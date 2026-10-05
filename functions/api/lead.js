import { json, isAuthed, tooFast } from '../_lib.js';

/* Αιτήματα προσφοράς από τη σελίδα.
   POST   /api/lead          (δημόσιο — έρχεται από τη φόρμα του site)
   GET    /api/lead          (με σύνδεση — τα βλέπει μόνο ο διαχειριστής)
   PATCH  /api/lead          (με σύνδεση — {id, done} ή {id, delete:true}) */

const KEY = 'leads';
const MAX = 300;              // κρατάμε τα 300 τελευταία
const KEEP_DAYS = 180;        // και τίποτα παλιότερο από 180 ημέρες

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

async function load(env) {
  try {
    const raw = await env.LLA_KV.get(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export async function onRequestGet({ request, env }) {
  if (!(await isAuthed(request, env))) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env.LLA_KV) return json({ ok: false, error: 'missing KV binding' }, 500);
  const leads = await load(env);
  return json({ ok: true, leads, count: leads.length });
}

export async function onRequestPost({ request, env }) {
  if (!env.LLA_KV) return json({ ok: false }, 500);

  /* ΠΡΟΣΤΑΣΙΑ ΤΟΥ ΔΗΜΟΣΙΟΥ ENDPOINT
     Χωρίς αυτό, κάποιος μπορεί να πλημμυρίσει τα αιτήματα με σκουπίδια και να
     κάψει το ημερήσιο όριο εγγραφών του KV (1.000/ημέρα) — που θα εμπόδιζε
     τον πελάτη να αποθηκεύσει αλλαγές. */
  const ip = request.headers.get('CF-Connecting-IP') || 'x';
  if (tooFast(ip)) return json({ ok: false, error: 'too many' }, 429);

  let b;
  try { b = await request.json(); } catch { return json({ ok: false, error: 'bad json' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad body' }, 400);

  /* 1. Χρόνος: μια πραγματική φόρμα θέλει πάνω από ~1.5" να συμπληρωθεί.
        Τα bots στέλνουν αμέσως. Επίσης κόβει παλιά/ανακυκλωμένα payloads. */
  const t0 = Number(b.t0) || 0;
  const age = Date.now() - t0;
  if (!t0 || age < 1200 || age > 6 * 3600e3) return json({ ok: false, error: 'rejected' }, 400);

  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    at: new Date().toISOString(),
    name: clean(b.name, 80),
    service: clean(b.service, 60),
    vehicle: clean(b.vehicle, 80),
    moves: b.moves === '1' ? '1' : b.moves === '0' ? '0' : '',
    fault: clean(b.fault, 120),
    when: clean(b.when, 24),
    from: clean(b.from, 80),
    to: clean(b.to, 80),
    platform: ['whatsapp', 'viber', 'email'].includes(b.platform) ? b.platform : '',
    ua: clean(request.headers.get('User-Agent'), 80),
    done: false,
  };

  /* βασικός έλεγχος: θέλουμε όνομα και διαδρομή */
  if (!lead.name || (!lead.from && !lead.to)) return json({ ok: false, error: 'incomplete' }, 400);

  const leads = await load(env);

  /* ίδιο αίτημα ξανά σε <60" -> αγνόησέ το (διπλό κλικ / refresh) */
  const dup = leads.find(l => l.name === lead.name && l.from === lead.from && l.to === lead.to &&
    Date.now() - new Date(l.at).getTime() < 60000);
  if (dup) return json({ ok: true, duplicate: true });

  leads.unshift(lead);
  const cutoff = Date.now() - KEEP_DAYS * 864e5;
  const trimmed = leads.filter(l => new Date(l.at).getTime() > cutoff).slice(0, MAX);

  await env.LLA_KV.put(KEY, JSON.stringify(trimmed));
  return json({ ok: true, id: lead.id });
}

export async function onRequestPatch({ request, env }) {
  if (!(await isAuthed(request, env))) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env.LLA_KV) return json({ ok: false, error: 'missing KV binding' }, 500);

  let b;
  try { b = await request.json(); } catch { return json({ ok: false, error: 'bad json' }, 400); }
  const id = clean(b && b.id, 40);
  if (!id) return json({ ok: false, error: 'no id' }, 400);

  let leads = await load(env);
  const idx = leads.findIndex(l => l.id === id);
  if (idx === -1) return json({ ok: false, error: 'not found' }, 404);
  if (b.delete) leads.splice(idx, 1);
  else leads[idx] = { ...leads[idx], done: !!b.done };

  await env.LLA_KV.put(KEY, JSON.stringify(leads));
  return json({ ok: true, done: leads[idx] ? leads[idx].done : null });
}
