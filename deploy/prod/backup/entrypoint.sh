#!/bin/sh
set -e

if ! command -v pg_dump >/dev/null 2>&1; then
  apt-get update
  apt-get install -y postgresql-client redis-tools cron
fi

crontab /backup/crontab
cron -f
