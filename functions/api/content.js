import { json, KV_KEY } from '../_lib.js';

/* GET /api/content -> το περιεχόμενο της σελίδας.
   Πρώτα το KV (ό,τι έχει αποθηκεύσει ο πελάτης), αλλιώς το content.json του deployment. */
export async function onRequestGet({ request, env }) {
  if (env.LLA_KV) {
    try {
      const stored = await env.LLA_KV.get(KV_KEY);
      if (stored && stored.trim().startsWith('{')) {
        return new Response(stored, {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            // σύντομο cache στην άκρη: αλλαγές φαίνονται σε ~30"
            'Cache-Control': 'public, max-age=0, s-maxage=30',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch (e) {
      /* πέφτουμε στο προεπιλεγμένο αρχείο */
    }
  }

  const url = new URL(request.url);
  url.pathname = '/content.json';
  url.search = '';
  const res = await env.ASSETS.fetch(new Request(url.toString(), { headers: request.headers }));
  const out = new Response(res.body, res);
  out.headers.set('Content-Type', 'application/json; charset=utf-8');
  out.headers.set('Cache-Control', 'public, max-age=0, s-maxage=30');
  out.headers.set('Access-Control-Allow-Origin', '*');
  return out;
}

export async function onRequestOptions() {
  return json({}, 200, { 'Access-Control-Allow-Methods': 'GET, OPTIONS' });
}
