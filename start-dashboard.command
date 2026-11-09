#!/bin/bash
# Double-click this file to start the VCDS Shuffleboard dashboard on a Mac.
# It runs run.sh, which starts the local server and opens the browser.
# Close this Terminal window (or press Control-C) to stop the dashboard.

cd "$(dirname "$0")" || exit 1
bash ./run.sh

echo ""
read -r -p "The dashboard stopped. Press Return to close this window..." _
