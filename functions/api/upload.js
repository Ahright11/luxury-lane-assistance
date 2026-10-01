import { json, isAuthed } from '../_lib.js';

const MAX = 12 * 1024 * 1024; // 12MB

/* POST /api/upload?name=foo.jpg  (raw body) -> αποθηκεύει εικόνα στο KV, γυρίζει το /img/... path */
export async function onRequestPost({ request, env }) {
  if (!(await isAuthed(request, env))) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env.LLA_KV) return json({ ok: false, error: 'missing KV binding' }, 500);

  const url = new URL(request.url);
  const raw = url.searchParams.get('name') || 'image.jpg';
  const ext = (raw.match(/\.(jpe?g|png|webp|avif|gif|svg)$/i) || ['.jpg'])[0].toLowerCase();
  const base = raw.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';
  const key = 'img:' + Date.now() + '-' + base + ext;

  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return json({ ok: false, error: 'empty file' }, 400);
  if (buf.byteLength > MAX) return json({ ok: false, error: 'το αρχείο είναι πολύ μεγάλο (max 12MB)' }, 413);

  const ct = request.headers.get('Content-Type') || mime(ext);
  await env.LLA_KV.put(key, buf, { metadata: { ct } });
  return json({ ok: true, path: '/img/' + encodeURIComponent(key.slice(4)), bytes: buf.byteLength });
}

function mime(ext) {
  return { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream';
}
