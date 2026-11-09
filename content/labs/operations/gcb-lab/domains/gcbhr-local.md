## 1. BASELINE (What exists in the environment?)

> `gcbhr.example` is a small, isolated domain with minimal infrastructure. Its offensive value lies not in volume but in a combination of poor operational hygiene, a deployed Exchange server, and dangerous ACL delegations on Exchange-related security groups. This makes `HR-MAIL` and Exchange-associated administrative identities the primary compromise axis.

```powershell
distinguishedname : DC=gcbhr,DC=local
name              : gcbhr
objectsid         : S-1-5-21-3602425948-896546556-3985009324
```

```powershell
HR        HR           gcbhr.example    \\10.200.11.1           HR
```

**Relevant Trusts**

No trust relationships with other domains were identified. `gcbhr.example` is a single-domain forest — all escalation must occur within the domain itself, with no intra-forest or cross-forest pivot options.

- Type: `Single-domain forest`
- Operational impact: No trust-based abuse surface exists
- Offensive implication: The attack path depends on:
    - valid credentials
    - internal ACL abuse
    - exposed services (primarily email / Exchange)
- Conclusion: Isolated domain — all relevant attack surface is internal

| Area                       | Key Findings |
| -------------------------- | ------------ |
| Domain / Forest            | `gcbhr.example` — single-domain independent forest. One Domain Controller (`HR-DC02` - 10.200.11.1), also serving as Global Catalog. Minimal infrastructure — DC compromise is a single point of failure for the entire domain. |
| Users                      | 16 users total, only 4 enabled. Single clear Tier-0 account: `Administrator`. Notable naming: `erika-admin`, `mailadmin`. 12 accounts with no login history and passwords >180 days old — poor identity hygiene. |
| Groups                     | Tier-0 groups (`Domain Admins`, `Enterprise Admins`, `Schema Admins`) contain only `Administrator`, reducing direct attack surface but concentrating all critical privileges in a single account. |
| Hosts                      | 3 hosts: `HR-DC02` (DC), `HR-MAIL`, `HR-ERIKA`. Machine account passwords not rotated since 2019 — indicative of poorly-managed or lab environment. `HR-MAIL` confirmed as a pivot vector via email services. |
| Password Policy            | Could not be retrieved via automated enumeration. Manual validation recommended — likely weak given the overall hygiene profile of the domain. |
| GPOs                       | Only default GPOs present (`Default Domain Policy`, `Default Domain Controllers Policy`). No additional hardening configurations — no specific defensive controls identified. |
| Exchange / Infrastructure  | Clear evidence of Exchange deployment (groups: `Exchange Servers`, `Organization Management`). Organization identified as `GCBFinance`. Exchange introduces ACL-based escalation vectors and email-based pivot via `HR-MAIL` (already leveraged during the compromise). |

## 2. IDENTITY (What can I do?)

**Relevant Offensive Capabilities**

1. `Organization Management` holds `GenericAll` over `OU=Microsoft Exchange Security Groups`, allowing modification of all objects contained within that OU, including critical Exchange groups.
2. If an account member of `Organization Management` (such as `erika-admin`) is compromised, it is possible to add it to groups like `Exchange Windows Permissions`.
3. `Exchange Windows Permissions` maintains the classic domain impact path via `WriteDACL` — this can be leveraged to assign replication permissions (`DCSync`) and achieve full domain compromise.
4. `HR-MAIL` represents a critical operational surface, both for email services and for the probability of hosting service credentials, artifacts, or privileged sessions.

**Technical Evidence — ACLs**

```powershell
----------------------------------------------------------------------
[+] ACL — Dangerous permissions over OUs
----------------------------------------------------------------------
Identity              : HR\Organization Management
SecurityIdentifier    : S-1-5-21-3602425948-896546556-3985009324-1108
ActiveDirectoryRights : GenericAll
ObjectAceType         :
ObjectDN              : OU=Microsoft Exchange Security Groups,DC=gcbhr,DC=local
ObjectSID             :
IsInherited           : False
AceFlags              : ContainerInherit
PropagationFlags      : None

Identity              : HR\Organization Management
SecurityIdentifier    : S-1-5-21-3602425948-896546556-3985009324-1108
ActiveDirectoryRights : GenericAll
ObjectAceType         : ms-Exch-Dynamic-Distribution-List
ObjectDN              : OU=Microsoft Exchange Security Groups,DC=gcbhr,DC=local
ObjectSID             :
IsInherited           : True
AceFlags              : ContainerInherit, Inherited
PropagationFlags      : None
```

**Operational Interpretation**

- The critical ACE is the non-inherited one (`IsInherited: False`) over the OU
- This makes `Organization Management` a valid escalation pivot point
- The expected offensive chain is:
    - compromise an account with membership in `Organization Management`
    - modify memberships within the Exchange OU
    - add to `Exchange Windows Permissions`
    - abuse `WriteDACL` over the domain
    - assign `DCSync` permissions

> `WriteDACL` on the domain by `Exchange Windows Permissions` → confirmed behavior (standard Exchange deployment risk)

**Capabilities Derived from the Compromised Identity**

- `erika-admin` can be materialized from `HR-ERIKA` following local credential harvesting
- `erika-admin` is a member of `Organization Management`
- This allows:
    - operating with its context in the domain
    - modifying memberships in sensitive Exchange groups
    - chaining the path toward `Exchange Windows Permissions`
    - deriving full domain control via replication permission delegation

## 3. ATTACK PATH (What am I going to do?)

> Priority target: `erika-admin`. Its membership in `Organization Management` allows abusing Exchange delegation to reach `Exchange Windows Permissions`, assign `DCSync` permissions, and obtain full control of `gcbhr.example`.

**Attack Threads**

1. Access `HR-ERIKA` → credential harvesting from memory / secrets → obtain `erika-admin` credentials
2. `erika-admin` → member of `Organization Management` → `GenericAll` over `OU=Microsoft Exchange Security Groups`
3. Modify group membership → add to `Exchange Windows Permissions`
4. `Exchange Windows Permissions` → `WriteDACL` over the domain → assign replication permissions (`DCSync`)
5. `DCSync` on `krbtgt` and `Administrator` → full domain compromise
6. Access / pivot to `HR-MAIL` as a complementary surface for credential hunting, email artifacts, and additional sensitive data

**Tactical Support**

- Small environment with no external trusts — all escalation is fully internal
- Low password rotation and low-activity accounts → high probability of credential reuse
- Exchange introduces a far richer delegated-privileges attack surface than the traditional AD hierarchy
