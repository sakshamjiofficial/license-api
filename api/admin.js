// ==============================================================================
// Vercel Serverless Function: /api/admin
// Complete Standalone Device Management Dashboard
// Fetches live device data from /api/verify to ensure 100% synchronized state.
// ==============================================================================

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    const { action } = req.query;
    const host = req.headers['host'] || 'license-api-theta.vercel.app';
    const protocol = req.headers['x-forwarded-proto'] || 'https';

    // --------------------------------------------------------------------------
    // If called via API (e.g. ?action=list, ?action=activate, etc.), proxy to /api/verify
    // --------------------------------------------------------------------------
    if (action) {
        try {
            const qs = new URLSearchParams(req.query).toString();
            const verifyUrl = `${protocol}://${host}/api/verify?${qs}`;
            const apiRes = await fetch(verifyUrl);
            const data = await apiRes.json();
            res.setHeader('Content-Type', 'application/json');
            return res.status(apiRes.status).json(data);
        } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            return res.status(500).json({ error: "Failed to query verify endpoint: " + err.message });
        }
    }

    // --------------------------------------------------------------------------
    // Default: Render the Complete Interactive HTML Admin Dashboard
    // --------------------------------------------------------------------------
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html>
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
            <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">Monitor and control Android activations in real-time</p>
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
            
            // Check if verify.js returned proper stats
            if (!data || !data.stats) {
                const msg = data && data.message ? data.message : "Incompatible response";
                showToast("Note: Please update api/verify.js on Vercel (" + msg + ")");
                document.getElementById('device-table').innerHTML = 
                    '<tr><td colspan="7" class="empty-state" style="padding: 30px; line-height: 1.8;">' +
                    '<div style="font-size: 16px; font-weight: 700; color: #dc2626; margin-bottom: 8px;">⚠️ api/verify.js on Vercel is still running the old version</div>' +
                    '<div style="color: #4b5563; font-size: 14px;">The dashboard reached <code>/api/verify?action=list</code>, but your deployed <code>api/verify.js</code> returned: <em>\"' + escapeHtml(msg) + '\"</em>.<br>' +
                    'Please copy the updated <code>api/verify.js</code> code into your Vercel project to enable live device listing.</div>' +
                    '</td></tr>';
                return;
            }

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
</html>`);
}
