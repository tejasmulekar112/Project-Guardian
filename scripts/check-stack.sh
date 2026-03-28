#!/usr/bin/env bash
set -euo pipefail

echo "=== Project Guardian Stack Check ==="
echo ""

MISSING=0

check() {
  if command -v "$1" &>/dev/null; then
    echo "[OK]      $1: $("$1" --version 2>&1 | head -1)"
  else
    echo "[MISSING] $1 is not installed"
    MISSING=1
  fi
}

check node
check npm
check python
check poetry
check docker

echo ""

# Check Node version >= 20
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "[WARN]    Node.js >= 20 required, found v${NODE_MAJOR}"
  fi
fi

# Check Python version >= 3.12
if command -v python &>/dev/null; then
  PY_VERSION=$(python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
  if python -c "import sys; exit(0 if sys.version_info >= (3, 12) else 1)"; then
    echo "[OK]      Python version: $PY_VERSION"
  else
    echo "[WARN]    Python >= 3.12 required, found $PY_VERSION"
  fi
fi

echo ""

# Check .env files
for env_file in .env backend/.env mobile/.env; do
  if [ -f "$env_file" ]; then
    echo "[OK]      $env_file exists"
  else
    echo "[WARN]    $env_file not found (copy from ${env_file}.example)"
  fi
done

echo ""

if [ "$MISSING" -eq 1 ]; then
  echo "[!] Some tools are missing. Install them before proceeding."
  exit 1
fi

echo "All checks passed."
