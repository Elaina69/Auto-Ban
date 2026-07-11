#!/bin/bash

SESSION_NAME="autoban"

# 1. Ensure tmux is installed.
if ! command -v tmux >/dev/null 2>&1; then
    echo "[ERROR] tmux was not found. Install tmux first."
    exit 1
fi

# 2. Skip creation if the session already exists.
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "[TMUX] Session '$SESSION_NAME' already exists."
    exit 0
fi

# 3. Create a new detached tmux session.
echo "[TMUX] Creating session '$SESSION_NAME'..."
tmux new-session -d -s "$SESSION_NAME"

echo "[TMUX] Session '$SESSION_NAME' has been created."
