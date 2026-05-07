#!/usr/bin/env bash
# install-user.sh — Cài package user vào ~/.claude/
#
# Workflow:
#   1. Đọc packages/user/deps.yaml để biết ECC modules cần cài
#   2. Resolve ECC source từ dependencies.yaml (local_path hoặc clone)
#   3. Gọi everything-claude-code/install.sh --modules <ids> --target claude
#   4. Overlay file riêng từ packages/user/{rules,agents,commands,hooks,skills} vào ~/.claude/
#
# Flags:
#   --dry-run    In ra plan, không thực hiện
#   --skip-ecc   Bỏ qua bước cài ECC modules, chỉ overlay package files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/packages/user"
DEPS_ROOT="$ROOT_DIR/dependencies.yaml"
DEPS_PKG="$PACKAGE_DIR/deps.yaml"
TARGET="${HOME}/.claude"

DRY_RUN=0
SKIP_ECC=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-ecc) SKIP_ECC=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

log() { echo "[install-user] $*"; }
run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "  [dry-run] $*"
  else
    eval "$@"
  fi
}

# ---- Step 1: Resolve ECC source ----
# Lightweight YAML parsing: chỉ đọc 2 key cần — local_path và pinned_commit.
# Tránh thêm dependency yq/python để installer self-contained.
if [ ! -f "$DEPS_ROOT" ]; then
  echo "Missing $DEPS_ROOT" >&2
  exit 1
fi

ECC_LOCAL_PATH="$(awk '
  /^sources:/ { in_sources=1; next }
  in_sources && /^  ecc:/ { in_ecc=1; next }
  in_ecc && /^  [a-z]/ { in_ecc=0 }
  in_ecc && /^    local_path:/ {
    sub(/^    local_path:[[:space:]]*/, "")
    gsub(/^"|"$/, "")
    print; exit
  }
' "$DEPS_ROOT")"

if [ -z "${ECC_LOCAL_PATH:-}" ] || [ "$ECC_LOCAL_PATH" = "null" ]; then
  echo "ECC local_path not configured in $DEPS_ROOT" >&2
  echo "Hint: set sources.ecc.local_path or implement clone-from-repo (TODO)" >&2
  exit 1
fi

# Resolve relative paths against ROOT_DIR
case "$ECC_LOCAL_PATH" in
  /*) ECC_DIR="$ECC_LOCAL_PATH" ;;
  *)  ECC_DIR="$(cd "$ROOT_DIR/$ECC_LOCAL_PATH" 2>/dev/null && pwd || echo "")" ;;
esac

if [ -z "$ECC_DIR" ] || [ ! -d "$ECC_DIR" ]; then
  echo "ECC directory not found at: $ROOT_DIR/$ECC_LOCAL_PATH" >&2
  exit 1
fi

log "ECC source: $ECC_DIR"

# ---- Step 2: Read modules from package deps.yaml ----
if [ ! -f "$DEPS_PKG" ]; then
  echo "Missing $DEPS_PKG" >&2
  exit 1
fi

MODULES="$(awk '
  /^ecc_modules:/ { in_modules=1; next }
  in_modules && /^[a-z]/ { in_modules=0 }
  in_modules && /^  - / {
    sub(/^  - /, "")
    sub(/[[:space:]]+#.*$/, "")
    gsub(/^"|"$/, "")
    print
  }
' "$DEPS_PKG" | paste -sd, -)"

if [ -z "$MODULES" ]; then
  echo "No ecc_modules in $DEPS_PKG" >&2
  exit 1
fi

log "ECC modules: $MODULES"
log "Target: $TARGET"

# ---- Step 3: Run ECC installer ----
if [ "$SKIP_ECC" = "0" ]; then
  log "Running ECC installer..."
  ECC_ARGS=(--target claude --modules "$MODULES")
  [ "$DRY_RUN" = "1" ] && ECC_ARGS+=(--dry-run)
  run "(cd '$ECC_DIR' && ./install.sh ${ECC_ARGS[*]})"
fi

# ---- Step 4: Overlay package files ----
log "Overlaying package files into $TARGET..."
for sub in rules agents commands hooks skills; do
  src="$PACKAGE_DIR/$sub"
  if [ -d "$src" ] && [ -n "$(ls -A "$src" 2>/dev/null)" ]; then
    log "  $sub/ -> $TARGET/$sub/"
    run "mkdir -p '$TARGET/$sub'"
    run "rsync -a '$src/' '$TARGET/$sub/'"
  fi
done

log "Done."
[ "$DRY_RUN" = "1" ] && log "(dry-run — no changes applied)"
