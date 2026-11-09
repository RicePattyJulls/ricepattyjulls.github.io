![Mapa de relaciones y pivotes entre los siete bosques del laboratorio](/images/labs/gcb-lab/trust-map.svg)

## 1. ENVIRONMENT COMPROMISE SUMMARY

`it.gcb.example` acts as the foothold domain and the main attack origin. From there, the compromise expands in five major directions:

1. `it.gcb.example` → `gcb.example` through `WriteDACL`, `DCSync`, and `Golden Ticket + ExtraSID`
2. `it.gcb.example` → `msp.example` / `internal.msp.example` through credential reuse, ACL chaining, and `KCD`
3. `it.gcb.example` → `gcbfinance.example` through HTTP credential capture, `JEA`, and `Unconstrained Delegation`
4. `it.gcb.example` → `gcbsec.example` → `gcbacc.example` through exposed artifacts, local account abuse, and `PAM Shadow Principal`
5. `gcb.example` → `gcbvault.example` through `WSUS` and Hyper-V level control
6. `it.gcb.example` / mail pivot → `gcbhr.example` through Exchange ACL abuse and `DCSync`

## 2. HIGH-LEVEL PROGRESSION

### Forest 1 — gcb.example

- `IT-EMPLOYEE15`
- `IT-APPSRV01`
- `IT-SQLSRV02`
- `IT-TRACK01`
- `IT-PREPROD`
- `IT-DC`
- `GCB-DC`
- `GCB-WSUS`

### Forest 2 — msp.example

- `MSP-SQLREPORT`
- `MSP-SRV01`
- `MSP-DC01`
- `INTERNAL-SRV06`
- `INTERNAL-BATCH`
- `INTERNAL-DC01`

### Forest 3 — gcbfinance.example

- `FINANCE-VANESSA`
- `FINANCE-DC01`

### Forest 4 — gcbsec.example

- `SEC-SYSLOG01`
- `SEC-DC`

### Forest 5 — gcbacc.example

- `ACC-DC07`
- `ACC-DATA`

### Forest 6 — gcbvault.example

- `VAULT-SRV`
- `VAULT-DC`
- `VAULT-DB`

### Forest 7 — gcbhr.example

- `HR-MAIL`
- `HR-ERIKA`
- `HR-DC02`

## 3. DOMINANT ABUSE PRIMITIVES

- ACL abuse on groups, domain roots, and Exchange-related objects
- LAPS read through delegated permissions
- `RBCD`, `KCD`, and `Unconstrained Delegation`
- `DCSync` and `Golden Ticket + ExtraSID`
- `PAM` / Shadow Principal privilege materialization
- `WSUS` as a segmentation bypass channel
- Hyper-V / offline disk access against a virtualized Domain Controller

## 4. OPERATIONAL TAKEAWAY

This environment is not interesting because of raw size alone. It is interesting because each forest requires a different compromise model:

- classical AD ACL abuse
- Kerberos delegation abuse
- trust-boundary manipulation
- bastion / PAM privilege projection
- management-plane abuse
- virtualization-layer compromise

That combination is what gives the lab its real depth.
