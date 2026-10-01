# CMS — πώς δουλεύει το site της Luxury Lane Assistance

## Για τον πελάτη

Διεύθυνση διαχείρισης: **https://www.luxurylaneassistance.gr/admin**
Κωδικός: (δικός σου — άλλαξέ τον με την εντολή πιο κάτω)

Αριστερά βλέπει τα πεδία ανά ενότητα, δεξιά την πραγματική σελίδα. Ό,τι γράφει
φαίνεται αμέσως στη προβολή. Πατάει **Αποθήκευση** και οι αλλαγές είναι live
σε λίγα δευτερόλεπτα — χωρίς build, χωρίς GitHub, χωρίς λογαριασμό.

## Αρχιτεκτονική

```
admin.html  ──POST /api/save──▶  Pages Function  ──▶  Cloudflare KV  ◀──GET /api/content── index.html
```

* `index.html` — το site. Το περιεχόμενο το ζητάει από `api/content` (fallback: `content.json`).
  Αν δεν απαντήσει τίποτα, κρατάει το κείμενο που είναι γραμμένο μέσα στο HTML (δεν σπάει ποτέ).
* `content.json` — το **προεπιλεγμένο** περιεχόμενο (μόνο όσο το KV είναι άδειο).
* `admin.html` — το split-view πρόγραμμα διαχείρισης.
* `functions/` — Pages Functions: σερβίρουν/γράφουν το περιεχόμενο και σερβίρουν τις εικόνες.
* `assets/` — οι αρχικές εικόνες. Οι εικόνες που ανεβάζει ο πελάτης πάνε στο KV και σερβίρονται από `/img/...`.

**Προσοχή:** το live περιεχόμενο ζει στο KV. Αν αλλάξεις το `content.json` στο repo,
η σελίδα ΔΕΝ αλλάζει — είναι μόνο το fallback. Για επαναφορά: `./reset-content.sh`.

## Τοπική δοκιμή

```sh
./dev-server.py            # http://localhost:8080  (admin: /admin)
```

Ο τοπικός server υλοποιεί τα ίδια endpoints με τα Pages Functions (χωρίς κωδικό),
γράφει απευθείας στο `content.json` και ανεβάζει εικόνες στο `assets/uploads/`.

Για να δοκιμάσεις τα αληθινά Functions με KV πριν το deploy:

```sh
npx wrangler pages dev . --kv LLA_KV --binding ADMIN_PASS=testpass --port 8090
```

## Deploy

```sh
./deploy.sh                # στέλνει το site (χωρίς dev αρχεία) στο Cloudflare Pages
```

Χρειάζεται `npx wrangler whoami` να δείχνει τον σωστό λογαριασμό.

## Συντήρηση

| Τι θέλω | Εντολή |
| --- | --- |
| Αλλαγή κωδικού διαχείρισης | `printf '%s' 'ΝΕΟΣ_ΚΩΔΙΚΟΣ' \| npx wrangler pages secret put ADMIN_PASS --project-name luxury-lane-assistance` |
| Backup του περιεχομένου | `./pull-content.sh` (γράφει το live περιεχόμενο στο `content.json`) |
| Επαναφορά στο αρχικό | `./reset-content.sh` |
| Δες τι είναι live | `curl -s https://www.luxurylaneassistance.gr/api/content` |

Τα μυστικά δεν είναι στο repo: ο κωδικός είναι Pages secret (`ADMIN_PASS`), το KV είναι
δεμένο στο project (`LLA_KV`, namespace `ff4bb51f53f14cde941e6e80044cb308`).
