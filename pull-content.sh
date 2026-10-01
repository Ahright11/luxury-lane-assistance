#!/bin/sh
# Κατεβάζει το περιεχόμενο που είναι ΤΩΡΑ live (από το KV) και το γράφει στο content.json.
# Χρήσιμο για backup / για να κρατάς το repo συγχρονισμένο.
set -e
cd "$(dirname "$0")"
curl -fsS "https://www.luxurylaneassistance.gr/api/content?t=$(date +%s)" \
  | python3 -c "import sys,json; json.dump(json.load(sys.stdin), open('content.json','w'), ensure_ascii=False, indent=2); open('content.json','a').write('\n')"
echo "✓ ενημερώθηκε το content.json από το live site"
