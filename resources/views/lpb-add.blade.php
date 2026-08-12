<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Add Time</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0b1220;
            color: #e2e8f0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 16px;
            padding: 32px 28px;
            width: 100%;
            max-width: 420px;
        }
        h1 { font-size: 22px; color: #f1f5f9; margin-bottom: 8px; }
        p.sub { color: #94a3b8; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }
        label { display: block; font-size: 13px; color: #cbd5e1; margin-bottom: 8px; }
        .row { display: flex; gap: 10px; margin-bottom: 8px; }
        input[type="number"] {
            flex: 1;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 10px;
            color: #f1f5f9;
            font-size: 22px;
            font-weight: 700;
            padding: 14px 16px;
            text-align: center;
            width: 100%;
        }
        input[type="number"]:focus { outline: 2px solid #38bdf8; border-color: transparent; }
        button {
            width: 100%;
            background: #38bdf8;
            color: #0b1220;
            border: none;
            border-radius: 10px;
            font-size: 17px;
            font-weight: 700;
            padding: 15px;
            cursor: pointer;
            margin-top: 4px;
        }
        button:disabled { opacity: .6; cursor: not-allowed; }
        .hint { font-size: 12px; color: #64748b; margin-top: 14px; line-height: 1.5; }
        .status {
            margin-top: 16px;
            padding: 12px 14px;
            border-radius: 10px;
            font-size: 14px;
            line-height: 1.5;
            display: none;
        }
        .status.ok { display: block; background: #052e16; color: #4ade80; border: 1px solid #166534; }
        .status.warn { display: block; background: #451a03; color: #fbbf24; border: 1px solid #92400e; }
        .status.error { display: block; background: #450a0a; color: #f87171; border: 1px solid #7f1d1d; }
        .invisible-form { display: none; }
    </style>
</head>
<body>
    <div class="card">
        <h1>&#9203; Add Time to This Device</h1>
        <p class="sub">Only works while your phone is connected to the shop WiFi network (it sends the request straight to the portal at 10.0.0.1).</p>

        <label for="days">How many days of time do you want?</label>
        <div class="row">
            <input type="number" id="days" min="1" max="500" value="1" inputmode="numeric">
        </div>
        <button id="go" onclick="addTime()">Add Time</button>

        <div class="status" id="status"></div>

        <div class="hint">
            When you press the button, a small window opens on the portal (10.0.0.1).
            If it shows <b>1</b> — the time was added to this phone. Close the window and refresh this page if you want to add more.
        </div>

        <form class="invisible-form" id="injectForm" method="POST" target="_blank"
              action="http://10.0.0.1/admin/index?sconvert=1">
            <input type="hidden" name="amountminutes">
        </form>

        <noscript>
            <p class="status warn" style="display:block">This page needs JavaScript enabled to add time.</p>
        </noscript>
    </div>

    <script>
        function setStatus(type, html) {
            const el = document.getElementById('status');
            el.className = 'status ' + type;
            el.innerHTML = html;
        }

        function addTime() {
            const btn = document.getElementById('go');
            const days = parseInt(document.getElementById('days').value, 10);

            if (!days || days < 1 || days > 500) {
                setStatus('error', 'Enter a number between 1 and 500 days.');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Adding...';
            setStatus('warn', 'Opening the portal to credit this phone...');

            const minutes = -days * 1440;
            const form = document.getElementById('injectForm');
            form.querySelector('input[name="amountminutes"]').value = minutes;

            try {
                form.submit();
                setStatus('warn',
                    'A new tab opened on the portal. If it shows <b>1</b>, ' + days +
                    ' day(s) were added to this phone. You can close that tab.');
            } catch (err) {
                setStatus('error', 'Could not reach the portal. Are you connected to the shop WiFi?');
            }

            btn.disabled = false;
            btn.textContent = 'Add Time';
        }
    </script>
</body>
</html>