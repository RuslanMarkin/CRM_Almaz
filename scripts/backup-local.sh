#!/bin/bash
set -euo pipefail
BACKUP_DIR="/opt/almaz/backups"
mkdir -p "${BACKUP_DIR}"
DATE=$(date +%Y-%m-%d_%H%M%S)
docker exec almaz_mysql mysqldump -u root -pca04053f444ac51a0bd07faadcc16e2c --single-transaction --routines --events --hex-blob logistics_docs | gzip -9 > "${BACKUP_DIR}/logistics_docs_${DATE}.sql.gz"
find "${BACKUP_DIR}" -name "logistics_docs_*.sql.gz" -mtime +14 -delete
echo "Backup created: ${BACKUP_DIR}/logistics_docs_${DATE}.sql.gz"
