## Overview

Four PowerShell modules built from CARTE lab work that cover the full offensive Entra ID workflow. They are designed to work sequentially: token acquisition feeds reconnaissance, reconnaissance feeds identity analysis, identity analysis feeds targeted abuse. No module requires knowledge of the others' internals — each accepts tokens as input and produces structured output for the next phase.

All code lives on GitHub. This page is the operator reference — purpose, inputs, outputs, and workflow.

---

## Module 01 — `get_token.ps1`

**Purpose:** Multi-flow token acquisition for any Azure/Entra ID resource. The starting point for all other operations.

**Supported acquisition flows:**

| Flow | When to use |
|---|---|
| Device Code Flow (DCF) | Phishing-based acquisition — victim authenticates, token arrives on attacker side |
| ROPC | Username + password directly to token endpoint — legacy tenants without strong CA |
| Auth code | Interactive browser flow with redirect capture |
| Client credentials (secret) | Service Principal authentication with a known secret |
| Client credentials (certificate) | Service Principal authentication with a PFX certificate |
| Browser extraction | Extract cached tokens from browser storage on a compromised machine |
| IMDS | Managed Identity token from within Azure compute |
| FOCI pivot | Reuse an existing FOCI-eligible refresh token against a different resource scope |

**Inputs:**
- Flow type (flag or parameter)
- Tenant ID (or `common` for multi-tenant flows)
- Client ID (for credential-based flows)
- Secret, certificate path, or existing refresh token (flow-dependent)
- Target resource scope (ARM, Graph, Key Vault, Storage, etc.)

**Outputs:**
- Access token (JWT) for the requested resource
- Refresh token (if `offline_access` was included in scope)
- FOCI eligibility flag (`foci: 1` detection)
- Token metadata: expiry, audience, identity (`upn`, `oid`), scopes

**Example workflow:**
```
# DCF phishing — token lands here when victim authenticates
get_token -Flow DCF -TenantId common -ClientId <FOCI_CLIENT_ID> -Scope graph
# → $AT, $RT, FOCI confirmed

# FOCI pivot — no re-authentication, different resource
get_token -Flow FOCI -RefreshToken $RT -ClientId <FOCI_CLIENT_ID> -Scope arm
# → $ARM_AT for further recon and abuse
```

**GitHub:** → [Operator Toolkit / get_token.ps1]

---

## Module 02 — `recon.ps1`

**Purpose:** Tenant-level attack surface mapping. Enumerates the structural and policy surface of an Entra ID tenant using a Graph and/or ARM token.

**What it maps:**

| Area | Detail |
|---|---|
| Users | All users, privileged users, hybrid-synced users, external guests |
| Groups | Group membership chains, dynamic groups, role-assignable groups |
| Applications | App registrations, service principals, FOCI-eligible apps |
| RBAC | Role assignments across subscriptions — Owner, Contributor, custom roles |
| Conditional Access | All CA policies: state, conditions, grant controls, excluded apps/users |
| PIM | Eligible role assignments for all principals |
| Managed Identities | System-assigned and user-assigned MIs with their RBAC assignments |

**Inputs:**
- Graph access token (for identity and policy mapping)
- ARM access token (for RBAC and subscription mapping)
- Optional: scope filter (specific user, group, application)

**Outputs:**
- Structured inventory of the tenant attack surface
- CA policy gap analysis (excluded apps, excluded users, unprotected flows)
- High-value target list: privileged identities, over-privileged SPs, ungated resources

**GitHub:** → [Operator Toolkit / recon.ps1]

---

## Module 03 — `entraId.ps1`

**Purpose:** Per-principal deep-dive. Given any identity (user, service principal, or managed identity), maps its complete privilege surface — the full picture of what that identity can do.

**What it analyzes:**

| Surface | Detail |
|---|---|
| Directory roles | Active and PIM-eligible assignments, scope per role |
| Group memberships | Direct and transitive, including role-assignable groups |
| App permissions | Delegated and application (app role) permissions consented or granted |
| Azure RBAC | ARM role assignments across all subscriptions and resource groups |
| Key Vault access | Access policies and RBAC on vault resources |
| Owned objects | Applications and service principals owned by this identity |
| OAuth consents | Grants made or received — third-party apps with delegated access |

**Inputs:**
- Target principal identifier (UPN, Object ID, App ID, or `me` for the token identity)
- Graph access token
- ARM access token (for RBAC surface)

**Outputs:**
- Full privilege map for the target identity
- Non-obvious paths: transitive group memberships, owned SPs with broad permissions
- Abuse recommendations based on discovered surface

**Example workflow:**
```
# After recon flags an identity as interesting
entraId -Identity <user@tenant.com> -GraphToken $AT -ARMToken $ARM_AT
# → full privilege surface: roles, groups, app perms, RBAC, consents
# → feeds directly into ex_entraId for abuse operations
```

**GitHub:** → [Operator Toolkit / entraId.ps1]

---

## Module 04 — `ex_entraId.ps1`

**Purpose:** Abuse module. Chains the privilege surface identified by `entraId` to targeted abuse operations — operates on what the identity actually has, not blind spraying.

**Supported operations:**

| Operation | Prerequisite |
|---|---|
| PIM role activation | Eligible assignment confirmed by entraId |
| Group membership add/remove | Group ownership or Group Administrator role |
| App secret addition | Application ownership or Application Administrator role |
| OAuth consent grant | Global Administrator or sufficient consent policy permissions |
| Password reset | User Administrator or Helpdesk Administrator scope |
| TAP issuance | Authentication Administrator scope |
| Token pivot | FOCI-eligible RT in session |
| Cross-tenant auth | B2B presence confirmed in target tenant |

**Inputs:**
- Target identity surface (output from entraId)
- Specific operation to perform
- Access tokens (Graph, ARM — as required by operation)
- Operation parameters (role ID, group ID, target user, etc.)

**Outputs:**
- Operation result and confirmation
- New credential material if applicable (new app secret, activated role, issued TAP)
- Updated token material if pivot was performed

**Example workflow:**
```
# entraId found: eligible PIM role + group ownership + owned SP
ex_entraId -Operation ActivatePIM -RoleId <ROLE_ID> -Scope / -Duration PT1H
# → role active for 1 hour

ex_entraId -Operation AddGroupMember -GroupId <GROUP_ID> -TargetId <CONTROLLED_USER>
# → controlled identity now inherits group permissions

ex_entraId -Operation AddAppSecret -AppObjectId <APP_OBJECT_ID>
# → new client secret → authenticate as Service Principal
```

**GitHub:** → [Operator Toolkit / ex_entraId.ps1]

---

## Recommended Workflow

```
get_token (DCF / ROPC / cert)
     ↓ AT + RT
recon (tenant mapping, CA gaps, privileged identities)
     ↓ target selection
entraId (per-principal privilege surface)
     ↓ abuse surface mapped
ex_entraId (targeted operations based on what's available)
     ↓ new privileges / credentials / lateral movement
loop back to get_token → recon → entraId with elevated access
```

All tools accept piped token input. Running the full chain from initial access to maximum privilege takes 4 sequential invocations with minimal manual steps.

## Notes

- Tokens are short-lived (~1 hour). Re-run `get_token -Flow FOCI -RefreshToken $RT` to refresh without re-phishing.
- The output of `entraId` is structured JSON — pipe it directly to `ex_entraId` for automated abuse path selection.
- All modules write structured logs. Run with `-Verbose` for per-step API call details; use `-Quiet` for minimal output in automated pipelines.
- **Code is on GitHub** — this page is reference only. No scripts are embedded in this portfolio.
