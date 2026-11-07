 // Combined handler so both actions share the exact same serverless memory
    global.activatedDevices = global.activatedDevices || {};
    
    export default function handler(req, res) {
        const { device_id, action } = req.query;
    
        if (!device_id) {
            return res.status(200).json({ isValid: false, message: "Missing device_id" });
        }
    
        const cleanId = device_id.trim();
        const now = Date.now();
    
        // 1. ACTION: USER VISITED THE ACTIVATION LINK IN BROWSER
        if (action === 'activate') {
            const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours
            global.activatedDevices[cleanId] = expiresAt;
    
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Activated</title>
                    <style>
                        body { font-family: sans-serif; text-align: center; padding: 40px 20px; background: #f0fdf4; }
                        .card { background: white; padding: 30px; border-radius: 12px; max-width: 400px; margin: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                        h2 { color: #16a34a; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h2>✓ Activated for 24 Hours!</h2>
                        <p>Your device is verified.</p>
                        <p><strong>Switch back to the app now.</strong></p>
                    </div>
                </body>
                </html>
            `);
        }
    
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const activationUrl = `${protocol}://${host}/api/verify?action=activate&device_id=${encodeURIComponent(cleanId)}`;

        return res.status(200).json({
            isValid: false,
            message: "Click Activate Device below.",
            renewalUrl: activationUrl
        });
    }
