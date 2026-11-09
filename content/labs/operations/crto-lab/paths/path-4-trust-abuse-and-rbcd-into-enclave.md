#### PATH SUMMARY

[LON-DC-1](/labs/crto-lab/hosts/lon-dc-1)
→ `foreignSecurityPrincipal` entries in the enclave are enumerated
→ the external SID is resolved back to `Enclave Access` in `contoso.example`
→ `ngreen` is identified as the relevant identity
→ `DCSync` against `CONTOSO\\ENCLAVE$` recovers trust-account material

[ENC-JMP-1](/labs/crto-lab/hosts/enc-jmp-1)
→ an inter-realm ticket projects CIFS access into the enclave
→ ACL discovery reveals `WriteProperty` over `msDS-AllowedToActOnBehalfOfOtherIdentity` on `ENC-FS-1`
→ RBCD is configured so `ENC-JMP-1$` can act on behalf of other users

[ENC-FS-1](/labs/crto-lab/hosts/enc-fs-1)
→ machine TGT from `ENC-JMP-1$` drives the S4U request
→ `Administrator` is impersonated against `cifs/enc-fs-1`
→ pass-the-ticket validates access to `\\enc-fs-1\c$`
→ SMB movement completes the final enclave pivot
