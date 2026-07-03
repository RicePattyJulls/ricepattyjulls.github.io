## Overview

A Shared Access Signature (SAS) URL is a pre-signed URL that grants scoped access to an Azure Storage resource — blob, container, file share, or queue — without requiring an OAuth token, an Entra ID identity, or an RBAC assignment. Access is entirely encoded in the URL itself: the signature, the permission set, the scope, and the validity window are all parameters in the query string.

Anyone who possesses a valid SAS URL has the access it describes for its entire validity window. There is no authentication step, no identity to compromise, and no token to acquire. If the URL is unexpired, the access is immediate and unconditional.

## SAS URL Anatomy

```
https://<storage-account>.blob.core.windows.net/<container>/<blob>
  ?sv=<version>
  &se=<expiry-datetime>
  &sr=<scope>
  &sp=<permissions>
  &sig=<hmac-signature>
```

| Parameter | Meaning |
|---|---|
| `sv` | Storage service version |
| `se` | Expiry — ISO 8601 UTC datetime. After this, the URL returns 403. |
| `sr` | Scope: `b` = blob, `c` = container, `s` = file share, `q` = queue |
| `sp` | Permissions: `r` read, `w` write, `d` delete, `l` list, `c` create, `a` add |
| `sig` | HMAC-SHA256 signature — any modification to other parameters invalidates this |

## Where SAS URLs Are Found

SAS URLs surface in locations where Storage access is distributed to systems or users without managing identities:

```
SQL / NoSQL databases     → configuration tables, inventory tables, connection string columns
App Service config        → application settings, environment variables, connection strings
Azure Automation          → job outputs, runbook variables, parameter logs
Azure Function settings   → WEBSITE_* environment variables, host.json references
Source code repositories  → GitHub, Azure DevOps — scripts, IaC templates, deployment configs
Email and Teams messages  → shared as temporary access links, support tickets
Blob contents             → blobs that reference other blobs via SAS URL inside their payload
Application logs          → diagnostic logs that record the full URL used for storage operations
```

## Parsing a SAS URL Before Using It

Validate scope and expiry before operating:

```powershell
$sasUrl = "<SAS_URL>"
$uri    = [System.Uri]$sasUrl
$query  = [System.Web.HttpUtility]::ParseQueryString($uri.Query)

[PSCustomObject]@{
    StorageAccount = $uri.Host.Split('.')[0]
    Path           = $uri.AbsolutePath
    Expiry         = $query['se']
    Scope          = $query['sr']    # b, c, s, q
    Permissions    = $query['sp']    # r, w, l, d, c, a
    IsExpired      = ([DateTime]$query['se'] -lt [DateTime]::UtcNow)
}
```

## Read Access — Download a Blob

If the SAS URL points directly to a blob (`sr=b`, `sp` includes `r`):

```powershell
Invoke-WebRequest -Uri "<BLOB_SAS_URL>" -OutFile ".\output-file" -UseBasicParsing
```

## List Access — Enumerate Container Contents

If the SAS is scoped to a container (`sr=c`) with list permission (`sp` includes `l`):

```powershell
$storageAccount = "<STORAGE_ACCOUNT>"
$container      = "<CONTAINER_NAME>"
$sasToken       = "<QUERY_STRING_WITHOUT_LEADING_?>"

$listUrl = "https://$storageAccount.blob.core.windows.net/$container`?restype=container&comp=list&$sasToken"
[xml]$xml = (Invoke-RestMethod -Method GET -Uri $listUrl -UseBasicParsing)
$xml.EnumerationResults.Blobs.Blob | Select-Object Name,
    @{n="Size";e={$_.Properties.'Content-Length'}},
    @{n="Modified";e={$_.Properties.'Last-Modified'}} | Format-Table
```

## Write Access — Upload a Payload

If the SAS includes write permission (`sp` includes `w`):

```powershell
$blobUrl     = "<SAS_URL_FOR_TARGET_BLOB>"
$fileContent = [System.IO.File]::ReadAllBytes("<local-file>")

Invoke-RestMethod -Method PUT -Uri $blobUrl -Body $fileContent `
    -Headers @{ "x-ms-blob-type" = "BlockBlob"; "Content-Type" = "application/octet-stream" }
```

Write access to a blob that is later read by an application or pipeline creates a supply chain injection vector.

## Operator Notes

- **Irrevocability:** SAS URLs signed with the storage account key cannot be individually revoked. The only way to invalidate them before expiry is to rotate the storage account key — which invalidates all SAS tokens signed with that key across all applications using the same account. This makes valid SAS URLs exceptionally high-value once recovered.
- **No identity in logs:** When a SAS URL is used, Storage diagnostic logs record the operation but the actor is identified as the SAS token, not an Entra ID identity. No sign-in event is generated in Entra ID.
- **Time is the only gate:** After expiry (`se` parameter), the URL is dead. Before expiry, it works from any IP, any device, any network unless the SAS was created with IP restrictions (`sip` parameter) — check for that parameter.
- SAS URLs with long validity windows (`se` months or years in the future) found in source code or configuration are common — developers hard-code them during development and forget to rotate.

## Detection / Friction Points

- Storage diagnostic logs record operations by SAS token, not by identity — the log entry shows the operation (GetBlob, ListBlobs) but attributes it to the SAS signature, not a named user.
- `AuthenticationType: SAS` in storage logs distinguishes SAS-based access from OAuth/RBAC-based access — a useful filter for hunting exposed tokens.
- Microsoft Defender for Storage can detect anomalous SAS URL access patterns — access from new geographies, unusual operation volumes, or access to sensitive containers.
- Mitigation: use user delegation SAS (signed with an Entra ID identity) instead of account-key SAS — user delegation SAS can be revoked by revoking the signing identity's permissions.
