#!/bin/bash
set -e

# Open Helpdesk Backend - Update Script
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Hyzokaaa/open-helpdesk-backend/main/update.sh -o update.sh
#   bash update.sh

INSTALL_DIR="${INSTALL_DIR:-/opt/open-helpdesk/backend}"
SERVICE_NAME="${SERVICE_NAME:-openhelpdesk-backend}"

echo ""
echo "=== Updating Open Helpdesk Backend ==="
echo ""

if [ ! -d "$INSTALL_DIR/.git" ]; then
  echo "[ERROR] Backend not found at $INSTALL_DIR"
  exit 1
fi

cd "$INSTALL_DIR"
git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true

echo "Pulling latest changes..."
sudo git pull

echo "Installing dependencies..."
sudo npm install --production=false 2>&1 | tail -1

echo "Building..."
sudo npm run build 2>&1 | tail -1

echo "Restarting service..."
sudo systemctl restart "$SERVICE_NAME"

echo ""
echo "[OK] Backend updated and restarted"
echo "  Logs: sudo journalctl -u $SERVICE_NAME -f"
echo ""
