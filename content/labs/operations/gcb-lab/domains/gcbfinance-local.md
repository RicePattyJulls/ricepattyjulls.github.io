## 1. BASELINE (What exists in the environment?)

> `gcbfinance.example` operates as an external domain inside a PAM / bastion forest architecture, with a restricted trust relationship (`QUARANTINED_DOMAIN`). Exploitation does not depend on direct cross-forest trusts but on valid identities within the domain or pivots from connected environments.

```powershell
distinguishedName : DC=gcbfinance,DC=local
objectSid         : S-1-5-21-1708299476-1681750518-2103560891
name              : gcbfinance
```

```powershell
IT             IT             gcb.example         \\10.200.9.2
FINANCE        FINANCE        gcbfinance.example  \\10.200.10.1
```

**Relevant Trusts**

1. `it.gcb.example` (external trusted domain)

```powershell
name            : it.gcb.example
trustPartner    : it.gcb.example
trustDirection  : 3
trustAttributes : 4
trustType       : 2
flatName        : IT
SIDFiltering    : False
```

- Type: `Cross-forest` restricted trust (`trustAttributes = 516 → CROSS_ORGANIZATION + QUARANTINED_DOMAIN`)
- Operational impact: The trust is protected by `SID Filtering`, blocking privilege propagation between forests and preventing classic `SIDHistory` / `ExtraSIDs` attacks.
- Offensive implication: Direct escalation from `it.gcb.example` to `gcbfinance.example` is not possible via elevated privileges in the source domain alone. Exploitation requires:
    - valid credentials within `gcbfinance.example`
    - access to hosts with real connectivity to the domain
    - internal ACL, delegation, or credential abuse
- Conclusion: Highly restricted trust. Not a direct cross-forest escalation vector.

| Area            | Key Findings |
| --------------- | ------------ |
| Users           | 6 users total (4 enabled). Notable accounts: `Administrator`, `vanessa`, `vanessa-admin`, and machine account `IT$`. Multiple hygiene weaknesses: non-expiring passwords, stale `pwdLastSet` (>180 days), 3 accounts with no login history. `vanessa-admin` suggests a delegated administrative account. |
| Groups          | `Administrator` is the sole member of Domain Admins, Enterprise Admins, and Schema Admins. 37 groups are empty (including `Account Operators`, `DnsAdmins`, `Backup Operators`), reflecting a lightly-used environment but with potential abuse surface if ACL misconfigurations exist. |
| Hosts           | Only 2 hosts: `FINANCE-DC01` (Domain Controller) and `FINANCE-VANESSA`. Both have stale machine passwords (>180 days). Critical configuration: both have Unconstrained Delegation enabled (`TRUSTED_FOR_DELEGATION`). |
| Password Policy | Weak: minimum length 7, complexity enabled, no lockout (`LockoutBadCount = 0`). Password spraying viable with no risk of lockout. |
| GPOs            | Only default GPOs present (`Default Domain Policy`, `Default Domain Controllers Policy`). No additional hardening observed. |

## 2. IDENTITY (What can I do?)

No exploitable ACLs were identified during initial enumeration. The domain presents a clean delegated-permissions surface. Abuse vectors are focused primarily on Kerberos delegation and weak credentials rather than ACL misconfigurations.

## 3. ATTACK PATH (What am I going to do?)

> The target is not to escalate directly from `it.gcb.example` — the quarantined trust prevents that. The approach is to reach a valid identity inside `gcbfinance.example` and abuse delegation configured on domain hosts.

**Attack Threads**

1. Access `FINANCE-VANESSA` → JEA endpoint (`ITAccess`) → restricted execution abuse → local execution context
2. `FINANCE-VANESSA$` has Unconstrained Delegation → capture TGT of authenticating users → impersonation via Pass-the-Ticket → full domain compromise → credential / ticket reuse → lateral movement

**Tactical Support**

- Weak password policy (`LockoutBadCount = 0`) → password spraying viable → initial access
- Stale `pwdLastSet` values → credentials likely still valid → credential reuse
