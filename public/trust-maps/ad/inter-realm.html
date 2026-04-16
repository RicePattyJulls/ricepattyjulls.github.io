<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kerberos Cross-Realm Authentication</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #fff;
            padding: 40px;
            margin: 0;
        }
        .diagram {
            position: relative;
            width: 700px;
            height: 500px;
            margin: 0 auto;
        }
        .entity {
            position: absolute;
            text-align: center;
            top: 0;
        }
        .entity img {
            width: 50px;
            height: 50px;
        }
        .entity-icon {
            font-size: 40px;
            margin-bottom: 5px;
        }
        .entity-label {
            font-size: 14px;
            color: #333;
        }
        .client { left: 20px; }
        .local-kdc { left: 180px; }
        .foreign-kdc { left: 400px; }
        .foreign-service { left: 580px; }
        
        .lifeline {
            position: absolute;
            top: 80px;
            width: 2px;
            height: 400px;
            border-left: 1px dashed #999;
        }
        .lifeline-client { left: 45px; }
        .lifeline-local { left: 205px; }
        .lifeline-foreign-kdc { left: 435px; }
        .lifeline-foreign-service { left: 615px; }
        
        .message {
            position: absolute;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }
        .message-text {
            font-size: 13px;
            font-weight: bold;
            padding: 2px 5px;
        }
        .message-subtext {
            font-size: 11px;
            padding: 0 5px;
        }
        .arrow {
            height: 2px;
            position: relative;
        }
        .arrow::after {
            content: '';
            position: absolute;
            width: 0;
            height: 0;
            border-style: solid;
            top: -4px;
        }
        .arrow-right::after {
            right: 0;
            border-width: 5px 0 5px 10px;
        }
        .arrow-left::after {
            left: 0;
            border-width: 5px 10px 5px 0;
        }
        
        /* Message 1 */
        .msg1 { top: 100px; left: 50px; }
        .msg1 .message-text { color: #c00; }
        .msg1 .message-subtext { color: #c00; }
        .msg1 .arrow { 
            width: 150px; 
            background: #c00; 
        }
        .msg1 .arrow::after { 
            border-color: transparent transparent transparent #c00; 
        }
        
        /* Message 2 */
        .msg2 { top: 170px; left: 50px; }
        .msg2 .message-text { color: #c00; }
        .msg2 .message-subtext { color: #c00; }
        .msg2 .arrow { 
            width: 150px; 
            background: #c00; 
        }
        .msg2 .arrow::after { 
            border-color: transparent #c00 transparent transparent; 
        }
        
        /* Message 3 */
        .msg3 { top: 250px; left: 50px; }
        .msg3 .message-text { color: #006400; }
        .msg3 .message-subtext { color: #006400; }
        .msg3 .arrow { 
            width: 380px; 
            background: #006400; 
        }
        .msg3 .arrow::after { 
            border-color: transparent transparent transparent #006400; 
        }
        
        /* Message 4 */
        .msg4 { top: 320px; left: 50px; }
        .msg4 .message-text { color: #006400; }
        .msg4 .arrow { 
            width: 380px; 
            background: #006400; 
        }
        .msg4 .arrow::after { 
            border-color: transparent #006400 transparent transparent; 
        }
        
        /* Message 5 */
        .msg5 { top: 390px; left: 50px; }
        .msg5 .message-text { color: #0066cc; }
        .msg5 .arrow { 
            width: 560px; 
            background: #0066cc; 
        }
        .msg5 .arrow::after { 
            border-color: transparent transparent transparent #0066cc; 
        }
        
        /* Message 6 */
        .msg6 { top: 440px; left: 50px; }
        .msg6 .message-text { color: #0066cc; text-align: right; width: 560px; }
        .msg6 .arrow { 
            width: 560px; 
            background: #0066cc; 
        }
        .msg6 .arrow::after { 
            border-color: transparent #0066cc transparent transparent; 
        }
    </style>
</head>
<body>
    <div class="diagram">
        <!-- Entities -->
        <div class="entity client">
            <div class="entity-icon">🖥️👤</div>
            <div class="entity-label">Client</div>
        </div>
        <div class="entity local-kdc">
            <div class="entity-icon">🗄️</div>
            <div class="entity-label">Local KDC</div>
        </div>
        <div class="entity foreign-kdc">
            <div class="entity-icon">🗄️</div>
            <div class="entity-label">Foreign KDC</div>
        </div>
        <div class="entity foreign-service">
            <div class="entity-icon">🖥️</div>
            <div class="entity-label">Foreign Service</div>
        </div>
        
        <!-- Lifelines -->
        <div class="lifeline lifeline-client"></div>
        <div class="lifeline lifeline-local"></div>
        <div class="lifeline lifeline-foreign-kdc"></div>
        <div class="lifeline lifeline-foreign-service"></div>
        
        <!-- Messages -->
        <div class="message msg1">
            <span class="message-text">1. TGS-REQ</span>
            <span class="message-subtext">with current TGT</span>
            <div class="arrow arrow-right"></div>
        </div>
        
        <div class="message msg2">
            <span class="message-text">2. TGS-REP</span>
            <span class="message-subtext">with inter-realm TGT</span>
            <div class="arrow arrow-left"></div>
        </div>
        
        <div class="message msg3">
            <span class="message-text">3. TGS-REQ</span>
            <span class="message-subtext">with inter-realm TGT</span>
            <div class="arrow arrow-right"></div>
        </div>
        
        <div class="message msg4">
            <span class="message-text">4. TGS-REP</span>
            <div class="arrow arrow-left"></div>
        </div>
        
        <div class="message msg5">
            <span class="message-text">5. AP-REQ</span>
            <div class="arrow arrow-right"></div>
        </div>
        
        <div class="message msg6">
            <span class="message-text">6. AP-REP</span>
            <div class="arrow arrow-left"></div>
        </div>
    </div>
</body>
</html>