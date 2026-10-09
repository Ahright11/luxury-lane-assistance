#!/bin/sh
# Φτιάχνει το preview.html από το index.html + preview.css + preview.js.
# Το index.html δεν αλλάζει. Τοπικά μόνο: ./dev-server.py  ->  http://localhost:8080/preview.html
# Περιεχόμενο: preview-content.json (αντίγραφο του live), φωτογραφίες: assets/uploads/
set -e
cd "$(dirname "$0")"
python3 - <<'PY'
s=open('index.html',encoding='utf-8').read()
assert s.count('</head>')==1 and s.count('<body>')==1 and s.count('</body>')==1
V=str(int(__import__('time').time()))
s=s.replace('</head>','<link rel="stylesheet" href="preview.css?v='+V+'">\n<meta name="robots" content="noindex">\n</head>')
# τοπικά: το περιεχόμενο έρχεται από το αντίγραφο του live, όχι από το fallback content.json
s=s.replace('<body>','<body>\n<script>(function(){var f=window.fetch;window.fetch=function(u,o){if(typeof u==="string"&&/^api\\/content/.test(u))u="preview-content.json";return f.call(this,u,o)}})();</script>')
s=s.replace('</body>','<script src="preview.js?v='+V+'"></script>\n</body>')
open('preview.html','w',encoding='utf-8').write(s)
print('preview.html ok')
PY
