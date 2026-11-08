// ==============================================================================
// Vercel Serverless Function: GET /api/verify
// Handles BOTH Verification (from Android App) and Activation (from Mobile Browser)
// Combining both in a single handler ensures they share serverless memory reliably.
// ==============================================================================

global.activatedDevices = global.activatedDevices || {};

export default function handler(req, res) {
    // Add CORS & No-Cache headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    try {
        const { device_id, action, pkg } = req.query;

        // 1. Validate device_id presence
        if (!device_id || device_id.trim() === '') {
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).json({
                isValid: false,
                expiresAt: 0,
                message: "Missing device identifier.",
                renewalUrl: null
            });
        }

        const cleanId = device_id.trim();
        const now = Date.now();

        // --------------------------------------------------------------------------
        // ACTION A: BROWSER ACTIVATION LINK VISIT (?action=activate)
        // --------------------------------------------------------------------------
        if (action === 'activate') {
            const durationMs = 24 * 60 * 60 * 1000; // 24 Hours
            const expiresAt = now + durationMs;

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

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Device Activated</title>
                    <style>
                        * { box-sizing: border-box; }
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                            background: #f0fdf4;
                            margin: 0;
                            padding: 40px 16px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 80vh;
                        }
                        .card {
                            background: #ffffff;
                            border-radius: 16px;
                            padding: 32px 24px;
                            max-width: 420px;
                            width: 100%;
                            text-align: center;
                            box-shadow: 0 10px 25px rgba(0,0,0,0.06);
                            border: 1px solid #bbf7d0;
                        }
                        .icon {
                            width: 64px;
                            height: 64px;
                            background: #dcfce7;
                            color: #16a34a;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 32px;
                            margin: 0 auto 20px auto;
                        }
                        h1 { font-size: 22px; color: #166534; margin: 0 0 10px 0; }
                        p { font-size: 15px; color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; }
                        .badge {
                            display: inline-block;
                            background: #dcfce7;
                            color: #15803d;
                            font-size: 13px;
                            padding: 6px 14px;
                            border-radius: 20px;
                            font-weight: 600;
                            margin-bottom: 24px;
                        }
                        .hint {
                            font-size: 14px;
                            color: #1f2937;
                            background: #f8fafc;
                            padding: 14px;
                            border-radius: 8px;
                            border: 1px dashed #cbd5e1;
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="icon">✓</div>
                        <h1>Device Activated!</h1>
                        <div class="badge">Valid for 24 Hours</div>
                        <p>Your device identity <code>${cleanId}</code> has been verified.</p>
                        <div class="hint">
                            👉 <strong>Switch back to your app now.</strong><br>
                            It will automatically unlock.
                        </div>
                    </div>
                </body>
                </html>
            `);
        }

        // --------------------------------------------------------------------------
        // ACTION B: ANDROID APP VERIFICATION (called in onResume)
        // --------------------------------------------------------------------------
        let record = global.activatedDevices[cleanId];
        let expiresAt = 0;

        if (typeof record === 'number') {
            expiresAt = record;
            record = { expiresAt, pkg: pkg || 'unknown', lastSeen: now, firstSeen: now };
            global.activatedDevices[cleanId] = record;
        } else if (record && typeof record === 'object') {
            expiresAt = record.expiresAt || 0;
            record.lastSeen = now;
            if (pkg) record.pkg = pkg;
        } else {
            // First time this device has been observed
            global.activatedDevices[cleanId] = {
                expiresAt: 0,
                pkg: pkg || 'unknown',
                firstSeen: now,
                lastSeen: now
            };
        }

        res.setHeader('Content-Type', 'application/json');

        // Check if device is active and not expired
        if (expiresAt > now) {
            return res.status(200).json({
                isValid: true,
                expiresAt: expiresAt,
                message: "Device active and verified.",
                renewalUrl: null
            });
        }

        // Device is NOT active -> Generate browser activation URL
        const host = req.headers['host'] || 'license-api-theta.vercel.app';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const activationLink = `${protocol}://${host}/api/verify?action=activate&device_id=${encodeURIComponent(cleanId)}`;

        return res.status(200).json({
            isValid: false,
            expiresAt: 0,
            message: "Daily device activation required. Click below to activate.",
            renewalUrl: activationLink
        });

    } catch (err) {
        // Guaranteed safe fallback: never crash with 500 FUNCTION_INVOCATION_FAILED
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
            isValid: false,
            expiresAt: 0,
            message: "Server verification error: " + err.message,
            renewalUrl: null
        });
    }
}
