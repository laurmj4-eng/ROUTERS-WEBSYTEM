#!/data/data/com.termux/files/usr/bin/bash
# Start the phone-agent (server.cjs) + a tunnel, and AUTO-SAVE the tunnel URL
# to the live site (/api/relay/pldt/tunnel-url) — no pasting needed.
# Tries cloudflared (trycloudflare.com) first; if the network blocks it,
# falls back to localhost.run. Whichever URL appears is saved automatically.

cd "$(dirname "$0")" || exit 1

if [ ! -f config.json ]; then
  echo "ERROR: config.json not found. Copy config.example.json to config.json and edit it (set relay_token!)."
  exit 1
fi

TOKEN=$(node -e "try{console.log(require('./config.json').relay_token||'')}catch(e){console.log('')}")
LIVE=$(node -e "try{console.log(require('./config.json').live_site||'')}catch(e){console.log('')}")
[ -z "$LIVE" ] && LIVE="https://piso-wifi-tools.onrender.com"

if [ -z "$TOKEN" ]; then
  echo "ERROR: relay_token is empty in config.json"
  exit 1
fi

termux-wake-lock 2>/dev/null || true

echo "Starting relay (port 8787)..."
node server.cjs &
SERVER_PID=$!
TUN_PID=""
trap 'kill $SERVER_PID $TUN_PID 2>/dev/null' EXIT

sleep 2
if ! curl -s --max-time 3 http://127.0.0.1:8787/health | grep -q '"ok":true'; then
  echo "ERROR: relay did not start (check config.json / node)."
  exit 1
fi
echo "Relay healthy on 8787."

URL=""
LOG=$(mktemp)

# 1) Try cloudflared quick tunnel
cloudflared tunnel --url http://localhost:8787 >"$LOG" 2>&1 &
TUN_PID=$!
echo "Waiting for cloudflared URL (up to 40s)..."
for i in $(seq 1 40); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | tail -1)
  [ -n "$URL" ] && break
  if ! kill -0 $TUN_PID 2>/dev/null; then
    echo "cloudflared exited (this network may block Cloudflare)."
    break
  fi
  sleep 1
done

if [ -z "$URL" ]; then
  # 2) Fallback: localhost.run via SSH
  kill $TUN_PID 2>/dev/null; wait $TUN_PID 2>/dev/null
  echo "Falling back to localhost.run tunnel..."
  ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -N -R 80:localhost:8787 nokey@localhost.run >"$LOG" 2>&1 &
  TUN_PID=$!
  for i in $(seq 1 30); do
    URL=$(grep -oE 'https://[a-z0-9-]+\.lhr\.life' "$LOG" | tail -1)
    [ -n "$URL" ] && break
    if ! kill -0 $TUN_PID 2>/dev/null; then break; fi
    sleep 1
  done
fi

if [ -z "$URL" ]; then
  echo "ERROR: no tunnel URL. Cloudflare blocked AND fallback failed."
  echo "Tunnel log tail:"; tail -5 "$LOG"
  echo "The relay is still running locally — fix the network and restart this script."
  wait $TUN_PID 2>/dev/null
  exit 1
fi

echo "=================================================="
echo " Tunnel URL: $URL"
echo " Saving to live site ($LIVE)..."
SAVE=$(curl -s -X POST -H "X-Relay-Token: $TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "url=$URL" "$LIVE/api/relay/pldt/tunnel-url")
echo " Save response: $SAVE"
echo "=================================================="
echo " Relay is live — scans from the live site now reach this phone."
echo " Keep Termux open (wake lock active). Ctrl+C stops."
echo "=================================================="

wait $TUN_PID 2>/dev/null