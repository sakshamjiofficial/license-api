<?php
/**
 * ==============================================================================
 * Background Polling & Verification Endpoint: dt.php
 * Path: /thirdparty/dt.php
 *
 * Polled on app launch / onResume() by HttpRequestTask.java:
 *   URL: /thirdparty/dt.php?ch=<Admin>&pkgname=<pkg_stripped>&androidid=<android_id>
 *
 * Response Contract:
 * - If ACTIVE & VALID: Response MUST contain "!!" (e.g., "Welcome !! Device Active")
 * - If EXPIRED / INVALID: Response MUST NOT contain "!!" (e.g., "EXPIRED")
 * ==============================================================================
 */

header('Content-Type: text/plain; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

date_default_timezone_set('Asia/Kolkata');

$DATA_DIR = __DIR__ . '/data';
$DB_FILE = $DATA_DIR . '/activated_devices.json';

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

$channel = isset($_GET['ch']) ? trim($_GET['ch']) : '';
$pkg = isset($_GET['pkgname']) ? trim($_GET['pkgname']) : (isset($_GET['pkg']) ? trim($_GET['pkg']) : '');
$androidId = isset($_GET['androidid']) ? trim($_GET['androidid']) : (isset($_GET['device_id']) ? trim($_GET['device_id']) : '');

if (!$androidId) {
    echo "EXPIRED: No device ID provided";
    exit;
}

$devices = loadActivatedDevices($DB_FILE);
$nowMs = round(microtime(true) * 1000);

if (isset($devices[$androidId])) {
    $record = $devices[$androidId];
    $expiresAt = $record['expiresAt'] ?? 0;

    if ($expiresAt > $nowMs) {
        // EXACT REQUIREMENT: Must contain "!!" to unlock the app
        $channelName = !empty($channel) ? $channel : ($record['channel'] ?? 'User');
        echo "Welcome !! - Device activated for {$channelName} until 00:00 AM IST.";
        exit;
    }
}

// If not found or expired, output string WITHOUT "!!" so the app launches CG.invoke()
echo "EXPIRED: Device not active or daily PIN expired at 00:00 AM IST.";
exit;
