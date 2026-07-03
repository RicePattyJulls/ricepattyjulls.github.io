## Overview

Device Code Flow (DCF) phishing abuses the OAuth 2.0 device authorization grant — a flow designed for input-constrained devices — to redirect authentication tokens to an attacker-controlled session. The attacker initiates the flow and delivers the resulting `user_code` to the victim via any social channel. When the victim authenticates, the token lands on the attacker side, not the victim's.

No credentials are required. The technique works through MFA as long as the victim completes the flow and DCF is not explicitly blocked by Conditional Access for the client ID in use.

## Requirements

| Requirement | Detail |
|---|---|
| Client ID | Any public Microsoft first-party app ID. FOCI-family IDs (e.g. Microsoft Office) maximize scope and enable refresh token reuse across resources. |
| Delivery channel | Any channel that reaches the victim — email, Teams, SMS. The verification URL is public and requires no prior authentication. |
| CA Policy gap | If a policy blocks the device code grant type or the specific client ID for the target user, token issuance fails. Enumerate CA policies during recon. |

## Attack Chain

```
Attacker  →  POST /oauth2/v2.0/devicecode (client_id, scope)
          ←  device_code + user_code + verification_uri

Attacker  →  delivers user_code to victim via social engineering

Victim    →  https://microsoft.com/devicelogin
          →  enters user_code
          →  completes primary auth + MFA

Attacker  →  polling POST /oauth2/v2.0/token (device_code)
          ←  access_token + refresh_token (foci: 1 if FOCI-eligible client)
```

## Minimal Example

```powershell
$body = @{
    client_id = "<CLIENT_ID>"   # Use a FOCI client ID
    scope     = "https://graph.microsoft.com/.default offline_access openid"
}
$r = Invoke-RestMethod -Method POST `
    -Uri "https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/devicecode" `
    -Body $body -ContentType "application/x-www-form-urlencoded"

# Deliver $r.user_code to target — poll $r.device_code until token received
```

## Operator Notes

- Use a FOCI-family client ID from the start — the resulting refresh token can then pivot to Graph, ARM, Key Vault, and Storage without re-authentication.
- The `user_code` validity window is approximately 15 minutes. Time delivery accordingly.
- Refresh tokens from this flow are typically valid for 90 days with activity. Persistence does not require repeating the phishing step.
- Check CA policy coverage before execution. If DCF is blocked at the tenant or application level, the request will fail at the polling step.
- Scope selection determines what the access token can reach. Request `offline_access` to ensure a refresh token is included.

## FOCI Pivot (post-phishing)

Once a FOCI-eligible refresh token is in hand, use it to request access tokens against different resource audiences without re-authentication. See **FOCI — Refresh Token Pivot** for the full technique.

## Tooling

Full acquisition loop, polling logic, and FOCI detection are handled by `get_token.ps1` (DCF mode) from the Operator Toolkit. See GitHub reference.
