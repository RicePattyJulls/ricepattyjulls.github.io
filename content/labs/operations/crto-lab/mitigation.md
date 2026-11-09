This lab does not depend on a single exceptional weakness. It succeeds because several ordinary weaknesses align in sequence, allowing a low-trust foothold to become cross-domain administrative control. The mitigation strategy therefore should not focus on one control alone, but on breaking the chain at multiple points before it can compound.

### 1. Eliminate local administrator password reuse

The first meaningful step inside Dublin relied on a reusable local Administrator password across workstations. Once that assumption held, lateral movement became possible without needing a domain-level failure.

Mitigation priorities:

- deploy managed local administrator passwords
- remove shared static local admin credentials
- restrict administrative SMB access between workstations
- review whether local administrator accounts are still operationally required on user endpoints

### 2. Reduce token theft opportunities

The move from `DUB-WKSTN-1` into `DUB-WEB-1` depended on a high-value user context already being present on a lower-trust system. That made token theft and session abuse far more valuable than they should have been.

Mitigation priorities:

- avoid privileged logons on lower-trust endpoints
- separate administrative workstations from standard user workstations
- reduce interactive logon exposure for web admins and server operators
- enable stronger LSASS and credential protection controls where possible

### 3. Review constrained delegation aggressively

The web tier only became dangerous because it was allowed to act on behalf of users to the SQL tier. That transformed a server compromise into an identity-projection problem.

Mitigation priorities:

- inventory all `msDS-AllowedToDelegateTo` relationships
- remove unnecessary constrained delegation entries
- mark sensitive accounts as not delegable
- avoid designs where server machine accounts can impersonate high-value identities to backend services

### 4. Harden SQL execution surfaces

SQL access became host-level execution because CLR and custom assembly loading were sufficiently exposed to be operationally useful. That turned database administration into code execution on the server itself.

Mitigation priorities:

- keep CLR disabled unless there is a documented business requirement
- monitor and approve trusted assembly creation
- limit which principals can perform assembly-related administrative actions in SQL Server
- reduce the privilege available to database-facing identities wherever possible

### 5. Treat trust accounts and FSP mappings as sensitive material

The parent-domain step was possible because trust metadata and trust-account material could be converted into real access across a domain boundary. ForeignSecurityPrincipal mappings further increased the value of that access by turning trust relationships into practical privilege.

Mitigation priorities:

- monitor DCSync exposure closely
- restrict who can recover trust-account material
- audit ForeignSecurityPrincipal usage and group mappings
- review whether cross-domain entitlements still reflect operational need

### 6. Remove delegated overreach in the enclave

The enclave stopped being meaningfully isolated once `Enclave Access` and RBCD-related rights aligned. At that point, a restricted segment became reachable through delegated trust and write access rather than direct compromise.

Mitigation priorities:

- review who can write `msDS-AllowedToActOnBehalfOfOtherIdentity`
- minimize delegated local admin and delegated write paths in restricted segments
- validate GPO-driven group placement on enclave systems
- separate enclave access from general administrative convenience
