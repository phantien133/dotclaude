#!/usr/bin/env bash
# install.sh — Entry point cho claude-config installer
#
# Usage:
#   ./scripts/install.sh user [--dry-run]
#   ./scripts/install.sh preset <name> [--dry-run]
#   ./scripts/install.sh list

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<EOF
claude-config installer

Usage:
  $(basename "$0") user [--dry-run]              Cài package user vào ~/.claude/
  $(basename "$0") preset <name> [--dry-run]     Cài preset vào .claude/ của CWD
  $(basename "$0") list                          Liệt kê tất cả packages có sẵn

Examples:
  $(basename "$0") user --dry-run
  $(basename "$0") preset typescript-fullstack
  cd /path/to/repo && $HOME/claude-config/scripts/install.sh preset python-django
EOF
}

cmd="${1:-}"
case "$cmd" in
  user)
    shift
    exec "$SCRIPT_DIR/install-user.sh" "$@"
    ;;
  preset)
    shift
    exec "$SCRIPT_DIR/install-preset.sh" "$@"
    ;;
  list)
    echo "User packages:"
    [ -d "$ROOT_DIR/packages/user" ] && echo "  - user"
    echo
    echo "Project presets:"
    if [ -d "$ROOT_DIR/packages/presets" ]; then
      for d in "$ROOT_DIR/packages/presets"/*/; do
        [ -d "$d" ] && echo "  - $(basename "$d")"
      done
    fi
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage
    exit 1
    ;;
esac
