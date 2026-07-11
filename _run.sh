#!/bin/bash
set -e

SESSION_NAME="autoban"

# 1. Resolve the project directory from this script location.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 2. Load common shell profile values so tmux can find PM2/Node on typical servers.
source ~/.bashrc 2>/dev/null || true

# 3. Ensure required commands are available before creating tmux.
if ! command -v tmux >/dev/null 2>&1; then
    echo "[ERROR] tmux was not found. Install tmux first."
    exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
    echo "[ERROR] pm2 was not found."
    exit 1
fi

# 4. Resolve and validate the BOT_INSTANCE list before starting anything.
source "$PROJECT_DIR/_instance-utils.sh"
resolve_bot_instances "$PROJECT_DIR" || exit 1
require_bot_config_files "$PROJECT_DIR" || exit 1

# 5. If the tmux session and all PM2 apps already exist, do not send duplicate commands.
PM2_APPS_READY="true"
for INSTANCE in "${RESOLVED_BOT_INSTANCES[@]}"; do
    if ! pm2 describe "${SESSION_NAME}-${INSTANCE}" >/dev/null 2>&1; then
        PM2_APPS_READY="false"
        break
    fi
done

if tmux has-session -t "$SESSION_NAME" 2>/dev/null && [ "$PM2_APPS_READY" = "true" ]; then
    echo "[TMUX] Session '$SESSION_NAME' is already running in the background."
    echo "[INFO] View the session with: tmux attach -t $SESSION_NAME"
    exit 0
fi

# 6. If tmux exists but PM2 apps are missing, recreate the workflow.
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "[TMUX] Removing old session '$SESSION_NAME' so the host workflow can be recreated..."
    tmux kill-session -t "$SESSION_NAME"
fi

# 7. Create the tmux session if it does not exist.
bash "$PROJECT_DIR/_create-tmux-session.sh"

# 8. Send commands to tmux to run the bot directly on the server.
tmux send-keys -t "$SESSION_NAME" "cd \"$PROJECT_DIR\"" C-m
tmux send-keys -t "$SESSION_NAME" "source ~/.bashrc 2>/dev/null || true" C-m
tmux send-keys -t "$SESSION_NAME" "bash ./_create-pm2-session.sh" C-m
tmux send-keys -t "$SESSION_NAME" "pm2 monit" C-m

echo "[DONE] Auto-Ban has been started on the server in tmux session '$SESSION_NAME'."
echo "[INFO] View the session with: tmux attach -t $SESSION_NAME"
