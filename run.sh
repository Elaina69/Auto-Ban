#!/bin/bash

SESSION_NAME="autoban"
CONTAINER_NAME="autoban"
IMAGE_NAME="autoban"
WORKDIR="/home/elaina/workspaces/Auto-Ban"
CONTAINER_WORKDIR="/Auto-Ban"

# ====== TMUX ======
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "[TMUX] Session '$SESSION_NAME' đã tồn tại → attach"
    tmux attach -t "$SESSION_NAME"
    exit 0
else
    echo "[TMUX] Tạo session mới '$SESSION_NAME'"
    tmux new-session -d -s "$SESSION_NAME"
fi

# ====== DOCKER ======
tmux send-keys -t "$SESSION_NAME" "
if ! docker ps -a --format '{{.Names}}' | grep -q '^$CONTAINER_NAME$'; then
    echo '[DOCKER] Container chưa tồn tại → docker run'
    sudo docker run -it \
        -v $WORKDIR:$CONTAINER_WORKDIR \
        --name $CONTAINER_NAME \
        $IMAGE_NAME
elif ! docker ps --format '{{.Names}}' | grep -q '^$CONTAINER_NAME$'; then
    echo '[DOCKER] Container tồn tại nhưng chưa chạy → docker start'
    sudo docker start -i $CONTAINER_NAME
else
    echo '[DOCKER] Container đang chạy → docker attach'
    sudo docker attach $CONTAINER_NAME
fi
" C-m

# ====== NODE SERVER ======
tmux send-keys -t "$SESSION_NAME" "
cd $CONTAINER_WORKDIR
echo '[NODE] Khởi động bot Auto-Ban'
node index.js
" C-m

# Attach tmux
tmux attach -t "$SESSION_NAME"