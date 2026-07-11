#!/bin/bash
set -e

IMAGE_NAME="autoban"
CONTAINER_NAME="autoban-container"
CONTAINER_WORKDIR="/Auto-Ban"
NODE_MODULES_VOLUME="${CONTAINER_NAME}-node_modules"
IDLE_COMMAND_JSON='["tail","-f","/dev/null"]'

# 1. Resolve the project directory from this script location.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 2. Ensure the Docker image exists.
if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
    echo "[ERROR] Docker image '$IMAGE_NAME' does not exist. Run _create-docker-image.sh first."
    exit 1
fi

# 3. Recreate old containers that use a different command.
EXISTING_COMMAND="$(docker inspect -f '{{json .Config.Cmd}}' "$CONTAINER_NAME" 2>/dev/null || true)"
if [ -n "$EXISTING_COMMAND" ] && [ "$EXISTING_COMMAND" != "$IDLE_COMMAND_JSON" ]; then
    echo "[DOCKER] Container '$CONTAINER_NAME' is using an old command: $EXISTING_COMMAND"
    echo "[DOCKER] Removing the old container so it can be recreated..."
    docker rm -f "$CONTAINER_NAME"
fi

# 4. Recreate the container if it was created from an older image.
CURRENT_IMAGE_ID="$(docker image inspect -f '{{.Id}}' "$IMAGE_NAME")"
EXISTING_IMAGE_ID="$(docker inspect -f '{{.Image}}' "$CONTAINER_NAME" 2>/dev/null || true)"
if [ -n "$EXISTING_IMAGE_ID" ] && [ "$EXISTING_IMAGE_ID" != "$CURRENT_IMAGE_ID" ]; then
    echo "[DOCKER] Container '$CONTAINER_NAME' is using an old image."
    echo "[DOCKER] Removing the old container so it can be recreated..."
    docker rm -f "$CONTAINER_NAME"
fi

# 5. Skip creation if the container already exists.
if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    echo "[DOCKER] Container '$CONTAINER_NAME' already exists."
    exit 0
fi

# 6. Create the container without starting it.
# Bind mount the project so configs/logs stay outside the container.
# Use a named node_modules volume so container dependencies are isolated from the host.
echo "[DOCKER] Creating container '$CONTAINER_NAME'..."
docker create \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -v "$PROJECT_DIR:$CONTAINER_WORKDIR" \
    -v "$NODE_MODULES_VOLUME:$CONTAINER_WORKDIR/node_modules" \
    -w "$CONTAINER_WORKDIR" \
    "$IMAGE_NAME" \
    tail -f /dev/null >/dev/null

echo "[DOCKER] Container '$CONTAINER_NAME' has been created."
