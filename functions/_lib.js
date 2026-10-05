/* Κοινόχρηστα helpers για τα Pages Functions του LLA CMS.
   (τα αρχεία με πρόθεμα _ δεν γίνονται routes) */

const enc = new TextEncoder();

export const COOKIE = 'lla_sess';

function b64url(bytes) {
  let s = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/* Το κλειδί υπογραφής δεν είναι ο ίδιος ο κωδικός: βγαίνει από HMAC(salt, κωδικός)
   όπου το salt είναι τυχαίο και μένει στο KV. Έτσι:
   - αλλαγή κωδικού ακυρώνει όλες τις συνδέσεις (καλό)
   - ένα κλεμμένο cookie ΔΕΝ επιτρέπει offline μαντεψιά του κωδικού,
     γιατί ο επιτιθέμενος δεν ξέρει το salt */
let SKEY_CACHE = null;
export async function signingKey(env) {
  if (SKEY_CACHE) return SKEY_CACHE;
  let salt = null;
  try { salt = await env.LLA_KV.get('_skey'); } catch (e) { throw new Error('no kv'); }
  if (!salt) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    salt = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
    try { await env.LLA_KV.put('_skey', salt); } catch (e) { /* ignore */ }
  }
  SKEY_CACHE = await hmac(salt, env.ADMIN_PASS);
  return SKEY_CACHE;
}

/** Δημιουργεί session token: <expiry>.<υπογραφή> */
export async function makeToken(secret, days = 30) {
  const exp = Date.now() + days * 864e5;
  return exp + '.' + (await hmac(secret, String(exp)));
}

/** Ελέγχει το session token (χρονικό όριο + υπογραφή, constant-time). */
export async function checkToken(secret, token) {
  if (!token || typeof token !== 'string') return false;
  const i = token.indexOf('.');
  if (i < 1) return false;
  const exp = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const want = await hmac(secret, exp);
  if (want.length !== sig.length) return false;
  let diff = 0;
  for (let k = 0; k < want.length; k++) diff |= want.charCodeAt(k) ^ sig.charCodeAt(k);
  return diff === 0;
}

export function readCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** Είναι ο χρήστης συνδεδεμένος; */
export async function isAuthed(request, env) {
  if (!env.ADMIN_PASS) return false;
  let key;
  try { key = await signingKey(env); } catch (e) { return false }
  return checkToken(key, readCookie(request, COOKIE));
}

/** Είσοδος με κωδικό πρόσβασης. */
export async function login(request, env, pass) {
  const secret = env.ADMIN_PASS;
  if (!secret || typeof pass !== 'string' || !pass) return null;
  // constant-time σύγκριση
  const a = enc.encode(pass), b = enc.encode(secret);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  if (diff !== 0) return null;
  let key;
  try { key = await signingKey(env); } catch (e) { return null }
  return makeToken(key);
}

export function cookieHeader(token, maxAge = 30 * 86400) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

/** Πολύ απλός έλεγχος δομής περιεχομένου πριν την αποθήκευση. */
export function sane(raw) {
  if (typeof raw !== 'string' || raw.length > 400_000) return false;
  let c;
  try { c = JSON.parse(raw); } catch { return false; }
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  for (const k of ['hero', 'about', 'contact', 'coverage', 'end']) {
    if (c[k] != null && typeof c[k] !== 'object') return false;
  }
  for (const k of ['services', 'process', 'reviews', 'why']) {
    if (c[k] != null && !Array.isArray(c[k])) return false;
  }
  return true;
}

/* Απλό όριο συχνότητας στη μνήμη της κάθε διεργασίας (isolate).
   Δεν είναι τέλειο, αλλά κόβει τις πλημμύρες πριν γράψουν στο KV. */
const HITS = new Map();
export function tooFast(ip, max = 6, winMs = 60000) {
  const now = Date.now();
  if (HITS.size > 5000) HITS.clear();
  const arr = (HITS.get(ip) || []).filter(t => now - t < winMs);
  arr.push(now);
  HITS.set(ip, arr);
  return arr.length > max;
}

export const KV_KEY = 'content';
