## Overview

Certificate-Based Authentication (CBA) is an Entra ID authentication method where an X.509 certificate satisfies a `Phishing-resistant MFA` requirement in a Conditional Access policy. Organizations deploy CBA as a stronger alternative to TOTP or SMS, believing it is resistant to phishing.

The gap: if the private key certificate associated with a user identity can be obtained from Azure Key Vault, Storage, or another source, that certificate can be presented as the second factor — satisfying the CA policy entirely. From Entra ID's perspective, the authentication is valid. The anomaly lives in the certificate acquisition path, not in the authentication event itself.

## Preconditions

| Requirement | Detail |
|---|---|
| Certificate PFX with private key | Must match the user binding configured in CBA policy (`userPrincipalName` in Subject or SAN) |
| PFX password | Required if the certificate is encrypted — sometimes reuses the user's password |
| CA policy with phishing-resistant MFA | Policy must include `x509CertificateMultiFactor` as an allowed combination |
| User in CBA scope | Target user must be in the authentication method policy that enables CBA |

## Identifying CBA Coverage

```powershell
# Find CA policies requiring phishing-resistant MFA
$policies = (Invoke-RestMethod `
    -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies" `
    -Headers @{ Authorization = "Bearer $Graph" }).value

$policies | Where-Object { $_.state -eq "enabled" } | ForEach-Object {
    $strength = $_.grantControls.authenticationStrength
    if ($strength) {
        [PSCustomObject]@{
            Policy         = $_.displayName
            AllowedMethods = $strength.allowedCombinations -join ", "
            IncludeUsers   = $_.conditions.users.includeUsers -join ", "
            IncludeGroups  = $_.conditions.users.includeGroups -join ", "
        }
    }
} | Format-List
```

Relevant output: `x509CertificateMultiFactor` in `AllowedMethods` confirms CBA is accepted by that policy.

## Certificate User Binding

CBA maps a certificate to an identity via the binding configuration:

```
Priority 1  →  userPrincipalName ← SubjectAltName PrincipalName
Priority 2  →  userPrincipalName ← SubjectAltName RFC822Name (email)
```

The certificate Subject or SAN must contain the target user's UPN. Verify before attempting:

```powershell
$cert = Get-PfxCertificate -FilePath "C:\path\to\cert.pfx"
Write-Host "Subject   : $($cert.Subject)"
Write-Host "Thumbprint: $($cert.Thumbprint)"
Write-Host "Expires   : $($cert.NotAfter)"
# Subject should contain user@tenant.com matching the target UPN
```

## Attack Chain

```
Obtain PFX   →  Key Vault (getSecret), Storage ABAC bypass, or other vector
              ↓
Verify match  →  cert Subject/SAN contains target user's UPN
               ↓
Import cert   →  into local certificate store (CurrentUser\My)
               ↓
Authenticate  →  username + password → prompted for MFA
              →  select "Use a certificate or smart card"
              →  browser presents imported certificate
              →  CA policy: x509CertificateMultiFactor ✓
               ↓
Access granted →  full authenticated session as target identity
```

## Operator Notes

- The certificate is the legitimate credential for that identity — there is no "bypass" from Entra ID's perspective. The full authentication event is logged as successful with CBA.
- Where to look for certificates: Key Vault (`getSecret` action on certificate objects), Azure Storage (ABAC bypass to read blobs), App Service configuration, Automation Account runbooks.
- PFX passwords sometimes match the user's AD password — if credentials were already compromised, try the same password on the certificate.
- After authentication, the session is indistinguishable from a normal user session. Proceed with recon and token extraction as normal.
- If the organization uses certificate-based auth, the certificates exist somewhere — the attack surface is the distribution and storage of those certificates, not the auth mechanism itself.

## Detection / Friction Points

- Entra ID logs the authentication method as `x509Certificate` — the sign-in event is present and shows CBA as the MFA method used. No anomaly at the auth layer.
- The anomaly signal is at the certificate source: Key Vault access logs, Storage access logs, or wherever the PFX was obtained — those events precede the authentication.
- If the user's normal sign-in pattern shows FIDO2 or WHfB and suddenly switches to CBA, that change in authentication method may be detectable with behavioral analytics.
- Organizations can restrict CBA to specific device states or network locations via CA policy — check for additional conditions beyond the MFA requirement during recon.
