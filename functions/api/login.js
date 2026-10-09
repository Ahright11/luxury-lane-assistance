import { json, isAuthed, login, cookieHeader, readCookie, COOKIE, failCount, failHit, failClear } from '../_lib.js';

/* ΟΡΙΟ ΠΡΟΣΠΑΘΕΙΩΝ
   Χωρίς αυτό, κάποιος μπορεί να δοκιμάζει κωδικούς ασταμάτητα.
   - 5 λάθος ανά IP σε 10' -> 429 μέχρι να περάσει το 10λεπτο
   - 40 λάθος συνολικά σε 10' -> 429 για όλους (επίθεση από πολλά IP)
   - κάθε λάθος κοστίζει 700ms, ώστε και χωρίς το όριο η μαντεψιά να είναι αργή
   Ο μετρητής ζει στη μνήμη του isolate (όχι στο KV: οι εγγραφές του KV είναι
   1.000/ημέρα και ένας επιτιθέμενος θα τις έκαιγε). */
const MAX_IP = 5, MAX_ALL = 40, WIN = 600000;
const wait = ms => new Promise(r => setTimeout(r, ms));

/* POST /api/login  { pass }   -> στήνει cookie σύνδεσης
   DELETE /api/login           -> αποσύνδεση
   GET  /api/login             -> { authed: true|false } */
export async function onRequestPost({ request, env }) {
  const ip = 'ip:' + (request.headers.get('CF-Connecting-IP') || 'x');
  if (failCount(ip, WIN) >= MAX_IP || failCount('all', WIN) >= MAX_ALL) {
    return json({ ok: false, error: 'Πολλές λάθος προσπάθειες. Δοκιμάστε ξανά σε 10 λεπτά.' }, 429, { 'Retry-After': '600' });
  }
  let pass = '';
  try { pass = (await request.json()).pass || ''; } catch { /* κενό */ }
  const token = await login(request, env, pass);
  if (!token) {
    failHit(ip); failHit('all');
    await wait(700);
    return json({ ok: false, error: 'Λάθος κωδικός' }, 401);
  }
  failClear(ip);
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(token) });
}

export async function onRequestGet({ request, env }) {
  return json({ authed: await isAuthed(request, env) });
}

export async function onRequestDelete({ request, env }) {
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(readCookie(request, COOKIE) || '', 0) });
}
