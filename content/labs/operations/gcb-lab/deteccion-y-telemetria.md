> A single event rarely confirms abuse — the real signal emerges from chaining related events, establishing context, and mapping them to a specific technique. Each block follows the structure: `primary event → supporting events → correlation → indicator → risk`

## LAPS — Local Credential Read from Active Directory

```
→ 4662 (Directory Service Access)
   → access to attribute ms-Mcs-AdmPwd
   → access type: ReadProperty / ExtendedRight

→ 4624 (Logon)
   → authentication by the account performing the query
   → pay attention to LogonType 3 or 10

→ Correlation
   → non-privileged user queries ms-Mcs-AdmPwd
   → followed by remote access to the host whose LAPS password was read

→ Indicator
   → unauthorized LAPS password read from AD

→ Risk
   → local administrator escalation and lateral movement
```

## Group Membership Modification / Group Abuse

```
→ 4728 / 4732
   → user added to privileged group
   → 4728: global group
   → 4732: local group

→ 5136
   → directory object modification associated with membership change

→ Correlation
   → unusual account modifies a sensitive group
   → shortly followed by privileged access or lateral movement

→ Indicator
   → privilege escalation via group membership change

→ Risk
   → indirect administrative access over hosts or domain
```

## Kerberoasting — Anomalous TGS Request over SPNs

```
→ 4769 (A Kerberos service ticket was requested)
   → target SPN: MSSQLSvc / HTTP / CIFS / etc.
   → review encryption type, especially RC4 (0x17)

→ 4624
   → logon associated with the requesting user

→ Correlation
   → multiple TGS requests against SPN-enabled accounts
   → from a standard user or unusual host
   → no subsequent legitimate access to the requested service

→ Indicator
   → ticket extraction for offline cracking

→ Risk
   → service account compromise and pivot to other systems
```

## LSASS Dump / Credential Dumping

```
→ 4688 (Process Creation)
   → execution of tools or unusual processes accessing memory
   → pay attention to dump binaries, rundll32, comsvcs, procdump, or equivalents

→ 4673 / 4674
   → use of sensitive privileges or access to protected objects

→ 4663 (Object Access)
   → access to lsass.exe or generated dump files

→ Correlation
   → non-legitimate process interacts with LSASS
   → followed by new authentications or lateral movement

→ Indicator
   → in-memory credential extraction

→ Risk
   → hash, password, and Kerberos ticket theft
```

## RBCD — Resource-Based Constrained Delegation

```
→ 5136 (Directory Service Changes)
   → modification of attribute msDS-AllowedToActOnBehalfOfOtherIdentity

→ 4741
   → creation of a new machine account (if applicable)

→ 4768 / 4769
   → subsequent Kerberos activity associated with the controlled account

→ Correlation
   → new machine or attacker-controlled identity created
   → change in msDS-AllowedToActOnBehalfOfOtherIdentity
   → subsequent use of tickets for impersonation

→ Indicator
   → malicious RBCD configuration

→ Risk
   → user impersonation and remote access to the target host
```

## KCD / S4U / TrustedToAuthForDelegation

```
→ 5136
   → changes to msDS-AllowedToDelegateTo
   → changes to TrustedToAuthForDelegation

→ 4769
   → TGS requests associated with S4U
   → review requested services and impersonated users

→ 4624
   → resulting authentications on target systems

→ Correlation
   → delegated account requests tickets on behalf of another user
   → subsequent access to LDAP, CIFS, HTTP, or similar services

→ Indicator
   → Kerberos delegation abuse / S4U impersonation

→ Risk
   → privileged access without knowing the impersonated user's credentials
```

## Unconstrained Delegation + Authentication Coercion

```
→ 5136
   → changes to TrustedForDelegation (if modified)

→ 4768
   → TGT issued toward a system with unconstrained delegation

→ 4769
   → associated service tickets

→ 4624
   → logon of a sensitive account on the delegated host

→ Correlation
   → privileged account or DC authenticates against a delegated host
   → reusable tickets subsequently present in memory

→ Indicator
   → TGT exposure via Unconstrained Delegation abuse

→ Risk
   → Pass-the-Ticket, DCSync, and full domain compromise
```

## DCSync — Unauthorized Replication

```
→ 4662 (Directory Service Access)
   → replication rights used:
      Replicating Directory Changes
      Replicating Directory Changes All
      Replicating Directory Changes In Filtered Set

→ 4624
   → logon of the account performing the replication

→ Correlation
   → non-DC account uses replication privileges
   → followed by access to sensitive directory objects

→ Indicator
   → DCSync / unauthorized secret replication

→ Risk
   → domain credential extraction, including krbtgt
```

## Golden Ticket / Kerberos Ticket Abuse

```
→ 4768 / 4769
   → Kerberos activity inconsistent with normal behavior
   → privileged accounts appearing without the expected authentication sequence

→ 4624
   → privileged logons from unexpected hosts

→ Correlation
   → anomalous privileged authentication
   → absence of prior coherent legitimate request events
   → subsequent high-privilege activity against DCs or critical resources

→ Indicator
   → possible forged or reused Kerberos ticket

→ Risk
   → persistence, Tier 0 access, and full domain or forest compromise
```

## ACL Abuse — WriteDACL / GenericWrite / WriteProperty / GenericAll

```
→ 5136
   → modification of AD objects

→ 4662
   → access to sensitive directory objects

→ Correlation
   → changes to ACLs on domain, OU, groups, or critical computers
   → followed by membership modification, DCSync, RBCD, or password reset

→ Indicator
   → abuse of excessive permissions over critical objects

→ Risk
   → persistent privilege escalation and chaining toward full domain compromise
```

## JEA / PowerShell Remoting / Endpoint Modification

```
→ 4688
   → execution of PowerShell / Set-PSSessionConfiguration / Register-PSSessionConfiguration

→ 4104
   → Script Block Logging (if enabled)
   → endpoint modification commands, SDDL changes, or session configuration changes

→ 4624
   → remote authentication via WinRM / PowerShell Remoting

→ Correlation
   → user with limited access modifies a JEA endpoint
   → subsequent connection to a privileged endpoint
   → execution of commands outside the expected scope

→ Indicator
   → JEA configuration abuse / escalation via remote endpoint

→ Risk
   → local elevation, restriction bypass, and domain pivot
```

## PSWA — PowerShell Web Access

```
→ 4624
   → authentication to the system hosting PSWA

→ 4688 / 4104
   → PowerShell execution following web authentication

→ Correlation
   → non-privileged or unusual account accesses PSWA
   → followed by administrative activity or remote commands

→ Indicator
   → unauthorized remote access via browser

→ Risk
   → remote execution and lateral pivot from exposed credentials
```

## WSUS Abuse — Malicious Update Approval / Deployment

```
→ Microsoft-Windows-WindowsUpdateServer/Operational
   → update creation, approval, or deployment

→ 4688
   → anomalous process execution on WSUS server or clients
   → psexec, powershell, cmd, or other unexpected binaries

→ 4624
   → administrative authentication to WSUS

→ Correlation
   → unusual update approved
   → followed by anomalous process execution on clients
   → unexpected outbound connections from WSUS-managed hosts

→ Indicator
   → trusted update channel abuse

→ Risk
   → mass RCE, segmentation bypass, and pivot into isolated networks
```

## Hyper-V / VHDX Access / Offline NTDS Extraction

```
→ Hyper-V-VMMS / host operational events
   → VM stop / start
   → unusual management operations

→ 4688
   → use of Mount-VHD, disk access tools, or offline extraction utilities

→ 4663
   → access to virtual disk paths (.vhdx)

→ Correlation
   → critical VM stopped
   → access to the .vhdx file
   → subsequent activity on NTDS.dit or SYSTEM hive

→ Indicator
   → offline secret extraction from virtualized infrastructure

→ Risk
   → full compromise of the domain hosted in the VM
```

## PowerShell Direct — Host-to-VM Access

```
→ 4624
   → authentication associated with the session on the host or VM

→ 4688 / 4104
   → PowerShell session creation and subsequent commands

→ Correlation
   → from a Hyper-V host, a direct administrative session is initiated to a VM
   → without requiring conventional network traffic
   → followed by access to sensitive files or secrets

→ Indicator
   → use of PowerShell Direct as an internal lateral channel

→ Risk
   → segmentation bypass and direct access to critical systems
```

## POP3 / Email / Identity Exposure and Shadow IT

```
→ 4624
   → authentication to the mail server

→ POP3 / mail service logs
   → mailbox access, queried users, unusual activity

→ Correlation
   → access to mailboxes or operational accounts
   → subsequent discovery of Shadow IT infrastructure
   → compromise of a host related to observed users

→ Indicator
   → email service used as an operational discovery vector

→ Risk
   → identity exposure, informal infrastructure discovery, and domain pivot
```

## Exchange / Exchange Windows Permissions / DCSync

```
→ 4728 / 4732
   → membership changes in Exchange groups

→ 5136
   → changes to OU or ACLs associated with Microsoft Exchange Security Groups

→ 4662
   → subsequent use of replication privileges

→ Correlation
   → membership modification in Exchange groups
   → permission inheritance or grant over the domain
   → followed by DCSync

→ Indicator
   → Exchange-inherited privilege abuse leading to domain control

→ Risk
   → full domain compromise via unauthorized replication
```

## PAM / Shadow Principals / Cross-Forest Mapping

```
→ 5136
   → changes to msDS-ShadowPrincipal objects
   → membership or configuration changes in Shadow Principal Configuration

→ 4624
   → subsequent authentications with unexpected elevated privileges

→ Correlation
   → identity in the source forest obtains a privileged mapping
   → high privileges appear in the destination forest
   → subsequent access to critical assets

→ Indicator
   → PAM / Shadow Principal abuse for cross-forest escalation

→ Risk
   → inter-forest escalation and access to critical production roles
```

## Sensitive File Exposure via Web Services

```
→ 4624
   → authentication to the web application or server (if applicable)

→ IIS / application logs
   → access to sensitive paths, attachments, configuration files, or dumps

→ 4663
   → access to sensitive files on disk

→ Correlation
   → web access to a sensitive artifact
   → subsequent credential reuse or lateral movement

→ Indicator
   → operational secrets or credentials exposed via web application

→ Risk
   → lateral pivot, privilege escalation, and cross-domain compromise
```
