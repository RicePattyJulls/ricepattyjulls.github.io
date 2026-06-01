## Overview

Active Directory forest trusts allow authenticated identities from one forest to access resources in a trusting forest. The trust relationship itself does not grant access — it establishes authentication interoperability. Access depends entirely on explicit ACLs in the destination forest that grant permissions to source-forest identities.

In hybrid Azure environments, cross-forest trust paths are relevant when an organization's Azure-integrated forest has a trust relationship with a partner, subsidiary, or segmented forest. Compromising a privileged identity in the source forest opens any resource in the destination forest that has been explicitly shared with source-forest groups.

## Trust Direction Terminology

```
Forest A  ──[Outbound Trust]──▶  Forest B
                                       ↑
                               Identities from A
                               can authenticate to B
                               (B trusts A)
```

An **Outbound** trust from Forest A toward Forest B means Forest A identities can authenticate into Forest B — the exploitation perspective when compromised in Forest A.

## Preconditions

| Requirement | Detail |
|---|---|
| Compromised privileged identity in source forest | Domain Admin or equivalent — needed to generate cross-forest referral tickets |
| Active trust relationship | Outbound trust toward the target forest |
| Resources in destination forest with permissive ACLs | Must explicitly grant access to source-forest groups or users |
| DNS resolution for both forests | Destination forest FQDN must resolve from the attacker's host |

## Enumerating Trust Relationships

```powershell
Import-Module ActiveDirectory

# List all trusts from the current domain
Get-ADTrust -Filter * |
    Select-Object Name, TrustType, TrustDirection, Source, Target | Format-Table

# Cross-check with nltest
nltest /domain_trusts
```

`TrustDirection: Outbound` confirms the current forest's identities can authenticate into the named destination. `Bidirectional` means both directions work.

## Attack Chain

```
Enumerate trusts  →  identify Outbound trust to destination forest
                  ↓
Resolve DNS       →  ensure destination forest FQDN and DC hostnames resolve
                  ↓
Authenticate      →  use compromised DA credentials/TGT in source forest
                  →  access destination forest resources via trust referral
                  ↓
Enumerate         →  list accessible shares, enumerate AD objects in destination
                  ↓
Identify ACLs     →  find resources granting access to source-forest groups
                  ↓
Exploit           →  read/write shares, enumerate users/groups, lateral move
```

## Discovering Cross-Forest Resource ACLs

```powershell
# Enumerate computers in destination forest via trust
Get-ADComputer -Filter * -Server <DESTINATION.FOREST> |
    Select-Object Name, DNSHostName | Format-Table

# List accessible shares on destination DC
net view \\<DESTINATION-DC>.<DESTINATION.FOREST>

# Check SYSVOL access (confirms trust authentication works)
dir \\<DESTINATION-DC>.<DESTINATION.FOREST>\SYSVOL

# Enumerate groups in destination forest
Get-ADGroup -Filter * -Server <DESTINATION.FOREST> |
    Select-Object Name, GroupScope | Format-Table
```

## Accessing Cross-Forest Resources

Once a resource is identified as accessible, standard Windows UNC paths work transparently via the trust:

```powershell
# List share contents
Get-ChildItem \\<destination-server>.<DESTINATION.FOREST>\<ShareName>

# Copy files across the trust
Copy-Item \\<destination-server>.<DESTINATION.FOREST>\<ShareName>\<file> -Destination .\
```

Kerberos handles the cross-forest referral automatically — the KDC in the source forest issues a referral ticket, and the destination DC issues a service ticket if the identity is authorized.

## Operator Notes

- The trust does not grant access to all destination forest resources — only those with explicit ACLs for source-forest groups. Finding those ACLs is the reconnaissance step.
- `Domain Admins` of Forest A are not automatically `Domain Admins` of Forest B in a standard trust — but they may be granted access to specific resources if an admin explicitly added the source-forest group to destination-forest ACLs.
- SID filtering (quarantine) on trusts blocks certain SID types from crossing — if SID filtering is enabled, SIDs from special groups (Enterprise Admins, Schema Admins) are stripped from cross-forest authentication. Check trust attributes during enumeration.
- Cross-forest Kerberos generates referral tickets visible in `klist` — useful for confirming which trusts are actively being exercised.
- In hybrid environments, if both forests are synced to the same Entra ID tenant, cloud-level group memberships and RBAC assignments may also reflect cross-forest access — worth checking both planes.

## Detection / Friction Points

- Cross-forest authentication generates `4768` and `4769` events on both the source and destination DCs — the referral path is fully auditable if both forests have logging enabled.
- Unusual access patterns from source-forest identities to destination-forest resources may trigger alerts if the identity doesn't normally cross the forest boundary.
- SID history attacks (adding source-forest privileged SIDs to user objects) are a related technique — SID filtering exists specifically to block this. Verify whether filtering is enabled before relying on it.
- Mitigation: audit cross-forest ACLs regularly; enable SID filtering on all external trusts; monitor cross-forest authentication events at the destination DC.
