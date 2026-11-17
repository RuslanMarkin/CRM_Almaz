#!/usr/bin/env bash
set -euo pipefail

SERVER_HOST="2.56.127.236"
SERVER_USER="root"
REMOTE_DIR="/opt/almaz"

echo "==> 1. Синхронизация файлов на сервер..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.manus-logs' \
  --exclude 'app.env' \
  --exclude '.env' \
  --exclude 'backups' \
  ./ "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/"

echo "==> 2. Сборка обновленного Docker-образа на сервере..."
ssh "${SERVER_USER}@${SERVER_HOST}" "cd ${REMOTE_DIR} && docker compose build app"

echo "==> 3. Перезапуск приложения с применением миграций..."
ssh "${SERVER_USER}@${SERVER_HOST}" "cd ${REMOTE_DIR} && docker compose up -d --no-deps app"

echo "==> 4. Проверка статуса приложения..."
sleep 4
ssh "${SERVER_USER}@${SERVER_HOST}" "docker ps --filter name=almaz_app --format 'table {{.Names}}\t{{.Status}}'"
curl -sf "http://${SERVER_HOST}/api/health" >/dev/null && echo "✓ Здоровье сервиса подтверждено (/api/health ok)"

echo ""
echo "🎉 Обновление успешно развернуто на http://${SERVER_HOST}!"
