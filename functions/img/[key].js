/* GET /img/<key> -> σερβίρει εικόνα που ανέβηκε από το CMS (αποθηκευμένη στο KV). */
export async function onRequestGet({ params, env }) {
  if (!env.LLA_KV) return new Response('not found', { status: 404 });
  const key = 'img:' + String(params.key || '');
  if (!key || key === 'img:') return new Response('not found', { status: 404 });

  const { value, metadata } = await env.LLA_KV.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!value) return new Response('not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

  return new Response(value, {
    headers: {
      'Content-Type': (metadata && metadata.ct) || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
