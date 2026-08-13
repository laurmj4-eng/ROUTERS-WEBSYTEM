#!/data/data/com.termux/files/usr/bin/bash
# Start the phone-agent (server.js) + cloudflared tunnel.
# The trycloudflare URL printed by cloudflared is the tunnel URL to paste
# into the live site's Relay card (with /3rdlaravel/public NOT needed here —
# the phone-agent serves its own root).

cd "$(dirname "$0")" || exit 1

if [ ! -f config.json ]; then
  echo "ERROR: config.json not found. Copy config.example.json to config.json and edit it (set relay_token!)."
  exit 1
fi

termux-wake-lock 2>/dev/null || true

node server.cjs &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

sleep 1

echo "=================================================="
echo " phone-agent running on port 8787"
echo " waiting for tunnel URL from cloudflared..."
echo "=================================================="

cloudflared tunnel --url http://localhost:8787

kill $SERVER_PID 2>/dev/null

