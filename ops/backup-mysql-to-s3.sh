#!/usr/bin/env bash
# Daily, encrypted-in-transit logical backup of MySQL to an independent S3 bucket.
# Required: BACKUP_DATABASE_URL, BACKUP_S3_URI, mysqldump, aws CLI, node.
set -euo pipefail

: "${BACKUP_DATABASE_URL:=${DATABASE_URL:?Set BACKUP_DATABASE_URL or DATABASE_URL}}"
: "${BACKUP_S3_URI:?Set BACKUP_S3_URI, e.g. s3://company-logistics-backups/mysql}"

command -v mysqldump >/dev/null || { echo "mysqldump is required" >&2; exit 1; }
command -v aws >/dev/null || { echo "aws CLI is required" >&2; exit 1; }

backup_tmp_dir="$(mktemp -d)"
backup_client_cnf="${backup_tmp_dir}/client.cnf"
backup_started_at="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
backup_file="${backup_tmp_dir}/logistics_docs_${backup_started_at}.sql.gz"
trap 'rm -rf "${backup_tmp_dir}"' EXIT

BACKUP_CLIENT_CNF="${backup_client_cnf}" node --input-type=module -e '
  import { writeFileSync } from "node:fs";
  const url = new URL(process.env.BACKUP_DATABASE_URL);
  if (!url.pathname || url.pathname === "/") throw new Error("Database name is missing from BACKUP_DATABASE_URL");
  const config = `[client]\nhost=${url.hostname}\nport=${url.port || 3306}\nuser=${decodeURIComponent(url.username)}\npassword=${decodeURIComponent(url.password)}\n`;
  writeFileSync(process.env.BACKUP_CLIENT_CNF, config, { mode: 0o600 });
'
backup_database="$(BACKUP_DATABASE_URL="${BACKUP_DATABASE_URL}" node --input-type=module -e 'console.log(decodeURIComponent(new URL(process.env.BACKUP_DATABASE_URL).pathname.slice(1)))')"

mysqldump --defaults-extra-file="${backup_client_cnf}" \
  --single-transaction --routines --events --hex-blob --set-gtid-purged=OFF \
  "${backup_database}" | gzip -9 > "${backup_file}"

backup_sha256="$(shasum -a 256 "${backup_file}" | awk '{print $1}')"
backup_target="${BACKUP_S3_URI%/}/$(date -u +%Y/%m/%d)/$(basename "${backup_file}")"
aws s3 cp "${backup_file}" "${backup_target}" --only-show-errors --metadata "sha256=${backup_sha256},created_at=${backup_started_at}"
echo "Backup uploaded: ${backup_target}"
