<?php
/**
 * ==============================================================================
 * Gateway & Activation Endpoint: third.php
 * Path: /thirdparty/third.php
 *
 * Receives redirect from CG.java when user taps "  !! Get Pin !!  ":
 *   URL: /thirdparty/third.php?ch=<Admin>&id=jiov<encId>jiovcuio<encPkg>cuio
 *
 * Capabilities:
 * 1. Decodes composite delimiter:
 *    - jiov -> reversed Base64(android_id)
 *    - jiovcuio -> reversed Base64(pkgname stripped of dots)
 *    - cuio -> suffix
 * 2. Supports Linkvertise tokens (ADID..._2txt) and direct device IDs
 * 3. Daily Midnight (00:00 AM IST) Expiration - exact match to auth.id notes
 * 4. Automatic device activation in data/activated_devices.json
 * 5. Clean, responsive mobile UI + JSON REST API support
 * ==============================================================================
 */

header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

// Set timezone to Indian Standard Time (IST: UTC + 5:30)
date_default_timezone_set('Asia/Kolkata');

// Storage configuration
$DATA_DIR = __DIR__ . '/data';
if (!is_dir($DATA_DIR)) {
    @mkdir($DATA_DIR, 0777, true);
}
$DB_FILE = $DATA_DIR . '/activated_devices.json';

// Optional Monetization / Linkvertise Redirect (Leave empty for direct activation)
$LINKVERTISE_BASE = getenv('LINKVERTISE_URL') ?: '';

// ------------------------------------------------------------------------------
// Helper: Calculate Next Midnight IST (00:00:00 AM)
// ------------------------------------------------------------------------------
function getNextMidnightIST() {
    $now = new DateTime('now', new DateTimeZone('Asia/Kolkata'));
    $midnight = clone $now;
    $midnight->modify('+1 day');
    $midnight->setTime(0, 0, 0, 0);
    return $midnight->getTimestamp() * 1000; // milliseconds
}

// ------------------------------------------------------------------------------
// Persistence Helpers (Safe JSON with file locks)
// ------------------------------------------------------------------------------
function loadActivatedDevices($dbFile) {
    if (!file_exists($dbFile)) {
        return [];
    }
    $fp = fopen($dbFile, 'r');
    if (!$fp) return [];
    flock($fp, LOCK_SH);
    $data = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $json = json_decode($data, true);
    return is_array($json) ? $json : [];
}

function saveActivatedDevices($dbFile, $devices) {
    $fp = fopen($dbFile, 'w');
    if (!$fp) return false;
    flock($fp, LOCK_EX);
    fwrite($fp, json_encode($devices, JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return true;
}

// ------------------------------------------------------------------------------
// Helper: Parse Hardware Device ID & Package Name from raw query
// ------------------------------------------------------------------------------
function extractCredentials($rawId) {
    $result = [
        'device_id' => null,
        'pkg' => null,
        'format' => 'direct'
    ];

    if (!$rawId) return $result;
    $rawId = trim($rawId);

    // 1. Raw Patch Composite Format: jiov<encId>jiovcuio<encPkg>cuio
    if (strpos($rawId, 'jiov') !== false) {
        if (preg_match('/jiov(.*?)(?:jiovcuio|$)/s', $rawId, $m1)) {
            $cleanEnc = str_replace(["\r", "\n", " "], '', $m1[1]);
            $decoded = base64_decode(strrev($cleanEnc));
            if ($decoded) {
                $result['device_id'] = trim($decoded);
                $result['format'] = 'thirdparty_patch';
            }
        }
        if (preg_match('/jiovcuio(.*?)(?:cuio|$)/s', $rawId, $m2)) {
            $cleanPkg = str_replace(["\r", "\n", " "], '', $m2[1]);
            $decodedPkg = base64_decode(strrev($cleanPkg));
            if ($decodedPkg) {
                $result['pkg'] = trim($decodedPkg);
            }
        }
        if ($result['device_id']) return $result;
    }

    // 2. Linkvertise / Gateway Token Format: ADID<b64>_2txt
    if (preg_match('/ADID([a-zA-Z0-9+\/=\-_]+?)(?:_2txt|ChCh|$)/', $rawId, $m)) {
        $clean = $m[1];
        $rev = strrev($clean);
        $dec = base64_decode($rev);
        if ($dec && preg_match('/^[a-zA-Z0-9_\-]{6,64}$/', $dec)) {
            $result['device_id'] = $dec;
            $result['format'] = 'gateway_token';
            return $result;
        }
    }

    // 3. Double query param check: Id=...
    if (strpos($rawId, 'Id=') === 0) {
        return extractCredentials(substr($rawId, 3));
    }

    // 4. Fallback: Direct ID
    $result['device_id'] = $rawId;
    return $result;
}

// ------------------------------------------------------------------------------
// Request Handling
// ------------------------------------------------------------------------------
$channel = isset($_GET['ch']) ? trim($_GET['ch']) : 'Razpay';
$rawId = isset($_GET['id']) ? trim($_GET['id']) : (isset($_GET['device_id']) ? trim($_GET['device_id']) : '');
$action = isset($_GET['action']) ? trim($_GET['action']) : '';
$pkgQuery = isset($_GET['pkg']) ? trim($_GET['pkg']) : (isset($_GET['pkgname']) ? trim($_GET['pkgname']) : '');

$creds = extractCredentials($rawId);
$deviceId = $creds['device_id'];
$pkg = $pkgQuery ?: $creds['pkg'] ?: 'Application';

$isJsonClient = (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false)
                || (isset($_GET['format']) && $_GET['format'] === 'json');

$devices = loadActivatedDevices($DB_FILE);
$nowMs = round(microtime(true) * 1000);
$expiresAt = getNextMidnightIST();

// Perform Activation
$activatedJustNow = false;
if ($deviceId) {
    $currentRecord = $devices[$deviceId] ?? null;
    $isAlreadyActive = $currentRecord && ($currentRecord['expiresAt'] > $nowMs);

    // Activate if requested, or if visiting via browser Get Pin
    if ($action === 'activate' || !$isAlreadyActive) {
        $devices[$deviceId] = [
            'deviceId' => $deviceId,
            'channel' => $channel,
            'pkg' => $pkg,
            'activatedAt' => $nowMs,
            'expiresAt' => $expiresAt,
            'active' => true,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
            'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
        ];
        saveActivatedDevices($DB_FILE, $devices);
        $activatedJustNow = true;
    }
}

// ------------------------------------------------------------------------------
// JSON Response
// ------------------------------------------------------------------------------
if ($isJsonClient) {
    header('Content-Type: application/json; charset=utf-8');
    if (!$deviceId) {
        echo json_encode([
            'status' => 'error',
            'isValid' => false,
            'message' => 'No valid device hardware ID provided.'
        ]);
        exit;
    }

    echo json_encode([
        'status' => 'success',
        'isValid' => true,
        'channel' => $channel,
        'deviceId' => $deviceId,
        'pkg' => $pkg,
        'activatedAt' => $devices[$deviceId]['activatedAt'] ?? $nowMs,
        'expiresAt' => $devices[$deviceId]['expiresAt'] ?? $expiresAt,
        'expiresInMinutes' => max(0, round(($expiresAt - $nowMs) / 60000)),
        'message' => 'Device activated successfully until Midnight 00:00 AM IST.'
    ], JSON_PRETTY_PRINT);
    exit;
}

// ------------------------------------------------------------------------------
// HTML Responsive Mobile Portal
// ------------------------------------------------------------------------------
$istMidnightFormatted = (new DateTime('@' . ($expiresAt / 1000)))
    ->setTimezone(new DateTimeZone('Asia/Kolkata'))
    ->format('d M Y, h:i A') . ' IST';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title><?= htmlspecialchars($channel) ?> - Device Activation Portal</title>
    <style>
        :root {
            --primary: #381E88;
            --accent: #0B57CF;
            --success: #10b981;
            --bg: #0f172a;
            --card: #1e293b;
            --text: #f8fafc;
            --muted: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        body {
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
        }
        .container {
            width: 100%;
            max-width: 440px;
            background: rgba(30, 41, 59, 0.85);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 28px 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
            text-align: center;
        }
        .ornament {
            color: #a78bfa;
            font-size: 24px;
            letter-spacing: 4px;
            margin-bottom: 8px;
        }
        .title {
            font-size: 20px;
            font-weight: 800;
            color: #ffffff;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .divider {
            height: 4px;
            background: linear-gradient(90deg, transparent, #381E88, #0B57CF, transparent);
            border-radius: 9999px;
            margin: 16px 0;
        }
        .badge-success {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #34d399;
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 16px;
        }
        .info-card {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 14px;
            margin: 14px 0;
            text-align: left;
            font-size: 13px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: var(--muted); }
        .info-val { color: #ffffff; font-weight: 600; font-family: monospace; font-size: 12px; }
        .countdown-box {
            background: rgba(56, 30, 136, 0.25);
            border: 1px solid rgba(167, 139, 250, 0.3);
            border-radius: 14px;
            padding: 12px;
            margin: 16px 0;
        }
        .countdown-title {
            font-size: 11px;
            text-transform: uppercase;
            color: #c4b5fd;
            letter-spacing: 1px;
            margin-bottom: 4px;
        }
        .countdown-val {
            font-size: 22px;
            font-weight: 800;
            color: #ffffff;
            font-family: monospace;
        }
        .btn {
            display: block;
            width: 100%;
            padding: 14px 20px;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 700;
            text-align: center;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
            margin-top: 10px;
        }
        .btn-primary {
            background: linear-gradient(135deg, #0B57CF 0%, #2563eb 100%);
            color: #ffffff;
            box-shadow: 0 10px 20px -5px rgba(11, 87, 207, 0.5);
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 25px -5px rgba(11, 87, 207, 0.6);
        }
        .btn-secondary {
            background: rgba(255, 255, 255, 0.06);
            color: var(--muted);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .footer-note {
            font-size: 11px;
            color: var(--muted);
            margin-top: 16px;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="ornament">꧁꧂</div>
        <h1 class="title">!! <?= htmlspecialchars($channel) ?> Mod !!</h1>
        <div class="divider"></div>

        <?php if ($deviceId): ?>
            <div class="badge-success">
                <span>●</span> Device Verified & Activated
            </div>

            <div class="info-card">
                <div class="info-row">
                    <span class="info-label">Channel</span>
                    <span class="info-val"><?= htmlspecialchars($channel) ?></span>
                </div>
                <div class="info-row">
                    <span class="info-label">Device ID</span>
                    <span class="info-val"><?= htmlspecialchars(substr($deviceId, 0, 10)) ?>...<?= htmlspecialchars(substr($deviceId, -4)) ?></span>
                </div>
                <div class="info-row">
                    <span class="info-label">Package</span>
                    <span class="info-val"><?= htmlspecialchars($pkg) ?></span>
                </div>
                <div class="info-row">
                    <span class="info-label">Expiry (IST)</span>
                    <span class="info-val"><?= htmlspecialchars($istMidnightFormatted) ?></span>
                </div>
            </div>

            <div class="countdown-box">
                <div class="countdown-title">Pin Valid Until Midnight (IST)</div>
                <div class="countdown-val" id="countdown">--:--:--</div>
            </div>

            <button class="btn btn-primary" onclick="alert('Activation Complete!\nPlease switch back to your App to continue.')">
                ✓ Return to App
            </button>
        <?php else: ?>
            <div style="color: #f87171; font-size: 14px; margin: 20px 0;">
                ⚠️ No device hardware ID detected. Please click "Get Pin" from inside the App.
            </div>
        <?php endif; ?>

        <p class="footer-note">
            〄 ➦ PIN resets automatically at 00:00 AM (IST) daily.<br>
            Protected by Razpay Thirdparty Security System.
        </p>
    </div>

    <script>
        // Live Countdown to Midnight IST
        const targetMs = <?= $expiresAt ?>;
        function updateTimer() {
            const now = Date.now();
            const diff = targetMs - now;
            if (diff <= 0) {
                document.getElementById('countdown').innerText = "EXPIRED";
                return;
            }
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);
            document.getElementById('countdown').innerText =
                String(hours).padStart(2, '0') + ":" +
                String(mins).padStart(2, '0') + ":" +
                String(secs).padStart(2, '0');
        }
        setInterval(updateTimer, 1000);
        updateTimer();
    </script>
</body>
</html>
