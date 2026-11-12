#!/bin/sh
set -eu
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
node_bin="$repo_dir/../toolchain/node-v22.23.0-darwin-arm64/bin"
if [ ! -x "$node_bin/node" ]; then
  printf '%s\n' 'Project Node.js 22.23.0 is missing; see docs/local-development.md.' >&2
  exit 1
fi
PATH="$node_bin:$PATH"
export PATH
if [ "$(node --version)" != v22.23.0 ]; then
  printf '%s\n' 'Expected project Node.js v22.23.0.' >&2
  exit 1
fi
if [ "$#" -eq 0 ]; then
  printf '%s\n' 'Usage: sh scripts/with-project-node.sh <command> [arguments...]' >&2
  exit 1
fi
exec "$@"
