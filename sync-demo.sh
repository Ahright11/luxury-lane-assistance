#!/bin/sh
# Στέλνει τη σελίδα στο demo (lla-demo.httpal.com) για να τη δείξουμε στον πελάτη.
#
#   ./sync-demo.sh
#
# Τι κάνει:
#   1. τραβάει το περιεχόμενο που είναι ΤΩΡΑ live, ώστε το demo να μη δείχνει παλιά κείμενα
#   2. ανεβάζει σελίδες + assets στο /var/www/lla-demo του hetzner
#
# Τι ΔΕΝ ανεβάζει σκόπιμα: admin.html και functions/
#   -> στο demo δεν υπάρχει το /api (είναι nginx, όχι Cloudflare Functions),
#      οπότε το «Αποθήκευση» θα έσκαγε. Το CMS το δείχνουμε στο κανονικό domain.
set -e
cd "$(dirname "$0")"

echo "→ 1/3 φέρνω το ζωντανό περιεχόμενο"
curl -fsS "https://www.luxurylaneassistance.gr/api/content?t=$(date +%s)" \
  | python3 -c "import sys,json; json.dump(json.load(sys.stdin), open('content.json','w'), ensure_ascii=False, indent=2); open('content.json','a').write('\n')"

echo "→ 2/3 ανεβάζω assets"
rsync -a assets/ hetzner:/var/www/lla-demo/assets/

echo "→ 3/3 ανεβάζω σελίδες"
scp -q index.html content.json 404.html robots.txt sitemap.xml hetzner:/var/www/lla-demo/

echo
echo "✓ Έτοιμο: https://lla-demo.httpal.com"
echo "  (αν δεις παλιά εικόνα/βίντεο, κάνε hard refresh: Cmd+Shift+R)"
