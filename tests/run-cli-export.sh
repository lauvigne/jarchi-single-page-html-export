#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ARCHI_BIN="${ARCHI_BIN:-/Applications/Archi.app/Contents/MacOS/Archi}"
SCRIPT_FILE="${PROJECT_ROOT}/Generate Single-page HTML Export.ajs"
PREFERENCES_FILE="${SCRIPT_DIR}/.exportSinglePage"
PROFILE_NAME="${PROFILE_NAME:-default}"

if [[ ! -x "${ARCHI_BIN}" ]]; then
  echo "Archi binary not executable: ${ARCHI_BIN}" >&2
  echo "Set ARCHI_BIN=/path/to/Archi" >&2
  exit 1
fi

ARCHI_APP_PLUGINS_DIR="$(cd "$(dirname "${ARCHI_BIN}")/../Eclipse/plugins" 2>/dev/null && pwd || true)"
USER_PLUGIN_GLOBS=(
  "${HOME}/Library/Application Support/Archi/dropins/com.archimatetool.script.commandline*"
  "${HOME}/Library/Application Support/Archi4/dropins/com.archimatetool.script.commandline*"
  "${HOME}/Library/Application Support/Archi4/plugins/com.archimatetool.script.commandline*"
  "${HOME}/Library/Application Support/Archi/plugins/com.archimatetool.script.commandline*"
  "${HOME}/Library/Application/com.archimatetool.script.commandline*"
)

HAS_SCRIPT_CMD_PLUGIN=0
if [[ -n "${ARCHI_APP_PLUGINS_DIR}" && -d "${ARCHI_APP_PLUGINS_DIR}" ]]; then
  if ls "${ARCHI_APP_PLUGINS_DIR}"/com.archimatetool.script.commandline* >/dev/null 2>&1; then
    HAS_SCRIPT_CMD_PLUGIN=1
  fi
fi

if [[ "${HAS_SCRIPT_CMD_PLUGIN}" -eq 0 ]]; then
  for pattern in "${USER_PLUGIN_GLOBS[@]}"; do
    if compgen -G "${pattern}" >/dev/null; then
      HAS_SCRIPT_CMD_PLUGIN=1
      break
    fi
  done
fi

if [[ "${HAS_SCRIPT_CMD_PLUGIN}" -eq 0 ]]; then
  echo "Warning: com.archimatetool.script.commandline plugin not found in usual locations." >&2
  echo "The script may still run if Archi resolves plugins from another path." >&2
fi

if [[ ! -f "${SCRIPT_FILE}" ]]; then
  echo "Export script not found: ${SCRIPT_FILE}" >&2
  exit 1
fi

if [[ ! -f "${PREFERENCES_FILE}" ]]; then
  echo "Preferences file not found: ${PREFERENCES_FILE}" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /absolute/path/to/model.archimate" >&2
  exit 1
fi

MODEL_FILE="$1"
if [[ ! -f "${MODEL_FILE}" ]]; then
  echo "Model file not found: ${MODEL_FILE}" >&2
  exit 1
fi

mkdir -p "${SCRIPT_DIR}/.exports"

cd "${PROJECT_ROOT}"

CMD=(
  "${ARCHI_BIN}"
  -application com.archimatetool.commandline.app
  -consoleLog -nosplash
  --loadModel "${MODEL_FILE}"
  --script.runScript "${SCRIPT_FILE}"
)

echo "Running Archi CLI command:"
printf '  %q' "${CMD[@]}"
echo
echo "With environment:"
echo "  EXPORT_PREFERENCES_FILE_PATH=${PREFERENCES_FILE}"
echo "  EXPORT_PROFILE_NAME=${PROFILE_NAME}"

EXPORT_PREFERENCES_FILE_PATH="${PREFERENCES_FILE}" \
EXPORT_PROFILE_NAME="${PROFILE_NAME}" \
exec "${CMD[@]}"
