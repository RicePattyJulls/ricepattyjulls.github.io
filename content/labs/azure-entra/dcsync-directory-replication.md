## Overview

DCSync simulates the behavior of a secondary Domain Controller to request credential replication from the primary DC via the MS-DRSR protocol. Rather than dumping memory or accessing the NTDS.dit file directly, it abuses the legitimate AD replication mechanism — any account with the required replication permissions can request that the DC "replicate" credential data for any account in the domain.

In hybrid environments, this technique is relevant as the endpoint of cloud-to-on-prem attack chains: a compromised cloud identity that gains on-prem replication rights (via Password Writeback to a privileged account, or lateral movement to a host with delegation to the DC) can extract credential material from the AD without physically accessing any DC.

## Required Permissions

Two Extended Rights on the domain object are required:

| Permission GUID | Name |
|---|---|
| `1131f6aa-9c07-11d1-f79f-00c04fc2dcd2` | DS-Replication-Get-Changes |
| `1131f6ab-9c07-11d1-f79f-00c04fc2dcd2` | DS-Replication-Get-Changes-All |

By default, only Domain Admins, Enterprise Admins, and Domain Controllers hold these rights. DCSync fails if either is missing.

## Verifying Replication Permissions

```powershell
Import-Module ActiveDirectory
$domainDN  = (Get-ADDomain).DistinguishedName
$acl       = Get-Acl "AD:\$domainDN"
$replGuids = @(
    "1131f6aa-9c07-11d1-f79f-00c04fc2dcd2",
    "1131f6ab-9c07-11d1-f79f-00c04fc2dcd2"
)

$acl.Access | Where-Object {
    $replGuids -contains $_.ObjectType.ToString() -and
    $_.ActiveDirectoryRights -match "ExtendedRight"
} | Select-Object IdentityReference, ObjectType | Format-Table
```

Any identity in the output — beyond DCs — is a DCSync candidate.

## Attack Chain

```
Compromised identity with replication rights (DA, custom ACL, or delegated)
     ↓
Network access to DC on port 135 + dynamic RPC range
     ↓
MS-DRSR replication request for target account
     ↓
DC responds with: NTLM hash, AES-128/256 Kerberos keys, password history
     ↓
High-value targets: krbtgt (Golden Ticket), Administrator, machine accounts ($)
```

## Tooling (Canonical Public Tools)

**Impacket secretsdump (Linux/remote):**
```bash
# Single account
python3 secretsdump.py <DOMAIN>/<username>:<password>@<DC-IP> -just-dc-user <TARGET>

# With NTLM hash instead of password (Pass-the-Hash)
python3 secretsdump.py <DOMAIN>/<username>@<DC-IP> -hashes :<NTLM_HASH> -just-dc-user <TARGET>
```

**Mimikatz (Windows, canonical reference):**
```
lsadump::dcsync /user:<DOMAIN>\<target> /domain:<domain.corp> /dc:<dc-hostname>
```

## Priority Accounts for Extraction

| Account | Why |
|---|---|
| `krbtgt` | Hash enables Golden Ticket — forged TGTs valid for 10 years by default |
| `Administrator` | Domain Admin — direct access to all domain resources |
| `<DOMAIN-DC>$` | DC machine account — holds replication rights, usable for OverPass-the-Hash |
| gMSA accounts (`<name>$`) | Service accounts with privileged access — hash derivable via DSInternals |

## Hybrid Context: How This Connects to Azure

DCSync becomes relevant in cloud attack chains when:
1. **Password Writeback** resets a privileged on-prem account → attacker gains AD access → finds accounts with replication rights → DCSync
2. **Hybrid-joined machine compromise** via Azure Arc Run Command → AD-connected host → DCSync from within
3. **Service principal abuse** grants access to a VM running AD-connected services → lateral movement to replication-capable host

## Operator Notes

- Extract only the accounts needed — dumping all domain hashes (`/all`) is significantly noisier and rarely necessary for a specific objective.
- RC4 (NTLM-based) Kerberos requests may be anomalous in environments that have enforced AES-only Kerberos — check Kerberos encryption policy during recon.
- Network access from a non-DC host to the DC on MS-DRSR ports (135 + dynamic RPC) is not inherently blocked but may be monitored.
- DCSync requires the requesting host to establish a connection to the DC — not to a domain member or LDAP. Direct DC reachability is required.

## Detection / Friction Points

- Event `4662` on the DC: Directory Service Access with the replication GUIDs — the requesting identity and accessed attributes are logged. This is the primary detection signal.
- Microsoft Defender for Identity generates a `DCSync attack detected` alert when a non-DC host performs replication requests.
- Replication traffic from a workstation or server IP (not a DC IP) to a DC on RPC ports is anomalous — network-level detection via flow analysis or NDR tools.
- Entra ID does not log DCSync directly — detection lives entirely on the on-prem DC and network monitoring stack.
