## Overview

Some applications authorize users based on the value of the `email` claim in their token or profile — checking for specific prefixes, domains, or patterns that signal elevated access. If that attribute is modifiable by the attacker (directly or via Graph), changing it to match the expected pattern causes the application to grant elevated access without compromising a privileged account.

This is not a flaw in Entra ID. It is an application logic error: trusting a mutable identity attribute as an authorization control. Entra ID accurately reports what the attribute contains — the application incorrectly treats it as authoritative for access decisions.

## Preconditions

| Requirement | Detail |
|---|---|
| Application authorizes on email attribute | App evaluates `email`, `mail`, or `otherMails` claim to determine access level |
| Modifiable attribute | Own user with self-service profile edit, or `User Administrator` role to modify others |
| Known target pattern | The value that triggers elevated access — discoverable through app behavior and error messages |

## Identifying the Pattern

Observable signals during application recon:

- Profile shows email as an editable field
- Application behavior changes noticeably based on email value (different UI, options, error messages)
- App returns messages like "access is based on your email address" or "use your corporate email"
- API responses include email as part of a permission or role evaluation

Common patterns to test:

```
admin<username>@<domain>
<username>admin@<domain>
<username>@admin.<domain>
admin@<domain>          ← catch-all admin domain
<username>+admin@<domain>
```

## Attack Chain

```
Observe app behavior  →  identify email-based authorization logic
                      ↓
Determine pattern     →  what email value triggers elevated access
                      ↓
Modify attribute      →  Graph PATCH on user object (otherMails or mail)
                      ↓
Re-authenticate       →  new token carries updated email claim
                      ↓
Access elevated       →  app grants higher access based on new claim value
                      ↓
Revert (opsec)        →  restore original value to reduce audit trail
```

## Attribute Modification via Graph

```powershell
# Modify otherMails — editable by the user or by User Administrator
$body = @{
    otherMails = @("admin<username>@<tenant>.onmicrosoft.com")
} | ConvertTo-Json

Invoke-RestMethod `
    -Method PATCH `
    -Uri "https://graph.microsoft.com/v1.0/users/<USER_OBJECT_ID>" `
    -Headers @{ Authorization = "Bearer $Graph"; "Content-Type" = "application/json" } `
    -Body $body
```

After modifying, sign out and re-authenticate so the new token carries the updated claim. Then verify application behavior.

## Operator Notes

- `otherMails` is generally editable with less privilege than `mail`. Determine which field the application reads before deciding what permissions are needed.
- `mail` (primary email) requires `User Administrator` or higher to modify. `otherMails` may be user-editable depending on tenant policy.
- The change takes effect on the next token issuance — no token refresh is sufficient, a full re-authentication is needed.
- Revert the attribute after the operation. The PATCH generates an `Update user` event in the Entra ID Audit Log with before/after values — the window of exposure is the time between modification and revert.

## Detection / Friction Points

- `Update user` event in Entra ID Audit Log — actor, timestamp, attribute name, old and new values are all logged.
- If the application also logs the email claim from tokens, the modified value will appear in application logs.
- Entra ID does not alert on `otherMails` changes by default — detection depends on audit log monitoring and alerting rules.
- Mitigation: application should not use mutable user attributes as sole authorization control — verify group membership or directory role instead.
