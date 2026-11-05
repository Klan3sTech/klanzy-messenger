#!/bin/sh
set -e

# Порт, который отдаём наружу (HF Spaces требует 7860, остальные — любой)
APP_PORT="${PORT:-8080}"
sed "s/__PORT__/${APP_PORT}/" /etc/nginx/klanzy.conf > /etc/nginx/conf.d/default.conf
rm -f /etc/nginx/sites-enabled/default

# Бэкенд (API + WebSocket) слушает 3001 внутри контейнера
node /app/server/index.mjs &
BACKEND_PID=$!

trap 'kill -TERM $BACKEND_PID 2>/dev/null; exit 0' INT TERM

# Если бэкенд упал — гасим контейнер, чтобы платформа перезапустила
( sleep 3; until kill -0 $BACKEND_PID 2>/dev/null; do kill -TERM 1 2>/dev/null; exit 1; done ) &

exec nginx -g 'daemon off;'
