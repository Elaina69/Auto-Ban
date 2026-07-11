#!/bin/bash
set -e

# Systemd usually does not load the same PATH/TERM values as an interactive login shell.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
export TERM="${TERM:-xterm-256color}"

SESSION_NAME="autoban"
CONTAINER_NAME="autoban-container"
CONTAINER_WORKDIR="/Auto-Ban"

# 1. Docker mode needs root so tmux does not prompt for sudo passwords.
if [ "$(id -u)" -ne 0 ]; then
    exec sudo -E "$0" "$@"
fi

# 2. Resolve the project directory from this script location.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 3. Ensure required commands are available.
if ! command -v docker >/dev/null 2>&1; then
    echo "[ERROR] docker was not found. Install Docker first."
    exit 1
fi

if ! command -v tmux >/dev/null 2>&1; then
    echo "[ERROR] tmux was not found. Install tmux first."
    exit 1
fi

# 4. Resolve and validate the BOT_INSTANCE list before starting anything.
source "$PROJECT_DIR/_instance-utils.sh"
resolve_bot_instances "$PROJECT_DIR" || exit 1
require_bot_config_files "$PROJECT_DIR" || exit 1
BOT_INSTANCES_FOR_TMUX="$(join_bot_instances ' ')"
DOCKER_EXEC_ENV_FLAGS="-e BOT_INSTANCES=\"$BOT_INSTANCES_FOR_TMUX\""

if [ -n "${AUTO_BAN_DATA_KEY:-}" ]; then
    DOCKER_EXEC_ENV_FLAGS="$DOCKER_EXEC_ENV_FLAGS -e AUTO_BAN_DATA_KEY"
fi

if [ -n "${AUTO_BAN_FSYNC_DIR:-}" ]; then
    DOCKER_EXEC_ENV_FLAGS="$DOCKER_EXEC_ENV_FLAGS -e AUTO_BAN_FSYNC_DIR"
fi

# 5. Create the Docker image if it does not exist.
bash "$PROJECT_DIR/_create-docker-image.sh"

# 6. Create the Docker container if it does not exist.
bash "$PROJECT_DIR/_create-docker-container.sh"

# 7. Start the Docker container before creating the tmux workflow.
echo "[DOCKER] Starting container '$CONTAINER_NAME'..."
docker start "$CONTAINER_NAME" >/dev/null

# 8. Check whether all PM2 apps already exist inside the container.
PM2_APPS_READY="true"
for INSTANCE in "${RESOLVED_BOT_INSTANCES[@]}"; do
    if ! docker exec "$CONTAINER_NAME" bash -lc "pm2 describe '${SESSION_NAME}-${INSTANCE}' >/dev/null 2>&1"; then
        PM2_APPS_READY="false"
        break
    fi
done

# 9. If root tmux is already running and PM2 apps exist, do not send duplicate commands.
if tmux has-session -t "$SESSION_NAME" 2>/dev/null && [ "$PM2_APPS_READY" = "true" ]; then
    echo "[TMUX] Session '$SESSION_NAME' is already running in the background."
    echo "[INFO] View the session with: sudo tmux attach -t $SESSION_NAME"
    exit 0
fi

# 10. If root tmux exists but PM2 apps were lost after a container restart, recreate the workflow.
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "[TMUX] Removing old session '$SESSION_NAME' so the Docker workflow can be recreated..."
    tmux kill-session -t "$SESSION_NAME"
fi

# 11. Create the root tmux session if it does not exist.
bash "$PROJECT_DIR/_create-tmux-session.sh"

# 12. Send commands to tmux to enter the container, create PM2 apps, and open pm2 monit.
tmux send-keys -t "$SESSION_NAME" "docker exec -it $DOCKER_EXEC_ENV_FLAGS \"$CONTAINER_NAME\" bash" C-m
tmux send-keys -t "$SESSION_NAME" "cd \"$CONTAINER_WORKDIR\"" C-m
tmux send-keys -t "$SESSION_NAME" "bash ./_create-pm2-session.sh" C-m
tmux send-keys -t "$SESSION_NAME" "pm2 monit" C-m

echo "[DONE] Auto-Ban has been started in Docker/tmux session '$SESSION_NAME'."
echo "[INFO] View the session with: sudo tmux attach -t $SESSION_NAME"
