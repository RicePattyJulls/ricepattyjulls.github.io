#### ATTACK (5 hosts)

[IT-EMPLOYEE15 to HR-ERIKA](/labs/gcb-lab/hosts/it-employee15-to-hr-erika)
→ previously obtained credentials for FINANCE\vanessa
→ access to `10.200.11.33 ~ HR-MAIL` over POP3
→ mailbox enumeration
→ Shadow IT infrastructure identified (erika, vanessa)
→ compromise of `10.200.11.24 ~ HR-ERIKA`
→ access to gcbhr.example

[HR-ERIKA](/labs/gcb-lab/hosts/hr-erika)  
→ `erika-admin` membership in `Organization Management`
→ `GenericAll` over `OU=Microsoft Exchange Security Groups`
→ group membership modification
→ added to Exchange Windows Permissions
→  `WriteDACL` inherited over `gcbhr.example`
→ replication rights assigned (Replicating Directory Changes*)
→ DCSync
→ krbtgt and Administrator credentials extracted
→ full compromise of `gcbhr.example`
→ 🔥 GCBHR FOREST OWNED

#### MITIGATION

```
[Initial access / HR-MAIL]
→ Restrict access to the POP3 service to only required users and segments
→ Avoid use of insecure or non-encrypted authentication protocols
→ Limit exposure of operational and user information through mail services
→ Control and restrict Shadow IT usage by users

[Identity / HR-ERIKA]
→ Rotate and protect credentials used by erika, vanessa, and related accounts
→ Limit local credential exposure on user workstations
→ Restrict administrative access on HR-ERIKA to authorized identities only

[Exchange / ACL abuse]
→ Remove GenericAll permissions over OU=Microsoft Exchange Security Groups from Organization Management where not strictly required
→ Restrict who can modify memberships in critical Exchange groups
→ Review delegated permissions associated with Exchange administrative groups
→ Prevent inheritance of dangerous privileges toward the domain

[DCSync / Domain control]
→ Limit replication privileges (Replicating Directory Changes*) to Domain Controllers only
→ Review and reduce implicit or inherited domain control paths through Exchange Windows Permissions
→ Audit accounts and groups with rights that can lead to domain-wide ACL modification
```

#### REMEDIATION

```
[Initial access / HR-MAIL]
→ Rotate credentials of exposed users (e.g., erika, vanessa)
→ Review access performed against HR-ERIKA
→ Validate integrity of the HR-MAIL server
→ Audit use of compromised accounts within gcbhr.example

[Exchange / Privilege escalation]
→ Revert unauthorized membership changes in Exchange Windows Permissions
→ Remove improper delegated permissions over OU=Microsoft Exchange Security Groups
→ Review and revert any unauthorized ACL modifications affecting the domain
→ Validate that no Exchange-related privilege escalation path remains active

[DCSync / Domain compromise]
→ Remove improperly assigned replication rights
→ Rotate compromised credentials, including krbtgt twice
→ Audit replication activity for possible prior DCSync operations
→ Review integrity of the gcbhr.example domain
→ Validate that no persistence remains through ACL abuse, group membership changes, or inherited Exchange permissions
```
