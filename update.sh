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
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Open Helpdesk Backend Updater      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

if [ ! -d "$INSTALL_DIR/.git" ]; then
  echo "[ERROR] Backend not found at $INSTALL_DIR"
  exit 1
fi

cd "$INSTALL_DIR"
git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true

# ── Version check ──

CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null)
CURRENT_VERSION=$(node -e "try{const c=require('./src/changelog/changelog.data');console.log(c.coreChangelog[0].version)}catch{console.log('unknown')}" 2>/dev/null || echo "unknown")

sudo git fetch origin &>/dev/null
LATEST_COMMIT=$(git rev-parse --short origin/main 2>/dev/null)
LATEST_VERSION=$(git show origin/main:src/changelog/changelog.data.ts 2>/dev/null | node -e "
  let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
    const m=d.match(/version:\s*'([^']+)'/);console.log(m?m[1]:'unknown')
  })" 2>/dev/null || echo "unknown")

echo "  Current:   v$CURRENT_VERSION ($CURRENT_COMMIT)"
echo "  Available: v$LATEST_VERSION ($LATEST_COMMIT)"
echo ""

if [ "$CURRENT_COMMIT" = "$LATEST_COMMIT" ]; then
  echo "  Already up to date!"
  echo ""
  exit 0
fi

CHANGES=$(git log --oneline "$CURRENT_COMMIT..origin/main" 2>/dev/null)
if [ -n "$CHANGES" ]; then
  CHANGE_COUNT=$(echo "$CHANGES" | wc -l)
  echo "  $CHANGE_COUNT new commit(s):"
  echo "$CHANGES" | head -10 | sed 's/^/    /'
  if [ "$CHANGE_COUNT" -gt 10 ]; then
    echo "    ... and $((CHANGE_COUNT - 10)) more"
  fi
  echo ""
fi

read -p "  Update to v$LATEST_VERSION? (Y/n): " CONFIRM
if [ "${CONFIRM,,}" = "n" ]; then
  echo "  Update cancelled."
  exit 0
fi

# ── Update ──

echo ""
echo "Pulling latest changes..."
sudo git pull

echo "Installing dependencies..."
sudo npm install --production=false 2>&1 | tail -1

echo "Building..."
sudo npm run build 2>&1 | tail -1

echo "Restarting service..."
sudo systemctl restart "$SERVICE_NAME"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║        Backend Updated!              ║"
echo "  ║  Version: v$LATEST_VERSION"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  Logs: sudo journalctl -u $SERVICE_NAME -f"
echo ""
