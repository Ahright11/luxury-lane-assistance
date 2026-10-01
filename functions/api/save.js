import { json, isAuthed, sane, KV_KEY } from '../_lib.js';

/* POST /api/save  { content: {...} }  -> γράφει το περιεχόμενο στο KV.
   Χρειάζεται σύνδεση με κωδικό (cookie). */
export async function onRequestPost({ request, env }) {
  if (!(await isAuthed(request, env))) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }
  if (!env.LLA_KV) {
    return json({ ok: false, error: 'missing KV binding' }, 500);
  }

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad json' }, 400); }
  const raw = JSON.stringify(body && body.content);
  if (!sane(raw)) return json({ ok: false, error: 'invalid content' }, 400);

  await env.LLA_KV.put(KV_KEY, raw);
  return json({ ok: true, savedAt: new Date().toISOString(), bytes: raw.length });
}
