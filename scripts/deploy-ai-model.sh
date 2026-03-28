#!/usr/bin/env bash
set -euo pipefail

echo "=== Whisper AI Model Deployment (Stub) ==="
echo ""
echo "This script will:"
echo "  1. Verify OpenAI API key is set"
echo "  2. Install ai-services dependencies"
echo "  3. Run a test transcription"
echo ""

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "[ERROR] OPENAI_API_KEY is not set."
  echo "        Export it or add to .env file."
  exit 1
fi

echo "[OK]   OPENAI_API_KEY is configured"

# Install dependencies if poetry is available
if command -v poetry &>/dev/null && [ -f "ai-services/pyproject.toml" ]; then
  echo "[INFO] Installing ai-services dependencies..."
  cd ai-services && poetry install
  echo "[OK]   Dependencies installed"
else
  echo "[WARN] Poetry not found or ai-services/pyproject.toml missing"
fi

echo ""
echo "[STUB] Model deployment not yet implemented."
echo "       Future: will validate Whisper inference pipeline."
