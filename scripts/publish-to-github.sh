#!/bin/zsh
set -e

REPO_URL="$1"

if [[ -z "$REPO_URL" ]]; then
  echo "Usage: ./publish-to-github.sh <github-repo-url>"
  echo "Example: ./publish-to-github.sh https://github.com/you/clawtomations.git"
  exit 1
fi

cd "$(dirname "$0")/.."

git init
if ! git remote | grep -q '^origin$'; then
  git remote add origin "$REPO_URL"
fi
git add .
git commit -m "feat: bootstrap clawtomations project" || true
git branch -M main
git push -u origin main
