import { json, isAuthed, login, cookieHeader, readCookie, COOKIE } from '../_lib.js';

/* POST /api/login  { pass }   -> στήνει cookie σύνδεσης
   DELETE /api/login           -> αποσύνδεση
   GET  /api/login             -> { authed: true|false } */
export async function onRequestPost({ request, env }) {
  let pass = '';
  try { pass = (await request.json()).pass || ''; } catch { /* κενό */ }
  const token = await login(request, env, pass);
  if (!token) return json({ ok: false, error: 'Λάθος κωδικός' }, 401);
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(token) });
}

export async function onRequestGet({ request, env }) {
  return json({ authed: await isAuthed(request, env) });
}

export async function onRequestDelete({ request, env }) {
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(readCookie(request, COOKIE) || '', 0) });
}
