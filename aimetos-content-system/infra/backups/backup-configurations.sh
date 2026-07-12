#!/usr/bin/env sh
set -eu
tar -czf aimetos-config-backup.tgz .env.example packages/prompts automation/n8n docs
