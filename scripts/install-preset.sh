#!/usr/bin/env bash
# install-preset.sh — Cài preset vào .claude/ của repo hiện tại (CWD)
#
# Usage:
#   install-preset.sh <preset-name> [--dry-run] [--target <dir>]
#
# Workflow:
#   1. Đọc packages/presets/<name>/deps.yaml để biết ECC skills cần symlink/copy
#   2. Symlink (hoặc copy với --copy) các skill vào <target>/skills/
#   3. Render CLAUDE.md.template -> <target>/CLAUDE.md (nếu chưa có)
#   4. Overlay file riêng từ packages/presets/<name>/skills/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPS_ROOT="$ROOT_DIR/dependencies.yaml"

PRESET="${1:-}"
[ -z "$PRESET" ] && { echo "Usage: $0 <preset-name> [--dry-run] [--copy] [--target <dir>]" >&2; exit 1; }
shift

DRY_RUN=0
COPY_MODE=0
TARGET="$(pwd)/.claude"
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --copy)    COPY_MODE=1; shift ;;
    --target)  TARGET="$2"; shift 2 ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

PACKAGE_DIR="$ROOT_DIR/packages/presets/$PRESET"
[ ! -d "$PACKAGE_DIR" ] && { echo "Preset not found: $PRESET" >&2; exit 1; }

DEPS_PKG="$PACKAGE_DIR/deps.yaml"
[ ! -f "$DEPS_PKG" ] && { echo "Missing $DEPS_PKG" >&2; exit 1; }

log() { echo "[install-preset:$PRESET] $*"; }
run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "  [dry-run] $*"
  else
    eval "$@"
  fi
}

# ---- Resolve ECC local_path ----
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

case "$ECC_LOCAL_PATH" in
  /*) ECC_DIR="$ECC_LOCAL_PATH" ;;
  *)  ECC_DIR="$(cd "$ROOT_DIR/$ECC_LOCAL_PATH" 2>/dev/null && pwd || echo "")" ;;
esac

if [ -z "$ECC_DIR" ] || [ ! -d "$ECC_DIR" ]; then
  echo "ECC directory not found" >&2
  exit 1
fi

# ---- Read ECC skills from preset deps.yaml ----
ECC_SKILLS="$(awk '
  /^ecc_skills:/ { in=1; next }
  in && /^[a-z]/ { in=0 }
  in && /^  - / {
    sub(/^  - /, "")
    sub(/[[:space:]]+#.*$/, "")
    gsub(/^"|"$/, "")
    print
  }
' "$DEPS_PKG")"

log "Target: $TARGET"
log "Mode: $([ "$COPY_MODE" = "1" ] && echo copy || echo symlink)"

run "mkdir -p '$TARGET/skills'"

# ---- Link/copy ECC skills ----
if [ -n "$ECC_SKILLS" ]; then
  while IFS= read -r skill; do
    [ -z "$skill" ] && continue
    src="$ECC_DIR/skills/$skill"
    dst="$TARGET/skills/$skill"
    if [ ! -d "$src" ]; then
      log "  WARN: ECC skill not found: $skill"
      continue
    fi
    if [ "$COPY_MODE" = "1" ]; then
      log "  copy  $skill"
      run "rm -rf '$dst' && cp -R '$src' '$dst'"
    else
      log "  link  $skill"
      run "rm -rf '$dst' && ln -s '$src' '$dst'"
    fi
  done <<< "$ECC_SKILLS"
fi

# ---- Overlay preset's own skills ----
if [ -d "$PACKAGE_DIR/skills" ] && [ -n "$(ls -A "$PACKAGE_DIR/skills" 2>/dev/null)" ]; then
  log "Overlaying preset skills..."
  run "rsync -a '$PACKAGE_DIR/skills/' '$TARGET/skills/'"
fi

# ---- Render CLAUDE.md template ----
TEMPLATE="$PACKAGE_DIR/CLAUDE.md.template"
if [ -f "$TEMPLATE" ] && [ ! -f "$TARGET/../CLAUDE.md" ]; then
  log "Creating CLAUDE.md from template at $(dirname "$TARGET")/CLAUDE.md"
  run "cp '$TEMPLATE' '$(dirname "$TARGET")/CLAUDE.md'"
elif [ -f "$TARGET/../CLAUDE.md" ]; then
  log "CLAUDE.md already exists — skipping template render"
fi

log "Done."
[ "$DRY_RUN" = "1" ] && log "(dry-run — no changes applied)"
