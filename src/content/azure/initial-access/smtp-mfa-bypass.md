## Overview

Conditional Access policies in Entra ID can exclude specific applications from their controls. When `Office 365 Exchange Online` is excluded from a policy that enforces MFA, the identity can authenticate against Exchange via SMTP AUTH using only username and password — no second factor is evaluated.

SMTP AUTH uses basic authentication over the protocol, which does not pass through the standard OAuth/OIDC interactive flow. As a result, Conditional Access evaluates it differently — or not at all — depending on policy scope. The practical outcome: send mail as a legitimate corporate identity with only plaintext credentials, regardless of MFA requirements on other apps.

## Preconditions

| Requirement | Detail |
|---|---|
| Valid credentials | Username + password of the target identity |
| Exchange Online excluded from CA | The MFA-enforcing policy must exclude `Office 365 Exchange Online` from its app scope |
| SMTP AUTH enabled | May be disabled at tenant level or per-mailbox — verify during recon |

## Identifying the CA Gap

Exchange Online's AppID (`00000002-0000-0ff1-ce00-000000000000`) appearing in `excludeApplications` of an MFA policy is the signal:

```powershell
$policies = (Invoke-RestMethod `
    -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies" `
    -Headers @{ Authorization = "Bearer $Graph" }).value

$policies | Where-Object { $_.state -eq "enabled" } | ForEach-Object {
    if ($_.conditions.applications.excludeApplications -contains "00000002-0000-0ff1-ce00-000000000000") {
        Write-Host "[!] '$($_.displayName)' excludes Exchange Online"
        Write-Host "    Controls: $($_.grantControls.builtInControls)"
    }
}
```

## Attack Chain

```
Recon:   CA policy excludes Exchange Online AppID
         ↓
Verify:  SMTP AUTH enabled on tenant / mailbox
         ↓
Abuse:   Authenticate to smtp.office365.com:587
         username + password only — no MFA prompt
         ↓
Impact:  Send mail as legitimate corporate identity
         → Phishing from real corporate domain
         → Higher credibility than external sending
```

## Operator Notes

- The primary offensive value is not reading mail — it's sending mail as a trusted internal identity. Phishing sent from a real corporate address bypasses domain reputation filters and increases victim trust significantly.
- Verify SMTP AUTH is enabled for the target mailbox before attempting. Tenants increasingly disable it by default.
- If credentials were obtained via other means (LSASS dump, password spray, prior compromise), this technique converts them into a low-noise sending primitive.
- Can be combined with email content from an earlier mailbox read (Graph `Mail.Read`) to craft contextual follow-up lures.

## Detection / Friction Points

- SMTP AUTH sign-in events appear in Entra ID sign-in logs under `Client app: SMTP AUTH` — distinguishable from interactive logins.
- If the tenant monitors for SMTP AUTH usage and the target mailbox does not normally use it, the event may be anomalous.
- No MFA event generated — absence of an MFA step for an account that normally uses it could trigger alert logic if monitoring is in place.
- Block: disabling SMTP AUTH at tenant or mailbox level, or removing Exchange Online from CA exclusion lists, closes this gap.
