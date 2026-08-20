#!/bin/bash
set -e

# Open Helpdesk Backend - Installation Script
# Requirements: Node.js 22+, PostgreSQL 15+.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Hyzokaaa/open-helpdesk-backend/main/install.sh -o install.sh
#   bash install.sh
#
# Custom install:
#   INSTALL_DIR=/opt/oh-test/backend BACKEND_PORT=3001 SERVICE_NAME=oh-test-backend DB_NAME=oh_test bash install.sh

# Detect if running via pipe (curl | bash) — read won't work
if [ ! -t 0 ]; then
  echo "[ERROR] This script requires interactive input."
  echo ""
  echo "  Download first, then run:"
  echo "    curl -fsSL https://raw.githubusercontent.com/Hyzokaaa/open-helpdesk-backend/main/install.sh -o install.sh"
  echo "    bash install.sh"
  echo ""
  exit 1
fi

INSTALL_DIR="${INSTALL_DIR:-/opt/open-helpdesk/backend}"
SERVICE_NAME="${SERVICE_NAME:-openhelpdesk-backend}"
SERVICE_USER="${SERVICE_USER:-openhelpdesk}"
BACKEND_PORT="${BACKEND_PORT:-3000}"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Open Helpdesk Backend Installer    ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  Install dir:   $INSTALL_DIR"
echo "  Port:          $BACKEND_PORT"
echo "  Service name:  $SERVICE_NAME"
echo ""

# ══════════════════════════════════════════════
# Step 1/4 — Prerequisites
# ══════════════════════════════════════════════

echo "── Step 1/4: Checking prerequisites ──"
echo ""

# Node.js
if ! command -v node &> /dev/null; then
  read -p "[MISSING] Node.js is not installed. Install it now? (Y/n): " INSTALL_NODE
  if [ "${INSTALL_NODE,,}" != "n" ]; then
    echo "Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    echo "[ERROR] Node.js is required. Aborting."
    exit 1
  fi
else
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 22 ]; then
    echo "[ERROR] Node.js 22+ required. Found: $(node -v)"
    exit 1
  fi
fi
echo "[OK] Node.js $(node -v)"

# PostgreSQL
if ! command -v psql &> /dev/null; then
  read -p "[MISSING] PostgreSQL is not installed. Install it now? (Y/n): " INSTALL_PG
  if [ "${INSTALL_PG,,}" != "n" ]; then
    echo "Installing PostgreSQL..."
    sudo apt-get install -y postgresql
  else
    echo "[ERROR] PostgreSQL is required. Aborting."
    exit 1
  fi
fi
echo "[OK] PostgreSQL found"

echo ""

# ══════════════════════════════════════════════
# Step 2/4 — Configuration
# ══════════════════════════════════════════════

echo "── Step 2/4: Configuration ──"
echo ""

if [ -f "$INSTALL_DIR/.env" ]; then
  echo "[OK] Using existing .env — skipping configuration"
  SKIP_CONFIG=true
else
  SKIP_CONFIG=false

  read -p "Server hostname (e.g. helpdesk.yourcompany.com): " SERVER_NAME
  SERVER_NAME=${SERVER_NAME:-localhost}

  echo ""
  echo "  Database"
  echo ""

  read -p "  Host [localhost]: " DB_HOST
  DB_HOST=${DB_HOST:-localhost}

  read -p "  Port [5432]: " DB_PORT
  DB_PORT=${DB_PORT:-5432}

  read -p "  Name [${DB_NAME:-open_helpdesk}]: " DB_NAME_INPUT
  DB_NAME=${DB_NAME_INPUT:-${DB_NAME:-open_helpdesk}}

  read -p "  User [postgres]: " DB_USER
  DB_USER=${DB_USER:-postgres}

  DB_PASSWORD_DEFAULT=$(openssl rand -hex 16)
  read -sp "  Password [$DB_PASSWORD_DEFAULT]: " DB_PASSWORD_INPUT
  echo ""
  DB_PASSWORD=${DB_PASSWORD_INPUT:-$DB_PASSWORD_DEFAULT}

  echo ""
  echo "  Application"
  echo ""

  if [ "$SERVER_NAME" = "localhost" ]; then
    FRONTEND_URL="http://localhost"
  else
    FRONTEND_URL="https://$SERVER_NAME"
  fi
  read -p "  Frontend URL [$FRONTEND_URL]: " FRONTEND_URL_INPUT
  FRONTEND_URL=${FRONTEND_URL_INPUT:-$FRONTEND_URL}

  read -p "  Admin email [admin@${SERVER_NAME}]: " ADMIN_EMAIL
  ADMIN_EMAIL=${ADMIN_EMAIL:-admin@${SERVER_NAME}}

  read -sp "  Admin password [admin1234]: " ADMIN_PASSWORD
  ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin1234}
  echo ""

  JWT_SECRET=$(openssl rand -hex 32)
fi

echo ""

# ══════════════════════════════════════════════
# Step 3/4 — Database setup
# ══════════════════════════════════════════════

echo "── Step 3/4: Database setup ──"
echo ""

# Ensure PostgreSQL is running
sudo systemctl start postgresql 2>/dev/null || true

if [ "$SKIP_CONFIG" = false ]; then
  # Create database if it doesn't exist
  if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "[OK] Database '$DB_NAME' already exists"
  else
    read -p "Database '$DB_NAME' does not exist. Create it? (Y/n): " CREATE_DB
    if [ "${CREATE_DB,,}" != "n" ]; then
      sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null
      echo "[OK] Database '$DB_NAME' created"
    else
      echo "[WARN] Skipped. Make sure the database exists before starting."
    fi
  fi

  # Configure user password
  if [ -n "$DB_PASSWORD" ]; then
    read -p "Set password for database user '$DB_USER'? (Y/n): " SET_DB_PASS
    if [ "${SET_DB_PASS,,}" != "n" ]; then
      sudo -u postgres psql -c "ALTER USER $DB_USER PASSWORD '$DB_PASSWORD';" 2>/dev/null
      echo "[OK] Password set for '$DB_USER'"

      PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" 2>/dev/null | tr -d ' ')
      if [ -n "$PG_HBA" ] && grep -q "127.0.0.1/32.*peer" "$PG_HBA" 2>/dev/null; then
        sudo sed -i 's/127.0.0.1\/32.*peer/127.0.0.1\/32            scram-sha-256/' "$PG_HBA"
        sudo systemctl reload postgresql
      fi
    fi
  fi
else
  echo "[OK] Skipping — using existing configuration"
fi

echo ""

# ══════════════════════════════════════════════
# Step 4/4 — Backend
# ══════════════════════════════════════════════

echo "── Step 4/4: Installing backend ──"
echo ""

# Create system user if needed
if ! id "$SERVICE_USER" &> /dev/null; then
  sudo useradd --system --no-create-home --shell /bin/false "$SERVICE_USER" 2>/dev/null || true
fi

# Clone or pull
sudo mkdir -p "$INSTALL_DIR"

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
if [ "$SKIP_CONFIG" = false ]; then
  sudo tee "$INSTALL_DIR/.env" > /dev/null << EOF
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
  echo "[OK] Backend config saved"
fi

# Set ownership
sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# Create systemd service
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

echo "[OK] Backend service started"

# Wait for backend to be ready
echo "Waiting for backend..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:$BACKEND_PORT/health 2>/dev/null; then
    echo "[OK] Backend is ready"
    break
  fi
  sleep 1
done

# ══════════════════════════════════════════════
# Done
# ══════════════════════════════════════════════

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║           Backend Installed!                         ║"
echo "  ╠══════════════════════════════════════════════════════╣"
echo "  ║                                                      ║"
echo "  ║  Config:   $INSTALL_DIR/.env"
echo "  ║  Storage:  $INSTALL_DIR/data/storage"
echo "  ║                                                      ║"
echo "  ║  Commands:                                           ║"
echo "  ║    sudo systemctl status $SERVICE_NAME"
echo "  ║    sudo journalctl -u $SERVICE_NAME -f"
echo "  ║                                                      ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""
