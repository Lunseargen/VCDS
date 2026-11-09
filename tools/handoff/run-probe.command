#!/bin/bash
# Double-click this file to run the Ross-Tech cable probe on a Mac.
# It is read-only. It sends nothing to the cable or the car.

# Go to the folder that holds this file.
cd "$(dirname "$0")" || exit 1

echo "============================================================"
echo " Ross-Tech cable probe (read-only)"
echo "============================================================"
echo ""
echo "Before you start:"
echo "  1. Plug the cable into this Mac and into the car."
echo "  2. Turn the ignition on."
echo "  3. Close VCDS and any other diagnostic program."
echo ""
read -r -p "Press Return when you are ready..." _

# Step 1: check that Node.js is installed.
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js is not installed. This script needs it."
  echo "I will open the download page. Install the LTS version, then run this again."
  sleep 2
  open "https://nodejs.org/en/download/" 2>/dev/null
  echo ""
  read -r -p "Press Return to close..." _
  exit 1
fi
echo ""
echo "Node.js is installed: $(node --version)"

# Step 2: install the one helper library the first time (needs the internet once).
if [ ! -d node_modules/node-hid ]; then
  echo ""
  echo "Installing the helper library (needs the internet, about 1 minute)..."
  if ! npm install --no-audit --no-fund; then
    echo ""
    echo "The install failed. Check the internet connection and run this again."
    read -r -p "Press Return to close..." _
    exit 1
  fi
fi

# Step 3: run the read-only probe.
echo ""
echo "Running the probe..."
echo ""
node probe.mjs

echo ""
read -r -p "Press Return to close this window..." _
