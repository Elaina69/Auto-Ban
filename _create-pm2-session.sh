#!/bin/bash
set -e

SESSION_NAME="autoban"

# 1. Resolve the project directory from this script location and run from there.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 2. Ensure this script is running from the project directory.
if [ ! -f "index.js" ] || [ ! -f "package.json" ]; then
    echo "[ERROR] Run this script from the project directory."
    exit 1
fi

# 3. Ensure required commands are available.
if ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] npm was not found."
    exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
    echo "[ERROR] pm2 was not found."
    exit 1
fi

# 4. Resolve and validate the BOT_INSTANCE list.
source "$PROJECT_DIR/_instance-utils.sh"
resolve_bot_instances "$PROJECT_DIR" || exit 1
require_bot_config_files "$PROJECT_DIR" || exit 1

BACKUP_OWNER="${RESOLVED_BOT_INSTANCES[0]}"

echo "[PM2] Resolved BOT_INSTANCE list: $(join_bot_instances ',')"
echo "[PM2] AUTO_BAN_BACKUP_OWNER will be '$BACKUP_OWNER'."

# 5. Install dependencies if node_modules is not ready.
if [ ! -d "node_modules/discord.js" ]; then
    echo "[NPM] Installing dependencies with npm ci..."
    npm ci
fi

# 6. Create a PM2 app for each bot instance.
for INSTANCE in "${RESOLVED_BOT_INSTANCES[@]}"; do
    APP_NAME="${SESSION_NAME}-${INSTANCE}"

    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
        echo "[PM2] App '$APP_NAME' already exists."
        continue
    fi

    echo "[PM2] Creating app '$APP_NAME' with BOT_INSTANCE=$INSTANCE..."
    AUTO_BAN_BACKUP_OWNER="$BACKUP_OWNER" BOT_INSTANCE="$INSTANCE" pm2 start index.js --name "$APP_NAME" --update-env
done

echo "[PM2] Auto-Ban PM2 apps are ready."
