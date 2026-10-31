#!/bin/sh
# Στέλνει το site στο Cloudflare Pages, χωρίς τα βοηθητικά/dev αρχεία.
#
#   ./deploy.sh
#
# Χρειάζεται σύνδεση στο Cloudflare (npx wrangler whoami).
set -e
cd "$(dirname "$0")"
STAGE=".deploy"

rm -rf "$STAGE"
mkdir -p "$STAGE"
rsync -a \
  --exclude '.git' --exclude '.gitignore' --exclude '.deploy' --exclude '.impeccable' --exclude '__pycache__' \
  --exclude '_unused' --exclude '_src-media' --exclude '*.md' --exclude 'leads.json' --exclude '*.py' \
  --exclude 'dev-server.py' --exclude 'deploy.sh' \
  --exclude 'upscale.py' --exclude 'ws_upscale.py' \
  --exclude 'luxurylaneassistance.gr.conf' \
  --exclude 'preview.html' --exclude 'preview.css' --exclude 'preview.js' --exclude 'preview-content.json' \
  --exclude 'make-preview.sh' --exclude 'assets/uploads' --exclude 'assets/load-seq' \
  --exclude 'dirA.html' --exclude 'dirB.html' --exclude 'dirC.html' \
  --exclude 'odiki-voitheia-neo-irakleio' --exclude 'odiki-voitheia-voreia-proastia' \
  --exclude 'lla.html' --exclude 'logoA.html' --exclude 'logoB.html' --exclude 'logoC.html' \
  ./ "$STAGE"/

echo "→ ανέβασμα:"
find "$STAGE" -type f | sed "s|^$STAGE/||" | sort | head -40
echo "→ σύνολο αρχείων: $(find "$STAGE" -type f | wc -l | tr -d ' ')"

npx wrangler pages deploy "$STAGE" \
  --project-name luxury-lane-assistance \
  --branch main \
  --commit-dirty=true "$@"
