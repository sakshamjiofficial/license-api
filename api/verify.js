// ==============================================================================
// Vercel Serverless Function: /api/verify
// Master Controller: Verification, Activation & Admin Listing
// Features: Daily Midnight (00:00 AM IST) Expiration, Hardware Device ID Support
// ==============================================================================

global.activatedDevices = global.activatedDevices || {};

// Optional Cloud Persistence (Vercel KV / Upstash Redis REST API)
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function syncFromCloud() {
    if (!KV_URL || !KV_TOKEN) return;
    try {
        const res = await fetch(`${KV_URL}/get/activated_devices`, {
            headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        const data = await res.json();
        if (data && data.result) {
            const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
            if (parsed && typeof parsed === 'object') {
                global.activatedDevices = { ...parsed, ...global.activatedDevices };
            }
        }
    } catch (e) {}
}

async function syncToCloud() {
    if (!KV_URL || !KV_TOKEN) return;
    try {
        await fetch(`${KV_URL}/set/activated_devices`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${KV_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(JSON.stringify(global.activatedDevices))
        });
    } catch (e) {}
}

// ------------------------------------------------------------------------------
// Calculate Next Midnight in Indian Standard Time (IST: UTC + 5:30)
// Exactly matches Thirdparty_Link_vist "Pin reset after 00:00 am everyday"
// ------------------------------------------------------------------------------
function getNextMidnightIST(baseDate = new Date()) {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(baseDate.getTime() + istOffsetMs);

    // Construct next day 00:00:00.000 in IST
    const nextMidnightUTC = new Date(Date.UTC(
        istNow.getUTCFullYear(),
        istNow.getUTCMonth(),
        istNow.getUTCDate() + 1,
        0, 0, 0, 0
    ));

    return nextMidnightUTC.getTime() - istOffsetMs;
}

function formatTimeRemaining(ms) {
    if (ms <= 0) return "Expired";
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return "Never";
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    try {
        await syncFromCloud();

        const { action, device_id, pkg, hours } = req.query;
        const now = Date.now();

        // ----------------------------------------------------------------------
        // 1. ACTION: LIST REGISTERED DEVICES (Dashboard API)
        // ----------------------------------------------------------------------
        if (action === 'list') {
            res.setHeader('Content-Type', 'application/json');
            const list = [];
            let activeCount = 0;
            let expiredCount = 0;

            for (const [id, raw] of Object.entries(global.activatedDevices)) {
                let record = typeof raw === 'number'
                    ? { expiresAt: raw, pkg: 'unknown', firstSeen: raw, lastSeen: raw }
                    : raw;

                const isActive = record.expiresAt && record.expiresAt > now;
                if (isActive) activeCount++;
                else expiredCount++;

                list.push({
                    device_id: id,
                    pkg: record.pkg || 'android.app',
                    isActive: !!isActive,
                    expiresAt: record.expiresAt || 0,
                    expiresFormatted: record.expiresAt ? new Date(record.expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : 'Never',
                    timeRemaining: isActive ? formatTimeRemaining(record.expiresAt - now) : 'Expired',
                    lastSeen: formatRelativeTime(record.lastSeen)
                });
            }

            list.sort((a, b) => b.expiresAt - a.expiresAt);

            return res.status(200).json({
                stats: { total: list.length, active: activeCount, expired: expiredCount },
                devices: list,
                midnightIST: new Date(getNextMidnightIST()).toISOString()
            });
        }

        // ----------------------------------------------------------------------
        // 2. ACTION: ADMIN MANUAL ACTIVATE / EXTEND
        // ----------------------------------------------------------------------
        if (action === 'admin_activate') {
            res.setHeader('Content-Type', 'application/json');
            if (!device_id) return res.status(400).json({ error: "Missing device_id" });

            const cleanId = device_id.trim();
            let expiresAt;
            if (hours === 'midnight') {
                expiresAt = getNextMidnightIST();
            } else {
                const durationHours = parseFloat(hours) || 24;
                expiresAt = now + (durationHours * 60 * 60 * 1000);
            }

            let record = global.activatedDevices[cleanId];
            if (typeof record === 'object' && record !== null) {
                record.expiresAt = expiresAt;
                record.lastSeen = now;
            } else {
                global.activatedDevices[cleanId] = {
                    expiresAt: expiresAt,
                    pkg: pkg || 'manual',
                    firstSeen: now,
                    lastSeen: now
                };
            }

            await syncToCloud();
            return res.status(200).json({ success: true, device_id: cleanId, expiresAt });
        }

        // ----------------------------------------------------------------------
        // 3. ACTION: REVOKE LICENSE FROM ADMIN
        // ----------------------------------------------------------------------
        if (action === 'revoke') {
            res.setHeader('Content-Type', 'application/json');
            if (!device_id) return res.status(400).json({ error: "Missing device_id" });

            const cleanId = device_id.trim();
            if (global.activatedDevices[cleanId]) {
                if (typeof global.activatedDevices[cleanId] === 'object') {
                    global.activatedDevices[cleanId].expiresAt = 0;
                    global.activatedDevices[cleanId].lastSeen = now;
                } else {
                    global.activatedDevices[cleanId] = 0;
                }
            }

            await syncToCloud();
            return res.status(200).json({ success: true, revoked: cleanId });
        }

        // ----------------------------------------------------------------------
        // 4. ACTION: DELETE DEVICE RECORD FROM ADMIN
        // ----------------------------------------------------------------------
        if (action === 'delete') {
            res.setHeader('Content-Type', 'application/json');
            if (!device_id) return res.status(400).json({ error: "Missing device_id" });

            delete global.activatedDevices[device_id.trim()];
            await syncToCloud();
            return res.status(200).json({ success: true, deleted: device_id.trim() });
        }

        // ----------------------------------------------------------------------
        // 5. ACTION: BROWSER ACTIVATION LINK VISIT (?action=activate)
        // Set expiry to exact Next Midnight IST (00:00 AM)
        // ----------------------------------------------------------------------
        if (action === 'activate') {
            if (!device_id || device_id.trim() === '') {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                return res.status(400).send("<h3>Missing device identifier</h3>");
            }

            const cleanId = device_id.trim();
            const expiresAt = getNextMidnightIST(new Date());

            let record = global.activatedDevices[cleanId];
            if (typeof record === 'object' && record !== null) {
                record.expiresAt = expiresAt;
                record.lastSeen = now;
            } else {
                global.activatedDevices[cleanId] = {
                    expiresAt: expiresAt,
                    pkg: pkg || 'android.app',
                    firstSeen: now,
                    lastSeen: now
                };
            }

            await syncToCloud();

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Device Activated</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #090d16;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px 16px;
        }
        .card {
            background: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 12px;
            padding: 36px 28px;
            max-width: 420px;
            width: 100%;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .icon-circle {
            width: 56px;
            height: 56px;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #10b981;
            margin-bottom: 20px;
        }
        h1 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .badge {
            display: inline-block;
            background: rgba(16, 185, 129, 0.12);
            color: #10b981;
            border: 1px solid rgba(16, 185, 129, 0.25);
            font-size: 12px;
            font-weight: 500;
            padding: 4px 12px;
            border-radius: 20px;
            margin-bottom: 20px;
        }
        p {
            color: #94a3b8;
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .device-code {
            font-family: ui-monospace, SFMono-Regular, monospace;
            font-size: 12px;
            color: #cbd5e1;
            background: #1e293b;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .instruction-box {
            background: #1e293b;
            border: 1px dashed #334155;
            border-radius: 8px;
            padding: 14px;
            font-size: 13px;
            color: #cbd5e1;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-circle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1>Device Activated</h1>
        <div class="badge">Valid Until 00:00 AM (IST Midnight)</div>
        <p>Hardware ID <code class="device-code">${cleanId}</code> is verified for today.</p>
        <div class="instruction-box">
            Switch back to your application now.<br>
            It will detect activation and unlock automatically.
        </div>
    </div>
</body>
</html>`);
        }

        // ----------------------------------------------------------------------
        // 6. ACTION: ANDROID APP VERIFICATION (Called by App in onResume)
        // ----------------------------------------------------------------------
        if (!device_id || device_id.trim() === '') {
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).json({
                isValid: false,
                expiresAt: 0,
                message: "Missing hardware device identifier.",
                renewalUrl: null
            });
        }

        const cleanDeviceId = device_id.trim();

        let record = global.activatedDevices[cleanDeviceId];
        let expiresAt = 0;

        if (typeof record === 'number') {
            expiresAt = record;
            record = { expiresAt, pkg: pkg || 'unknown', lastSeen: now, firstSeen: now };
            global.activatedDevices[cleanDeviceId] = record;
        } else if (record && typeof record === 'object') {
            expiresAt = record.expiresAt || 0;
            record.lastSeen = now;
            if (pkg) record.pkg = pkg;
        } else {
            // First time device has visited: record as unactivated
            global.activatedDevices[cleanDeviceId] = {
                expiresAt: 0,
                pkg: pkg || 'unknown',
                firstSeen: now,
                lastSeen: now
            };
        }

        await syncToCloud();

        res.setHeader('Content-Type', 'application/json');

        // Check if device is active and not expired (Expires at Midnight IST)
        if (expiresAt > now) {
            return res.status(200).json({
                isValid: true,
                expiresAt: expiresAt,
                message: "Device active until 00:00 AM IST.",
                renewalUrl: null
            });
        }

        // Device is NOT active today -> Return browser activation link
        const host = req.headers['host'] || 'license-api-theta.vercel.app';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const activationLink = `${protocol}://${host}/api/verify?action=activate&device_id=${encodeURIComponent(cleanDeviceId)}`;

        return res.status(200).json({
            isValid: false,
            expiresAt: 0,
            message: "Daily activation required. Valid until 00:00 AM (IST) everyday.",
            renewalUrl: activationLink
        });

    } catch (err) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
            isValid: false,
            expiresAt: 0,
            message: "Server error: " + err.message,
            renewalUrl: null
        });
    }
}
