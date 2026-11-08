// ==============================================================================
// Vercel Serverless Function: GET /api/activate
// Opened in mobile browser when user clicks the dialog action button
// ==============================================================================

global.activatedDevices = global.activatedDevices || {};

export default function handler(req, res) {
    const { device_id } = req.query;

    if (!device_id || device_id.trim() === '') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(400).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Error</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 40px 20px; background: #fff5f5; color: #c53030; }
                    .card { background: white; padding: 25px; border-radius: 10px; max-width: 400px; margin: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.08); }
                </style>
            </head>
            <body>
                <div class="card">
                    <h3>Missing Device Identifier</h3>
                    <p>No device ID was provided. Please launch the link from inside the application.</p>
                </div>
            </body>
            </html>
        `);
    }

    const cleanDeviceId = device_id.trim();
    const durationMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expiresAt = now + durationMs;

    // Save or update device record
    let record = global.activatedDevices[cleanDeviceId];
    if (typeof record === 'object' && record !== null) {
        record.expiresAt = expiresAt;
        record.lastSeen = now;
    } else {
        global.activatedDevices[cleanDeviceId] = {
            expiresAt: expiresAt,
            pkg: 'unknown',
            firstSeen: now,
            lastSeen: now
        };
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

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
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background: #f7fafc;
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
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.03);
                    border: 1px solid #edf2f7;
                }
                .icon {
                    width: 64px;
                    height: 64px;
                    background: #e6fffa;
                    color: #319795;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    margin: 0 auto 20px auto;
                }
                h1 {
                    font-size: 22px;
                    color: #2d3748;
                    margin: 0 0 10px 0;
                }
                p {
                    font-size: 15px;
                    color: #718096;
                    line-height: 1.6;
                    margin: 0 0 24px 0;
                }
                .badge {
                    display: inline-block;
                    background: #edf2f7;
                    color: #4a5568;
                    font-size: 13px;
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-weight: 500;
                    margin-bottom: 24px;
                }
                .hint {
                    font-size: 14px;
                    color: #4a5568;
                    background: #f7fafc;
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px dashed #cbd5e0;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">✓</div>
                <h1>Device Activated!</h1>
                <div class="badge">Valid for 24 Hours</div>
                <p>Your device has been verified in our authentication system.</p>
                <div class="hint">
                    👉 <strong>Switch back to your app now</strong><br>
                    It will unlock automatically.
                </div>
            </div>
        </body>
        </html>
    `);
}
