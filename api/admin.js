// ==============================================================================
// Vercel Serverless Function: /api/admin
// Un-slopped Standalone Device Management Dashboard
// Pro-grade interface with zero AI cliches, clean SVG iconography & live state sync.
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
    // Default: Render the Un-slopped HTML Admin Dashboard
    // --------------------------------------------------------------------------
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Device Management Dashboard</title>
    <style>
        :root {
            --bg-base: #090d16;
            --bg-surface: #0f172a;
            --bg-surface-elevated: #1e293b;
            --bg-subtle: #172033;
            --border-subtle: #1e293b;
            --border-default: #334155;
            --border-focus: #6366f1;
            
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-tertiary: #64748b;
            
            --accent-primary: #6366f1;
            --accent-primary-hover: #4f46e5;
            --accent-subtle: rgba(99, 102, 241, 0.12);
            
            --status-active: #10b981;
            --status-active-bg: rgba(16, 185, 129, 0.1);
            --status-active-border: rgba(16, 185, 129, 0.25);
            
            --status-expired: #64748b;
            --status-expired-bg: rgba(100, 116, 139, 0.1);
            --status-expired-border: rgba(100, 116, 139, 0.25);
            
            --status-danger: #f43f5e;
            --status-danger-bg: rgba(244, 63, 94, 0.1);
            --status-danger-border: rgba(244, 63, 94, 0.25);
            
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
            --radius-sm: 6px;
            --radius-md: 8px;
            --radius-lg: 12px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background-color: var(--bg-base);
            color: var(--text-primary);
            font-family: var(--font-sans);
            font-size: 14px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
            padding: 32px 24px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        /* Header */
        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 28px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border-subtle);
            flex-wrap: wrap;
            gap: 16px;
        }

        .header-title-group {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        h1 {
            font-size: 20px;
            font-weight: 600;
            letter-spacing: -0.02em;
            color: var(--text-primary);
        }

        .pulse-indicator {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--text-secondary);
            background: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            padding: 4px 10px;
            border-radius: var(--radius-sm);
        }

        .pulse-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: var(--status-active);
            box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
            animation: pulse-ring 2.5s infinite;
        }

        @keyframes pulse-ring {
            0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
            70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        /* Metric Grid */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .metric-card {
            background-color: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 18px 20px;
            transition: border-color 0.15s ease;
        }

        .metric-card:hover {
            border-color: var(--border-default);
        }

        .metric-label {
            font-size: 12px;
            font-weight: 500;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 8px;
        }

        .metric-value {
            font-size: 32px;
            font-weight: 600;
            letter-spacing: -0.03em;
            font-variant-numeric: tabular-nums;
            line-height: 1;
        }

        .metric-value.active { color: var(--status-active); }
        .metric-value.expired { color: var(--text-secondary); }

        /* Action Toolbar */
        .toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            background: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            padding: 12px 16px;
            border-radius: var(--radius-md);
        }

        .search-container {
            position: relative;
            flex: 1;
            min-width: 260px;
        }

        .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-tertiary);
            pointer-events: none;
            width: 16px;
            height: 16px;
        }

        .search-input {
            width: 100%;
            background: var(--bg-base);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            padding: 8px 12px 8px 36px;
            color: var(--text-primary);
            font-size: 13px;
            outline: none;
            transition: border-color 0.15s ease;
        }

        .search-input:focus {
            border-color: var(--border-focus);
        }

        .search-input::placeholder {
            color: var(--text-tertiary);
        }

        .toolbar-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .input-text {
            background: var(--bg-base);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            padding: 8px 12px;
            color: var(--text-primary);
            font-size: 13px;
            outline: none;
            min-width: 200px;
            font-family: var(--font-mono);
        }

        .input-text:focus {
            border-color: var(--border-focus);
        }

        .select-custom {
            background: var(--bg-base);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            padding: 8px 12px;
            color: var(--text-primary);
            font-size: 13px;
            outline: none;
            cursor: pointer;
        }

        .select-custom:focus {
            border-color: var(--border-focus);
        }

        /* Buttons */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 500;
            border-radius: var(--radius-sm);
            padding: 8px 14px;
            cursor: pointer;
            border: 1px solid transparent;
            transition: all 0.15s ease;
            white-space: nowrap;
        }

        .btn-primary {
            background-color: var(--accent-primary);
            color: #ffffff;
        }

        .btn-primary:hover {
            background-color: var(--accent-primary-hover);
        }

        .btn-secondary {
            background-color: var(--bg-surface-elevated);
            color: var(--text-primary);
            border-color: var(--border-subtle);
        }

        .btn-secondary:hover {
            background-color: var(--border-default);
        }

        .btn-sm {
            padding: 5px 9px;
            font-size: 12px;
        }

        .btn-ghost-danger {
            background: transparent;
            color: var(--status-danger);
            border-color: transparent;
        }

        .btn-ghost-danger:hover {
            background: var(--status-danger-bg);
            border-color: var(--status-danger-border);
        }

        .btn-ghost-subtle {
            background: transparent;
            color: var(--text-secondary);
            border-color: transparent;
        }

        .btn-ghost-subtle:hover {
            background: var(--bg-surface-elevated);
            color: var(--text-primary);
        }

        /* Table */
        .table-container {
            background-color: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            overflow: hidden;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-variant-numeric: tabular-nums;
        }

        thead {
            background-color: var(--bg-subtle);
            border-bottom: 1px solid var(--border-subtle);
        }

        th {
            padding: 12px 18px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-secondary);
        }

        tbody tr {
            border-bottom: 1px solid var(--border-subtle);
            transition: background-color 0.1s ease;
        }

        tbody tr:last-child {
            border-bottom: none;
        }

        tbody tr:hover {
            background-color: var(--bg-subtle);
        }

        td {
            padding: 14px 18px;
            font-size: 13px;
            vertical-align: middle;
        }

        /* Badges */
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
            font-weight: 500;
            padding: 3px 8px;
            border-radius: var(--radius-sm);
        }

        .badge-active {
            background-color: var(--status-active-bg);
            color: var(--status-active);
            border: 1px solid var(--status-active-border);
        }

        .badge-expired {
            background-color: var(--status-expired-bg);
            color: var(--status-expired);
            border: 1px solid var(--status-expired-border);
        }

        .device-id-cell {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .code-text {
            font-family: var(--font-mono);
            font-size: 12px;
            color: var(--text-primary);
        }

        .pkg-tag {
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--text-secondary);
            background: var(--bg-base);
            padding: 3px 7px;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border-subtle);
        }

        .copy-btn {
            background: transparent;
            border: none;
            color: var(--text-tertiary);
            cursor: pointer;
            padding: 3px;
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: color 0.15s ease;
        }

        .copy-btn:hover {
            color: var(--text-primary);
        }

        .action-group {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
        }

        .empty-state {
            padding: 56px 20px;
            text-align: center;
            color: var(--text-secondary);
        }

        .empty-state svg {
            margin-bottom: 12px;
            color: var(--text-tertiary);
        }

        /* Notification Toast */
        .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background-color: var(--bg-surface-elevated);
            color: var(--text-primary);
            border: 1px solid var(--border-default);
            padding: 10px 16px;
            border-radius: var(--radius-sm);
            font-size: 13px;
            display: none;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            z-index: 1000;
            animation: toast-in 0.2s ease;
        }

        @keyframes toast-in {
            from { transform: translateY(10px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    </style>
</head>
<body>
<div class="container">
    <header>
        <div class="header-title-group">
            <h1>Device Licenses</h1>
            <div class="pulse-indicator">
                <span class="pulse-dot"></span>
                <span>Live State</span>
            </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="fetchDevices()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            Refresh
        </button>
    </header>

    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-label">Registered Devices</div>
            <div class="metric-value" id="stat-total">0</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Active Licenses</div>
            <div class="metric-value active" id="stat-active">0</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Expired / Inactive</div>
            <div class="metric-value expired" id="stat-expired">0</div>
        </div>
    </div>

    <div class="toolbar">
        <div class="search-container">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" class="search-input" id="search-input" placeholder="Search by device UUID or package name..." oninput="filterTable()">
        </div>
        <div class="toolbar-actions">
            <input type="text" class="input-text" id="manual-id" placeholder="Device UUID">
            <select class="select-custom" id="manual-hours">
                <option value="24">24 Hours</option>
                <option value="48">48 Hours</option>
                <option value="168">7 Days</option>
                <option value="720">30 Days</option>
            </select>
            <button class="btn btn-primary" onclick="manualActivate()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                Grant License
            </button>
        </div>
    </div>

    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th style="width: 120px;">Status</th>
                    <th>Device Identifier</th>
                    <th>Package</th>
                    <th>Time Remaining</th>
                    <th>Expiration</th>
                    <th>Last Active</th>
                    <th style="text-align: right; width: 180px;">Actions</th>
                </tr>
            </thead>
            <tbody id="device-table">
                <tr><td colspan="7" class="empty-state">Loading registered records...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<div class="toast" id="toast"></div>

<script>
    let allDevices = [];

    async function fetchDevices() {
        try {
            const res = await fetch('/api/verify?action=list');
            const data = await res.json();

            if (!data || !data.stats) {
                const msg = data && data.message ? data.message : "Incompatible response";
                document.getElementById('device-table').innerHTML = 
                    '<tr><td colspan="7" class="empty-state">' +
                    '<div style="font-weight: 600; color: #f43f5e; margin-bottom: 6px;">api/verify.js on Vercel needs updating</div>' +
                    '<div style="font-size: 13px; color: var(--text-secondary);">Endpoint returned: <code>' + escapeHtml(msg) + '</code>. Ensure the updated <code>api/verify.js</code> is deployed.</div>' +
                    '</td></tr>';
                return;
            }

            allDevices = data.devices || [];

            document.getElementById('stat-total').innerText = data.stats.total;
            document.getElementById('stat-active').innerText = data.stats.active;
            document.getElementById('stat-expired').innerText = data.stats.expired;

            renderTable(allDevices);
        } catch (e) {
            showToast("Failed to query device state: " + e.message);
        }
    }

    function renderTable(devices) {
        const tbody = document.getElementById('device-table');
        if (devices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">' +
                '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>' +
                '<div>No devices registered yet. Devices appear automatically on first application launch.</div>' +
                '</td></tr>';
            return;
        }

        tbody.innerHTML = devices.map(d => \`
            <tr>
                <td>
                    <span class="badge \${d.isActive ? 'badge-active' : 'badge-expired'}">
                        \${d.isActive ? 'Active' : 'Expired'}
                    </span>
                </td>
                <td>
                    <div class="device-id-cell">
                        <span class="code-text">\${escapeHtml(d.device_id)}</span>
                        <button class="copy-btn" title="Copy Identifier" onclick="copyId('\${escapeHtml(d.device_id)}')">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        </button>
                    </div>
                </td>
                <td><span class="pkg-tag">\${escapeHtml(d.pkg)}</span></td>
                <td style="font-weight: 500;">\${d.timeRemaining}</td>
                <td style="color: var(--text-secondary); font-size: 12px;">\${d.expiresFormatted}</td>
                <td style="color: var(--text-secondary); font-size: 12px;">\${d.lastSeen}</td>
                <td>
                    <div class="action-group">
                        <button class="btn btn-secondary btn-sm" onclick="modifyDevice('\${escapeHtml(d.device_id)}', 24)">+24h</button>
                        \${d.isActive ? \`<button class="btn btn-ghost-danger btn-sm" onclick="revokeDevice('\${escapeHtml(d.device_id)}')">Revoke</button>\` : ''}
                        <button class="btn btn-ghost-subtle btn-sm" title="Delete record" onclick="deleteDevice('\${escapeHtml(d.device_id)}')">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        \`).join('');
    }

    async function modifyDevice(id, hours) {
        try {
            const res = await fetch(\`/api/verify?action=admin_activate&device_id=\${encodeURIComponent(id)}&hours=\${hours}\`);
            await res.json();
            showToast("Extended license by " + hours + " hours");
            fetchDevices();
        } catch (e) {
            showToast("Error updating device");
        }
    }

    async function revokeDevice(id) {
        if (!confirm("Revoke license for this device immediately?")) return;
        try {
            await fetch(\`/api/verify?action=revoke&device_id=\${encodeURIComponent(id)}\`);
            showToast("License revoked");
            fetchDevices();
        } catch (e) {
            showToast("Error revoking license");
        }
    }

    async function deleteDevice(id) {
        if (!confirm("Permanently remove this device record?")) return;
        try {
            await fetch(\`/api/verify?action=delete&device_id=\${encodeURIComponent(id)}\`);
            showToast("Record deleted");
            fetchDevices();
        } catch (e) {
            showToast("Error removing record");
        }
    }

    async function manualActivate() {
        const idInput = document.getElementById('manual-id');
        const hoursSelect = document.getElementById('manual-hours');
        const id = idInput.value.trim();
        const hours = hoursSelect.value;

        if (!id) {
            showToast("Please provide a device identifier");
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

    function copyId(id) {
        navigator.clipboard.writeText(id).then(() => {
            showToast("Copied device identifier to clipboard");
        });
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.innerText = msg;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 2200);
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    fetchDevices();
    setInterval(fetchDevices, 8000);
</script>
</body>
</html>`);
}
