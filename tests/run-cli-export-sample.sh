#!/usr/bin/env bash
set -euo pipefail

export ARCHI_BIN="/Applications/Archi-5.7.0.app/Contents/MacOS/Archi"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL_FILE="${HOME}/Documents/Archi/Supporting OpRes with ArchiMate - Amsterdam TOG Summit 2025.archimate"

exec "${SCRIPT_DIR}/run-cli-export.sh" "${MODEL_FILE}"
