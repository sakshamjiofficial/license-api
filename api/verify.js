// ==============================================================================
// Vercel Serverless Function: /api/verify
// Unified Master Controller: Verification, Activation & Admin Dashboard
// Combining all operations ensures 100% shared state in Vercel serverless.
// Supports optional persistent cloud storage via Vercel KV / Upstash Redis.
// ==============================================================================

// In-memory registry (fast local cache)
global.activatedDevices = global.activatedDevices || {};

// ------------------------------------------------------------------------------
// Optional Cloud Persistence (Vercel KV / Upstash Redis REST API)
// Automatically activates if KV_REST_API_URL or UPSTASH_REDIS_REST_URL is set in Vercel
// ------------------------------------------------------------------------------
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
    } catch (e) {
        // Fallback to in-memory silently
    }
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
    } catch (e) {
        // Fallback to in-memory silently
    }
}

// Format helpers
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
        // Initial sync from persistent store if available
        await syncFromCloud();

        const { action, device_id, pkg, hours } = req.query;
        const now = Date.now();

        // ======================================================================
        // 1. ACTION: ADMIN DASHBOARD HTML PAGE
        // ======================================================================
        if (action === 'admin' || (!action && !device_id && (req.headers.accept || '').includes('text/html'))) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(renderAdminHtml(KV_URL ? 'Connected (Vercel KV)' : 'In-Memory (Single Container)'));
        }

        // ======================================================================
        // 2. ACTION: LIST REGISTERED DEVICES (Dashboard API)
        // ======================================================================
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
                    pkg: record.pkg || 'unknown',
                    isActive: !!isActive,
                    expiresAt: record.expiresAt || 0,
                    expiresFormatted: record.expiresAt ? new Date(record.expiresAt).toLocaleString() : 'Never',
                    timeRemaining: isActive ? formatTimeRemaining(record.expiresAt - now) : 'Expired',
                    lastSeen: formatRelativeTime(record.lastSeen)
                });
            }

            list.sort((a, b) => b.expiresAt - a.expiresAt);

            return res.status(200).json({
                stats: { total: list.length, active: activeCount, expired: expiredCount },
                devices: list,
                storage: KV_URL ? 'cloud_kv' : 'memory'
            });
        }

        // ======================================================================
        // 3. ACTION: MANUAL ACTIVATE / EXTEND FROM ADMIN
        // ======================================================================
        if (action === 'admin_activate') {
            res.setHeader('Content-Type', 'application/json');
            if (!device_id) return res.status(400).json({ error: "Missing device_id" });

            const cleanId = device_id.trim();
            const durationHours = parseFloat(hours) || 24;
            const expiresAt = now + (durationHours * 60 * 60 * 1000);

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

        // ======================================================================
        // 4. ACTION: REVOKE LICENSE FROM ADMIN
        // ======================================================================
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

        // ======================================================================
        // 5. ACTION: DELETE DEVICE RECORD FROM ADMIN
        // ======================================================================
        if (action === 'delete') {
            res.setHeader('Content-Type', 'application/json');
            if (!device_id) return res.status(400).json({ error: "Missing device_id" });

            delete global.activatedDevices[device_id.trim()];
            await syncToCloud();
            return res.status(200).json({ success: true, deleted: device_id.trim() });
        }

        // ======================================================================
        // 6. ACTION: MOBILE BROWSER ACTIVATION LINK VISIT (?action=activate)
        // ======================================================================
        if (action === 'activate') {
            if (!device_id || device_id.trim() === '') {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                return res.status(400).send("<h3>Missing device_id</h3>");
            }

            const cleanId = device_id.trim();
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

            await syncToCloud();

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

        // ======================================================================
        // 7. ACTION: ANDROID APP VERIFICATION (Called by app in onResume)
        // ======================================================================
        if (!device_id || device_id.trim() === '') {
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).json({
                isValid: false,
                expiresAt: 0,
                message: "Missing device identifier.",
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
            // First time device has visited: register as unactivated
            global.activatedDevices[cleanDeviceId] = {
                expiresAt: 0,
                pkg: pkg || 'unknown',
                firstSeen: now,
                lastSeen: now
            };
        }

        await syncToCloud();

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

        // Device is NOT active -> Return activation link
        const host = req.headers['host'] || 'license-api-theta.vercel.app';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const activationLink = `${protocol}://${host}/api/verify?action=activate&device_id=${encodeURIComponent(cleanDeviceId)}`;

        return res.status(200).json({
            isValid: false,
            expiresAt: 0,
            message: "Daily device activation required. Click below to activate.",
            renewalUrl: activationLink
        });

    } catch (err) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
            isValid: false,
            expiresAt: 0,
            message: "Server verification error: " + err.message,
            renewalUrl: null
        });
    }
}

// ------------------------------------------------------------------------------
// HTML Template for Admin Dashboard
// ------------------------------------------------------------------------------
function renderAdminHtml(storageStatus) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>License Dashboard - Live Device Manager</title>
    <style>
        :root {
            --bg: #f8fafc;
            --surface: #ffffff;
            --border: #e2e8f0;
            --text: #0f172a;
            --text-muted: #64748b;
            --primary: #2563eb;
            --primary-hover: #1d4ed8;
            --success: #16a34a;
            --success-bg: #dcfce7;
            --danger: #dc2626;
            --danger-bg: #fee2e2;
            --radius: 10px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            padding: 30px 20px;
        }
        .container { max-width: 1100px; margin: 0 auto; }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            flex-wrap: wrap;
            gap: 15px;
        }
        h1 { font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .tag { font-size: 12px; background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 20px; font-weight: 600; }
        .storage-badge { font-size: 12px; background: #e2e8f0; color: #475569; padding: 4px 10px; border-radius: 6px; font-weight: 500; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 15px;
            margin-bottom: 25px;
        }
        .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .stat-label { font-size: 13px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-bottom: 6px; }
        .stat-value { font-size: 28px; font-weight: 700; }
        .stat-active { color: var(--success); }
        .stat-expired { color: var(--danger); }
        
        .controls {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            background: var(--surface);
            padding: 16px;
            border-radius: var(--radius);
            border: 1px solid var(--border);
        }
        .controls input, .controls select, .controls button {
            padding: 10px 14px;
            border-radius: 6px;
            border: 1px solid var(--border);
            font-size: 14px;
        }
        .controls input { flex: 1; min-width: 200px; }
        .btn-primary {
            background: var(--primary);
            color: white;
            border: none;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.2s;
        }
        .btn-primary:hover { background: var(--primary-hover); }
        
        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--surface);
            border-radius: var(--radius);
            overflow: hidden;
            border: 1px solid var(--border);
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        th, td { padding: 14px 18px; text-align: left; font-size: 14px; }
        th { background: #f1f5f9; color: var(--text-muted); font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
        tr:not(:last-child) { border-bottom: 1px solid var(--border); }
        tr:hover { background: #f8fafc; }
        
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-active { background: var(--success-bg); color: var(--success); }
        .badge-expired { background: var(--danger-bg); color: var(--danger); }
        
        .device-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 600; }
        .btn-action {
            padding: 6px 10px;
            border-radius: 5px;
            border: 1px solid var(--border);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            background: white;
            margin-right: 4px;
            transition: 0.15s;
        }
        .btn-action:hover { background: #f1f5f9; }
        .btn-revoke { color: var(--danger); border-color: #fecaca; }
        .btn-revoke:hover { background: var(--danger-bg); }
        .btn-add { color: var(--primary); border-color: #bfdbfe; }
        .btn-add:hover { background: #dbeafe; }
        
        .empty-state { text-align: center; padding: 40px; color: var(--text-muted); }
        .toast {
            position: fixed;
            bottom: 25px;
            right: 25px;
            background: #1e293b;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            display: none;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 1000;
        }
    </style>
</head>
<body>
<div class="container">
    <header>
        <div>
            <h1>Device License Dashboard <span class="tag">Live Manager</span></h1>
            <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">
                Storage: <span class="storage-badge">${storageStatus}</span>
            </p>
        </div>
        <button class="btn-action" onclick="fetchDevices()" style="padding: 10px 16px; font-size: 13px;">🔄 Refresh List</button>
    </header>

    <div class="stats">
        <div class="card">
            <div class="stat-label">Total Registered</div>
            <div class="stat-value" id="stat-total">0</div>
        </div>
        <div class="card">
            <div class="stat-label">Currently Active</div>
            <div class="stat-value stat-active" id="stat-active">0</div>
        </div>
        <div class="card">
            <div class="stat-label">Expired / Inactive</div>
            <div class="stat-value stat-expired" id="stat-expired">0</div>
        </div>
    </div>

    <div class="controls">
        <input type="text" id="search-input" placeholder="🔍 Search by device ID or package..." oninput="filterTable()">
        <input type="text" id="manual-id" placeholder="Device UUID to activate" style="flex: 0.8;">
        <select id="manual-hours">
            <option value="24">24 Hours (1 Day)</option>
            <option value="48">48 Hours (2 Days)</option>
            <option value="168">7 Days (1 Week)</option>
            <option value="720">30 Days (1 Month)</option>
        </select>
        <button class="btn-primary" onclick="manualActivate()">+ Activate Device</button>
    </div>

    <table>
        <thead>
            <tr>
                <th>Status</th>
                <th>Device ID</th>
                <th>Package</th>
                <th>Time Remaining</th>
                <th>Expires At</th>
                <th>Last Active</th>
                <th style="text-align: right;">Quick Actions</th>
            </tr>
        </thead>
        <tbody id="device-table">
            <tr><td colspan="7" class="empty-state">Loading registered devices...</td></tr>
        </tbody>
    </table>
</div>

<div class="toast" id="toast"></div>

<script>
    let allDevices = [];

    async function fetchDevices() {
        try {
            const res = await fetch('/api/verify?action=list');
            const data = await res.json();
            allDevices = data.devices || [];
            
            document.getElementById('stat-total').innerText = data.stats.total;
            document.getElementById('stat-active').innerText = data.stats.active;
            document.getElementById('stat-expired').innerText = data.stats.expired;

            renderTable(allDevices);
        } catch (e) {
            showToast("Failed to fetch devices: " + e.message);
        }
    }

    function renderTable(devices) {
        const tbody = document.getElementById('device-table');
        if (devices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No devices registered yet. Devices appear automatically when the Android app launches.</td></tr>';
            return;
        }

        tbody.innerHTML = devices.map(d => \`
            <tr>
                <td><span class="badge \${d.isActive ? 'badge-active' : 'badge-expired'}">\${d.isActive ? 'Active' : 'Expired'}</span></td>
                <td class="device-code">\${escapeHtml(d.device_id)}</td>
                <td style="color: var(--text-muted); font-size: 13px;">\${escapeHtml(d.pkg)}</td>
                <td style="font-weight: 600;">\${d.timeRemaining}</td>
                <td style="color: var(--text-muted); font-size: 13px;">\${d.expiresFormatted}</td>
                <td style="color: var(--text-muted); font-size: 13px;">\${d.lastSeen}</td>
                <td style="text-align: right;">
                    <button class="btn-action btn-add" onclick="modifyDevice('\${escapeHtml(d.device_id)}', 24)">+24h</button>
                    \${d.isActive ? \`<button class="btn-action btn-revoke" onclick="revokeDevice('\${escapeHtml(d.device_id)}')">Revoke</button>\` : ''}
                    <button class="btn-action" onclick="deleteDevice('\${escapeHtml(d.device_id)}')">✕</button>
                </td>
            </tr>
        \`).join('');
    }

    async function modifyDevice(id, hours) {
        try {
            const res = await fetch(\`/api/verify?action=admin_activate&device_id=\${encodeURIComponent(id)}&hours=\${hours}\`);
            const data = await res.json();
            showToast("Device activated for " + hours + " hours");
            fetchDevices();
        } catch (e) {
            showToast("Error updating device");
        }
    }

    async function revokeDevice(id) {
        if (!confirm("Revoke license for this device immediately?")) return;
        try {
            await fetch(\`/api/verify?action=revoke&device_id=\${encodeURIComponent(id)}\`);
            showToast("Device license revoked");
            fetchDevices();
        } catch (e) {
            showToast("Error revoking device");
        }
    }

    async function deleteDevice(id) {
        if (!confirm("Remove this device from the registry?")) return;
        try {
            await fetch(\`/api/verify?action=delete&device_id=\${encodeURIComponent(id)}\`);
            showToast("Device deleted");
            fetchDevices();
        } catch (e) {
            showToast("Error deleting device");
        }
    }

    async function manualActivate() {
        const idInput = document.getElementById('manual-id');
        const hoursSelect = document.getElementById('manual-hours');
        const id = idInput.value.trim();
        const hours = hoursSelect.value;

        if (!id) {
            alert("Please enter a device ID");
            return;
        }

        await modifyDevice(id, hours);
        idInput.value = '';
    }

    function filterTable() {
        const query = document.getElementById('search-input').value.toLowerCase();
        const filtered = allDevices.filter(d => 
            d.device_id.toLowerCase().includes(query) || 
            d.pkg.toLowerCase().includes(query)
        );
        renderTable(filtered);
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.innerText = msg;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 2500);
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Auto-fetch on load and poll every 8 seconds
    fetchDevices();
    setInterval(fetchDevices, 8000);
</script>
</body>
</html>`;
}
