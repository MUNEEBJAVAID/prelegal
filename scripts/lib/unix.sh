# Shared start/stop logic for the macOS and Linux scripts (sourced, not run).
#
# Temporary local runner: builds the static frontend and runs the FastAPI
# backend in the background with uv. Docker packaging will replace this.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_DIR="$ROOT/.run"
PID_FILE="$RUN_DIR/backend.pid"
LOG_FILE="$RUN_DIR/backend.log"
PORT="${PORT:-8000}"
URL="http://localhost:$PORT"

is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

start_app() {
  for tool in npm uv curl; do
    command -v "$tool" >/dev/null || { echo "Error: '$tool' is required but not installed." >&2; exit 1; }
  done
  if is_running; then
    echo "Prelegal is already running at $URL (pid $(cat "$PID_FILE"))."
    return
  fi

  echo "Building frontend..."
  (cd "$ROOT/frontend" && { [[ -d node_modules ]] || npm ci; } && npm run build)

  echo "Starting backend..."
  mkdir -p "$RUN_DIR"
  local env_args=()
  [[ -f "$ROOT/.env" ]] && env_args=(--env-file ../.env)
  (cd "$ROOT/backend" && PORT="$PORT" nohup uv run ${env_args[@]+"${env_args[@]}"} prelegal-backend </dev/null >"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE")

  for _ in $(seq 1 60); do
    if curl -fsS "$URL/api/health" >/dev/null 2>&1; then
      echo "Prelegal is running at $URL (logs: $LOG_FILE)"
      return
    fi
    if ! is_running; then break; fi
    sleep 1
  done
  echo "Error: backend did not start. See $LOG_FILE" >&2
  exit 1
}

stop_app() {
  if ! is_running; then
    echo "Prelegal is not running."
    rm -f "$PID_FILE"
    return
  fi
  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid"
  for _ in $(seq 1 10); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  kill -0 "$pid" 2>/dev/null && kill -9 "$pid"
  rm -f "$PID_FILE"
  echo "Prelegal stopped."
}
