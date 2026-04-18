export async function onRequest(context) {
  const url = new URL(context.request.url);

  // TEMP: return pathname so we can see what it is
  return new Response('PATH: ' + url.pathname, { status: 200 });
}