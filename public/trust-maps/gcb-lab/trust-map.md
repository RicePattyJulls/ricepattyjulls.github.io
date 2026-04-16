

<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GCB Lab · Trust Map</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #020408; display: flex; justify-content: center; padding: 24px 12px; font-family: 'Courier New', monospace; }
.wrap { background: #05080f; border-radius: 18px; border: 1px solid #1e293b; padding: 22px 16px 18px; width: 100%; max-width: 880px; }
.hdr { text-align: center; color: #64748b; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; margin-bottom: 16px; border-bottom: 1px solid #1e293b; padding-bottom: 12px; }
.hdr strong { color: #e2e8f0; font-size: 14px; display: block; margin-bottom: 4px; letter-spacing: .05em; }
svg { overflow: visible; display: block; }
.fc { cursor: pointer; }
.fc:hover { opacity: .82; }
.leg { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-top: 14px; padding-top: 12px; border-top: 1px solid #1e293b; font-size: 10px; color: #475569; }
.li { display: flex; align-items: center; gap: 5px; }
</style>
</head>
<body>
<div class="wrap">
<div class="hdr">
  <strong>GCB LAB · Trust &amp; Reach Map</strong>
  7 forests &nbsp;·&nbsp; 9 dominios &nbsp;·&nbsp; 26 hosts compromised
</div>

<svg width="100%" viewBox="0 0 820 890" xmlns="http://www.w3.org/2000/svg">
<defs>
  <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
    <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </marker>
  <marker id="ahb" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="5" markerHeight="5" orient="auto">
    <path d="M8 1L2 5L8 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </marker>
</defs>

<!-- zona principal -->
<rect x="14" y="14" width="792" height="522" rx="18" fill="#060910" stroke="#1e293b" stroke-width="1" stroke-dasharray="6 4"/>
<text x="410" y="36" text-anchor="middle" font-size="10" fill="#2d3f55" font-family="Courier New,monospace" letter-spacing=".14em">BLOQUE PRINCIPAL · VISIBILIDAD DIRECTA DESDE FOOTHOLD</text>

<!-- F1 GCB.LOCAL root -->
<g class="fc">
  <rect x="280" y="50" width="260" height="80" rx="12" fill="#12062a" stroke="#7c3aed" stroke-width="1.5"/>
  <rect x="280" y="50" width="260" height="28" rx="12" fill="#2e1065"/>
  <rect x="280" y="66" width="260" height="12" fill="#2e1065"/>
  <polygon points="294,53 305,53 309,63 305,72 294,72 290,63" fill="#7c3aed" opacity=".55"/>
  <text x="315" y="68" font-size="11" fill="#c084fc" font-weight="bold" font-family="Courier New,monospace">gcb.local</text>
  <text x="536" y="68" text-anchor="end" font-size="9" fill="#7c3aed" font-family="Courier New,monospace">FOREST ROOT · F1</text>
  <text x="410" y="92" text-anchor="middle" font-size="10" fill="#a78bfa" font-family="Courier New,monospace">Enterprise Admin · ExtraSIDs</text>
  <text x="410" y="108" text-anchor="middle" font-size="9" fill="#5b21b6" font-family="Courier New,monospace">GCB-DC · GCB-WSUS · hosts: 2</text>
  <rect x="290" y="118" width="86" height="14" rx="4" fill="#2e1065" stroke="#7c3aed" stroke-width=".5"/>
  <text x="333" y="128" text-anchor="middle" font-size="9" fill="#c084fc" font-family="Courier New,monospace">COMPROMETIDO</text>
</g>

<!-- bidi gcb root ↔ it.gcb child -->
<line x1="410" y1="130" x2="410" y2="160" stroke="#7c3aed" stroke-width="1.5" marker-start="url(#ahb)" marker-end="url(#ah)"/>
<rect x="310" y="138" width="200" height="14" rx="4" fill="#05080f"/>
<text x="410" y="148" text-anchor="middle" font-size="9" fill="#4c1d95" font-family="Courier New,monospace">intra-forest · bidi · transitivo</text>

<!-- F1 IT.GCB.LOCAL foothold child -->
<g class="fc">
  <rect x="268" y="160" width="284" height="92" rx="12" fill="#0f0824" stroke="#a855f7" stroke-width="2"/>
  <rect x="268" y="160" width="284" height="30" rx="12" fill="#3b0764"/>
  <rect x="268" y="178" width="284" height="12" fill="#3b0764"/>
  <polygon points="284,163 288,173 298,173 290,179 293,189 284,183 275,189 278,179 270,173 280,173" fill="#e879f9" opacity=".9"/>
  <text x="304" y="178" font-size="11" fill="#f0abfc" font-weight="bold" font-family="Courier New,monospace">it.gcb.local</text>
  <text x="548" y="178" text-anchor="end" font-size="9" fill="#e879f9" font-family="Courier New,monospace">FOOTHOLD · CHILD · F1</text>
  <text x="410" y="205" text-anchor="middle" font-size="10" fill="#d8b4fe" font-family="Courier New,monospace">DCSync · RBCD · LAPS · WriteDACL</text>
  <text x="410" y="220" text-anchor="middle" font-size="9" fill="#7c3aed" font-family="Courier New,monospace">IT-DC · IT-EMPLOYEE15 · IT-APPSRV01 · hosts: 8</text>
  <rect x="278" y="232" width="86" height="14" rx="4" fill="#3b0764" stroke="#a855f7" stroke-width=".5"/>
  <text x="321" y="242" text-anchor="middle" font-size="9" fill="#e879f9" font-family="Courier New,monospace">COMPROMETIDO</text>
  <rect x="372" y="232" width="72" height="14" rx="4" fill="#2e1065" stroke="#6d28d9" stroke-width=".5"/>
  <text x="408" y="242" text-anchor="middle" font-size="9" fill="#a78bfa" font-family="Courier New,monospace">CHILD DOM.</text>
</g>

<!-- IT.GCB → MSP inbound trust -->
<path d="M 322 252 Q 230 292 210 340" fill="none" stroke="#16a34a" stroke-width="1.5" marker-start="url(#ahb)" marker-end="url(#ah)"/>
<text x="222" y="304" text-anchor="end" font-size="9" fill="#4ade80" font-family="Courier New,monospace">inbound</text>

<!-- IT.GCB → GCBFINANCE external SID filter -->
<path d="M 498 252 Q 580 292 596 340" fill="none" stroke="#d97706" stroke-width="1.5" stroke-dasharray="6 3" marker-start="url(#ahb)" marker-end="url(#ah)"/>
<text x="570" y="300" font-size="9" fill="#fbbf24" font-family="Courier New,monospace">SID filter</text>

<!-- F2 MSP.LOCAL root -->
<g class="fc">
  <rect x="32" y="340" width="222" height="82" rx="12" fill="#0a1a0a" stroke="#16a34a" stroke-width="1.5"/>
  <rect x="32" y="340" width="222" height="28" rx="12" fill="#14532d"/>
  <rect x="32" y="356" width="222" height="12" fill="#14532d"/>
  <rect x="46" y="343" width="16" height="12" rx="2" fill="#4ade80" opacity=".6"/>
  <rect x="48" y="345" width="12" height="2" rx="1" fill="#86efac"/>
  <rect x="48" y="349" width="12" height="2" rx="1" fill="#86efac"/>
  <rect x="48" y="353" width="12" height="2" rx="1" fill="#86efac"/>
  <text x="68" y="358" font-size="11" fill="#86efac" font-weight="bold" font-family="Courier New,monospace">msp.local</text>
  <text x="250" y="358" text-anchor="end" font-size="9" fill="#4ade80" font-family="Courier New,monospace">FOREST ROOT · F2</text>
  <text x="143" y="382" text-anchor="middle" font-size="10" fill="#4ade80" font-family="Courier New,monospace">SQL pivot · LDAP cross-domain</text>
  <text x="143" y="396" text-anchor="middle" font-size="9" fill="#166534" font-family="Courier New,monospace">MSP-DC01 · MSP-SRV01 · hosts: 4</text>
  <rect x="42" y="406" width="86" height="14" rx="4" fill="#14532d" stroke="#16a34a" stroke-width=".5"/>
  <text x="85" y="416" text-anchor="middle" font-size="9" fill="#4ade80" font-family="Courier New,monospace">COMPROMETIDO</text>
</g>

<!-- MSP root ↔ INTERNAL child -->
<line x1="143" y1="422" x2="143" y2="450" stroke="#16a34a" stroke-width="1.5" marker-start="url(#ahb)" marker-end="url(#ah)"/>
<rect x="100" y="429" width="82" height="13" rx="3" fill="#05080f"/>
<text x="141" y="439" text-anchor="middle" font-size="8" fill="#166534" font-family="Courier New,monospace">intra-forest</text>

<!-- F2 INTERNAL.MSP.LOCAL child -->
<g class="fc">
  <rect x="32" y="450" width="222" height="80" rx="12" fill="#0a1a0a" stroke="#22c55e" stroke-width="1"/>
  <rect x="32" y="450" width="222" height="26" rx="12" fill="#166534"/>
  <rect x="32" y="464" width="222" height="12" fill="#166534"/>
  <text x="143" y="468" text-anchor="middle" font-size="11" fill="#86efac" font-weight="bold" font-family="Courier New,monospace">internal.msp.local</text>
  <text x="143" y="492" text-anchor="middle" font-size="10" fill="#4ade80" font-family="Courier New,monospace">RBCD · intra-forest pivot</text>
  <text x="143" y="506" text-anchor="middle" font-size="9" fill="#166534" font-family="Courier New,monospace">INTERNAL-DC01 · BATCH · hosts: 2</text>
  <rect x="42" y="516" width="86" height="14" rx="4" fill="#166534" stroke="#22c55e" stroke-width=".5"/>
  <text x="85" y="526" text-anchor="middle" font-size="9" fill="#4ade80" font-family="Courier New,monospace">COMPROMETIDO</text>
  <rect x="136" y="516" width="66" height="14" rx="4" fill="#14532d" stroke="#16a34a" stroke-width=".5"/>
  <text x="169" y="526" text-anchor="middle" font-size="9" fill="#86efac" font-family="Courier New,monospace">CHILD DOM.</text>
</g>

<!-- F3 GCBFINANCE.LOCAL -->
<g class="fc">
  <rect x="566" y="340" width="222" height="82" rx="12" fill="#1c0f00" stroke="#d97706" stroke-width="1.5"/>
  <rect x="566" y="340" width="222" height="28" rx="12" fill="#78350f"/>
  <rect x="566" y="356" width="222" height="12" fill="#78350f"/>
  <circle cx="582" cy="354" r="8" fill="#f59e0b" opacity=".65"/>
  <text x="582" y="358" text-anchor="middle" font-size="10" fill="#78350f" font-weight="bold" font-family="sans-serif">$</text>
  <text x="596" y="358" font-size="11" fill="#fbbf24" font-weight="bold" font-family="Courier New,monospace">gcbfinance.local</text>
  <text x="784" y="358" text-anchor="end" font-size="9" fill="#d97706" font-family="Courier New,monospace">F3</text>
  <text x="677" y="382" text-anchor="middle" font-size="10" fill="#fbbf24" font-family="Courier New,monospace">External trust · SID Filtering</text>
  <text x="677" y="396" text-anchor="middle" font-size="9" fill="#92400e" font-family="Courier New,monospace">FINANCE-DC01 · VANESSA · hosts: 2</text>
  <rect x="576" y="406" width="86" height="14" rx="4" fill="#78350f" stroke="#d97706" stroke-width=".5"/>
  <text x="619" y="416" text-anchor="middle" font-size="9" fill="#fbbf24" font-family="Courier New,monospace">COMPROMETIDO</text>
  <rect x="670" y="406" width="108" height="14" rx="4" fill="#451a03" stroke="#b45309" stroke-width=".5"/>
  <text x="724" y="416" text-anchor="middle" font-size="9" fill="#fcd34d" font-family="Courier New,monospace">creds reutilizadas</text>
</g>

<!-- zona aislada -->
<rect x="14" y="548" width="792" height="320" rx="18" fill="#07070d" stroke="#1e293b" stroke-width="1" stroke-dasharray="4 6"/>
<text x="410" y="570" text-anchor="middle" font-size="10" fill="#2d3f55" font-family="Courier New,monospace" letter-spacing=".14em">FORESTS AISLADOS · PIVOT / CREDENCIALES REUTILIZADAS</text>

<!-- pivot IT.GCB → GCBSEC -->
<path d="M 340 252 Q 160 430 138 572" fill="none" stroke="#ef4444" stroke-width="1" stroke-dasharray="5 4" marker-end="url(#ah)"/>
<text x="200" y="416" font-size="9" fill="#ef4444" font-family="Courier New,monospace" transform="rotate(-80,200,416)">creds it.gcb.local</text>

<!-- pivot GCB-WSUS → GCBVAULT -->
<path d="M 518 130 Q 560 380 420 572" fill="none" stroke="#6366f1" stroke-width="1" stroke-dasharray="5 4" marker-end="url(#ah)"/>
<text x="512" y="370" font-size="9" fill="#6366f1" font-family="Courier New,monospace" transform="rotate(88,512,370)">GCB-WSUS pivot</text>

<!-- pivot IT.GCB → GCBHR -->
<path d="M 548 252 Q 700 430 700 572" fill="none" stroke="#db2777" stroke-width="1" stroke-dasharray="5 4" marker-end="url(#ah)"/>
<text x="690" y="416" font-size="9" fill="#db2777" font-family="Courier New,monospace" transform="rotate(83,690,416)">creds it.gcb.local</text>

<!-- F4 GCBSEC.LOCAL bastion -->
<g class="fc">
  <rect x="32" y="580" width="222" height="90" rx="12" fill="#1a0000" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="5 2"/>
  <rect x="32" y="580" width="222" height="28" rx="12" fill="#7f1d1d"/>
  <rect x="32" y="596" width="222" height="12" fill="#7f1d1d"/>
  <path d="M46,583 L60,583 L65,595 L60,606 L46,606 L41,595 Z" fill="#ef4444" opacity=".55"/>
  <text x="53" y="598" text-anchor="middle" font-size="8" fill="#fecaca" font-family="sans-serif">PAM</text>
  <text x="72" y="599" font-size="11" fill="#fca5a5" font-weight="bold" font-family="Courier New,monospace">gcbsec.local</text>
  <text x="250" y="599" text-anchor="end" font-size="9" fill="#dc2626" font-family="Courier New,monospace">BASTION · F4</text>
  <text x="143" y="624" text-anchor="middle" font-size="10" fill="#f87171" font-family="Courier New,monospace">PAM · Shadow Principals</text>
  <text x="143" y="638" text-anchor="middle" font-size="9" fill="#7f1d1d" font-family="Courier New,monospace">SEC-DC · SEC-SYSLOG01 · hosts: 2</text>
  <rect x="42" y="650" width="86" height="14" rx="4" fill="#7f1d1d" stroke="#dc2626" stroke-width=".5"/>
  <text x="85" y="660" text-anchor="middle" font-size="9" fill="#f87171" font-family="Courier New,monospace">COMPROMETIDO</text>
  <rect x="136" y="650" width="106" height="14" rx="4" fill="#450a0a" stroke="#b91c1c" stroke-width=".5"/>
  <text x="189" y="660" text-anchor="middle" font-size="9" fill="#fca5a5" font-family="Courier New,monospace">BASTION FOREST</text>
</g>

<!-- PAM chain SEC → ACC -->
<line x1="143" y1="670" x2="143" y2="698" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#ah)"/>
<rect x="104" y="678" width="72" height="12" rx="3" fill="#07070d"/>
<text x="140" y="687" text-anchor="middle" font-size="9" fill="#dc2626" font-family="Courier New,monospace">PAM chain</text>

<!-- F5 GCBACC.LOCAL produccion -->
<g class="fc">
  <rect x="32" y="698" width="222" height="84" rx="12" fill="#150000" stroke="#ef4444" stroke-width="1" stroke-dasharray="4 3"/>
  <rect x="32" y="698" width="222" height="26" rx="12" fill="#450a0a"/>
  <rect x="32" y="712" width="222" height="12" fill="#450a0a"/>
  <text x="143" y="716" text-anchor="middle" font-size="11" fill="#fca5a5" font-weight="bold" font-family="Courier New,monospace">gcbacc.local</text>
  <text x="143" y="738" text-anchor="middle" font-size="10" fill="#f87171" font-family="Courier New,monospace">Produccion · PAM controlled</text>
  <text x="143" y="752" text-anchor="middle" font-size="9" fill="#7f1d1d" font-family="Courier New,monospace">ACC-DC07 · ACC-DATA · hosts: 2</text>
  <rect x="42" y="762" width="86" height="14" rx="4" fill="#450a0a" stroke="#ef4444" stroke-width=".5"/>
  <text x="85" y="772" text-anchor="middle" font-size="9" fill="#f87171" font-family="Courier New,monospace">COMPROMETIDO</text>
  <rect x="136" y="762" width="86" height="14" rx="4" fill="#3b0000" stroke="#b91c1c" stroke-width=".5"/>
  <text x="179" y="772" text-anchor="middle" font-size="9" fill="#fca5a5" font-family="Courier New,monospace">PRODUCCION</text>
</g>

<!-- F6 GCBVAULT.LOCAL -->
<g class="fc">
  <rect x="298" y="580" width="224" height="90" rx="12" fill="#0a0020" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="5 2"/>
  <rect x="298" y="580" width="224" height="28" rx="12" fill="#1e1b4b"/>
  <rect x="298" y="596" width="224" height="12" fill="#1e1b4b"/>
  <rect x="312" y="582" width="16" height="14" rx="3" fill="#6366f1" opacity=".55"/>
  <circle cx="320" cy="590" r="4" fill="#a5b4fc"/>
  <circle cx="320" cy="590" r="2" fill="#1e1b4b"/>
  <text x="336" y="599" font-size="11" fill="#a5b4fc" font-weight="bold" font-family="Courier New,monospace">gcbvault.local</text>
  <text x="518" y="599" text-anchor="end" font-size="9" fill="#6366f1" font-family="Courier New,monospace">F6</text>
  <text x="410" y="624" text-anchor="middle" font-size="10" fill="#818cf8" font-family="Courier New,monospace">Aislado · pivot via GCB-WSUS</text>
  <text x="410" y="638" text-anchor="middle" font-size="9" fill="#3730a3" font-family="Courier New,monospace">VAULT-SRV · VAULT-DC · VAULT-DB · hosts: 3</text>
  <rect x="308" y="650" width="86" height="14" rx="4" fill="#1e1b4b" stroke="#6366f1" stroke-width=".5"/>
  <text x="351" y="660" text-anchor="middle" font-size="9" fill="#818cf8" font-family="Courier New,monospace">COMPROMETIDO</text>
  <rect x="402" y="650" width="62" height="14" rx="4" fill="#0f0e2a" stroke="#4f46e5" stroke-width=".5"/>
  <text x="433" y="660" text-anchor="middle" font-size="9" fill="#a5b4fc" font-family="Courier New,monospace">AISLADO</text>
</g>

<!-- F7 GCBHR.LOCAL -->
<g class="fc">
  <rect x="566" y="580" width="222" height="90" rx="12" fill="#1a0010" stroke="#db2777" stroke-width="1.5" stroke-dasharray="5 2"/>
  <rect x="566" y="580" width="222" height="28" rx="12" fill="#500724"/>
  <rect x="566" y="596" width="222" height="12" fill="#500724"/>
  <circle cx="582" cy="591" r="6" fill="#db2777" opacity=".6"/>
  <rect x="579" y="598" width="6" height="6" rx="1" fill="#f9a8d4" opacity=".55"/>
  <circle cx="594" cy="590" r="5" fill="#be185d" opacity=".45"/>
  <text x="606" y="599" font-size="11" fill="#f9a8d4" font-weight="bold" font-family="Courier New,monospace">gcbhr.local</text>
  <text x="784" y="599" text-anchor="end" font-size="9" fill="#db2777" font-family="Courier New,monospace">F7</text>
  <text x="677" y="624" text-anchor="middle" font-size="10" fill="#f472b6" font-family="Courier New,monospace">Exchange · ACL abuse interno</text>
  <text x="677" y="638" text-anchor="middle" font-size="9" fill="#831843" font-family="Courier New,monospace">HR-DC02 · HR-ERIKA · HR-MAIL · hosts: 3</text>
  <rect x="576" y="650" width="86" height="14" rx="4" fill="#500724" stroke="#db2777" stroke-width=".5"/>
  <text x="619" y="660" text-anchor="middle" font-size="9" fill="#f472b6" font-family="Courier New,monospace">COMPROMETIDO</text>
  <rect x="670" y="650" width="62" height="14" rx="4" fill="#3b0020" stroke="#be185d" stroke-width=".5"/>
  <text x="701" y="660" text-anchor="middle" font-size="9" fill="#f9a8d4" font-family="Courier New,monospace">AISLADO</text>
</g>

<!-- totales -->
<rect x="280" y="852" width="260" height="28" rx="9" fill="#0f172a" stroke="#334155" stroke-width=".5"/>
<text x="410" y="871" text-anchor="middle" font-size="11" fill="#94a3b8" font-family="Courier New,monospace">7/7 forests · 9 dominios · 26 hosts</text>
</svg>

<div class="leg">
  <div class="li">
    <svg width="24" height="8" xmlns="http://www.w3.org/2000/svg"><defs><marker id="l1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#7c3aed" stroke-width="1.5"/></marker><marker id="l1b" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M8 1L2 5L8 9" fill="none" stroke="#7c3aed" stroke-width="1.5"/></marker></defs><line x1="2" y1="4" x2="22" y2="4" stroke="#7c3aed" stroke-width="1.5" marker-start="url(#l1b)" marker-end="url(#l1)"/></svg>
    intra-forest bidi
  </div>
  <div class="li">
    <svg width="24" height="8" xmlns="http://www.w3.org/2000/svg"><defs><marker id="l2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#16a34a" stroke-width="1.5"/></marker><marker id="l2b" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M8 1L2 5L8 9" fill="none" stroke="#16a34a" stroke-width="1.5"/></marker></defs><line x1="2" y1="4" x2="22" y2="4" stroke="#16a34a" stroke-width="1.5" marker-start="url(#l2b)" marker-end="url(#l2)"/></svg>
    inbound trust
  </div>
  <div class="li">
    <svg width="24" height="8" xmlns="http://www.w3.org/2000/svg"><defs><marker id="l3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#d97706" stroke-width="1.5"/></marker></defs><line x1="2" y1="4" x2="22" y2="4" stroke="#d97706" stroke-width="1.5" stroke-dasharray="5 3" marker-end="url(#l3)"/></svg>
    SID filter · external
  </div>
  <div class="li">
    <svg width="24" height="8" xmlns="http://www.w3.org/2000/svg"><defs><marker id="l4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#ef4444" stroke-width="1.5"/></marker></defs><line x1="2" y1="4" x2="22" y2="4" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#l4)"/></svg>
    PAM chain
  </div>
  <div class="li">
    <svg width="24" height="8" xmlns="http://www.w3.org/2000/svg"><defs><marker id="l5" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#6366f1" stroke-width="1.5"/></marker></defs><line x1="2" y1="4" x2="22" y2="4" stroke="#6366f1" stroke-width="1" stroke-dasharray="5 4" marker-end="url(#l5)"/></svg>
    pivot / creds reusadas
  </div>
</div>
</div>
</body>
</html>



