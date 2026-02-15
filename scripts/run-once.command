#!/bin/zsh
cd "$(cd "$(dirname "$0")/.." && pwd)"
node src/cli.js run --workflow workflows/sample-workflow.yaml
