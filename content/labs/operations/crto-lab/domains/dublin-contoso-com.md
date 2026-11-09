`DUBLIN.contoso.example` is the primary operating domain in the lab. It contains the workstations, web tier, SQL tier, and the child-domain controller that carry the first three paths.

### Trusts

```powershell
# Enumerates the domain trust relationships
ldapsearch (objectClass=trustedDomain) --attributes name,flatName,trustPartner,trustType,trustAttributes,trustDirection
# trustPartner: contoso.example (root domain)
# trustDirection: 3 (bidirectional)
# trustType: 2 (external/forest trust)

# Enumerates trust-type accounts (inter-domain trust accounts)
ldapsearch (samAccountType=805306370) --attributes samAccountName
# CONTOSO$
```

- A trust relationship exists with `contoso.example`, which corresponds to the root domain.
- The trust is **bidirectional** (`trustDirection: 3`), meaning both sides recognize authentication relationships across the boundary.
- The domain exposes a **trust account** (`CONTOSO$`), confirming that the relationship is implemented at the Active Directory level and is not just conceptual.
- From an offensive perspective, this trust creates a possible path for **lateral movement or privilege projection** into the root domain, provided valid identities, trust material, or abuse of the trust can be obtained.
### Important host map

- `DUB-WKSTN-2` → initial foothold as `consultant`
- `DUB-WKSTN-1` → internal bridge through local admin reuse and token theft
- `DUB-WEB-1` → constrained-delegation host trusted to reach MSSQL
- `DUB-SQL-1` → SQL execution surface and later SYSTEM pivot
- `DUB-DC-1` → child-domain controller and source of domain-level material

### Identity takeaways

- `consultant` initial user
- `mssqlsvc` belongs to `Domain Users`
- `tdobson` belongs to `Workstation Admins` and `Web Admins`
- `etate` belongs to `Workstation Admins` and `Web Admins`
- `iappleton` belongs to `SQL Admins`
- `nwallace` belongs to `Domain Admins`

> no directly exploitable user ACL path was identified during baseline LDAP discovery

### Dead end worth noting

```powershell
# Enumerates SPNs associated with the mssqlsvc service account
ldapsearch "(sAMAccountName=mssqlsvc)" --attributes servicePrincipalName,sAMAccountName
# MSSQLSvc/dub-sql-2.dublin.contoso.example
# MSSQLSvc/dub-sql-2
```

> Rabbit hole → `dub-sql-2` does not exist → non-exploitable SPN

### Kerberos delegation

```powershell
ldapsearch "(sAMAccountName=DUB-WEB-1$)" --attributes msDS-AllowedToDelegateTo,sAMAccountName
# sAMAccountName: DUB-WEB-1$
# mSDS-AllowedToDelegateTo: MSSQLSvc/dub-sql-1.dublin.contoso.example:1433, MSSQLSvc/dub-sql-1.dublin.contoso.example
```

`DUB-WEB-1$` can delegate to MSSQL → direct Constrained Delegation vector

### GPO and OU context

| Scope | Operational meaning |
| --- | --- |
| `Default Domain Policy` | Global password and machine-account behavior applies across the child domain. |
| `OU=Domain Controllers` | `Default Domain Controllers Policy` applies to `DUB-DC-1`. |
| `OU=Workstations` | `AppLocker` and `Workstation Admins` apply to `DUB-WKSTN-1` and `DUB-WKSTN-2`. |
| `OU=Web` | `Web Admins` exists, but there are no computers in the OU, so the policy has no practical impact. |
| `OU=SQL` | No meaningful GPO is applied to the SQL OU. |

#### Applocker

1. APPX: only signed packaged apps (APPX/MSIX) can run. (Because the rule is a FilePublisherRule with `PublisherName="*"` → it requires a signature).
2. DLL: there are no restrictions. (`EnforcementMode="NotConfigured"` → AppLocker does NOT enforce DLL rules). Any DLL—signed or unsigned—loads without being blocked, including via LOLBAS (rundll32, regsvr32, etc.)
3. EXE: only binaries located in `%PROGRAMFILES%` and `%WINDIR%` can run (there are only `FilePathRules` → signature does NOT matter), except for paths with explicit `Deny` rules, which always take precedence: `%WINDIR%\Temp\*`, `%WINDIR%\Tasks\*` (including `C:\Windows\System32\Tasks\`), and `%SYSTEM32%\spool\*`)
4. MSI: the following are allowed: signed MSI files (FilePublisherRule with `PublisherName="*"` → signature required). MSI files inside `%WINDIR%\Installer*` (FilePathRule)
5. SCRIPT: only scripts inside `%PROGRAMFILES%` or `%WINDIR%`. (There are no publisher rules → signature does not matter, only the path)

### Policy findings with offensive value

- minimum password length is only 7 characters
- there is no lockout threshold, so password spraying remains viable
- machine accounts do not rotate passwords (`REDACTED_SECRET`)
- AppLocker restricts EXE and script paths on workstations, but DLL enforcement is not configured
- `Workstation Admins` (`etate`, `tdobson`) become local administrators on both Dublin workstations
