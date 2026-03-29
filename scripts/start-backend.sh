#!/usr/bin/env bash
set -euo pipefail

# Kill any existing uvicorn/backend processes on port 8000
echo "Checking for existing processes on port 8000..."

if command -v netstat &>/dev/null; then
  PIDS=$(netstat -ano 2>/dev/null | grep ":8000.*LISTEN" | awk '{print $5}' | sort -u)
elif command -v ss &>/dev/null; then
  PIDS=$(ss -tlnp 'sport = :8000' 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u)
else
  PIDS=""
fi

if [ -n "$PIDS" ]; then
  echo "Killing existing processes on port 8000: $PIDS"
  for PID in $PIDS; do
    taskkill //F //PID "$PID" 2>/dev/null || kill -9 "$PID" 2>/dev/null || true
  done
  sleep 1
  echo "Old processes killed."
else
  echo "Port 8000 is free."
fi

# Start the backend
cd "$(dirname "$0")/../backend"
echo "Starting backend server on http://0.0.0.0:8000 ..."
python -m poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
