#!/usr/bin/env bash
# Build the site and publish it to a GitHub Pages branch of a preview repository.
# The default repository is the agent's preview repo; override with PREVIEW_REPO=owner/name.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREVIEW_REPO="${PREVIEW_REPO:-boboloveai/pagecat-preview}"
cd "$ROOT"

pnpm build

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R dist/. "$TMP"/
touch "$TMP/.nojekyll"
cd "$TMP"
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="boboloveai" -c user.email="211100170+boboloveai@users.noreply.github.com" \
  commit -qm "deploy: PageCat preview"
git remote add origin "https://github.com/${PREVIEW_REPO}.git"
git push --force origin gh-pages

if ! gh api "repos/${PREVIEW_REPO}/pages" >/dev/null 2>&1; then
  printf '{"source":{"branch":"gh-pages","path":"/"}}' \
    | gh api -X POST "repos/${PREVIEW_REPO}/pages" --input - >/dev/null
fi

owner="${PREVIEW_REPO%%/*}"
name="${PREVIEW_REPO##*/}"
echo "Preview: https://${owner}.github.io/${name}/"
