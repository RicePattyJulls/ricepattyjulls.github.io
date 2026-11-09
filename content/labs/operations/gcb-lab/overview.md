## Main sections

- [LOOT](/labs/gcb-lab/loot/): inventory of credentials, access, secrets, artifacts and other sensitive information recovered during the lab.
- [COMPROMISE MAP](/labs/gcb-lab/mapa-compromiso/): domain-level summary view of obtained access, relevant relationships, compromised systems and overall multi-forest compromise progress.
- [MITIGATION AND REMEDIATION](/labs/gcb-lab/mitigacion-y-remediacion/): actions taken to correct the identified abuses, reduce the attack surface and preserve only the legitimate access that is required.
## COMPROMISE SCOPE

#### Forest 1: gcb.example ~ 10.200.9.0 (root) ↔ it.gcb.example (child) Compromised hosts (8):
	- `10.200.5.15 ~ IT-EMPLOYEE15`
	- `10.200.9.121 ~ IT-APPSRV01`
	- `10.200.9.51 ~ IT-SQLSRV02`
	- `10.200.9.111 ~ IT-TRACK01`
	- `10.200.9.41 ~ IT-PREPROD`
	- `10.200.9.3 ~ GCB-WSUS`
	- `10.200.9.2 ~ IT-DC`
	- `10.200.9.1 ~ GCB-DC`
#### Forest 2: msp.example ~ 10.200.8.0 (root) ↔ internal.msp.example (child) Compromised hosts (6):
	- `10.200.8.10 ~ MSP-SQLREPORT`
	- `10.200.8.22 ~ MSP-SRV01`
	- `10.200.8.75 ~ INTERNAL-SRV06`
	- `10.200.8.177 ~ INTERNAL-BATCH`
	- `10.200.8.2 ~ INTERNAL-DC01`
	- `10.200.8.1 ~ MSP-DC01`
#### Forest 3: gcbfinance.example ~ 10.200.10.0 Compromised hosts (2):
	- `10.200.10.14 ~ FINANCE-VANESSA`
	- `10.200.10.1 ~ FINANCE-DC01`
#### Forest 4: gcbsec.example ~ 10.200.6.0 _(PAM Trust)_ Compromised hosts (2):
	- `10.200.6.197 ~ SEC-SYSLOG01`
	- `10.200.6.1 ~ SEC-DC`
#### Forest 5: gcbacc.example ~ 10.200.12.0 _(Production - PAM)_ Compromised hosts (2):
	- `10.200.12.1 ~ ACC-DC07`
	- `10.200.12.189 ~ ACC-DATA`
#### Forest 6: gcbvault.example ~ 10.200.7.0 Compromised hosts (3):
	- `10.200.7.1 ~ VAULT-SRV`
	- `10.200.7.2 ~ VAULT-DC`
	- `10.200.7.3 ~ VAULT-DB`
#### Forest 7: gcbhr.example ~ 10.200.11.0 Compromised hosts (3):
	- `10.200.11.1 ~ HR-DC02`
	- `10.200.11.24 ~ HR-ERIKA`
	- `10.200.11.33 ~ HR-MAIL`

> Forests reached: `7/7`. Hosts compromised (total): `26`

[Ver mapa y rutas](/labs/gcb-lab/mapa-compromiso/)
