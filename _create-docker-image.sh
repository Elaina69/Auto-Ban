#!/bin/bash
set -e

IMAGE_NAME="autoban"

# 1. Resolve the project directory from this script location.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 2. Ensure Docker is installed.
if ! command -v docker >/dev/null 2>&1; then
    echo "[ERROR] docker was not found. Install Docker first."
    exit 1
fi

# 3. Skip creation if the image already exists.
if docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
    echo "[DOCKER] Image '$IMAGE_NAME' already exists."
    exit 0
fi

# 4. Build a new Docker image from the project Dockerfile.
echo "[DOCKER] Creating image '$IMAGE_NAME'..."
docker build -t "$IMAGE_NAME" "$PROJECT_DIR"

echo "[DOCKER] Image '$IMAGE_NAME' has been created."
