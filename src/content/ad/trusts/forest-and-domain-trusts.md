## 1. Active Directory Trust Fundamentals

A trust relationship is a link between two domains or forests that allows cross-domain or cross-forest authentication. Without a trust, identities from one domain cannot be recognized in another. The goal is to provide _controlled access_ between separate security boundaries. This includes:

- cross-domain authentication
- conditional access based on local permissions
- collaboration between separate infrastructures

- [ ] Real security boundary in Active Directory

Within the same forest (intra-forest):
- SID filtering does **not** apply
- PAC data with `ExtraSIDs` is accepted
- A Domain Admin can pivot into other domains
- Escalation up to Enterprise Admins is possible

Across forests (external / forest trusts):
- SID filtering is enabled by default
- `ExtraSIDs` are filtered out
- Golden / Diamond ticket abuse across the boundary fails by default
- Compromising one domain does **not** automatically mean compromising the remote forest

> If SID filtering is manually disabled, the impact becomes similar to an intra-forest scenario.

- [ ] Authentication vs authorization (Layer 1 vs Layer 2)

- Layer 1 — Authentication: determined by _trust direction (inbound/outbound)_ → “I recognize who you are.” Nothing more.
- Layer 2 — Real access: determined by _FSP + ACL_ → “I allow or deny access to local resources.”

## 2. Trust Types

- [ ] Comparative summary

| Trust type | Scope | Transitive | Direction | Propagation |
| ---------- | ----- | ---------- | --------- | ----------- |
| Parent-child | Same forest | Yes | Bidirectional | All domains in the forest |
| Cross-link | Same forest | Yes | Bidirectional | Only between those two specific domains to optimize referral paths; it does not propagate to the rest. |
| Tree-root | Same forest | Yes | Bidirectional | All domains in both trees, including their child domains. |
| Forest | Separate forests | Yes | One-way or bidirectional | All domains in both forests |
| External | Separate forests | No | One-way or bidirectional | Only those two specific domains in separate forests |
| ESAE (bastion) | Separate forest | Depends | Controlled | Very limited |

### 2.1. Internal trusts (parent-child, cross-link, tree-root)

> `parent-child`, `tree-root`, and `cross-link` (internal trusts inside the same forest) do not use SID filtering. In this example, `atlas.local` is the forest root.

Note: Each domain has its own DCs. There is no single “central forest DC.” The forest root does not directly administratively control the others. Internal domains trust each other because they share the same forest security authority (same SID namespace and same trust root).

1. **Parent-child:**
    - Between domains inside the same forest.
    - A bidirectional, transitive trust created automatically when a new domain is added to an existing tree. That trust propagates through the full hierarchy: `corp.atlas.local`, `research.corp.atlas.local`, and so on. There is therefore an implicit relationship between every child domain and the tree root (`atlas.local`).
    - Analogy: A large house (the parent domain) builds an annex (the child domain). There is always a door in both directions between the main house and the annex. Example: `atlas.local` (parent) ↔ `corp.atlas.local` (child)

```powershell
        ( Forest: ATLAS )
          ┌─────────────┐
          │ atlas.local │ Forest root domain (Main house)
          └───────┬─────┘
                  │
                  ▼
      ┌───────────────────┐
      │ corp.atlas.local  │ Child domain in the forest (Annex)
      └───────────┬───────┘
```

2. **Cross-link:**
    - Between secondary domains (child domains). It optimizes authentication flows without forcing them to travel through the forest root every time. A cross-link trust can be created between any pair of child domains within the same forest, even if one is a child and the other is a grandchild.
    - Analogy: Two annexes of the same large house install a direct door between them so they do not always need to pass through the front entrance.

```powershell
                 [ Cross-link ]
               <- direct door ->
    ┌───────────────────────┐ ┌───────────────────┐
    │ Child domain          │ │ Another subdomain │
    │ (corp.atlas.local)    │ │ (dev.atlas.local) │
    └───────────────────────┘ └───────────────────┘
```

3. **Tree-root trust:**
    - Established between the forest root domain and a new tree root domain inside the same forest.
        - Forest root: the first root domain created in the forest (for example, `atlas.local`).
        - Tree root: an additional root domain with a different DNS suffix (for example, `helios.net`).
    - It is created automatically when a new domain tree is added to the forest. It is always bidirectional and transitive, allowing mutual identity recognition between both trees.
    - Analogy: It is like building a new house in the same neighborhood. The neighborhood (the forest) automatically opens doors in both directions between the original house and the new one.

```powershell
   (Forest: ATLAS)

(atlas.local)  ↔  (helios.net)
```

### 2.2. Forest trust

> A trust between two complete forests. Transitive. One-way or bidirectional.

4. **Forest:**
    - A one-way or bidirectional, transitive trust between all domains in separate forests (`forest ↔ forest`)
    - Uses SID filtering to restrict which external SIDs are accepted when crossing the trust boundary
    - Analogy: At this point we are no longer talking about houses, but about two complete neighborhoods (two forests). A main avenue is built between them, and anyone with a valid key from one neighborhood can be recognized in the other.

```powershell
   (Forest: ATLAS)                   (Forest: RIDGE)
   ┌─────────────────────┐           ┌────────────────────────┐
   │ Forest root domain  │ < Forest >│ Forest root domain     │
   │ atlas.local         │           │ ridge.local            │
   └─────────────────────┘           └────────────────────────┘
```

### 2.3. External trust

> Between specific domains in different forests. Non-transitive. SID filtering applies.

5. **External trust:**
    - A one-way or bidirectional, non-transitive trust between two specific domains in separate forests (`domain ↔ domain`)
    - It only connects those two domains, not the rest of the domains in each forest.
    - Uses SID filtering to restrict authentication and prevent fake SID abuse.
    - Analogy: Two houses in different neighborhoods agree to open a special door between them. That door connects only those two houses, not their neighbors. A guard stands at the door (SID filtering) and only lets approved identities through.

```powershell
 (Forest: ATLAS)                    (Forest: RIDGE)
 ┌──────────────────┐               ┌──────────────────┐
 │ corp.atlas.local │ <- External ->│ sales.ridge.local│
 └──────────────────┘               └──────────────────┘
```

### 2.4. ESAE / Bastion Forest trust

> A separate administrative forest with tightly controlled trust relationships.

6. **ESAE (bastion):**
    - The bastion forest is **not** “just another domain.” It is a separate administrative forest with an asymmetric role: it projects privilege into production, but it does not accept normal administration from outside. It commonly relies on a one-way forest trust. The bastion forest trusts the production forest to recognize production identities. The production forest does **not** allow unrestricted authentication back into the bastion. There is no direct cross-forest administration and no interactive logon flow as in a normal production trust.
    - It does not host regular users or application services. It hosts administrative accounts, administrative groups, and administrative systems.
    - Analogy:
        - Bastion forest = Ministry of the Interior
        - Production forests = Cities
        - The ministry authorizes temporary police powers
        - The cities do not control the ministry

```powershell
        ( PAM / Bastion Forest )
        ┌──────────────────────────────┐
        │ pam.secure.local             │
        │                              │
        │  - MIM                       │
        │  - Shadow Security Principals│
        │  - Time-bound groups         │
        └───────────────┬──────────────┘
                        │
        Forest Trust    │  (one-way)
        (Outbound)      ▼
        ┌────────────────────────────┐
        │ prod.atlas.local           │
        │                            │
        │  - Production DCs          │
        │  - Servers                 │
        │  - Real Domain Admins      │
        └────────────────────────────┘
```

## 3. Trust Components

```powershell
┌────────────────────────┐                 ┌────────────────────────┐
│     Domain A           │                 │     Domain B           │
│    ATLAS.LOCAL         │                 │    RIDGE.LOCAL         │
├────────────────────────┤                 ├────────────────────────┤
│  TDO: ridge.local      │                 │  TDO: atlas.local      │
│  (local trust config)  │                 │  (local trust config)  │
│  - Direction           │                 │  - Direction           │
│  - Type                │                 │  - Type                │
│  - Attributes          │                 │  - Attributes          │
│  - DNS / flatName      │                 │  - DNS / flatName      │
└─────────────┬──────────┘                 └─────────────┬──────────┘
              │                                          │
              ▼                                          ▼
┌────────────────────────┐                 ┌────────────────────────┐
│ Trust Account: RIDGE$  │                 │ Trust Account: ATLAS$  │
│ (stores trust secret)  │                 │ (stores trust secret)  │
└─────────────┬──────────┘                 └─────────────┬──────────┘
              │                                          │
              ▼                                          ▼
┌────────────────────────┐                 ┌────────────────────────┐
│   KDC / krbtgt realm   │◄──────────────► │   KDC / krbtgt realm   │
│      for ATLAS         │  inter-realm    │      for RIDGE         │
│                        │  validation      │                        │
└─────────────┬──────────┘                 └─────────────┬──────────┘
              │                                          │
              └──── referral TGT processing / PAC checks ────┘
                    (configured by the TDO)
                    (enforced by the KDC)
                    (with SID filtering when applicable)
```

### 3.1. Trusted Domain Objects (TDO)

Each domain stores a TDO (`trustedDomain` object) in its own AD to describe the trust with the remote domain. That TDO represents “the trust relationship with the other domain.” The TDO lives in the local domain.

```powershell
# ldapsearch
ldapsearch (objectClass=trustedDomain) --attributes name,trustPartner,flatName,trustType,trustDirection,trustAttributes,msDS-QuarantinedDomain

# PowerView
Get-DomainTrust -Domain domain_name | select SourceName,TargetName,TrustDirection,TrustAttributes,SIDFilteringQuarantined

# AD Module
Get-ADTrust -Filter * | select Name,ForestTransitive,SIDFilteringQuarantined
```

- [ ] `name`: NetBIOS or DNS name of the remote domain for this trust
- [ ] `trustPartner`: Remote domain associated with the trust relationship (usually the same as `name`)
- [ ] `flatName`: Short NetBIOS name of the remote domain
- [ ] `trustType`: Defines what kind of trust it is

| trustType | Trust type |
| --------- | ---------- |
| 1 | External Trust (domain ↔ domain, outside the forest) |
| 2 | Windows AD Trust (can be intra-forest or forest trust) |
| 3 | MIT Kerberos Realm |

- [ ] `trustDirection`: Direction of the trust from the perspective of the local domain

> Trust direction only controls whether the domain can _recognize_ an external identity. It does not grant permissions or access by itself; it simply allows Kerberos to cross the trust boundary.

| Value | Constant | Meaning (from the current domain) |
| ----- | -------- | --------------------------------- |
| `0` | `TRUST_DIRECTION_DISABLED` | Disabled |
| `1` | `TRUST_DIRECTION_INBOUND` | The remote domain trusts the local domain |
| `2` | `TRUST_DIRECTION_OUTBOUND` | The local domain trusts the remote domain |
| `3` | `TRUST_DIRECTION_BIDIRECTIONAL` | Both domains trust each other |

- [ ] `SID Filtering Policy`: SID filtering controls whether the domain accepts or strips SIDs from external domains during PAC validation in cross-domain or cross-forest authentication.

| Value | Meaning |
| ----- | ------- |
| `msDS-QuarantinedDomain: TRUE` | SID filtering enabled |
| `msDS-QuarantinedDomain: FALSE` | SID filtering disabled |

> SID filtering is enforced during PAC validation by the KDC in the target domain. Its purpose is to prevent external identities from injecting privileged SIDs that do not belong to the trusted side.

- SID filtering types in Active Directory. Depending on the trust type, AD uses different SID filtering mechanisms.

| SID filtering type | Where it is used | Indicator | What it does |
| ------------------ | ---------------- | --------- | ------------ |
| Quarantined Domain SID Filtering | External / Domain trust | `SIDFilteringQuarantined = True` | Blocks external SIDs and `SIDHistory` |
| Forest SID Filtering | Forest trust | `SIDFilteringForestAware` | Only accepts SIDs that belong to the trusted forest |
| Relaxed SID Filtering | Forest trust | `SIDFilteringQuarantined = False` | Allows external SIDs (required for PAM or special delegation scenarios) |
| PAM SID Relaxation | PAM trust | `TRUST_ATTRIBUTE_PIM_TRUST (0x400)` | Allows privileged SID projection through Shadow Principals |

- [ ] `trustAttributes`: A bitmask that defines the properties of the trust. The observed value is the sum of the enabled flags.

| Value | Flag / Combination | Applies to | Actual meaning | Typical context |
| ----- | ------------------ | ---------- | -------------- | --------------- |
| `0` | `NONE` | All | Standard trust with no special flags | Basic configuration |
| `1` | `TRUST_ATTRIBUTE_NON_TRANSITIVE` | External | The trust does not propagate to other domains | External trust |
| `2` | `TRUST_ATTRIBUTE_UPLEVEL_ONLY` | External | Only works with domains ≥ Windows 2000 | Legacy |
| `4` | `TRUST_ATTRIBUTE_QUARANTINED_DOMAIN` | External / Forest | SID filtering enabled (blocks `SIDHistory` and external SIDs) | External trust |
| `8` | `TRUST_ATTRIBUTE_FOREST_TRANSITIVE` | Forest | Allows trust transitivity between domains in both forests | Standard forest trust |
| `32` | `TRUST_ATTRIBUTE_WITHIN_FOREST` | Intra-forest | Internal trust inside the same forest | Parent/child |
| `64` | `TRUST_ATTRIBUTE_TREAT_AS_EXTERNAL` | Forest | Makes the forest trust behave like an external trust | Higher isolation |
| `1024` | `TRUST_ATTRIBUTE_PIM_TRUST` | PAM / PIM | Enables features used by Privileged Access Management | Bastion forest |

- Real combinations seen in environments

```text
4    → I treat you as a quarantined external domain (SID filtering)
8    → standard forest trust (I trust your forest)
32   → internal trust inside the same forest
72   → forest trust treated as external (I do not trust your full forest normally)
516  → cross-organization trust with SID quarantine
1096 → common combination observed in PAM environments
       (FOREST_TRANSITIVE + TREAT_AS_EXTERNAL + PIM_TRUST)
```

> The presence of `1096` alone does **not** confirm PAM. Real PAM evidence is the existence of the container: `CN=Shadow Principal Configuration`.

| Observed value | Included flags | Trust type | Quick interpretation | Typical context |
| -------------- | -------------- | ---------- | -------------------- | --------------- |
| 8 | `FOREST_TRANSITIVE (0x8)` | Forest trust | Transitive trust between forests | Most common scenario |
| 32 | `WITHIN_FOREST (0x20)` | Intra-forest trust | Trust inside the same forest (parent/child or tree-root) | Standard AD architecture |
| 72 | `FOREST_TRANSITIVE (0x8)` + `TREAT_AS_EXTERNAL (0x40)` | Forest trust treated as external | Applies external-trust rules (stricter SID filtering) | Highly isolated environments |
| 4 | `QUARANTINED_DOMAIN (0x4)` | External trust | SID filtering active for external identities | Isolated domain trust |
| 516 | `CROSS_ORGANIZATION (0x200)` + `QUARANTINED_DOMAIN (0x4)` | Cross-organization trust | Trust between organizations with SID quarantine | B2B / enterprise federation |
| 1096 | `PIM_TRUST (0x400)` + `TREAT_AS_EXTERNAL (0x40)` + `FOREST_TRANSITIVE (0x8)` | PAM trust | Trust prepared for Privileged Access Management (bastion forest) | PAM environments |
### 3.2. trustDirection
#### One-way trust direction: `Inbound (1)` and `Outbound (2)`

- From ATLAS (its TDO): `trustDirection = 1` → Inbound. The local domain ATLAS sees the trust as inbound because the remote domain RIDGE trusts ATLAS. In practical terms, identities from ATLAS can be recognized in RIDGE. This does **not** grant access by itself.

> The remote domain trusts me → My users can authenticate to resources in the remote domain

```powershell
# PowerView
Get-DomainTrust | select TargetName,TrustDirection,TrustAttributes,SIDFilteringQuarantined

# LDAP
ldapsearch (objectClass=trustedDomain) --attributes cn,trustPartner,trustDirection,trustAttributes,trustType,flatName,msDS-QuarantinedDomain

# Output
cn: ridge.local
trustPartner: ridge.local
trustDirection: 1           
trustAttributes: 8           
trustType: 2 
flatName: RIDGE
```

- From RIDGE (its TDO): `trustDirection = 2` → Outbound. The local domain RIDGE sees the same trust as outbound because RIDGE trusts ATLAS. In practical terms, RIDGE can send inter-realm authentication toward ATLAS according to the trust relationship. This still does **not** guarantee access.

> I trust the remote domain → Its users can authenticate to resources in my domain

```powershell
ldapsearch (objectClass=trustedDomain) --attributes cn,trustPartner,trustDirection,trustAttributes,trustType,flatName,msDS-QuarantinedDomain

# Output
cn: atlas.local
trustPartner: atlas.local
trustDirection: 2       
trustType: 2            
trustAttributes: 8          
flatName: ATLAS
```

#### Bidirectional trust direction: `3` → ATLAS ↔ RIDGE

> Bidirectional = inbound + outbound at the same time, in both domains.

- Users from ATLAS can go to RIDGE.
- Users from RIDGE can go to ATLAS.

> Both domains trust each other → Users from both sides can authenticate to resources in the other domain

```powershell
Users in ATLAS  ──▶ Resources in RIDGE
Users in RIDGE  ──▶ Resources in ATLAS
```

> A “bidirectional trust” is not a separate special object. It is simply two one-way trust directions active in opposite directions.


### 3.3 SID filtering

SID filtering is a mechanism that blocks unauthorized external SIDs so a remote domain cannot send fake or privileged SIDs across a trust. SID filtering lives in the TDO, in the `trustAttributes` field of the object:

```powershell
CN=<REMOTE-DOMAIN>,CN=System,DC=<domain>,DC=<local>
```

- Exact location: `trustedDomain` object (TDO)
- Container: `CN=System` in the local domain
- Attribute where it lives: `trustAttributes` (bit `4` = `QUARANTINED_DOMAIN`)
- Evaluated by: the KDC during SID validation in inter-realm tickets

- [ ] When it applies

- External trust: yes
- Forest trust: yes
- Internal trusts: no
- PAM: no

- [ ] Why it does not apply internally

SID filtering does not apply to internal trusts because all domains inside the same forest belong to one security authority (same SID namespace and same trust root). They are not treated as “external domains” that require SID filtering.
### 3.4 Trust key and trust account

Normally, an entity obtains a TGT (Ticket Granting Ticket) from its own KDC and uses it to request service tickets (TGS) within its own domain. That process does not work directly across domains because a TGT issued by one domain cannot be decrypted by another: each domain has its own `krbtgt` secret. To solve that problem, Active Directory uses a shared inter-domain secret, also called the _trust key_. This key allows one KDC to validate referral tickets issued by another domain during inter-realm Kerberos authentication. That secret is stored locally in each domain as the password of a trust account (`SAM_TRUST_ACCOUNT`) that represents the remote domain. In other words, the trust key is not a separate visible object in AD: it is materialized through the trust account created for the remote domain.

- In `ATLAS`, the trust account for the remote domain is `RIDGE$`  
- In `RIDGE`, the trust account for the remote domain is `ATLAS$`
  
> The trust account name is always the NetBIOS name of the remote domain, followed by `$`.

- [ ] What it enables

The trust key allows one domain to validate Kerberos referral tickets issued by another domain, which makes inter-realm authentication possible.

- [ ] Real function

- It represents the remote domain inside local Active Directory.  
- Its password is the trust key used for inter-realm Kerberos.  
- Its privileges are minimal (typically similar to Domain Users), but it is essential for trust processing between domains.

- [ ] Role inside the trust. The KDC uses it to:

The KDC relies on the trust account and its secret to:

- sign inter-realm referral TGTs  
- validate referral tickets received from the trusted domain  
- identify tickets that originate from another domain

- [ ] Relationship with transitivity

1. **Forest trust:** There is a trust key between the forest root domains of both forests. Authentication is transitive at the forest level through Kerberos referrals, but trust keys are not created between every individual domain.  
2. **External trust:** One trust key exists for each pair of domains across different forests. This trust is not transitive.  
3. **Internal trust (parent-child, tree-root, cross-link):** Windows creates _one trust key for each direct relationship between two domains_ inside the same forest (parent ↔ child, root ↔ new tree, or cross-link). There is no global trust key shared across the entire forest.

- root ↔ child1 → one trust key  
- root ↔ child2 → another trust key  
- child2 ↔ subchild → another trust key

> `child1` does not have a direct trust key with `child2`, even though it can still authenticate to resources in that domain through transitivity. Authentication does not work because every domain in the forest shares a single trust key, but because Kerberos chains referrals through intermediate domains that do have direct trust relationships.

Example: if a user in `dev.domain.local` wants to authenticate to a service in `hr.domain.local`, a direct trust key `dev ↔ hr` is not required. The flow is:

```
1. The client in dev.domain.local requests access to a service in hr.domain.local  
2. The KDC in dev.domain.local cannot issue the final ticket for hr, so it returns a referral TGT for domain.local  
3. The client presents that referral to the KDC in domain.local, which returns another referral for hr.domain.local  
4. Finally, the client presents that referral to the KDC in hr.domain.local, which issues the final TGS for the target service
```

> In other words, transitivity is achieved through trust keys for each direct link plus chained Kerberos referrals, not through a single global trust key shared by all domains in the forest.

- [ ] Enumeration

```powershell
# FROM ATLAS
ldapsearch (samAccountType=805306370) --attributes samAccountName
# sAMAccountName: RIDGE$
```

### 3.5 KDC

The KDC is the Kerberos service running on each Domain Controller (DC). In a trust, it is the component that actually uses the TDO, the trust account, and the trust key.

- [ ] Core KDC functions in a trust

- Issues local TGTs to users in the domain.
- Issues referral TGTs when the target resource belongs to a remote domain.
- Validates referral TGTs received from a trusted domain.
- Uses the trust key to sign (when issuing) or validate (when receiving) inter-realm TGTs.
- Consults the TDO to decide:
    - trust direction (inbound/outbound)
    - whether SID filtering applies
    - whether the trust is transitive or not
    - which remote KDC the client should be referred to

- [ ] Where it lives

- It is a DC service, not an AD object.
- Each DC/KDC in the domain:
    - reads the trust account (stored in `CN=System`)
    - reads the TDO (also stored in `CN=System`)
    - uses its local copy of the trust key

### 3.6 `foreignSecurityPrincipal` (FSP)

> An FSP only appears in the domain that grants permissions, never in the domain that receives them. FSP is more relevant in **external / forest trusts**, not inside the same forest.

An FSP is a local object that represents an external SID. It is not a real user or group from the remote domain. It is only a _placeholder_ that lets the local domain reference that external SID in its ACLs. An FSP exists because Active Directory cannot place external SIDs directly into local permissions without first creating an object that represents them. This happens automatically when the domain:

- adds an external user/group into a local group,
- grants NTFS/SMB permissions to an external SID,
- applies GPO permissions to an external SID.

An FSP does not grant access by itself. It only means “this external SID can be referenced locally.” Real access depends on the ACLs where that FSP was placed. FSPs live exclusively in the domain that owns the resource, inside the container:

```powershell
CN=ForeignSecurityPrincipals,DC=domain,DC=local
```

- Object type: `foreignSecurityPrincipal`
- Key attribute: `objectSid`

### 3.7 ACLs

The resource domain is the only owner of its ACLs:

- If you access a resource in ATLAS → the ACLs that matter are in ATLAS.
- If you access a resource in RIDGE → the relevant ACLs are in RIDGE.

> No domain can grant permissions over resources owned by the other domain.


### 3.8 Selective Authentication

> Trust ≠ automatic access. Trust + AllowedToAuthenticate = access

In a normal trust: users from the trusted domain can authenticate to any machine in the trusting domain (if the ACL allows it).

With Selective Authentication enabled: the existence of the trust is not enough. The user must also have the explicit `Allowed to authenticate` right on the target computer. This breaks:

- Automatic access to any server in the trusting domain
- Lateral movement across forests/domains
- WinRM/SMB access even when the ticket is valid
- Many techniques that assume “if a trust exists, access is possible”

The ticket may be cryptographically valid, but the destination domain will reject the authentication if you do not have that explicit permission.

## 4. Inter-Realm Kerberos Flow

- [ ] Participants

- Client: machine or user requesting access.
- Local KDC: domain controller of the user’s own domain.
- Remote KDC: domain controller of the trusted domain.
- Remote service: the target service hosted in the remote domain.

- [ ] Kerberos mechanism steps

> The same inter-realm Kerberos flow (TGS-REQ → referral TGT → remote TGS-REQ → TGS-REP → AP-REQ/AP-REP) also applies to an External Trust. The difference is the _scope_ of the trust, not the Kerberos mechanism itself.

| Step | Message | From → To | Key content | Result |
| ---- | ------- | --------- | ----------- | ------ |
| 1 | TGS-REQ | Alice → KDC dev.atlas.local | Her TGT + SPN for a remote resource | Requests access to a resource in another domain |
| 2 | TGS-REP | KDC dev.atlas.local → Alice | Inter-realm TGT | Returns a “referral” ticket for the other domain |
| 3 | TGS-REQ | Alice → KDC corp.atlas.local | Inter-realm TGT | Uses that referral ticket to request real access |
| 4 | TGS-REP | KDC corp.atlas.local → Alice | Service ticket | Valid ticket to access `\\corp-dc-1\shared` |
| 5 | AP-REQ | Alice → `corp-dc-1` | Service ticket | Presents the ticket to the target resource |
| 6 | AP-REP | `corp-dc-1` → Alice | Confirmation | Access is granted if permissions allow it |

- [ ] Notes

- The KDCs of both domains cooperate during steps 2 and 3 by using the trust key, which is stored as the password of the trust account. That key is never sent across the network. Each KDC uses it locally to sign the referral TGT when it is the issuing side, or to validate it when it is the receiving side. In other words, _trust account + trust key_ form the cryptographic link that lets inter-realm TGS-REQ / TGS-REP processing happen securely without direct client involvement.

- [ ] Detailed flow

<div style="margin: 1.4rem 0 1.7rem; border: 1px solid rgba(84, 129, 214, 0.16); border-radius: 18px; overflow: hidden; background: rgba(8, 11, 20, 0.72); box-shadow: 0 14px 32px rgba(0, 0, 0, 0.28);">
  <iframe src="/trust-maps/ad/inter-realm.html" title="Kerberos Inter-Realm Flow Diagram" loading="lazy" style="width: 100%; height: 560px; border: 0; display: block; background: transparent;"></iframe>
</div>

1. TGS-REQ (with current TGT): the client already has a local TGT issued by its own domain. It sends a TGS-REQ to its local KDC asking for a ticket to a remote service (`service@FOREIGN.REALM`).

> At this point, none of the trust components are involved yet. Only the local KDC receives the remote SPN.

2. TGS-REP → referral TGT: the local KDC detects that the requested service belongs to another domain. Instead of returning a service ticket directly, it responds with an inter-realm TGT (also called an inter-realm TGT or referral TGT). This new ticket is not for the final service. It is for the remote domain KDC (`krbtgt/FOREIGN.REALM`). It is encrypted with the shared key between both KDCs (established by the trust relationship).

> This is the “TGS referral” described by Microsoft. “Domain A signs a referral TGT using the trust key.”

This is where the components from section `#3` appear for the first time:

- local KDC
- TDO (to determine direction and trust type)
- trust key (required to encrypt/sign the referral TGT)
- trust account (contains the password = trust key)

3. TGS-REQ (with inter-realm TGT): the client now contacts the foreign KDC using the inter-realm TGT it received earlier. It sends another TGS-REQ, this time directly to the remote domain KDC, requesting the final service ticket (`service@FOREIGN.REALM`).

At this stage the same components are involved again, but on the remote side:

- remote KDC
- its copy of the TDO
- its trust account
- its trust key

> “Domain B validates the referral TGT using the same trust key.”

4. TGS-REP (service ticket): the foreign KDC validates the inter-realm TGT (using its copy of the shared key) and generates a valid service ticket for the requested resource. It returns that ticket to the client in a TGS-REP.
5. AP-REQ: with the service ticket in hand, the client contacts the remote service (for example, SMB or MSSQL in the trusted domain). It sends an AP-REQ containing the service ticket.
6. AP-REP: the remote service validates the ticket (using its own service key) and returns AP-REP, completing cross-domain Kerberos authentication.

> During steps 5 and 6, FSP and local ACLs are what matter.

- [ ] Comparison with forged tickets

> Golden, Silver, and Diamond tickets “break” the normal Kerberos flow. In each case, you start with an already forged or modified ticket and skip part of the legitimate request path.

- Golden Ticket → you start with a _TGT_ already signed with the domain `krbtgt` key. You skip steps 1 and 2 entirely.
- Diamond Ticket → you start with a legitimate TGT and re-sign / modify it with the `krbtgt` key. You skip the same stages as Golden, but with better realism.
- Silver Ticket (service ticket) → you start with a _TGS_ already signed with the service NTLM/AES key. You skip steps 1-4 and go straight to AP-REQ.
## 5. Authentication and Real Access

- [ ] (Layer 1 — Authentication)

> _trust direction_, _TDO_, _trust account_, _trust key_, and the _KDCs_ (local and remote) are active here. Their job is only to identify the external user. According to the inter-realm Kerberos flow, that happens during steps 2 and 3.

Result: identity recognized

```powershell
                ┌──────────────────────────────────────────┐
                │         LAYER 1 — AUTHENTICATION         │
                │   (Recognition of an external identity)  │
                └──────────────────────────────────────────┘
                                │
                                │  Trust Direction
                                ▼
┌──────────────────────┬─────────────────────────┬─────────────────────────────┐
│ Inbound (1)          │ Outbound (2)            │ Bidirectional (3)           │
│ “I accept external   │ “My identities can go   │ “I accept external          │
│  identities”         │  out”                   │  identities and mine can    │
│                      │                         │  go out too”                │
└──────────────────────┴─────────────────────────┴─────────────────────────────┘
                                │
                                ▼
                  ┌──────────────────────────────┐
                  │     TDO (trustedDomain)      │
                  │  - Direction                 │
                  │  - Type                      │
                  │  - Attributes (SID Filtering)│
                  │  - DNS / flatName            │
                  └──────────────────────────────┘
                                │
                                ▼
                  ┌──────────────────────────────┐
                  │   Trust Account (REMOTE$)    │
                  │  password = trust key        │
                  └──────────────────────────────┘
                                │
                                ▼
                  ┌──────────────────────────────┐
                  │     Local and remote KDC     │
                  │  Use the trust key to:       │
                  │   - validate inter-realm TGT │
                  │   - issue referral TGT       │
                  └──────────────────────────────┘
                                │
                                ▼
                     ✔ Identity recognized
                     ✖ No permissions yet (no access)
```

- [ ] Real Access (Layer 2 — FSP + ACL)

> Only _FSP_ and _local ACLs_ are active here. They are the only things that decide whether access is granted or denied. This happens **after** inter-realm Kerberos authentication succeeds (steps 5-6).

Result: access is granted only if the FSP appears in a local ACL. If the FSP does not exist or is not present in any ACL → access = 0.

```powershell
                      AUTHENTICATION COMPLETED
                           (Layer 1)
                            │
                            ▼
         ┌─────────────────────────────────────────────────────┐
         │       LAYER 2 — REAL ACCESS (LOCAL TO EACH DOMAIN)  │
         └─────────────────────────────────────────────────────┘
                            │
                            │  External identity comes from the trust,
                            │  but access does NOT depend on the trust.
                            ▼

                 ┌─────────────────────────────────┐
                 │     FSP (local external SID)    │
                 │ (only exists if permissions do) │
                 └─────────────────────────────────┘
                            │
                            ▼
                 ┌─────────────────────────────────┐
                 │          Local ACLs             │
                 │ (NTFS, SMB, GPO, groups, etc.)  │
                 └─────────────────────────────────┘
                            │
                            ▼
           ✔ Access allowed if FSP ∈ any local ACL
           ✖ Access denied if FSP does not exist or is not in an ACL
```

Notes:

- Layer 1 (authentication) only determines whether the external identity can be _recognized_ by the target domain. It does not decide access.
- Layer 2 (access) is only evaluated after inter-realm authentication succeeds (Layer 1). Real access always depends on whether an FSP exists and whether that FSP appears in a local ACL.

## 6. Trust Direction Abuse Scenarios

### `trustDirection:1` — Inter-forest Silver / referral abuse

- [ ] Enumerating the TDO from ATLAS (LAYER 1: AUTHENTICATION)

```powershell
# FROM ATLAS
ldapsearch (objectClass=trustedDomain) --attributes name,flatName,trustPartner,trustType,trustAttributes,trustDirection

# Output
name: ridge.local
flatName: RIDGE
trustPartner: ridge.local
trustType: 2
trustAttributes: 8
trustDirection: 1
```

- `trustType: 2` → Windows AD trust
- `trustAttributes: 8` → `TRUST_ATTRIBUTE_FOREST_TRANSITIVE`. Standard forest trust. Forest trust SID filtering still applies by default.
- `trustDirection: 1` → RIDGE trusts ATLAS. In practice, ATLAS identities can be recognized in RIDGE (assuming no selective authentication or other restrictions).

- [ ] Enumerating FSPs in RIDGE (LAYER 2: ACCESS)

If the goal is to pivot into a trusted domain, we need to determine whether identities from ATLAS were introduced into RIDGE through `foreignSecurityPrincipal` (FSP) objects.

```powershell
# 1. Enumerate FSPs
ldapsearch (objectClass=foreignSecurityPrincipal) --attributes cn,memberOf --hostname ridge.local --dn DC=ridge,DC=local

cn: S-1-5-4
cn: S-1-5-11
cn: S-1-5-17
cn: S-1-5-9
--------------------
cn: S-1-5-21-3926355307-1661546229-813047887-6102
memberOf: CN=Atlas Users,CN=Users,DC=ridge,DC=local
```

In this result, RIDGE contains a `foreignSecurityPrincipal` whose `cn` matches an external SID that belongs to ATLAS. This indicates that an identity (user or group) from ATLAS was, at some point, introduced into RIDGE — either as a group member or as a SID referenced in an ACL — and was granted permissions in that domain. The existence of the FSP does not guarantee that the identity can currently authenticate through inter-realm Kerberos by itself (that still depends on trust direction and controls such as selective authentication), but it **does** confirm that RIDGE delegated access to an external identity represented by that SID.

```powershell
# 2. Resolve the SID to a readable object
ldapsearch (objectSid=S-1-5-21-3926355307-1661546229-813047887-6102) --attributes objectClass,sAMAccountName,distinguishedName

--------------------
objectClass: group
sAMAccountName: Ridge Jump Users
distinguishedName: CN=Ridge Jump Users,CN=Users,DC=atlas,DC=local
```

The SID represents a remote group in ATLAS (`Ridge Jump Users`). Therefore, any ATLAS user who is a member of that group inherits the permissions RIDGE granted to that external SID.

```powershell
# 3. Enumerate members of Ridge Jump Users to determine who gets permissions in RIDGE through the FSP
net group "Ridge Jump Users" /domain
# ada
```

> Only `ada` receives in RIDGE the permissions assigned to the group where RIDGE placed the FSP.

- [ ] Attack mode

In a relationship where `trustDirection = 1` from the perspective of the local domain, the remote domain trusts the local one. Under normal conditions, that means identities from the local domain can authenticate to the remote domain through inter-realm Kerberos.

However, if an attacker gains sufficient privilege in the local domain (for example, DCSync-equivalent replication rights), they can extract the shared key associated with the trust account. That key is used by both domains to validate inter-realm tickets. With it, the attacker can generate valid tickets that the remote domain will accept as legitimate, regardless of the natural limitations imposed by trust direction.

At that point, the original trust direction stops being an effective boundary. The attacker no longer depends on the standard Kerberos referral flow and can instead forge tickets that the remote KDC will validate because they are signed with the shared trust key.

### `trustDirection:2` — Asymmetric trust

```text
- trustDirection ❌ stops mattering
- SID filtering  ❌ stops mattering for this specific scenario
```

- [ ] Enumerating the TDO from SOURCE (LAYER 1: AUTHENTICATION)

```powershell
# FROM RIDGE
ldapsearch (objectClass=trustedDomain) --attributes name,flatName,trustPartner,trustType,trustAttributes,trustDirection

name: atlas.local
flatName: ATLAS
trustPartner: atlas.local
trustType: 2
trustAttributes: 8
trustDirection: 2
```

- `trustType: 2` → Windows AD trust
- `trustAttributes: 8` → `TRUST_ATTRIBUTE_FOREST_TRANSITIVE`. Standard forest trust. Forest trust SID filtering still applies by default.
- `trustDirection: 2` → RIDGE trusts ATLAS. In practical terms, identities from ATLAS can be recognized in RIDGE (assuming no selective authentication or other restrictions).

- [ ] Enumerating FSPs in ATLAS (LAYER 2: ACCESS)

If the goal is to pivot from RIDGE into ATLAS, the first question is whether identities from RIDGE were introduced into ATLAS through `foreignSecurityPrincipal` (FSP) objects. However, in a one-way trust where `trustDirection = 2` from RIDGE, RIDGE trusts ATLAS. That means ATLAS identities can authenticate into RIDGE — not the other way around.

```powershell
# FROM RIDGE
ldapsearch (objectClass=foreignSecurityPrincipal) --attributes cn,memberOf --hostname atlas.local --dn DC=atlas,DC=local
# Bind Failed: 49
# KDC_ERR_S_PRINCIPAL_UNKNOWN
```

In this scenario, LDAP enumeration against ATLAS fails because RIDGE cannot initiate inter-realm Kerberos authentication toward ATLAS. The trust exists, but its direction prevents RIDGE identities from being accepted by the ATLAS KDC. The error does not mean the trust is absent. It means RIDGE is on the trusting side, and that side cannot initiate cross-domain authentication back into the source by design. As a result, it is not possible to enumerate FSPs or other objects in ATLAS using the current security context. That would only be possible with valid ATLAS credentials.

- [ ] Attack mode

In a scenario where `trustDirection = 2` from RIDGE, the natural trust direction prevents authentication toward ATLAS. However, if an attacker gains domain-control-equivalent privileges in RIDGE, they can extract the shared key associated with the trust account (`<DOMAIN>$`). This key, known as the trust key, is used by both domains to validate inter-realm tickets.

With that key, the attacker can generate valid inter-realm tickets that the ATLAS KDC will accept as legitimate because they are signed with the shared trust key. At that point, the original trust direction stops being an effective limitation. The attacker no longer depends on the normal Kerberos referral flow and can instead present tickets that the remote domain will validate as authentic.

This requires elevated privilege in RIDGE (for example, DCSync-equivalent replication rights). It is therefore not a direct escalation path, but an advanced trust-direction bypass after full compromise of the domain.

### `trustDirection:3` — Bidirectional trust

When a new domain is added to an existing forest, Active Directory automatically creates a bidirectional, transitive trust between the new domain and the rest of the forest. It does not matter how deep the tree is (`child.domain.com`, `grandchild.child.domain.com`, and so on). Because of intra-forest transitivity, every domain in the forest implicitly trusts the others. When querying the TDO, a bidirectional trust with `atlas.local` is visible:

```powershell
ldapsearch (objectClass=trustedDomain)

name: atlas.local
trustDirection: 3
trustAttributes: 32
flatName: ATLAS
```

- `trustDirection: 3` → bidirectional trust (INBOUND + OUTBOUND).
- `trustAttributes: 32` → `WITHIN_FOREST`: internal trust inside the same forest. It is transitive and SID filtering does not apply.
- `flatName: ATLAS` → NetBIOS name of the root domain.

In this scenario, any valid identity in one domain of the forest can authenticate in the others, as long as the ACLs allow it.

- [ ] Attack mode

In a `WITHIN_FOREST` environment, if an adversary obtains Domain Admin in a child domain, they can escalate to forest level because internal trusts do not apply SID filtering. That allows a Kerberos ticket issued in the compromised domain to include additional SIDs in the `SIDHistory` field, and those SIDs will be accepted by other domains in the forest.

`SIDHistory` is a legitimate attribute used during domain migrations, but it can be abused in forged-ticket scenarios (Golden / Diamond) to insert the SID of a privileged group from the root domain, such as `Enterprise Admins (RID 519)`. Because intra-forest trusts do not filter SIDs, the root domain KDC will accept the ticket as valid, giving the attacker Enterprise Admin-equivalent privileges.

By injecting the forged ticket into memory (PTT), the attacker can authenticate to forest DCs and take full control.

In an Active Directory forest, compromising one domain can potentially mean compromising the entire forest unless additional protections are in place.
