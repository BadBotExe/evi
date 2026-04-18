export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // only intercept the main HTML page
  const p = url.pathname.replace(/\/$/, ''); // strip trailing slash
  if (p !== '/cards' && p !== '/cards/index.html') {
    return next();
  }

  const cardId = url.searchParams.get('card');
  const mode   = url.searchParams.get('mode') ?? 'normal';
  const stars  = url.searchParams.get('stars') ?? '0';

  // fetch cards.json to look up the card name and image
  const jsonUrl = new URL('/cards/cards.json', url.origin);
  const json = await fetch(jsonUrl).then(r => r.json()).catch(() => null);

  let title       = 'Evitania';
  let description = 'Evitania Card Viewer';
  let image       = '';

  if (json && cardId) {
    for (const cat of json.categories) {
      const card = cat.cards.find(c => c.id === cardId);
      if (card) {
        const modeName = mode.charAt(0).toUpperCase() + mode.slice(1);
        title       = `Evitania - ${card.name}`;
        description = `${card.name} | ${modeName} | ${'*'.repeat(parseInt(stars)) || '0*'}`;
        image       = card.image_card
          ? new URL(card.image_card, url.origin).href
          : '';
        break;
      }
    }
  }

  const ogTags = `
    <meta property="og:site_name" content="Evitania" />
    <meta property="og:title"       content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image"       content="${image}" />
    <meta property="og:url"         content="${url.href}" />
    <meta name="twitter:card"       content="summary_large_image" />
    <meta name="twitter:title"      content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image"      content="${image}" />
  `;

  class HeadHandler {
    element(el) {
      el.prepend(`<title>${title}</title>`, { html: true });
      el.append(ogTags, { html: true });
    }
  }

  // remove the static <title> tag so it doesn't appear twice
  class TitleHandler {
    element(el) { el.remove(); }
  }

  const response = await next();
  return new HTMLRewriter()
    .on('title', new TitleHandler())
    .on('head',  new HeadHandler())
    .transform(response);
}