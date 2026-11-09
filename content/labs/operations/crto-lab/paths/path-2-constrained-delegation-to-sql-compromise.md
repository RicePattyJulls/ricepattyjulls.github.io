#### PATH SUMMARY

[DUB-WEB-1](/labs/crto-lab/hosts/dub-web-1)
→ SQL service details enumerated from the web-tier foothold
→ `DUB-WEB-1$` shown to be trusted for delegation to `MSSQLSvc`
→ Kerberos S4U abuse used to impersonate `iappleton`

[DUB-SQL-1](/labs/crto-lab/hosts/dub-sql-1)
→ `sql-info` confirms `CurrentLogin : DUBLIN\\iappleton → IsSysAdmin : True` establishes meaningful SQL control
→ CLR enabled and a custom assembly loaded
→ Beacon linked back into Cobalt Strike
→ SQL context escaped to `SYSTEM`

This path is where service trust is converted into practical operator control. `DUB-WEB-1` stops being just another internal server and becomes the platform that can project real privilege into the SQL tier, first through delegated identity abuse and then through direct execution on the host itself.
