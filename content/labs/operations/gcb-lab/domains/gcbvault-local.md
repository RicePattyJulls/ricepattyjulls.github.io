## 1. BASELINE (What exists in the environment?)

No traditional AD enumeration was necessary for `gcbvault.example`. Access to `VAULT-SRV` provided direct control over the domain's virtual infrastructure, including the Domain Controller itself. The relevant attack surface was not in new escalation paths but in abusing the virtualization layer.

## 2. IDENTITY (What can I do?)

From `VAULT-SRV` (`10.200.7.1`), it is possible to interact directly with the domain's virtual machines, extract secrets from `VAULT-DC` offline, and project the compromise to additional systems such as `VAULT-DB`.

## 3. ATTACK PATH (What am I going to do?)

> No AD-based attack path development was required. Access to `VAULT-SRV` grants a privileged position over the virtualized domain infrastructure — the entire domain is accessible from the hypervisor layer.

**Attack Threads**

1. `VAULT-SRV` → mount `VAULT-DC` virtual disk → offline `NTDS.dit` + `SYSTEM` extraction → full domain credential set
2. Recovered credential (`vaultdbadmin : REDACTED_SECRET`) → `PowerShell Direct` to `VAULT-DB` → lateral movement without network dependency
3. `VAULT-DB` → identify sensitive artifacts (`transfer.txt`) → confirm business-level impact

**Tactical Support**

- Access already materialized on the Hyper-V host
- Offline domain controller abuse possible — no authentication or network required
- `PowerShell Direct` enables lateral movement without network connectivity
- Reusable credentials and sensitive data exposed within the environment
