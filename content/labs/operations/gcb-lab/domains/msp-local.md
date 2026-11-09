## 1. BASELINE (What exists in the environment?)

> Enumeration of `TrustedDomainObjects` from `msp.example` reveals two relevant trust relationships that extend the attack surface beyond the current domain. One corresponds to the child domain `internal.msp.example` within the same forest, with transparent authentication; the other corresponds to `it.gcb.example` via an external trust in `QUARANTINED_DOMAIN` mode, useful primarily for context-conditioned enumeration or pivoting.

```powershell
distinguishedName : DC=msp,DC=local
objectSid         : S-1-5-21-2998733414-582960673-4099777928
name              : msp
```

```powershell
MSP            MSP            msp.example      \\10.200.8.1          MSP
INTERNALMSP    INTERNALMSP    msp.example      \\10.200.8.2          INTERNALMSP
IT             IT
```

1. `internal.msp.example` (child domain — same forest)

```powershell
name            : internal.msp.example
trustPartner    : internal.msp.example
trustDirection  : 3
trustAttributes : 32
trustType       : 2
flatName        : INTERNALMSP
SIDFiltering    : False
```

```
Type: Intra-forest (trustAttributes = 32 → WITHIN_FOREST)

Transparent authentication within the forest, no SID Filtering → direct cross-domain LDAP access with valid credentials.

Abuse vectors:

→ Intra-forest escalation via SIDHistory (ExtraSIDs) after DA compromise

Conclusion:

→ High-impact relationship — enables forest-level escalation after Domain Admin compromise in either domain.
```

2. `it.gcb.example` (external forest — restricted trust)

```powershell
name            : it.gcb.example
trustPartner    : it.gcb.example
trustDirection  : 2
trustAttributes : 4
trustType       : 2
flatName        : IT
SIDFiltering    : False
```

```
Type: External trust (trustAttributes = 4 → QUARANTINED_DOMAIN)

External trust with restricted authentication (selective authentication) → access is conditioned on context and identity.

Abuse vectors:

→ Trust key abuse after compromising Domain Admin for cross-forest access, though this only enables basic enumeration of the remote (IT) domain.

Conclusion:

Limited trust relationship — useful for conditioned pivot and enumeration, but no direct cross-forest escalation capability. Its relevance here is reduced given that functional connectivity to it.gcb.example already exists.
```

| Area            | Key Findings |
| --------------- | ------------ |
| Users           | 104 users, 102 active. 102 with non-expiring passwords, 103 with no rotation in >180 days. Only `Administrator` and `mspdb` have ever logged on — highly inactive environment with high credential reuse probability. |
| Groups          | Full control centralized in `Administrator` (DA/EA/SA). Multiple empty privileged groups — low operational maturity with potential future abuse surface. |
| Hosts           | 13 servers, no workstations. Main DC: `MSP-DC01`. All hosts have stale machine passwords (>180 days), reinforcing the general credential hygiene weakness. |
| Password Policy | No lockout (`REDACTED_SECRET`) → password spraying viable. Stale, unrotated passwords increase likelihood of successful credential-based initial access. |
| Kerberos        | Multiple accounts with `MSSQLSvc` SPNs (`mspdb`, `Vencome`, `Whirosed`, `Preselle`, etc.) → clear Kerberoasting surface. No AS-REP roastable accounts. |
| GPOs            | Only `Default Domain Policy` and `Default Domain Controllers Policy`. No hardening GPOs or relevant operational delegations observed. |
| Trusts          | `internal.msp.example` is the primary intra-forest expansion path; `it.gcb.example` acts as an external trust useful for contextual pivot and enumeration. |
| Subdomains      | `internal.msp.example` exists within the forest — expands the enumeration and attack surface. |

## 2. IDENTITY (What can I do?)

No globally exploitable ACLs were identified over the domain root (`DC=msp,DC=local`). The initial attack surface in `msp.example` is therefore not oriented toward global ACL abuse but toward weak credentials, Kerberoastable SPNs, and intra-forest expansion toward `internal.msp.example`.

```powershell
----------------------------------------------------------------------
[+] ACL — Dangerous permissions over Domain Controllers
----------------------------------------------------------------------
Identity              : S-1-5-21-948911695-1962824894-4291460450-1105
SecurityIdentifier    : S-1-5-21-948911695-1962824894-4291460450-1105
ActiveDirectoryRights : ExtendedRight
ObjectAceType         : Allowed-To-Authenticate
ObjectDN              : CN=MSP-DC01,OU=Domain Controllers,DC=msp,DC=local
ObjectSID             : S-1-5-21-2998733414-582960673-4099777928-1000
IsInherited           : False

----------------------------------------------------------------------
[+] ACL — Dangerous permissions over Computer Objects
----------------------------------------------------------------------
Identity              : S-1-5-21-948911695-1962824894-4291460450-1105
SecurityIdentifier    : S-1-5-21-948911695-1962824894-4291460450-1105
ActiveDirectoryRights : ExtendedRight
ObjectAceType         : Allowed-To-Authenticate
ObjectDN              : CN=MSP-DC01,OU=Domain Controllers,DC=msp,DC=local
ObjectSID             : S-1-5-21-2998733414-582960673-4099777928-1000
IsInherited           : False
```

`S-1-5-21-948911695-1962824894-4291460450-1105` = `IT-SQLSRV02$` → `Allowed-To-Authenticate` → `MSP-DC01`:
- This host is explicitly permitted to authenticate against `MSP-DC01`
- It is the only VALIDATED pivot point confirmed so far

**Why enumeration fails from other hosts (e.g., `it-employee15`) via LDAP bind:**

> The host cannot establish the communication or security context required to reach the DC.

Possible causes:

- Firewall blocking LDAP (389/636) or RPC/SMB
- Network segmentation
- WinRM session (LogonType 3) without a valid LDAP context
- DNS / SPN resolution failure (affects Kerberos → LDAP bind)

## 3. ATTACK PATH (What am I going to do?)

> The target is to abuse existing privileged context on domain hosts (`MSP-SQLREPORT`, `MSP-SRV01`) to obtain reusable credentials or valid tokens, enabling escalation toward domain control in `msp.example` or a pivot into `internal.msp.example`.

**Attack Threads**

1. Administrative access on `MSP-SQLREPORT` → cross-domain LDAP enumeration of `internal.msp.example` → identify ACLs, credentials, and delegations in the child domain → intra-forest trust → pivot → expansion

**Tactical Support**

- Weak password policy (`min length = 7`, no lockout, stale passwords) → favors password spraying
- Stale `pwdLastSet` values → credentials likely still valid → credential reuse viable
