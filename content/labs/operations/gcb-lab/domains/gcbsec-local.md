## 1. BASELINE (What exists in the environment?)

> `gcbsec.example` is identified as a security-function domain within the infrastructure. This implies a higher probability of privileged accounts, additional controls, and high-value identities. Exploitation depends primarily on obtaining a valid identity within the domain, not on direct trust relationships.

```powershell
distinguishedName : DC=gcbsec,DC=local
objectSid         : S-1-5-21-4056425676-3036975250-1243519898
name              : gcbsec
```

```powershell
SEC      SEC          gcbsec.example   \\10.200.6.1          SEC
```

**Relevant Trusts**

1. `gcbacc.example` (forest trust inbound)

```powershell
name            : gcbacc.example
trustPartner    : gcbacc.example
trustDirection  : 1
trustAttributes : 8
trustType       : 2
flatName        : ACC
SIDFiltering    : False
```

- Type: `Forest trust inbound` (`trustDirection = 1`, `trustAttributes = 8 → FOREST_TRANSITIVE`)
- Operational impact: `gcbacc.example` trusts `gcbsec.example`, meaning authenticated identities in the bastion forest (`gcbsec.example`) can materialize administrative access over resources in the production forest (`gcbacc.example`), provided PAM configurations, connectivity, and effective authorization over target resources are in place.
- Offensive implication: The offensive value of this trust lies in compromising `gcbsec.example` to project administrative access onto `gcbacc.example`. The inverse direction is not useful.
- Exploitation requirements:
    - Prior compromise of a privileged or delegated identity in `gcbsec.example`
    - Functional PAM / Shadow Principal configuration
    - Effective connectivity from `gcbsec.example` to `gcbacc.example` resources
    - Materializable privileges over the production domain
- Conclusion: High-value offensive trust. Compromise of `gcbsec.example` can translate directly into effective access over `gcbacc.example`.

| Area              | Key Findings |
| ----------------- | ------------ |
| Users             | 7 users total (5 active): `Administrator`, `secadmin`, `syslogagent`, `logagent`, `ACC$`. Both `Administrator` and `syslogagent` are members of Enterprise Admins (Tier 0). `syslogagent` and `logagent` appear to be service-oriented accounts. 5 accounts have `DONT_EXPIRE_PASSWORD` set, several with no password rotation in >180 days. |
| Groups            | `syslogagent` is a member of Enterprise Admins and Administrators — full forest control from that identity. `Administrator` also holds multiple Tier-0 group memberships. No members in `Account Operators`, `Server Operators`, or `DnsAdmins`. |
| Hosts             | Only 2 hosts: `SEC-DC` (Domain Controller) and `SEC-SYSLOG01`. Both have stale machine passwords (>180 days). |
| Password Policy   | Weak: minimum length 7, complexity enabled, no lockout (`LockoutBadCount = 0`). Password spraying viable with no risk of lockout. |
| GPOs              | 3 GPOs present: `Default Domain Policy`, `Default Domain Controllers Policy`, and `SecureServers`. The `SecureServers` GPO applies exclusively to `SEC-SYSLOG01`, confirming additional restrictions (AppLocker/WDAC) on that host. |
| Forest / Trusts   | `gcbsec.example` is the forest root. Inbound forest trust with `gcbacc.example` (`trustAttributes=8`, `SIDFiltering=False`) → potential cross-forest pivot vector. |
| ADCS              | CA identified: `gcbsec-SEC-DC-CA` on the DC → potential ADCS attack surface. |
| Shadow Principals | `accforest-ShadowEnterpriseAdmin` present, indicating PAM / Shadow Admin configuration. Currently no visible members — but the configuration is in place for cross-forest privilege materialization. |

## 2. IDENTITY (What can I do?)

No exploitable ACLs were identified during initial enumeration. The domain presents a relatively clean delegated-permissions surface. Abuse vectors are focused primarily on:

- Privileged credentials (`syslogagent` — Enterprise Admin)
- `PAM` / Shadow Principal trust relationships
- Exposed critical services (`ADCS`, `SEC-SYSLOG01`)
- Weak credential hygiene (stale passwords, no rotation)

```powershell
name                    : accforest-ShadowEnterpriseAdmin
member                  :
msDS_ShadowPrincipalSid : S-1-5-21-3331877400-209796306-1317730910-519
```

The presence of `accforest-ShadowEnterpriseAdmin` confirms a `PAM` / Shadow Principal configuration tied to SID `-519` (Enterprise Admins) of the external forest `gcbacc.example`. The offensive value here is not in local ACL abuse but in compromising an identity with sufficient privileges in `gcbsec.example` to materialize cross-forest administrative access over `gcbacc.example`.

`syslogagent` is a member of Enterprise Admins, implying full domain/forest control from that identity. Internal ACL-based escalation is therefore not a priority — the focus shifts directly to credential acquisition, reuse, and privilege projection.

## 3. ATTACK PATH (What am I going to do?)

> Priority target: `syslogagent`. Its membership in Enterprise Admins grants full control over `gcbsec.example`, and combined with the `PAM` / Shadow Principal configuration, allows projecting privileged access over `gcbacc.example` without requiring additional escalation techniques.

**Attack Threads**

1. `SEC-SYSLOG01` → credential / token / secret collection from memory → obtain `syslogagent` credentials → authenticate as Enterprise Admin in `gcbsec.example` → full domain/forest control
2. `syslogagent` → control over `gcbsec.example` → abuse `PAM` / Shadow Principals (`accforest-ShadowEnterpriseAdmin`) → materialize privileges over `gcbacc.example` → direct cross-forest pivot
3. `SEC-DC-CA` (ADCS) → potential certificate abuse (`ESC` paths) → additional persistence or escalation if required

**Tactical Support**

- Stale passwords (>180 days) → high probability of credential reuse
- No account lockout → password spraying viable without risk of blocking
- Small environment (few hosts) → low surface area, but high concentration of privileged identities
