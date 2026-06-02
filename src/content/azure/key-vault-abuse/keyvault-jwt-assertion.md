## Overview

When a Service Principal has a certificate registered in Entra ID, that certificate can be used to authenticate via a signed JWT (`client_assertion`) instead of a client secret. If that certificate's private key is stored in Azure Key Vault, an attacker with data plane access to the vault can sign the JWT assertion directly via the Key Vault API — without ever exporting the private key from the vault.

This converts Key Vault data plane access (`keys/sign/action`) into Service Principal authentication, which in turn yields access tokens for any resource that SP has permissions on.

## Required Data Actions

```
Microsoft.KeyVault/vaults/certificates/read   → enumerate certs, read x5t and kid
Microsoft.KeyVault/vaults/keys/read           → validate key metadata and key_ops
Microsoft.KeyVault/vaults/keys/sign/action    → sign the JWT payload (critical)
```

## Certificate Eligibility Criteria

A Key Vault certificate is usable for JWT assertion if all of the following are true:

| Field | Condition |
|---|---|
| `enabled` | `true` |
| `nbf` / `exp` | Current time is within validity window |
| `x5t` | Present — used as JWT header thumbprint |
| `kid` | Present — identifies the key endpoint for signing |
| `key_ops` | Contains `sign` |

Enumerate certificates against the vault and filter by these criteria before attempting the assertion.

## Attack Chain

```
[Key Vault AT with certificates/read + keys/read + keys/sign/action]
     │
     ▼
Enumerate /certificates → filter for usable candidates
     │
     ▼
Build JWT header (alg: RS256, x5t: <thumbprint>)
     + JWT payload (iss/sub: <APP_CLIENT_ID>, aud: /oauth2/v2.0/token, exp: now+5m)
     │
     ▼
Hash header.payload (SHA-256) → POST to /keys/<KID>/sign (RS256)
     ← base64url signature from Key Vault
     │
     ▼
Assemble signed JWT: header.payload.signature
     │
     ▼
POST /oauth2/v2.0/token
     client_id             = <APP_CLIENT_ID>
     client_assertion      = <signedJWT>
     client_assertion_type = urn:ietf:params:oauth:grant-type:jwt-bearer
     grant_type            = client_credentials
     scope                 = <target_resource>/.default
     │
     ▼
Access token for the Service Principal → Graph, ARM, Storage, Key Vault
```

## Token Exchange (sanitized snippet)

```powershell
$uri  = "https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token"
$body = @{
    client_id             = "<APP_CLIENT_ID>"
    client_assertion      = $signedJWT          # output of signing function
    client_assertion_type = "urn:ietf:params:oauth:grant-type:jwt-bearer"
    grant_type            = "client_credentials"
    scope                 = "https://graph.microsoft.com/.default"
}
$response = Invoke-RestMethod -Method POST -Uri $uri -Body $body `
    -ContentType "application/x-www-form-urlencoded"
$GraphToken = $response.access_token
```

## Operator Notes

- This is a data plane attack, not a control plane attack. Access to the vault's management operations (ARM) is not required — only the vault endpoint (`https://<vault>.vault.azure.net`) matters.
- The private key never leaves Azure Key Vault. The vault performs the signing operation server-side. The output is only the signature value.
- The assertion JWT is valid for a short window (typically 5 minutes). It cannot be reused — generate a new one per token request.
- The resulting access token is app-only (client credentials flow). No user context is involved.
- Target scope determines which resource the SP authenticates against. If the SP has Graph, ARM, and Storage permissions, pivot to each with the same pattern.
- After obtaining the SP token, pivot to enumeration via `entraId.ps1` to map what that SP can reach.

## Tooling

The full certificate enumeration function and `New-SignedJWTWithKeyVault` signing function are in the Operator Toolkit on GitHub
