#!/bin/bash

SERVICE_NAME="autoban"
USER_NAME="elaina"
DESCRIPTION="Auto-Ban Discord Bot"

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_SCRIPT="$BASE_DIR/run.sh"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "[INFO] Install service: $SERVICE_NAME"
echo "[INFO] Folder: $BASE_DIR"

if [ ! -f "$RUN_SCRIPT" ]; then
    echo "[ERROR] Script not found: run.sh"
    exit 1
fi

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=$DESCRIPTION
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$BASE_DIR
ExecStart=/bin/bash $RUN_SCRIPT
Restart=always
RestartSec=10
Environment=TERM=xterm-256color

[Install]
WantedBy=multi-user.target
EOF

echo "[INFO] Reload systemd"
sudo systemctl daemon-reexec
sudo systemctl daemon-reload

echo "[INFO] Enable + Start service"
sudo systemctl enable $SERVICE_NAME.service
sudo systemctl restart $SERVICE_NAME.service

echo "[DONE] $DESCRIPTION has been installed and started with the system"