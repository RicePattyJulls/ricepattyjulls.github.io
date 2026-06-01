## Overview

Evilginx is an adversary-in-the-middle framework that positions a reverse proxy between the victim's browser and Microsoft's legitimate authentication infrastructure. The victim authenticates normally — including MFA — but every request and response passes through the attacker's server. The result is capture of both the plaintext credentials and, critically, the session cookies issued by Entra ID after authentication completes.

Session cookies represent an already-validated authentication state including the second factor. Importing them into a browser gives an attacker a live authenticated session without knowing the victim's password or satisfying MFA again.

## Preconditions

| Requirement | Detail |
|---|---|
| Controlled DNS infrastructure | Domain and DNS records pointing to the Evilginx server |
| Valid TLS certificate | Evilginx handles Let's Encrypt automatically |
| Configured phishlet | The `o365` phishlet covers Microsoft / Entra ID flows |
| Delivery vector | Any channel to reach the victim with the lure URL |
| Victim completes auth | Including MFA — the proxy captures the result regardless of method |

## Attack Chain

```
Attacker  →  configure Evilginx domain + o365 phishlet
          →  generate lure URL → deliver to victim

Victim    →  clicks lure URL
          →  sees legitimate-looking Microsoft login (valid TLS, real domain proxy)
          →  enters credentials + completes MFA

Evilginx  →  captures ESTSAUTH, ESTSAUTHPERSISTENT, SignInStateCookie
Attacker  →  imports cookies → authenticated session without credentials or MFA
```

## Session Cookies Captured

| Cookie | Lifetime | Value |
|---|---|---|
| `ESTSAUTH` | Hours | Active session — short window |
| `ESTSAUTHPERSISTENT` | Days / weeks | Persistent session — primary target |
| `SignInStateCookie` | Session | Browser state token |

`ESTSAUTHPERSISTENT` is the high-value target. With `Sign-in frequency` not configured on the tenant, it survives until explicit sign-out.

## Operator Notes

- Evilginx requires DNS propagation before the lure works — set up infrastructure ahead of time.
- The lure URL should be convincing in context. Social engineering pretext determines conversion rate more than technical setup.
- After importing cookies, navigate to `portal.azure.com` or `myapps.microsoft.com` to confirm the session is live before pivoting.
- Tokens extracted from the browser session (localStorage, sessionStorage) can be reused via PowerShell or CLI — check the `aud` claim to confirm which resource each token is scoped to.
- If the tenant enforces `Sign-in frequency` or `Persistent browser session: Never`, cookie lifetime is reduced. Check CA policies during recon.

## Detection / Friction Points

- Custom domain used as proxy — suspicious if not consistent with known attacker infra or typosquats.
- Microsoft Entra ID logs the sign-in from the proxy's IP address, not the victim's — IP anomaly may trigger Identity Protection risk signals.
- `ESTSAUTHPERSISTENT` cookie origin differs from the user's normal location — may surface in Conditional Access location-based policies.
- No detection at the application layer — the session is cryptographically valid from Microsoft's perspective.
