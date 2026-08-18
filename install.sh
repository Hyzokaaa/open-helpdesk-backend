#!/bin/bash
set -e

# Open Helpdesk Backend - Installation Script
# Requirements: Node.js 22+, PostgreSQL 15+.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Hyzokaaa/open-helpdesk-backend/main/install.sh | bash
#
# Custom install:
#   INSTALL_DIR=/opt/oh-test BACKEND_PORT=3001 SERVICE_NAME=oh-test-backend DB_NAME=oh_test bash install.sh

INSTALL_DIR="${INSTALL_DIR:-/opt/open-helpdesk/backend}"
SERVICE_NAME="${SERVICE_NAME:-openhelpdesk-backend}"
SERVICE_USER="${SERVICE_USER:-openhelpdesk}"
BACKEND_PORT="${BACKEND_PORT:-3000}"

echo ""
echo "=== Open Helpdesk Backend Installer ==="
echo ""
echo "  Install dir:   $INSTALL_DIR"
echo "  Port:          $BACKEND_PORT"
echo "  Service name:  $SERVICE_NAME"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "[ERROR] Node.js is not installed. Install Node.js 22+ first."
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  echo "[ERROR] Node.js 22+ required. Found: $(node -v)"
  exit 1
fi
echo "[OK] Node.js $(node -v)"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
  echo "[WARNING] PostgreSQL client not found. Make sure PostgreSQL is running and accessible."
else
  echo "[OK] PostgreSQL client found"
fi

# Create system user if needed
if ! id "$SERVICE_USER" &> /dev/null; then
  echo "Creating system user: $SERVICE_USER"
  sudo useradd --system --no-create-home --shell /bin/false "$SERVICE_USER" 2>/dev/null || true
fi

# Create install directory
echo "Installing to $INSTALL_DIR"
sudo mkdir -p "$INSTALL_DIR"

# Clone or pull
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing installation..."
  git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
  cd "$INSTALL_DIR"
  sudo git pull
else
  echo "Cloning repository..."
  sudo git clone https://github.com/Hyzokaaa/open-helpdesk-backend.git "$INSTALL_DIR"
  git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
fi

cd "$INSTALL_DIR"

# Install dependencies and build
echo "Installing dependencies..."
sudo npm install --production=false 2>&1 | tail -1
echo "Building..."
sudo npm run build 2>&1 | tail -1

# Create data directory for filesystem storage
sudo mkdir -p "$INSTALL_DIR/data/storage"

# Generate .env if it doesn't exist
if [ ! -f "$INSTALL_DIR/.env" ]; then
  echo ""
  echo "=== Configuration ==="
  echo ""

  JWT_SECRET=$(openssl rand -hex 32)

  read -p "Database host [localhost]: " DB_HOST
  DB_HOST=${DB_HOST:-localhost}

  read -p "Database port [5432]: " DB_PORT
  DB_PORT=${DB_PORT:-5432}

  read -p "Database name [${DB_NAME:-open_helpdesk}]: " DB_NAME_INPUT
  DB_NAME=${DB_NAME_INPUT:-${DB_NAME:-open_helpdesk}}

  read -p "Database user [postgres]: " DB_USER
  DB_USER=${DB_USER:-postgres}

  read -sp "Database password: " DB_PASSWORD
  echo ""

  read -p "Frontend URL (e.g. https://helpdesk.yourcompany.com): " FRONTEND_URL
  FRONTEND_URL=${FRONTEND_URL:-http://localhost}

  read -p "Admin email [admin@admin.com]: " ADMIN_EMAIL
  ADMIN_EMAIL=${ADMIN_EMAIL:-admin@admin.com}

  read -sp "Admin password [admin1234]: " ADMIN_PASSWORD
  ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin1234}
  echo ""

  cat > "$INSTALL_DIR/.env" << EOF
PORT=$BACKEND_PORT
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_RUN_MIGRATIONS=true
JWT_SECRET=$JWT_SECRET
JWT_EXPIRATION=1d
FRONTEND_URL=$FRONTEND_URL
STORAGE_PROVIDER=filesystem
STORAGE_PATH=$INSTALL_DIR/data/storage
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

  echo "[OK] Configuration saved to $INSTALL_DIR/.env"
else
  echo "[OK] Using existing .env"
fi

# Set ownership
sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# Create systemd service
echo "Creating systemd service..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null << EOF
[Unit]
Description=Open Helpdesk Backend ($SERVICE_NAME)
After=postgresql.service network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$(which node) $INSTALL_DIR/dist/main
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME" 2>/dev/null
sudo systemctl restart "$SERVICE_NAME"

echo ""
echo "=== Backend installed ==="
echo "  Status:  sudo systemctl status $SERVICE_NAME"
echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
echo "  Config:  $INSTALL_DIR/.env"
echo "  Storage: $INSTALL_DIR/data/storage"
echo ""
