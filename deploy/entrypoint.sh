#!/bin/sh
set -e

# ────────────────────────────────────────────────────────────────
# Внешний порт задаёт платформа (Render: 10000, HF Spaces: 7860).
# ВАЖНО: этот порт забирает nginx, а бэкенд всегда слушает 3001
# внутри контейнера — иначе два процесса дерутся за один порт.
# ────────────────────────────────────────────────────────────────
APP_PORT="${PORT:-8080}"
PORT=3001
export PORT

sed "s/__PORT__/${APP_PORT}/" /etc/nginx/klanzy.conf > /etc/nginx/conf.d/default.conf
rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf.bak

echo "[klanzy] nginx -> 0.0.0.0:${APP_PORT}, backend -> 127.0.0.1:${PORT}"

node /app/server/index.mjs &
BACKEND_PID=$!

# Если бэкенд упал на старте — падаем и мы, чтобы платформа сделала рестарт
sleep 2
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "[klanzy] backend не запустился" >&2
  exit 1
fi

trap 'kill -TERM "$BACKEND_PID" 2>/dev/null || true' INT TERM

exec nginx -g 'daemon off;'
