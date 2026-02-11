#!/bin/sh
set -e

node /app/scripts/backup.mjs >> /var/log/backup.log 2>&1
