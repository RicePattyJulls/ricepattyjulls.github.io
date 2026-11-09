## 1. BASELINE (What exists in the environment?)

> `gcb.example` is the forest root domain and acts as the central relationship point between internal child domains and intra-forest escalation surfaces. Trust enumeration, delegation configuration, privileged groups, and critical assets make this domain a high-value strategic target for forest-wide control.

```powershell
distinguishedName : {DC=gcb,DC=local}
objectSid         : S-1-5-21-2781415573-3701854478-2406986946
name              : {gcb}
```

```powershell
IT             IT             gcb.example         \\10.200.9.2            IT
```

**Relevant Trusts**

1. `it.gcb.example` (child domain — same forest)

```powershell
name            : it.gcb.example
trustPartner    : it.gcb.example
trustDirection  : 3
trustAttributes : 32
trustType       : 2
flatName        : IT
```

- Type: `Intra-forest` (`trustAttributes = 32 → WITHIN_FOREST`)
- Operational impact: The relationship between `gcb.example` and `it.gcb.example` is transparent at the forest level. With valid credentials and sufficient privileges, cross-domain authentication is seamless and forest-internal trust abuse is possible without the restrictions typical of quarantined external trusts.
- Offensive implication: Compromising `it.gcb.example` can be projected toward `gcb.example` via `SIDHistory` / `ExtraSIDs` abuse once domain-level control is achieved.
- Conclusion: `it.gcb.example` is the primary indirect entry path to `gcb.example`, making the forest root a high strategic-value target.

| Area            | Key Findings |
| --------------- | ------------ |
| Domain / Forest | Forest root `gcb.example`. Single child domain: `it.gcb.example`. Two Global Catalogs identified (`gcb-dc.gcb.example` and `it-dc.it.gcb.example`). Intra-forest trust is bidirectional and transitive — full cross-domain authentication between domains. |
| Users           | 5 users total (3 enabled). Notable accounts: `Administrator`, `IT$`, `wsusadmin`. Multiple hygiene weaknesses: non-expiring passwords, stale `pwdLastSet` (>180 days), several accounts with no login history. `wsusadmin` indicates operational relevance as a WSUS service account. |
| Groups          | `Administrator` is the sole member of Domain Admins, Enterprise Admins, and Schema Admins. Most privileged groups are empty (`Account Operators`, `DnsAdmins`, `Backup Operators`), indicating low operational maturity but potential abuse surface if delegations are introduced later. |
| Hosts           | Minimal infrastructure: `GCB-DC` (Domain Controller) and `GCB-WSUS`. Both have stale machine passwords (>180 days). Small environment with credential reuse potential. |
| Password Policy | Weak: minimum length 7, complexity enabled, no lockout (`LockoutBadCount = 0`). Password spraying viable with no risk of lockout. |
| GPOs            | Only default GPOs present (`Default Domain Policy`, `Default Domain Controllers Policy`). No additional hardening configurations identified. |

## 2. IDENTITY (What can I do?)

No exploitable ACLs were identified during initial enumeration. The domain presents a clean delegated-permissions surface. Abuse vectors are focused on weak credentials and the intra-forest trust relationship with `it.gcb.example`.

## 3. ATTACK PATH (What am I going to do?)

> Priority target: `wsusadmin`. The account name suggests an administrative account associated with the WSUS server (`GCB-WSUS`), with high probability of operational use on that system, potential credential reuse, and value as a lateral movement target.

**Attack Threads**

- Escalate to Domain Admin in `gcb.example` → SIDHistory (ExtraSIDs) abuse → implicit Enterprise Admin → full forest compromise → access to `GCB-WSUS` → remote execution on critical WSUS infrastructure → in-memory credential extraction and further escalation

**Tactical Support**

- Weak password policy (`min length = 7`, no lockout, stale passwords) → favors password spraying
- Stale `pwdLastSet` values → credentials likely still valid → credential reuse probable
