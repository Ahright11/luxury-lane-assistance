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

/** Είναι ο χρήστης συνδεδεμένος; (το μυστικό είναι ο κωδικός του admin) */
export async function isAuthed(request, env) {
  const secret = env.ADMIN_PASS;
  if (!secret) return false;
  return checkToken(secret, readCookie(request, COOKIE));
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
  return makeToken(secret);
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

export const KV_KEY = 'content';
