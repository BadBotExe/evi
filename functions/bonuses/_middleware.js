export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');

  if (path !== '/bonuses' && path !== '/bonuses/index.html') {
    return next();
  }

  const response = await next();
  const headers = new Headers(response.headers);

  // Always revalidate the HTML shell so clients discover new asset versions.
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
