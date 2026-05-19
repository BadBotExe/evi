export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');

  const htmlPaths = ['', '/index.html', '/bonuses', '/bonuses/index.html',
    '/cards', '/cards/index.html', '/tools', '/tools/index.html'];

  const response = await next();

  if (!htmlPaths.includes(path)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  // Явно сбрасываем Cloudflare edge cache
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}