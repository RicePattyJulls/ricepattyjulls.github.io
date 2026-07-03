## Overview

Azure Automation runbooks write their output to a job log that is stored by the Automation Account and accessible via the ARM API. The output is stored in plaintext — Azure Automation applies no encryption, redaction, or access control beyond the RBAC permission `jobs/output/read` on the account. A runbook that writes credentials, connection strings, tokens, or any other sensitive data to its output exposes that data to every identity with this permission.

The attack surface: runbooks are commonly used to provision infrastructure, create accounts, rotate credentials, or interact with external systems. Any data generated during these operations and printed to output — including dynamically generated passwords, API keys, or IP addresses — becomes readable through a single ARM API call.

## Preconditions

| Permission | Purpose |
|---|---|
| `Microsoft.Automation/automationAccounts/jobs/read` | List jobs and query status |
| `Microsoft.Automation/automationAccounts/jobs/output/read` | Read the full stdout of any completed job |
| `Microsoft.Automation/automationAccounts/runbooks/read` *(optional)* | Read runbook metadata |
| `Microsoft.Automation/automationAccounts/runbooks/content/read` *(optional)* | Export runbook source code |

`jobs/output/read` is the critical permission. Without a Job ID to target, `jobs/read` is needed to enumerate recent executions.

## Attack Chain

```
Enumerate Automation Accounts  →  ARM API or Az PowerShell
                               ↓
Check permissions              →  confirm jobs/output/read on the account
                               ↓
List recent jobs               →  GET /automationAccounts/<NAME>/jobs
                               →  filter by runbook name and completion status
                               ↓
Read job output                →  GET /jobs/<JOB_ID>/output
                               ↓
Extract credentials            →  passwords, tokens, IPs, connection strings in plaintext
                               ↓
Optional: export runbook       →  GET runbook content to understand what data it generates
                               →  identify Automation credentials used by the runbook
```

## Reading Job Output

```powershell
$sub     = "<SUB_ID>"
$rg      = "<RESOURCE_GROUP>"
$account = "<AUTOMATION_ACCOUNT>"
$jobId   = "<JOB_ID>"

$basePath = "/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.Automation/automationAccounts/$account"
$uri      = "https://management.azure.com$basePath/jobs/$jobId/output?api-version=2023-11-01"

$output = Invoke-RestMethod -Method GET -Uri $uri `
    -Headers @{ Authorization = "Bearer $ARM" }

Write-Host $output
```

## Listing Recent Jobs to Identify Targets

```powershell
$uri = "https://management.azure.com$basePath/jobs?api-version=2023-11-01"
$jobs = (Invoke-RestMethod -Method GET -Uri $uri -Headers @{ Authorization = "Bearer $ARM" }).value

$jobs | Select-Object @{n="JobId";e={$_.properties.jobId}},
                       @{n="Runbook";e={$_.properties.runbook.name}},
                       @{n="Status";e={$_.properties.status}},
                       @{n="StartTime";e={$_.properties.startTime}} |
    Sort-Object StartTime -Descending | Format-Table
```

Target jobs with status `Completed` from runbooks whose names suggest credential handling: `New-*`, `Create-*`, `Provision-*`, `Reset-*`, `Rotate-*`.

## Exporting the Runbook Source

```powershell
Export-AzAutomationRunbook `
    -AutomationAccountName "<AUTOMATION_ACCOUNT>" `
    -ResourceGroupName     "<RESOURCE_GROUP>" `
    -Name                  "<RUNBOOK_NAME>" `
    -Slot                  Published `
    -OutputFolder          ".\runbooks"
```

Runbook source reveals: which Automation credentials it uses, what systems it accesses, what data it writes to output, and whether it interacts with external services (AWS, GCP, databases).

## Job ID Obtained Externally

Job IDs sometimes surface outside the Automation Account:
- GitHub issue comments (bots that post execution results)
- Webhook responses from pipelines that trigger runbooks
- Application logs that record job submission confirmations
- Teams or email notifications from automation workflows

A Job ID obtained from any of these sources, combined with `jobs/output/read`, yields full job output without requiring access to the Automation Account UI or additional permissions.

## Operator Notes

- Job output persists in Azure Automation for 30 days by default. Historical job outputs from runbooks that ran weeks ago are still readable if within the retention window.
- Automation credentials (username/password pairs stored in the Automation Account) are separate from job output — they require `automationAccounts/credentials/read` and `getValues/action`. But runbooks that use these credentials and print them during execution expose them via the job output.
- Cross-cloud scenarios: runbooks that provision or interact with AWS, GCP, or on-premises systems may write those systems' credentials to output. The Automation Account becomes a pivot point to infrastructure outside Azure.
- Runbook source code may contain hardcoded values — export the source in addition to reading output for a complete picture.

## Detection / Friction Points

- ARM Activity Log records `Get job output` — actor, job ID, and Automation Account name are logged.
- High-volume job output reads across multiple Job IDs in a short window may appear anomalous if log alerting is in place.
- No Entra ID sign-in event is generated for job output reads — the operation is an ARM control plane call.
- Mitigation: runbooks should use Automation credentials or Key Vault references for secrets, not generate and print them. Scope `jobs/output/read` tightly — do not include it in broad Automation Account reader roles.
