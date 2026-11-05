# ── 1. сборка фронтенда (single-file dist/index.html) ──
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ── 2. рантайм: Node 22 (нужен для node:sqlite) + nginx ──
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    TZ=Europe/Minsk

RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist
COPY deploy/nginx.conf /etc/nginx/klanzy.conf
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
 && mkdir -p /app/server/data

# база SQLite живёт здесь — на платформах с диском смонтируй сюда volume
VOLUME ["/app/server/data"]
EXPOSE 8080

CMD ["/entrypoint.sh"]
