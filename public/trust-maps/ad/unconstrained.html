<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Outfit:wght@300;500;700;900&display=swap');

  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    background: #080b14;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Outfit', sans-serif;
    overflow: hidden;
  }

  .canvas {
    position: relative;
    width: 960px;
    height: 620px;
  }

  /* Grid background */
  .canvas::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(100,120,200,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(100,120,200,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  /* Glow blobs */
  .glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.15;
    pointer-events: none;
  }
  .glow.purple { width:300px; height:300px; background:#8b5cf6; top:0; left:320px; }
  .glow.blue   { width:250px; height:250px; background:#3b82f6; top:180px; left:-40px; }
  .glow.green  { width:250px; height:250px; background:#10b981; bottom:0; left:300px; }
  .glow.amber  { width:200px; height:200px; background:#f59e0b; bottom:20px; right:40px; }

  /* Entity boxes */
  .entity {
    position: absolute;
    width: 130px;
    height: 130px;
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1.5px solid rgba(255,255,255,0.1);
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }

  .entity .icon {
    font-size: 40px;
    line-height: 1;
  }

  .entity .label {
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.5px;
  }

  .entity.user {
    left: 40px; top: 240px;
    background: linear-gradient(135deg, rgba(59,130,246,0.3), rgba(29,78,216,0.5));
    border-color: rgba(96,165,250,0.3);
  }
  .entity.kdc {
    left: 400px; top: 20px;
    background: linear-gradient(135deg, rgba(139,92,246,0.3), rgba(109,40,217,0.5));
    border-color: rgba(167,139,250,0.3);
  }
  .entity.web {
    left: 400px; top: 440px;
    background: linear-gradient(135deg, rgba(16,185,129,0.3), rgba(4,120,87,0.5));
    border-color: rgba(52,211,153,0.3);
  }
  .entity.db {
    left: 750px; top: 440px;
    background: linear-gradient(135deg, rgba(245,158,11,0.3), rgba(217,119,6,0.5));
    border-color: rgba(251,191,36,0.3);
  }

  .badge {
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 20px;
    background: rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.8);
    font-family: 'JetBrains Mono', monospace;
  }

  /* SVG arrows layer */
  .arrows {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .arrow-line {
    fill: none;
    stroke-width: 2.2;
    stroke-linecap: round;
  }

  .arrow-line.dashed { stroke-dasharray: 8 5; }

  /* Step circles */
  .step {
    position: absolute;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 15px;
    color: #fff;
    box-shadow: 0 0 20px rgba(0,0,0,0.4);
    z-index: 10;
  }

  .step .tip {
    position: absolute;
    top: 34px;
    white-space: nowrap;
    font-size: 9px;
    font-weight: 500;
    color: #94a3b8;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.3px;
  }

  .step.s1 { background:#3b82f6; left:228px; top:184px; }
  .step.s2 { background:#10b981; left:298px; top:168px; }
  .step.s3 { background:#3b82f6; left:310px; top:118px; }
  .step.s4 { background:#10b981; left:338px; top:140px; }
  .step.s5 { background:#f59e0b; left:238px; top:400px; }
  .step.s6 { background:#ef4444; left:528px; top:290px; }
  .step.s7 { background:#ef4444; left:618px; top:478px; }

  /* Title */
  .title {
    position: absolute;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: rgba(226,232,240,0.35);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
  }
</style>
</head>
<body>
<div class="canvas">
  <div class="glow purple"></div>
  <div class="glow blue"></div>
  <div class="glow green"></div>
  <div class="glow amber"></div>

  <svg class="arrows" viewBox="0 0 960 620" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="mB" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1 L8 5 L0 9z" fill="#60a5fa"/></marker>
      <marker id="mG" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1 L8 5 L0 9z" fill="#34d399"/></marker>
      <marker id="mA" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1 L8 5 L0 9z" fill="#fbbf24"/></marker>
      <marker id="mR" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1 L8 5 L0 9z" fill="#f87171"/></marker>
    </defs>

    <path class="arrow-line a1" d="M155 260 Q270 160 405 110" stroke="#60a5fa" marker-end="url(#mB)"/>
    <path class="arrow-line a2" d="M400 130 Q280 195 165 275" stroke="#34d399" marker-end="url(#mG)"/>
    <path class="arrow-line a3" d="M168 252 Q310 115 410 82" stroke="#60a5fa" marker-end="url(#mB)"/>
    <path class="arrow-line a4" d="M405 95 Q290 155 168 262" stroke="#34d399" marker-end="url(#mG)"/>
    <path class="arrow-line a5" d="M155 370 Q270 430 405 490" stroke="#fbbf24" stroke-width="2.8" marker-end="url(#mA)"/>
    <path class="arrow-line a6" d="M530 445 Q548 290 535 155" stroke="#f87171" marker-end="url(#mR)"/>
    <path class="arrow-line a7" d="M530 510 L750 510" stroke="#f87171" stroke-width="2.8" marker-end="url(#mR)"/>
  </svg>

  <div class="entity user">
    <div class="icon">👤</div>
    <div class="label">User</div>
  </div>

  <div class="entity kdc">
    <div class="icon">🔐</div>
    <div class="label">KDC / DC</div>
  </div>

  <div class="entity web">
    <div class="icon">🌐</div>
    <div class="label">Web Server</div>
    <div class="badge">Delegation</div>
  </div>

  <div class="entity db">
    <div class="icon">🗄️</div>
    <div class="label">DB Server</div>
  </div>

  <div class="step s1">1<span class="tip">Credentials</span></div>
  <div class="step s2">2<span class="tip">TGT</span></div>
  <div class="step s3">3<span class="tip">TGS Request</span></div>
  <div class="step s4">4<span class="tip">TGS + ok-as-delegate</span></div>
  <div class="step s5">5<span class="tip">TGS + TGT</span></div>
  <div class="step s6">6<span class="tip">TGS Req (user's TGT)</span></div>
  <div class="step s7">7<span class="tip">Auth as User</span></div>

  <div class="title">Kerberos Unconstrained Delegation</div>
</div>
</body>
</html>

