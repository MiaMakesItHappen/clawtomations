#!/bin/zsh
cd "$(cd "$(dirname "$0")/.." && pwd)"
node src/cli.js serve --port 8787
