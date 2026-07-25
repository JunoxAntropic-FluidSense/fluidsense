#!/usr/bin/env bash
# Commit whatever's changed and deploy to Vercel production.
# Usage: npm run push -- "commit message"   (message optional)
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
  msg="${1:-chore: update}"
  git add -A
  git commit -m "$msg"
else
  echo "No changes to commit — deploying current HEAD."
fi

npx --yes vercel --prod --yes
