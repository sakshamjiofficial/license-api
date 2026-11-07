    export default function handler(req, res) {
        // Set response headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, max-age=0');

        // Read query parameters (?key=...&device_id=...&pkg=...)
        const { key, device_id, pkg } = req.query;

        const renewalUrl = "https://yourdomain.com/getkey";

        // 1. License Keys Database
        // Format: 'KEY' => Expiration timestamp in milliseconds (1798761599000 = Dec 31, 2026)
        const keysDatabase = {
            "KEY-1234567": 1798761599000,
            "VIP-PRO-2026": 1798761599000,
            "TEST-PIN-7890": 1780000000000
        };

        // 2. Check if key is provided
        if (!key || key.trim() === '') {
            return res.status(200).json({
                isValid: false,
                expiresAt: 0,
                message: "Please enter your license key to activate.",
                renewalUrl: renewalUrl
            });
        }

        const cleanKey = key.trim();

        // 3. Check if key exists
        if (!keysDatabase.hasOwnProperty(cleanKey)) {
            return res.status(200).json({
                isValid: false,
                expiresAt: 0,
                message: "Invalid license key or PIN.",
                renewalUrl: renewalUrl
            });
        }

        const expiresAt = keysDatabase[cleanKey];
        const now = Date.now();

        // 4. Check expiration
        if (expiresAt <= now) {
            return res.status(200).json({
                isValid: false,
                expiresAt: expiresAt,
                message: "This license key has expired.",
                renewalUrl: renewalUrl
            });
        }

        // 5. Success
        return res.status(200).json({
            isValid: true,
            expiresAt: expiresAt,
            message: "License verified successfully.",
            renewalUrl: null
        });
    }
