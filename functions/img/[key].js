/* GET /img/<key>        -> η εικόνα που ανέβηκε από το CMS (αποθηκευμένη στο KV).
   GET /img/<key>?w=800  -> μικρότερη εκδοχή της ίδιας εικόνας, ΑΝ υπάρχει.
                            Αν δεν υπάρχει, γυρίζει το πρωτότυπο — ποτέ σπασμένη εικόνα. */
const WIDTHS = ['800', '1280'];

export async function onRequestGet({ request, params, env }) {
  if (!env.LLA_KV) return new Response('not found', { status: 404 });
  const name = String(params.key || '');
  if (!name) return new Response('not found', { status: 404 });

  const w = new URL(request.url).searchParams.get('w');
  if (w && WIDTHS.includes(w)) {
    try {
      const v = await env.LLA_KV.getWithMetadata('img:' + name + '@' + w, { type: 'arrayBuffer' });
      if (v && v.value) {
        return new Response(v.value, {
          headers: {
            'Content-Type': (v.metadata && v.metadata.ct) || 'image/webp',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    } catch (e) { /* πέφτουμε στο πρωτότυπο */ }
  }

  const { value, metadata } = await env.LLA_KV.getWithMetadata('img:' + name, { type: 'arrayBuffer' });
  if (!value) return new Response('not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

  return new Response(value, {
    headers: {
      'Content-Type': (metadata && metadata.ct) || 'application/octet-stream',
      /* ζητήθηκε μικρή εκδοχή που δεν υπάρχει (ακόμα): σύντομο cache, ώστε όταν
         φτιαχτεί να τη δει ο browser. Το πρωτότυπο μένει «για πάντα». */
      'Cache-Control': w ? 'public, max-age=300' : 'public, max-age=31536000, immutable',
    },
  });
}
