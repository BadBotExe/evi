const ROUTE_STYLE_LINK_ID = 'shell-route-style';

const ROUTE_STYLE_HREFS = Object.freeze({
    bonuses: '/bonuses/style.css?v=a4c5a91396',
    cards: '/cards/style.css?v=1192e6f5ef',
    smith: '/smith/style.css?v=1391ddc967',
    tools: '/tools/style.css?v=705c694aa7'
});

function resolveRouteStyleHref(routeId) {
    return ROUTE_STYLE_HREFS[routeId] ?? null;
}

function findManagedRouteStyleLink(doc) {
    return doc?.getElementById?.(ROUTE_STYLE_LINK_ID) ?? null;
}

function ensureRouteStyleLink(doc) {
    const existing = findManagedRouteStyleLink(doc);
    if (existing) return existing;
    if (typeof doc?.createElement !== 'function') return null;
    const link = doc.createElement('link');
    link.id = ROUTE_STYLE_LINK_ID;
    link.rel = 'stylesheet';
    doc.head?.appendChild?.(link);
    return link;
}

export function syncShellRouteStyles(routeId, doc = globalThis.document) {
    const targetHref = resolveRouteStyleHref(routeId);
    const existing = findManagedRouteStyleLink(doc);

    if (!targetHref) {
        existing?.remove?.();
        return null;
    }

    const link = existing ?? ensureRouteStyleLink(doc);
    if (!link) return null;
    if (link.getAttribute?.('href') === targetHref) return link;
    link.setAttribute?.('href', targetHref);
    return link;
}

export function getShellRouteStyleHref(routeId) {
    return resolveRouteStyleHref(routeId);
}
