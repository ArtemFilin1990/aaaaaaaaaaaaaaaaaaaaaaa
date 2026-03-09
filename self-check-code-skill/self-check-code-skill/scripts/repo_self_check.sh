#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

status() { printf '\n[%s] %s\n' "$1" "$2"; }
run() {
  local label="$1"; shift
  status RUN "$label"
  if "$@"; then
    status OK "$label"
  else
    local code=$?
    status FAIL "$label (exit $code)"
    return $code
  fi
}

has_file() { [ -f "$1" ]; }
has_cmd() { command -v "$1" >/dev/null 2>&1; }

PKG=""
if has_file package.json; then
  if has_cmd pnpm && [ -f pnpm-lock.yaml ]; then PKG="pnpm";
  elif has_cmd yarn && [ -f yarn.lock ]; then PKG="yarn";
  elif has_cmd bun && [ -f bun.lockb ]; then PKG="bun";
  elif has_cmd npm; then PKG="npm"; fi
fi

get_script() {
  python - "$1" <<'PY'
import json, sys, pathlib
name = sys.argv[1]
p = pathlib.Path('package.json')
if not p.exists():
    raise SystemExit(1)
data = json.loads(p.read_text())
print((data.get('scripts') or {}).get(name, ''))
PY
}

EXIT=0

status INFO "root=$PWD"

if has_file package.json; then
  status INFO "detected Node project via package.json"
  if [ -n "$PKG" ]; then
    for script in lint typecheck build test; do
      cmd="$(get_script "$script" || true)"
      if [ -n "$cmd" ]; then
        case "$PKG" in
          npm) run "$PKG run $script" npm run "$script" || EXIT=$? ;;
          pnpm) run "$PKG $script" pnpm "$script" || EXIT=$? ;;
          yarn) run "$PKG $script" yarn "$script" || EXIT=$? ;;
          bun) run "$PKG run $script" bun run "$script" || EXIT=$? ;;
        esac
      fi
    done
  else
    status INFO "package manager not found; skipping Node checks"
  fi
fi

if has_cmd python3; then PY=python3; elif has_cmd python; then PY=python; else PY=""; fi
if [ -n "$PY" ]; then
  if [ -f requirements.txt ] || [ -f pyproject.toml ] || [ -d tests ] || [ -d src ]; then
    status INFO "detected Python project"
    run "python compileall" "$PY" -m compileall . || EXIT=$?
    if has_cmd pytest && ([ -d tests ] || find . -maxdepth 2 -name 'test_*.py' | grep -q .); then
      run "pytest" pytest || EXIT=$?
    fi
    if has_cmd ruff; then
      run "ruff check ." ruff check . || EXIT=$?
    fi
    if has_cmd mypy && ([ -f mypy.ini ] || grep -q "mypy" pyproject.toml 2>/dev/null); then
      run "mypy ." mypy . || EXIT=$?
    fi
  fi
fi

if [ "$EXIT" -eq 0 ]; then
  status DONE "self-check passed or no failing checks were available"
else
  status DONE "self-check finished with failures"
fi

exit "$EXIT"
