## 1. BASELINE (What exists in the environment?)

> `gcbacc.example` is an extremely small domain with near-zero operational activity. Its offensive relevance is not in its internal attack surface but in its `PAM` / `PIM` forest trust with `gcbsec.example`, which introduces a critical cross-forest compromise path based on externally-defined privileged identities.

```powershell
distinguishedName : DC=gcbacc,DC=local
objectSid         : S-1-5-21-3331877400-209796306-1317730910
name              : gcbacc
```

```powershell
ACC      ACC          gcbacc.example   \\10.200.12.1          ACC
```

**Relevant Trusts**

1. `gcbsec.example` (forest trust outbound + PAM)

```powershell
name            : gcbsec.example
trustPartner    : gcbsec.example
trustDirection  : 2
trustAttributes : 1096
trustType       : 2
flatName        : SEC
```

- Type: `Forest Trust` with `PAM` (`trustAttributes = 1096 → FOREST_TRANSITIVE + PIM`)
- Operational impact: `gcbacc.example` maintains an outbound trust toward `gcbsec.example`, meaning privileged identities defined in the trusted forest can materialize privileges within this domain.
- Conclusion: `gcbacc.example` acts more as a target domain than an escalation origin. The actual compromise occurs in `gcbsec.example` and is projected here via PAM Shadow Principals.

| Area            | Key Findings |
| --------------- | ------------ |
| Users           | Only 3 users (1 active): `Administrator`. `Guest` and `krbtgt` are disabled. Minimal activity, stale passwords (>180 days), no operational accounts. |
| Groups          | `Administrator` is the sole member of all Tier-0 groups (`Domain Admins`, `Enterprise Admins`, `Administrators`, `Schema Admins`). No members in `Account Operators`, `DnsAdmins`, or `Server Operators`. |
| Hosts           | Only 2 hosts: `ACC-DC07` (Domain Controller) and `ACC-DATA`. Both have stale machine passwords (>180 days). |
| Password Policy | Stale passwords with no rotation observed — low operational hygiene, credential reuse likely. No lockout configured. |
| Forest / Trusts | `gcbacc.example` is the forest root. Outbound forest trust with `gcbsec.example` using PAM (`trustAttributes=1096`). Cross-forest privileged access is mediated via Shadow Principals defined in the trusted forest. |

## 2. IDENTITY (What can I do?)

No exploitable ACLs were identified during initial enumeration. The domain surface is minimal and offers no relevant internal escalation paths. At this stage, ACL enumeration is not a priority — privileged access to `ACC-DC07` is already materialized via PAM projection from `gcbsec.example`, providing full operational control over `gcbacc.example`.

## 3. ATTACK PATH (What am I going to do?)

> No new escalation path within `gcbacc.example` is required. Privileged access was already projected from `gcbsec.example` via `PAM` / Shadow Principals and is materialized directly on the Domain Controller.

**Attack Threads**

- `ACC-DC07` (Domain Controller) → full domain control → direct access to credentials, tickets, and secrets → lateral movement to `ACC-DATA` → host with potential sensitive data artifacts

**Tactical Support**

- Access already materialized on the Domain Controller
- Extremely small domain — any high privilege immediately implies full domain control
- `ACC-DATA` is the next operational target within the production environment
