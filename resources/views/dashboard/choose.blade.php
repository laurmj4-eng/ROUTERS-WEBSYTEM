<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Piso WiFi Tools</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .wrap { width: 100%; max-width: 640px; }
        .brand { text-align: center; margin-bottom: 36px; }
        .brand .icon {
            width: 72px; height: 72px; margin: 0 auto 16px;
            background: linear-gradient(135deg, #2563eb, #4f46e5);
            border-radius: 20px; display: flex; align-items: center;
            justify-content: center; font-size: 34px;
            box-shadow: 0 12px 40px rgba(37, 99, 235, 0.35);
        }
        .brand h1 { font-size: 24px; font-weight: 700; color: #f8fafc; }
        .brand p { font-size: 13px; color: #64748b; margin-top: 6px; }
        .card {
            display: flex; align-items: center; gap: 18px;
            background: #1e293b; border: 1px solid #334155;
            border-radius: 16px; padding: 22px 24px; margin-bottom: 16px;
            text-decoration: none; color: #e2e8f0;
            transition: all 0.2s; cursor: pointer;
        }
        .card:hover { transform: translateY(-2px); border-color: #2563eb; box-shadow: 0 10px 30px rgba(37, 99, 235, 0.15); }
        .card:active { transform: translateY(0); }
        .card .tile {
            width: 56px; height: 56px; border-radius: 14px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center; font-size: 26px;
        }
        .tile-lpb { background: #064e3b; }
        .tile-pldt { background: #1e1b4b; }
        .tile-adu { background: #312e81; }
        .card .info { flex: 1; }
        .card .info h2 { font-size: 16px; font-weight: 600; color: #f8fafc; }
        .card .info p { font-size: 12px; color: #94a3b8; margin-top: 4px; line-height: 1.5; }
        .card .arrow { font-size: 20px; color: #475569; }
        .footer { text-align: center; margin-top: 28px; font-size: 12px; color: #475569; }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="brand">
            <div class="icon">&#128241;</div>
            <h1>Piso WiFi Tools</h1>
            <p>Choose what you want to attack</p>
        </div>

        <a class="card" href="{{ route('tools.lpb') }}">
            <div class="tile tile-lpb">&#128176;</div>
            <div class="info">
                <h2>LPB Piso WiFi Tools</h2>
                <p>Admin password scan, time-to-voucher convert, session state (10.0.0.1)</p>
            </div>
            <div class="arrow">&#8250;</div>
        </a>

        <a class="card" href="{{ route('tools.pldt') }}">
            <div class="tile tile-pldt">&#128225;</div>
            <div class="info">
                <h2>PLDT WiFi Tools</h2>
                <p>WiFi password scanner via router admin login (192.168.1.1)</p>
            </div>
            <div class="arrow">&#8250;</div>
        </a>

        <a class="card" href="{{ route('tools.adu') }}">
            <div class="tile tile-adu">&#9202;</div>
            <div class="info">
                <h2>ADU Piso WiFi Tools</h2>
                <p>Add time, convert vouchers, admin credentials, status (10.0.0.1)</p>
            </div>
            <div class="arrow">&#8250;</div>
        </a>

        <div class="footer">Works while connected to the target WiFi (or a relay tunnel)</div>
    </div>
</body>
</html>