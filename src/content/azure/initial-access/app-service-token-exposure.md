## Overview

Azure App Services that implement delegated auth flows sometimes return access tokens in their HTTP responses — in the response body, in a JSON payload, or via a dedicated "fetch token" UI element. This occurs in demo applications, development environments left exposed, or applications that pass tokens to their frontend without sufficient protection.

If the authenticated session carries a privileged identity and the exposed token has a useful audience — Graph, ARM, Key Vault, Storage — the token can be extracted and reused outside the application entirely.

## Preconditions

| Condition | Detail |
|---|---|
| App Service accessible | Reachable via public domain (`azurewebsites.net`) or private network with access |
| Authenticated session with target identity | Token returned is scoped to the authenticated user's permissions |
| Token exposed in response | App has UI element, API endpoint, or button that returns the token |
| Useful audience | `aud` claim maps to a resource the attacker wants to reach |

## Reconnaissance

When exploring an App Service with an authenticated session, look for:

- Buttons or links labeled `Get Token`, `Fetch Access Token`, `Show Credentials`, `Get Credentials`
- API endpoints that return JSON with `access_token` or `token` fields
- JavaScript source referencing token storage or token-issuing endpoints
- Source HTML that includes JWT material inline

## Attack Chain

```
Authenticate to App Service  →  with compromised identity session
                             ↓
Locate token endpoint        →  UI button, API route, or JS source
                             ↓
Extract token from response  →  access_token field in JSON body
                             ↓
Decode JWT payload           →  verify aud, scp/roles, upn, exp
                             ↓
Reuse against target API     →  Graph, ARM, Key Vault, or Storage
                             ↓
If RT also exposed           →  chain to FOCI pivot for persistent access
```

## Token Validation

Before reusing, decode the JWT to confirm what it can reach:

```powershell
$parts   = $exposedToken.Split(".")
$payload = [System.Text.Encoding]::UTF8.GetString(
    [Convert]::FromBase64String(
        $parts[1].PadRight($parts[1].Length + (4 - $parts[1].Length % 4) % 4, '=')
    )
) | ConvertFrom-Json

$payload | Select-Object aud, scp, roles, upn, exp | Format-List
```

Key fields to check:

| Field | What it means |
|---|---|
| `aud` | Which resource the token is valid for |
| `scp` | Delegated scopes granted |
| `roles` | App roles if the token is app-only |
| `upn` | Identity the token belongs to |
| `exp` | Unix timestamp for expiration |

## Operator Notes

- Access tokens are typically valid for ~1 hour. Operate quickly or return to the endpoint to fetch a fresh token if the app allows it.
- If the application also exposes a `refresh_token`, the access window extends significantly — chain to the FOCI technique for scope pivoting without re-authentication.
- The target identity's permissions determine what the token can reach. Use the identity enumeration module (`entraId`) to map what that principal has access to before pivoting.
- App Service `Authentication` configuration in Azure Portal shows whether Entra ID auth is configured — check during initial recon to understand the auth model before accessing the app.

## Detection / Friction Points

- Token use outside the application generates API calls from a different IP/client — Entra ID sign-in logs will show the token being used, not a fresh interactive login.
- The sign-in event showing token issuance appears under the App Service's client application, not the attacker's client — the source application is logged.
- If the application logs token fetch events, those are recorded at the application layer.
- Mitigation: tokens should never be returned to the client if they are not needed there; use backend-to-backend calls with managed identity instead.
