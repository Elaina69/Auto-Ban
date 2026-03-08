#!/bin/bash

SESSION_NAME="autoban"
WORKDIR="~/workspaces/Auto-Ban"

# 1. Kiểm tra nếu session đã có
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "[TMUX] Session '$SESSION_NAME' đang chạy nền."
    exit 0
fi

# 2. Tạo session mới (Chế độ Detached -d)
echo "[TMUX] Khởi tạo session '$SESSION_NAME'..."
tmux new-session -d -s "$SESSION_NAME"

# 3. Gửi lệnh vào bên trong Tmux
# Lưu ý: Cần source .bashrc để Tmux nhận diện được PM2/Node
tmux send-keys -t "$SESSION_NAME" "cd $WORKDIR" C-m
tmux send-keys -t "$SESSION_NAME" "source ~/.bashrc" C-m
tmux send-keys -t "$SESSION_NAME" "pm2 start index.js --name $SESSION_NAME" C-m
tmux send-keys -t "$SESSION_NAME" "pm2 monit" C-m

echo "[DONE] Đã khởi động $SESSION_NAME trong Tmux."