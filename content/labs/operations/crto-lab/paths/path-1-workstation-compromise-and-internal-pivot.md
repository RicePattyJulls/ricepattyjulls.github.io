#### PATH SUMMARY

[DUB-WKSTN-2](/labs/crto-lab/hosts/dub-wkstn-2)
→ staged DLL execution through `rundll32.exe`
→ AppLocker-aware foothold from `C:\Windows\System32\Tasks`
→ local Administrator password reuse validated with `spawnas`
→ SMB reach and lateral movement into `DUB-WKSTN-1`

[DUB-WKSTN-1](/labs/crto-lab/hosts/dub-wkstn-1)
→ stable access as local `Administrator`
→ explorer-backed `tdobson` session identified
→ token theft turns endpoint compromise into identity-driven movement

[DUB-WEB-1](/labs/crto-lab/hosts/dub-web-1)
→ token-derived access validated over SMB
→ web tier reached as the first real server pivot inside Dublin

This path matters because it shows that the operation is enabled first by endpoint-level weaknesses, not by high-complexity domain abuse. The initial foothold comes from an AppLocker-aware DLL execution path, the first expansion depends on reusable local Administrator credentials across workstations, and the transition toward the server tier becomes possible only because a high-value user session is exposed on the second endpoint
