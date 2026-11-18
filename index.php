<?php
// Auto-start Node.js backend if not already running on port 3777
$fp = @fsockopen("127.0.0.1", 3777, $errno, $errstr, 0.5);
if (!$fp) {
    pclose(popen("start /B node server.js", "r"));
    usleep(1500000); // 1.5s to initialize
} else {
    fclose($fp);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lead &amp; Job Agent</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #0b1120;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #appFrame {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
    }
    #loading {
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0b1120;
      color: #94a3b8;
      z-index: 10;
      transition: opacity 0.3s ease;
    }
    .spinner {
      width: 38px;
      height: 38px;
      border: 3px solid #334155;
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <div style="font-size:14px;font-weight:500;color:#f8fafc">Loading Lead &amp; Job Agent...</div>
  </div>
  <iframe id="appFrame" src="http://127.0.0.1:3777/" allow="clipboard-read; clipboard-write" onload="hideLoader()"></iframe>
  <script>
    function hideLoader() {
      const el = document.getElementById('loading');
      if (el) {
        el.style.opacity = '0';
        setTimeout(() => { if (el) el.style.display = 'none'; }, 300);
      }
    }
    setTimeout(hideLoader, 2500);
  </script>
</body>
</html>
