## Overview

Some Entra ID tenants enable self-service B2B registration, allowing external users to request access to an application without being explicitly invited by an administrator. The attacker — acting as an external identity — navigates to the target application URL, initiates the registration flow, and gains access if the tenant allows it.

The MFA registration bypass is a secondary condition: when the tenant requires MFA but the user has no MFA method registered, Entra ID may prompt the user to *register* a method during that first access rather than requiring an already-registered one. This allows the attacker to register their own device as the MFA factor — satisfying the requirement with a method entirely under their control.

This is not a technical exploit of Entra ID. Both behaviors — self-service registration and MFA registration on first access — are functioning as configured. The weakness is in the policy: trusting unverified external identities to self-register, and allowing MFA method registration without prior identity verification.

## Preconditions

| Requirement | Detail |
|---|---|
| Self-service B2B registration enabled | Tenant allows external users to request access without admin invitation |
| Application accessible externally | A URL that initiates the B2B registration flow must be reachable |
| MFA not pre-registered | Tenant requires MFA but allows registration during first access instead of requiring prior enrollment |
| External identity to use | Attacker's own identity from their tenant, used to initiate the B2B flow |

## Identifying Self-Service Registration Availability

From outside the tenant — observable signals at the application URL:

```
- Flow shows "Request access" or "Sign up" instead of an error
- After authenticating with external identity, shown an access request form
- No immediate 403 or redirect to an admin for approval
```

From inside the tenant (if Graph access exists):

```powershell
$policy = Invoke-RestMethod -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/policies/authorizationPolicy" `
    -Headers @{ Authorization = "Bearer $Graph" }

$policy | Select-Object allowInvitesFrom, allowedToSignUpEmailBasedSubscriptions,
                         allowEmailVerifiedUsersToJoinOrganization | Format-List
```

## Attack Chain

```
Navigate to application URL  →  target tenant's app (azurewebsites.net, SharePoint, etc.)
                             ↓
Authenticate as external ID  →  attacker@attacker-tenant.com
                             ↓
Complete B2B registration    →  access request form or automatic provisioning
                             ↓
If MFA required:
  Entra ID shows            →  "Set up your security info" (registration, not satisfaction)
  Attacker registers        →  Authenticator app, SMS, or FIDO2 on attacker-controlled device
  Immediately satisfies     →  MFA requirement with the just-registered method
                             ↓
Access granted              →  attacker has authenticated session in target tenant as B2B guest
                             ↓
Enumerate permissions        →  appRoleAssignments, RBAC, available resources
```

## Verifying Access Obtained

After registration and authentication:

```powershell
# Confirm identity context in destination tenant
Invoke-RestMethod -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/me?`$select=displayName,userPrincipalName,userType" `
    -Headers @{ Authorization = "Bearer $Graph" } | Format-List

# userType: Guest — confirms B2B status in the tenant

# Check what app roles were granted
Invoke-RestMethod -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/me/appRoleAssignments" `
    -Headers @{ Authorization = "Bearer $Graph" } | Select-Object -ExpandProperty value | Format-List
```

## Operator Notes

- The guest object created in the target tenant has the format `user_sourcedomain.com#EXT#@targettenant.onmicrosoft.com`. All activity from this identity is logged under that UPN in the target tenant.
- App roles granted during self-service registration are typically limited to the specific application. Enumerate carefully to understand the actual access surface.
- If the tenant requires admin approval for the access request, the flow will enter a pending state — the attack only works if approval is automatic or if access is granted without review.
- The MFA registration step only works if the user has *no* MFA methods registered. If the attacker's external identity already has MFA registered in their home tenant, Entra ID may honor that existing registration and skip the setup step.

## Detection / Friction Points

- Self-service access request events appear in the Entra ID Audit Log under the target tenant.
- MFA method registration during first access is logged as a method enrollment event — unusual for a brand-new guest identity.
- The `#EXT#` UPN format makes guest activity distinguishable in logs — if guest sign-ins are monitored, an unfamiliar external domain is visible.
- Disabling self-service B2B registration (`allowInvitesFrom: adminsAndGuestInviters`) or requiring pre-registered MFA before first access closes both vectors.
