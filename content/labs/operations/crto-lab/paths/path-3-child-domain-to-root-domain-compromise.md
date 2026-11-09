#### PATH SUMMARY

[DUB-SQL-1](/labs/crto-lab/hosts/dub-sql-1)
→ `SYSTEM` context established after escaping the SQL service
→ `nwallace` token recovered from the SQL host
→ administrative access toward the child-domain controller becomes viable

[DUB-DC-1](/labs/crto-lab/hosts/dub-dc-1)
→ DPAPI backup key extracted
→ protected credentials recovered
→ `DCSync` against `DUBLIN\\krbtgt` provides Golden-Ticket material

[LON-DC-1](/labs/crto-lab/hosts/lon-dc-1)
→ forged ticket includes the parent-domain privilege projection
→ administrative reach into the root-domain controller is validated

This path is where host-level control becomes domain-level and then forest-level leverage. Compromising `DUB-SQL-1` is operationally valuable, but the real strategic shift happens when that access is extended into the child-domain controller and then projected into the root domain. That transition is what gives the campaign broader identity authority and makes the later movement into the enclave possible.
