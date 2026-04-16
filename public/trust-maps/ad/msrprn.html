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
    width: 760px;
    height: 480px;
  }

  .canvas::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(100,120,200,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(100,120,200,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  .glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.15;
    pointer-events: none;
  }
  .glow.blue   { width:280px; height:280px; background:#3b82f6; top:60px; left:20px; }
  .glow.purple { width:280px; height:280px; background:#8b5cf6; top:60px; right:20px; }
  .glow.red    { width:200px; height:200px; background:#ef4444; bottom:20px; left:50%; transform:translateX(-50%); }

  .entity {
    position: absolute;
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

  .entity .icon { font-size: 42px; line-height: 1; }
  .entity .label { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: 0.5px; text-align:center; }
  .entity .sublabel { font-size: 9px; font-weight: 500; color: rgba(255,255,255,0.5); text-align:center; font-family:'JetBrains Mono',monospace; }

  .entity.server {
    left: 75px; top: 150px;
    width: 160px; height: 160px;
    background: linear-gradient(135deg, rgba(59,130,246,0.3), rgba(29,78,216,0.5));
    border-color: rgba(96,165,250,0.3);
  }
  .entity.dc {
    left: 515px; top: 150px;
    width: 160px; height: 160px;
    background: linear-gradient(135deg, rgba(139,92,246,0.3), rgba(109,40,217,0.5));
    border-color: rgba(167,139,250,0.3);
  }

  .badge {
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 3px 12px;
    border-radius: 20px;
    background: rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.8);
    font-family: 'JetBrains Mono', monospace;
  }

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
    white-space: nowrap;
    font-size: 10px;
    font-weight: 500;
    color: #94a3b8;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.3px;
  }

  .arrow {
    position: absolute;
    z-index: 5;
    pointer-events: none;
  }
  .arrow-h {
    height: 2.5px;
    border-radius: 2px;
    position: absolute;
    width: 100%;
  }
  .arrowhead-right {
    position: absolute;
    width: 0; height: 0;
    border-top: 8px solid transparent;
    border-bottom: 8px solid transparent;
    right: -14px; top: -7px;
  }
  .arrowhead-left {
    position: absolute;
    width: 0; height: 0;
    border-top: 8px solid transparent;
    border-bottom: 8px solid transparent;
    left: -14px; top: -7px;
  }

  /* Step 1: Server1 → DC */
  .arrow1 {
    top: 215px; left: 245px; width: 250px;
  }
  .arrow1 .arrow-h { background: #fbbf24; }
  .arrow1 .arrowhead-right { border-left: 14px solid #fbbf24; }
  .step.s1 {
    background: #f59e0b;
    left: 365px; top: 199px;
  }
  .step.s1 .tip { top: -22px; left: 50%; transform: translateX(-50%); }

  /* Step 2: DC → Server1 */
  .arrow2 {
    top: 280px; left: 260px; width: 245px;
  }
  .arrow2 .arrow-h { background: #34d399; }
  .arrow2 .arrowhead-left { border-right: 14px solid #34d399; }
  .step.s2 {
    background: #10b981;
    left: 365px; top: 262px;
  }
  .step.s2 .tip { top: -22px; left: 50%; transform: translateX(-50%); }

  /* Step 3: Loop on Server1 */
  .arrow3-wrap {
    position: absolute;
    top: 70px; left: 82px; width: 150px; height: 95px;
    z-index: 5;
    pointer-events: none;
  }
  .arrow3-line {
    position: absolute;
    width: 132px;
    height: 50px;
    border: 2.5px solid #60a5fa;
    border-bottom: none;
    border-radius: 66px 66px 0 0;
    top: 25px; left: 8px;
  }
  .arrow3-head-l {
    position: absolute;
    left: 4px; bottom: 13px;
    width: 0; height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-right: 12px solid #60a5fa;
    transform: rotate(15deg);
  }
  .step.s3 {
    background: #3b82f6;
    left: 130px; top: 58px;
  }
  .step.s3 .tip { top: -22px; left: 50%; transform: translateX(-50%); }

  /* Step 4: Server1 → DC */
  .arrow4 {
  top: 355px; left: 160px; width: 425px;
}
.arrow4 .arrow-h { background: #f87171; }
.arrow4 .arrowhead-right { border-left: 14px solid #f87171; }
.step.s4 {
  background: #ef4444;
  left: 365px; top: 338px;
}
.step.s4 .tip { top: -22px; left: 50%; transform: translateX(-50%); }

  .title {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: rgba(226,232,240,0.3);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
  }
</style>
</head>
<body>
<div class="canvas">
  <div class="glow blue"></div>
  <div class="glow purple"></div>

  <div class="entity server">
    <div class="icon">🖥️</div>
    <div class="label">Server1</div>
    <div class="badge">Unconstrained Delegation</div>
  </div>

  <div class="entity dc">
    <div class="icon">🔐</div>
    <div class="label">DC</div>
    <div class="sublabel">Domain Controller</div>
  </div>

  <div class="arrow arrow1">
    <div class="arrow-h"></div>
    <div class="arrowhead-right"></div>
  </div>

  <div class="arrow arrow2">
    <div class="arrow-h"></div>
    <div class="arrowhead-left"></div>
  </div>

  <div class="arrow3-wrap">
    <div class="arrow3-line"></div>
    <div class="arrow3-head-l"></div>
  </div>

  <div class="arrow arrow4">
    <div class="arrow-h"></div>
    <div class="arrowhead-right"></div>
  </div>

  <div class="step s1">1<span class="tip">Please connect to Server1</span></div>
  <div class="step s2">2<span class="tip">DC$ authenticates</span></div>
  <div class="step s3">3<span class="tip">Extract DC$ TGT</span></div>
  <div class="step s4">4<span class="tip">DCSync</span></div>

  <div class="title">Unconstrained Delegation Attack</div>
</div>
</body>
</html>