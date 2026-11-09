#### ATTACK (5 hosts)

[IT-EMPLOYEE15 to IT-DC](/labs/gcb-lab/hosts/it-employee15-to-it-dc)
→ `orgadmin` member of `OrganizationAdmins`
→ `WriteDACL` over `it.gcb.example`
→ DCSync
→ krbtgt credentials obtained
→ Golden Ticket + ExtraSID (EA root)
→ intra-forest pivot
→ DCSync against `10.200.9.1 ~ GCB-DC`
→ full compromise of the `gcb.example` forest
→ 🔥 GCB FOREST OWNED
→ access to `10.200.9.3 ~ GCB-WSUS`

[GCB-WSUS](/labs/gcb-lab/hosts/gcb-wsus)
→ WSUS role identified
→ `10.200.7.1 ~ VAULT-SRV` detected as a managed client
→ trusted update channel abused
→ malicious update injected
→ remote code execution (RCE)
→ network segmentation bypass
→ pivot into the isolated segment
→ access to `gcbvault.example`

[VAULT-SRV](/labs/gcb-lab/hosts/vault-srv)  
→ Hyper-V role identified
→ `10.200.7.2 ~ VAULT-DC` VM identified
→ virtual disk (`.vhdx`) located
→ offline access to the Domain Controller system
→ extraction of NTDS.dit + SYSTEM hive
→ domain credentials obtained
→ compromise of `gcbvault.example`
→ credential reuse
→ access to `10.200.7.3 ~ VAULT-DB`
→ exposure of sensitive information
→ 🔥 GCBVAULT FOREST OWNED

#### MITIGATION

```
[WSUS / Initial pivot]
→ Restrict administrative access to the WSUS server to Tier 0 identities only
→ Limit who can create, modify, and approve updates
→ Prevent execution of unauthorized tools or scripts on the WSUS server
→ Restrict interactive access to the WSUS server to avoid its use as a pivot point
→ Validate that only authorized computer groups receive update approvals and deployments

[Segmentation / Trust in update infrastructure]
→ Avoid using WSUS as a bridge between isolated segments
→ Limit management reachability between update infrastructure and sensitive environments
→ Review which clients are allowed to receive updates from each WSUS instance

[Hyper-V / Virtualization layer]
→ Restrict administrative access to the Hyper-V host to Tier 0 identities only
→ Limit who can manage virtual machines and virtual disks
→ Prevent unauthorized access to .vhdx files and VM storage paths
→ Separate virtualization administration from general server administration
→ Avoid reuse of privileged credentials across Hyper-V hosts, DCs, and database systems

[Credential hygiene]
→ Prevent storage or reuse of privileged credentials across critical systems
→ Limit local administrative access on systems hosting sensitive infrastructure
```

#### REMEDIATION

```
[WSUS / Initial pivot]
→ Remove malicious updates injected into WSUS
→ Review recent update approvals and deployment history
→ Audit client systems affected by the malicious deployment (e.g., VAULT-SRV)
→ Rotate credentials potentially exposed through WSUS access
→ Validate integrity of the WSUS server

[Hyper-V / Domain compromise]
→ Rotate compromised domain credentials, including krbtgt twice
→ Rotate reused credentials (e.g., vaultdbadmin)
→ Review integrity of the Domain Controller (VAULT-DC)
→ Review and remove artifacts generated during access to the virtual disk (.vhdx), including mounts, copies, or offline dumps

[Database / Business impact]
→ Rotate or invalidate exposed sensitive information used in business operations
→ Audit access to VAULT-DB and related systems
→ Validate that no persistence remains on VAULT-SRV, VAULT-DC, or VAULT-DB
```
