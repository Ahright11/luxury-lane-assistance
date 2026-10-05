#!/usr/bin/env python3
"""Τοπικός server για το LLA CMS — ίδια API με τα Pages Functions του production.

    python3 dev-server.py            # http://localhost:8080/   (admin: /admin)

Endpoints (ίδια λογική με το functions/):
    GET  /api/content   -> content.json (ή ό,τι έχει αποθηκευτεί τοπικά)
    POST /api/save      -> γράφει το content.json
    POST /api/upload?name=x.jpg -> γράφει στο assets/uploads/, γυρίζει {path}
    GET  /img/<key>     -> σερβίρει από assets/uploads/
    GET  /api/login     -> {"authed": true}   (τοπικά πάντα συνδεδεμένος)
"""
import json
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

ROOT = os.path.dirname(os.path.abspath(__file__))
UPLOADS = os.path.join(ROOT, "assets", "uploads")
SAFE = re.compile(r"[^A-Za-z0-9._-]+")

# LLA_AUTH=0 -> το τοπικό api/login γυρίζει authed:false, για να δοκιμάζεις την πύλη
DEV_AUTH = os.environ.get("LLA_AUTH", "1") != "0"
DEV_PASS = os.environ.get("LLA_PASS", "testpass")


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    # ---------- helpers ----------
    def end_headers(self):
        # μην κρατάει ο browser παλιά html/json όσο δουλεύουμε
        p = self.path.split("?")[0]
        if p in ("/", "/index.html", "/content.json", "/admin", "/admin.html"):
            self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _bytes(self, code, data, ctype, cache="no-store"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(data)

    def _body(self, n):
        data = b""
        while len(data) < n:
            chunk = self.rfile.read(n - len(data))
            if not chunk:
                break
            data += chunk
        return data

    # ---------- routes ----------
    def do_GET(self):
        p = urlparse(self.path).path

        if p.rstrip("/") == "/admin":
            self.path = "/admin.html"
            return super().do_GET()

        if p == "/api/content":
            try:
                raw = open(os.path.join(ROOT, "content.json"), encoding="utf-8").read()
            except OSError:
                return self._json(404, {"error": "no content.json"})
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw.encode("utf-8"))))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw.encode("utf-8"))
            return

        if p == "/api/login":
            if DEV_AUTH:
                return self._json(200, {"authed": True})
            return self._json(200, {"authed": False})

        if p == "/api/lead":
            try:
                leads = json.load(open(os.path.join(ROOT, "leads.json"), encoding="utf-8"))
            except (OSError, ValueError):
                leads = []
            return self._json(200, {"ok": True, "leads": leads, "count": len(leads)})

        if p.startswith("/img/"):
            key = SAFE.sub("", unquote(p[5:]))
            fp = os.path.join(UPLOADS, key)
            if os.path.isfile(fp):
                ext = os.path.splitext(key)[1].lower()
                ct = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
                      ".avif": "image/avif", ".gif": "image/gif", ".svg": "image/svg+xml"}.get(ext, "application/octet-stream")
                return self._bytes(200, open(fp, "rb").read(), ct, "public, max-age=31536000, immutable")
            return self._bytes(404, b"not found", "text/plain")

        return super().do_GET()

    def do_POST(self):
        p = urlparse(self.path).path

        if p == "/api/save":
            n = int(self.headers.get("Content-Length") or 0)
            try:
                payload = json.loads(self._body(n).decode("utf-8"))
            except Exception as e:
                return self._json(400, {"ok": False, "error": "bad json: %s" % e})
            content = payload.get("content")
            if not isinstance(content, dict):
                return self._json(400, {"ok": False, "error": "no content"})
            tmp = os.path.join(ROOT, "content.json.tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(content, f, ensure_ascii=False, indent=2)
                f.write("\n")
            os.replace(tmp, os.path.join(ROOT, "content.json"))
            return self._json(200, {"ok": True, "savedAt": "local"})

        if p == "/api/upload":
            q = parse_qs(urlparse(self.path).query)
            name = SAFE.sub("-", (q.get("name") or ["upload.jpg"])[0]).strip("-") or "upload.jpg"
            if not re.search(r"\.[a-z0-9]+$", name, re.I):
                name += ".jpg"
            n = int(self.headers.get("Content-Length") or 0)
            data = self._body(n)
            os.makedirs(UPLOADS, exist_ok=True)
            with open(os.path.join(UPLOADS, name), "wb") as f:
                f.write(data)
            return self._json(200, {"ok": True, "path": "/img/" + name})

        if p == "/api/login":
            if DEV_AUTH:
                return self._json(200, {"ok": True})
            n = int(self.headers.get("Content-Length") or 0)
            try:
                pass_ = json.loads(self._body(n).decode("utf-8")).get("pass", "")
            except Exception:
                pass_ = ""
            if pass_ == DEV_PASS:
                return self._json(200, {"ok": True})
            return self._json(401, {"ok": False, "error": "Λάθος κωδικός"})

        if p == "/api/lead":
            n = int(self.headers.get("Content-Length") or 0)
            try:
                b = json.loads(self._body(n).decode("utf-8"))
            except Exception:
                return self._json(400, {"ok": False, "error": "bad json"})
            fp = os.path.join(ROOT, "leads.json")
            try:
                leads = json.load(open(fp, encoding="utf-8"))
            except (OSError, ValueError):
                leads = []
            import time
            lead = {
                "id": format(int(time.time() * 1000), "x") + os.urandom(2).hex(),
                "at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
                "name": (b.get("name") or "")[:80],
                "service": (b.get("service") or "")[:60],
                "vehicle": (b.get("vehicle") or "")[:80],
                "moves": b.get("moves") or "",
                "fault": (b.get("fault") or "")[:120],
                "when": (b.get("when") or "")[:24],
                "from": (b.get("from") or "")[:80],
                "to": (b.get("to") or "")[:80],
                "platform": b.get("platform") or "",
                "ua": (self.headers.get("User-Agent") or "")[:80],
                "done": False,
            }
            leads.insert(0, lead)
            with open(fp, "w", encoding="utf-8") as f:
                json.dump(leads[:300], f, ensure_ascii=False, indent=2)
            return self._json(200, {"ok": True, "id": lead["id"]})

        return self._json(404, {"ok": False, "error": "unknown endpoint"})

    def do_PATCH(self):
        p = urlparse(self.path).path
        if p != "/api/lead":
            return self._json(404, {"ok": False, "error": "unknown endpoint"})
        n = int(self.headers.get("Content-Length") or 0)
        try:
            b = json.loads(self._body(n).decode("utf-8"))
        except Exception:
            return self._json(400, {"ok": False, "error": "bad json"})
        fp = os.path.join(ROOT, "leads.json")
        try:
            leads = json.load(open(fp, encoding="utf-8"))
        except (OSError, ValueError):
            leads = []
        if b.get("delete"):
            leads = [x for x in leads if x.get("id") != b.get("id")]
        else:
            for x in leads:
                if x.get("id") == b.get("id"):
                    x["done"] = bool(b.get("done"))
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(leads, f, ensure_ascii=False, indent=2)
        return self._json(200, {"ok": True})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print("LLA dev server -> http://localhost:%d/   (admin: http://localhost:%d/admin)" % (port, port))
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
