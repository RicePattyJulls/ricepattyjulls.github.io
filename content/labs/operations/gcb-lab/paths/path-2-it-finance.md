#### ATTACK

[IT-EMPLOYEE15 (Foothold)](/labs/gcb-lab/hosts/it-employee15)
→ machine account context available as `IT-EMPLOYEE15$`
→ membership in `ITEmployeesMachines`
→ `GenericWrite` over `IT-TRACK01`
→ Kerberos context established for `IT-EMPLOYEE15$`
→ controlled machine account `it-attack01$` created
→ RBCD configured on `IT-TRACK01` via `PrincipalsAllowedToDelegateToAccount`
→ SPNs for `IT-TRACK01` identified
→ NTLM hash obtained for `it-attack01$`
→ S4U abuse performed to impersonate `Administrator`
→ access to `10.200.9.111 ~ IT-TRACK01`

[IT-TRACK01 to FINANCE-VANESSA](/labs/gcb-lab/hosts/it-track01-to-finance-vanessa)
→ exposed web service identified
→ enumeration + sniffing / MITM
→ cleartext credentials recovered
→ access to `10.200.10.14 ~ FINANCE-VANESSA`
→ access to `gcbfinance.example`
→ Extra: we can also access [MSP-SRV01](/labs/gcb-lab/hosts/msp-srv01) (PSWA)

[FINANCE-VANESSA](/labs/gcb-lab/hosts/finance-vanessa)
→ JEA endpoint identified (`ITAccess`)
→ JEA abuse
→ SDDL modification via `Set-PSSessionConfiguration`
→ access to `ITAdmin` endpoint (`RunAs: vanessa-admin`)
→ local administrator privilege escalation
→ JEA escape via `microsoft.powershell32`
→ Unconstrained Delegation abuse
→ coercion of `10.200.10.1 ~ FINANCE-DC01`
→ TGT capture
→ Pass-the-Ticket
→ DCSync
→ 🔥 GCBFINANCE FOREST OWNED


#### MITIGATION

```
[Initial access / IT-TRACK01]
→ Restrict exposure of the web service (only required access / basic segmentation)
→ Prevent transmission of credentials in cleartext (use secure channels)
→ Limit sniffing / MITM opportunities (network isolation between sensitive segments)
→ Remove insecure storage or transmission of credentials

[JEA]
→ Restrict who can modify JEA endpoint configurations (Set-PSSessionConfiguration)
→ Limit access to the ITAdmin endpoint to authorized identities only
→ Avoid using real privileged accounts in RunAs; prefer virtual accounts or minimum-privilege JEA configurations
→ Review endpoint SDDL and session configuration permissions regularly

[Delegation]
→ Disable Unconstrained Delegation on non-critical systems
→ Mark sensitive accounts as "Account is sensitive and cannot be delegated"
→ Review systems configured for delegation and reduce exposure wherever possible

[DCSync]
→ Restrict replication privileges (Replicating Directory Changes*) to strictly required accounts only
→ Audit delegation of replication rights across the domain
```

#### REMEDIATION

```
[Initial access / IT-TRACK01]
→ Rotate credentials exposed during sniffing / MITM
→ Review access performed against FINANCE-VANESSA
→ Validate integrity of the compromised web service
→ Remove artifacts that may have captured or exposed credentials

[JEA]
→ Restore the original configuration of JEA endpoints (ITAccess / ITAdmin)
→ Remove unauthorized access to the ITAdmin endpoint
→ Review SDDL changes and revert unauthorized modifications
→ Validate that no insecure RunAs configuration remains in place

[Delegation / Domain]
→ Rotate compromised credentials (vanessa-admin and any related accounts)
→ Rotate the krbtgt account twice to invalidate forged or stolen tickets
→ Audit Domain Controller access for possible prior DCSync activity
→ Review systems affected by Unconstrained Delegation abuse
→ Validate that no persistence remains through tickets, delegated access, or modified session configurations
```
