<?php
// Auto-start Node.js server if not already running
$fp = @fsockopen("127.0.0.1", 3777, $errno, $errstr, 0.5);
if (!$fp) {
    pclose(popen("start /B node server.js", "r"));
    usleep(1200000); // 1.2s to initialize
} else {
    fclose($fp);
}

// Redirect directly to the full Lead & Job Agent application
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Location: http://localhost:3777/");
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="1;url=http://localhost:3777/">
  <title>Opening Lead & Job Agent...</title>
  <script>window.location.href = "http://localhost:3777/";</script>
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .box { text-align: center; padding: 30px; background: #1e293b; border-radius: 12px; border: 1px solid #334155; }
    h2 { color: #38bdf8; margin-bottom: 12px; }
    a { color: #60a5fa; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="box">
    <h2>🚀 Opening Lead & Job Generator Agent...</h2>
    <p>Please wait, redirecting to <a href="http://localhost:3777/">http://localhost:3777/</a></p>
  </div>
</body>
</html>
