## 1. BASELINE (What exists in the environment?)

> `internal.msp.example` is a child domain within the `msp.example` forest — a small environment with low operational activity and multiple structural weaknesses. Kerberos delegation configurations and ACL permissions over privileged groups introduce a clear identity-based escalation surface.

```powershell
distinguishedName : DC=internal,DC=msp,DC=local
objectSid         : S-1-5-21-2754435719-1041067879-922430489
name              : internal
```

**Relevant Trusts**

1. `msp.example` (parent domain — same forest)

```powershell
name            : msp.example
trustPartner    : msp.example
trustDirection  : 3
trustAttributes : 32
trustType       : 2
flatName        : MSP
SIDFiltering    : False
```

- Type: `Intra-forest` (`trustAttributes = 32 → WITHIN_FOREST`)
- Operational impact: Authentication between domains in the same forest is transparent. With valid credentials, direct cross-domain LDAP access is possible with no quarantine-equivalent restrictions.
- Offensive implication: After achieving high-privilege control in either domain, this relationship enables intra-forest escalation via `SIDHistory` / `ExtraSIDs`.
- Conclusion: Critical relationship — full forest compromise is achievable after domain-level control.

| Area            | Key Findings                                                                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users           | Only 5 users total, 3 active. Only `Administrator` and `batchsvc` have ever logged on. `batchsvc` is a service account and a member of `Account Operators`, granting it the ability to manage accounts within the domain.                                                        |
| Groups          | `Administrator` is the sole Domain Admins member. `batchsvc` belongs to `Account Operators`, allowing creation or modification of certain domain accounts. Several privileged groups are empty (`DnsAdmins`, `Server Operators`, `Backup Operators`) — low operational maturity. |
| Hosts           | Domain comprises only 3 hosts. `INTERNAL-BATCH` has Kerberos Constrained Delegation configured toward HTTP services on the Domain Controller — a potential delegation abuse vector.                                                                                              |
| Password Policy | Minimum length 7, no lockout (`LockoutBadCount = 0`). Password spraying viable without risk of account lockout.                                                                                                                                                                  |
| Delegation      | `INTERNAL-BATCH$` has Constrained Delegation and is marked `TrustedToAuthForDelegation` (S4U) — potential Kerberos delegation abuse vector if the host or its machine account is compromised.                                                                                    |
| GPOs            | Three GPOs: `Default Domain Policy`, `Default Domain Controllers Policy`, and `DCs`. No additional hardening observed. The `DCs` GPO is not empty.                                                                                                                               |
| Trusts          | Part of the same forest as `msp.example` — direct pivot post-compromise.                                                                                                                                                                                                           |
| Subdomains      | `internal.msp.example` is the only child domain in the `msp.example` forest.                                                                                                                                                                                                         |

## 2. IDENTITY (What can I do?)

**Relevant Offensive Capabilities**

- `mspdb` → `Self-Membership` on `ForestManagers` → can add itself to the group → potential escalation depending on the group's effective privileges
- `ForestManagers` → `Self-Membership` on `InternalAdmins` → control over group membership → possible privilege chaining
- `batchsvc` (`Account Operators`) → domain account management → creation or modification of unprotected users/hosts → indirect escalation or persistence
- `INTERNAL-BATCH$` → `Constrained Delegation` + `TrustedToAuthForDelegation` → S4U abuse → impersonation toward services on `INTERNAL-DC01`

**Technical Evidence — ACLs**

```powershell
----------------------------------------------------------------------
[+] ACL — Dangerous permissions over privileged groups
----------------------------------------------------------------------
Identity              : MSP\mspdb
SecurityIdentifier    : S-1-5-21-2998733414-582960673-4099777928-1107
ActiveDirectoryRights : Self
ObjectAceType         : Self-Membership
ObjectDN              : CN=ForestManagers,CN=Users,DC=internal,DC=msp,DC=local
ObjectSID             : S-1-5-21-2754435719-1041067879-922430489-1118
IsInherited           : False

Identity              : INTERNALMSP\ForestManagers
SecurityIdentifier    : S-1-5-21-2754435719-1041067879-922430489-1118
ActiveDirectoryRights : Self
ObjectAceType         : Self-Membership
ObjectDN              : CN=InternalAdmins,CN=Users,DC=internal,DC=msp,DC=local
ObjectSID             : S-1-5-21-2754435719-1041067879-922430489-1119
IsInherited           : False
```

**Note on `Account Operators`:**

- Can create/modify user accounts and some machine accounts in the domain.
- By design, `Account Operators` has delegated permissions to create and modify users, some groups, and host accounts that are not protected by `AdminSDHolder` (`adminCount=1`) — typically within `CN=Users` or `CN=Computers` containers.
- Actual impact depends on any additional ACL delegations present. If extra permissions exist over other AD objects, they can be leveraged to modify identities, alter unprotected group memberships, or abuse delegated configurations to escalate privileges within the domain.

> Current identity (`mspdb`) can authenticate to `msp-srv01` using the credential `REDACTED_SECRET`.

## 3. ATTACK PATH (What am I going to do?)

> Priority target: `INTERNAL-BATCH$`. Its Constrained Delegation configuration enables S4U abuse for impersonation and access to services on the Domain Controller, facilitating full domain escalation.

**Attack Threads**

1. Initial access: `mspdb` → authenticate to `msp-srv01`
2. ACL escalation chain: `mspdb` → `Self-Membership` → `ForestManagers` → `Self-Membership` → `InternalAdmins`
3. `batchsvc` (`Account Operators`) → domain account management → user creation/modification → indirect escalation / persistence
4. Delegation abuse: `INTERNAL-BATCH$` → `Constrained Delegation` + `TrustedToAuthForDelegation` → S4U impersonation → access to services on `INTERNAL-DC01`
5. Privileged identity compromise in `internal.msp.example` → intra-forest trust abuse with `msp.example` → post-EA ExtraSID escalation → full forest compromise

**Tactical Support**

- Weak password policy (no lockout + stale passwords) → password spraying → initial access
- Low account activity (no logins / no rotation) → credential reuse → lateral movement
- Intra-forest trust (`msp.example`) → direct post-compromise pivot → expansion to parent domain
