// ==============================================================================
// Vercel Serverless Function: GET /api/verify
// Queried automatically by the Android app in onResume()
// ==============================================================================

// Global in-memory cache for active lambda instances
global.activatedDevices = global.activatedDevices || {};

export default function handler(req, res) {
    // Set headers to prevent caching
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { device_id, pkg } = req.query;

    if (!device_id || device_id.trim() === '') {
        return res.status(200).json({
            isValid: false,
            expiresAt: 0,
            message: "Missing device identifier.",
            renewalUrl: null
        });
    }

    const cleanDeviceId = device_id.trim();
    const now = Date.now();
    const expiry = global.activatedDevices[cleanDeviceId];

    // 1. Device is already activated and unexpired
    if (expiry && expiry > now) {
        return res.status(200).json({
            isValid: true,
            expiresAt: expiry,
            message: "Device active and verified.",
            renewalUrl: null
        });
    }

    // 2. Device is not active or has expired today
    const host = req.headers['host'];
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const activationLink = `${protocol}://${host}/api/activate?device_id=${encodeURIComponent(cleanDeviceId)}`;

    return res.status(200).json({
        isValid: false,
        expiresAt: 0,
        message: "Device requires daily activation. Please complete link visit.",
        renewalUrl: activationLink
    });
}
