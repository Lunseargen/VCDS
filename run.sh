#!/usr/bin/env bash
# Start the VCDS Shuffleboard dashboard. It starts the local server and opens the browser.
# Works on macOS and Linux. Press Control-C to stop.
#
# Usage:  ./run.sh
set -euo pipefail

# Go to the folder that holds this file.
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

URL="http://localhost:5175"

echo "============================================================"
echo " VCDS Shuffleboard dashboard"
echo "============================================================"

# Step 1: check that Node.js is installed.
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org/ and run this again."
  exit 1
fi
echo "Node.js is installed: $(node --version)"

# Step 2: install the app libraries the first time (needs the internet once).
if [ ! -d node_modules ]; then
  echo "Installing the app libraries (needs the internet, a few minutes)..."
  npm install --no-audit --no-fund
fi

# Step 3: pick the command that opens a browser on this platform.
opener=""
if command -v open >/dev/null 2>&1; then
  opener="open"            # macOS
elif command -v xdg-open >/dev/null 2>&1; then
  opener="xdg-open"        # Linux
fi

# Step 4: open the browser once the server is up (skip if no opener, e.g. a headless host).
if [ -n "$opener" ]; then
  ( sleep 4; "$opener" "$URL" >/dev/null 2>&1 || true ) &
fi

# Step 5: start the server. It keeps running until you stop it with Control-C.
echo ""
echo "Starting the dashboard at $URL ..."
echo "Open that address in a browser if it does not open on its own. Press Control-C to stop."
echo ""
npm run dev:ui
