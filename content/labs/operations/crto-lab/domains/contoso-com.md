Once `LON-DC-1` is under control, routine domain enumeration becomes secondary. At this stage, the objective is no longer to map the local domain in depth, but to identify how existing trust relationships can be turned into lateral movement across the forest boundary. The focus shifts from ordinary host and service discovery to trust-aware enumeration: ForeignSecurityPrincipal mappings, delegated cross-domain access, and the material required to project control into `enclave.example`.
### Trust

```powershell
ldapsearch (objectClass=trustedDomain) --attributes name,flatName,trustPartner,trustType,trustAttributes,trustDirection
# name: enclave.example
# trustDirection: 1
# trustPartner: enclave.example
# trustType: 2
# trustAttributes: 8
# flatName: ENCLAVE
```

- A trust relationship exists with `enclave.example`, identified in AD as `ENCLAVE`.
- The trust is **one-way** (`trustDirection: 1`), so the direction of usable access must be interpreted carefully and cannot be assumed to be symmetric.
- The relationship is implemented as a real AD trust (`trustType: 2`), not just a naming artifact.
- From an offensive perspective, this trust is relevant because it defines the boundary through which access into `enclave.example` may later be projected, if valid trust material, mapped identities, or delegated access paths are identified.

### GPO and OU context
  
| Scope                   | Operational meaning                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `Default Domain Policy` | Global password and machine-account behavior applies across the root domain.                          |
| `OU=Domain Controllers` | `Default Domain Controllers Policy` applies to `LON-DC-1`.                                            |
| `Windows Firewall`      | Present as a domain-level control, but with no meaningful offensive impact in this path.              |
| `WinRM`                 | Enables remote administration over `5985`, expanding the usable post-exploitation surface.            |
| `Network Notifications` | Cosmetic UX policy only; no practical offensive value.                                                |
| `Windows Update`        | Reduces update enforcement and may favor persistence, but does not provide direct execution.          |
| `PowerShell Logging`    | Provides partial PowerShell visibility, but not full invocation coverage.                             |
| `Windows Defender`      | Weakens local detection through poor defensive settings, including an explicit `lsass.exe` exclusion. |
  
### Policy findings with offensive value
  
- minimum password length is only 7 characters  
- there is no lockout threshold, so password spraying remains viable  
- machine accounts do not rotate passwords (`REDACTED_SECRET`)  
- LDAP signing, SMB signing, and Netlogon signing are enabled on domain controllers, which reduces classic relay paths  
- `SeMachineAccountPrivilege` remains enabled, preserving the standard authenticated-user computer-join vector  
- WinRM is enabled over `5985`, which provides a useful remote administration channel after compromise  
- PowerShell logging is only partial, so inline C#, reflection, and reduced-visibility execution remain viable  
- Windows Defender is weakened by poor policy choices, most notably the explicit exclusion of `lsass.exe`
