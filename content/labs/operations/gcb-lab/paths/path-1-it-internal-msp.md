#### ATTACK (8 hosts)

[IT-EMPLOYEE15 (Foothold)](/labs/gcb-lab/hosts/it-employee15)
→ membership in `ITEmployeesUsers`
→ `WriteProperty` over `LocalAdmins`
→ LAPS read access obtained
→ access to `10.200.9.121 ~ IT-APPSRV01`

[IT-APPSRV01](/labs/gcb-lab/hosts/it-appsrv01)
→ WSL identified
→ credentials recovered from a `.keytab` file
→ lateral movement to `10.200.9.51 ~ IT-SQLSRV02`

[IT-SQLSRV02](/labs/gcb-lab/hosts/it-sqlsrv02)
→ SPNs identified (MSSQLSvc)
→ Kerberoasting
→ credential reuse from `ConsoleHost_history.txt`
→ valid authentication to `10.200.8.10 ~ MSP-SQLREPORT`
→ access to `msp.example`

[MSP-SQLREPORT](/labs/gcb-lab/hosts/msp-sqlreport)
→ mspdb context obtained
→ `Self-Membership` over `ForestManagers`
→ privilege chaining
→ lateral movement to `10.200.8.75 ~ INTERNAL-SRV06`
→ access to `internal.msp.example`
→ Extra: we can also access [MSP-SRV01](/labs/gcb-lab/hosts/msp-srv01) (PSWA)

[INTERNAL-SRV06](/labs/gcb-lab/hosts/internal-srv06)
→ LSASS dump
→ batchsvc credentials recovered
→ lateral movement to `10.200.8.177 ~ INTERNAL-BATCH`

[INTERNAL-BATCH](/labs/gcb-lab/hosts/internal-batch)
→ KCD abuse + `TrustedToAuthForDelegation`
→ S4U impersonation
→ LDAP access to `10.200.8.2 ~ INTERNAL-DC01`
→ DCSync
→ krbtgt obtained
→ Golden Ticket + ExtraSID (EA `msp.example`)
→ intra-forest pivot
→ DCSync on `10.200.8.1 ~ MSP-DC01`
→ 🔥 MSP FOREST OWNED

> Objective achieved: `$objectivePart1 = REDACTED_OBJECTIVE`

#### MITIGATION

```
[ACLs / Identity]
→ Remove WriteProperty over LocalAdmins (ITEmployeesUsers)
→ Restrict modification of privileged group memberships

[LAPS]
→ Limit read access to ms-Mcs-AdmPwd to Tier 0 groups only
→ Audit access to LAPS attributes

[Credentials]
→ Avoid storing credentials in files (.keytab, history)
→ Apply system hardening (protect sensitive artifacts)

[Kerberos / SPN]
→ Review accounts with SPN (principle of least privilege)
→ Rotate service account credentials

[Delegation]
→ Restrict KCD (msDS-AllowedToDelegateTo)
→ Disable TrustedToAuthForDelegation where not required

[DCSync]
→ Limit replication privileges (Replicating Directory Changes*) to DCs only
```

#### REMEDIATION

```
[Initial access]
→ Remove unauthorized members from LocalAdmins
→ Force LAPS password rotation on affected systems

[Credentials]
→ Rotate exposed credentials (.keytab, history, service accounts)
→ Review credential reuse across systems

[Kerberoast]
→ Rotate compromised SPN accounts
→ Review issued tickets (TGS)

[Delegation]
→ Remove improper KCD configurations
→ Review accounts with TrustedToAuthForDelegation

[DCSync / Domain]
→ Rotate krbtgt account (twice)
→ Audit replication events (possible DCSync activity)
→ Review access to DCs (INTERNAL-DC01, MSP-DC01)

[Forest impact]
→ Validate absence of active Golden Tickets
→ Review persistence mechanisms (tickets, ACLs, added accounts)
```
