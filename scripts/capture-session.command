#!/bin/zsh
cd "$(cd "$(dirname "$0")/.." && pwd)"
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./capture-session.command <alias> <url>"
  exit 1
fi
node src/cli.js capture --site "$1" --url "$2"
