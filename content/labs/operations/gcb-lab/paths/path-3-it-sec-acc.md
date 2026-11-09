#### ATTACK (3 hosts)



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

[IT-TRACK01 to SEC-SYSLOG01](/labs/gcb-lab/hosts/it-track01-to-sec-syslog01)
→ web enumeration
→ sensitive file identified
→ credentials discovered
→ access to `10.200.6.197 ~ SEC-SYSLOG01`
→ access to `gcbsec.example`

[SEC-SYSLOG01](/labs/gcb-lab/hosts/sec-syslog01)
→ LSASS dump
→ syslogagent credentials recovered
→ authenticated session established from `SEC-SYSLOG01`
→ remote access to `10.200.6.1 ~ SEC-DC`
→ 🔥 GCBSEC FOREST OWNED

[SEC-DC](/labs/gcb-lab/hosts/sec-dc)
→ Shadow Principal configuration identified
→ `accforest-ShadowEnterpriseAdmin` identified
→ syslogagent added as member
→ PAM-based cross-forest privilege materialization
→ remote authentication to `10.200.12.1 ~ ACC-DC07`
→ privileged access in `gcbacc.example`

[ACC-DC07](/labs/gcb-lab/hosts/acc-dc07)
→ lateral movement to `10.200.12.189 ~ ACC-DATA`
→ sensitive credential extraction
→ 🔥 GCBACC FOREST OWNED


> Objective achieved: `$objectivePart2 = REDACTED_OBJECTIVE`

#### MITIGATION

```
[Initial access / IT-TRACK01]
→ Restrict access to web resources exposing sensitive files
→ Remove credential exposure from web applications, files, endpoints, and logs
→ Limit access to sensitive content to authorized users only
→ Validate that no reusable credentials are accessible through the web layer

[Credential access / SEC-SYSLOG01]
→ Restrict access to LSASS to prevent in-memo- [ ] ATTACK (4 hosts)ry credential extraction
→ Enable protections that reduce credential exposure on critical systems
→ Limit administrative access on SEC-SYSLOG01 to strictly required identities only

[Privileged identities / PAM]
→ Restrict membership of highly privileged accounts (e.g., Enterprise Admins)
→ Review privileged account usage and reduce unnecessary interactive logon exposure
→ Review PAM / Shadow Principal configuration and remove unnecessary assignments
→ Restrict cross-forest privilege mappings to only approved administrative scenarios
→ Validate that shadow principals do not provide unnecessary standing access into critical roles in gcbacc.example

[Final access / ACC-DC07 → ACC-DATA]
→ Restrict lateral movement from Domain Controllers to non-critical systems
→ Limit access to sensitive resources (ACC-DATA) to strictly required accounts only
→ Avoid storing credentials, operational codes, or business secrets in plaintext on endpoint systems
→ Segment access between Domain Controllers and data servers
```

#### REMEDIATION

```
[Initial access / IT-TRACK01]
→ Remove exposed sensitive files from the web service
→ Rotate credentials discovered during web enumeration
→ Review access performed against SEC-SYSLOG01
→ Validate integrity of the compromised web service

[Credential access / SEC-SYSLOG01]
→ Rotate credentials for syslogagent and any related privileged accounts
→ Review potential credential exposure caused by LSASS access
→ Audit administrative logons and actions performed on SEC-SYSLOG01

[PAM / Cross-forest impact]
→ Review and correct PAM / Shadow Principal configuration (accforest-ShadowEnterpriseAdmin)
→ Audit cross-forest access into gcbacc.example
→ Validate that no unauthorized privileged mappings remain active
→ Review possible post-compromise access, lateral movement, or privilege abuse across the forest boundary

[Final access / ACC-DC07 → ACC-DATA]
→ Rotate exposed sensitive credentials or business secrets (e.g., escrow material)
→ Remove files or artifacts containing sensitive information from ACC-DATA
→ Review recent access from ACC-DC07 to ACC-DATA
→ Validate integrity of compromised systems
```
