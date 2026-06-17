#!/bin/bash
# Shofar Hub — GPU Monitor (macOS)
# Double-click this file in Finder to run.
# If macOS blocks it: right-click → Open → Open anyway

cd "$(dirname "$0")"
clear

echo ""
echo " ==================================="
echo "  SHOFAR HUB  —  GPU Monitor"
echo " ==================================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo " Node.js is not installed."
    echo ""
    echo " Please follow these steps:"
    echo "   1. Press Enter to open the Node.js download page"
    echo "   2. Download and install the 'LTS' version"
    echo "   3. Restart your Mac"
    echo "   4. Double-click this file again"
    echo ""
    read -p " Press Enter to open Node.js download page..."
    open "https://nodejs.org"
    exit 0
fi

# First-time setup
if [ ! -d "node_modules/systeminformation" ]; then
    echo " First-time setup: installing dependencies..."
    echo " This only happens once. Please wait."
    echo ""
    npm install --save systeminformation 2>/dev/null
    echo ""
    echo " Done!"
    echo ""
fi

echo " Starting... (you may be asked for your Mac password)"
echo ""
sudo node gpu-monitor.js

echo ""
echo " GPU Monitor stopped. Press Enter to close."
read
