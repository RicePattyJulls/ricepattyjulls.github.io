`enclave.example` is the restricted segment in the lab. It is small, but its access model is too generous once the correct identity arrives from the parent domain.

### Important host map

- `ENC-DC-1` → reference point for domain context
- `ENC-JMP-1` → first operational landing host
- `ENC-FS-1` → deeper enclave target reached through RBCD
### Enclave Access

Membership in `Enclave Access` gives effective administrative control on enclave systems where the GPO applies, and that access is what makes it possible to configure RBCD on `ENC-FS-1` from `ENC-JMP-1`.

That design creates a chain where:

- `Enclave Access` carries effective admin rights into the enclave
- `ngreen` inherits that access through group membership
- the trust makes those rights operational on enclave hosts
- `ENC-JMP-1` then becomes the platform used to identify and abuse RBCD control over `ENC-FS-1`
