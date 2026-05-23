export const TOP_LEVEL_ROUTES = Object.freeze({
    about: '/',
    bonuses: '/bonuses',
    cards: '/cards',
    smith: '/smith',
    tools: '/tools'
});

function normalizePathname(pathname = '/') {
    if (!pathname || pathname === '/') return '/';
    if (pathname === '/index.html') return '/';
    return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function resolveTopLevelRoute(pathname = '/') {
    const normalizedPath = normalizePathname(pathname);
    if (normalizedPath === '/bonuses') return 'bonuses';
    if (normalizedPath === '/cards') return 'cards';
    if (normalizedPath === '/smith') return 'smith';
    if (normalizedPath === '/tools') return 'tools';
    return 'about';
}

export function buildTopLevelHref(routeId) {
    return TOP_LEVEL_ROUTES[routeId] ?? TOP_LEVEL_ROUTES.about;
}

export function resolveShellRoute(routeKey) {
    if (routeKey === 'bonus') {
        return {
            routeId: 'bonuses',
            href: TOP_LEVEL_ROUTES.bonuses
        };
    }
    if (routeKey === 'item') {
        return {
            routeId: 'bonuses',
            href: `${TOP_LEVEL_ROUTES.bonuses}?v=i`
        };
    }
    if (routeKey === 'cards') {
        return {
            routeId: 'cards',
            href: TOP_LEVEL_ROUTES.cards
        };
    }
    if (routeKey === 'smith') {
        return {
            routeId: 'smith',
            href: TOP_LEVEL_ROUTES.smith
        };
    }
    if (routeKey === 'tools') {
        return {
            routeId: 'tools',
            href: TOP_LEVEL_ROUTES.tools
        };
    }
    return {
        routeId: 'about',
        href: TOP_LEVEL_ROUTES.about
    };
}

export function maybeNormalizeLegacyTopLevelRoute(urlLike) {
    const url = new URL(urlLike.toString(), 'https://evitania.local');
    const route = resolveTopLevelRoute(url.pathname);
    if (route === 'bonuses' && url.searchParams.get('v') === 'cards') {
        url.pathname = TOP_LEVEL_ROUTES.cards;
        url.searchParams.delete('v');
        return url.pathname + url.search + url.hash;
    }
    if (route === 'bonuses' && url.searchParams.get('v') === 'c') {
        url.pathname = TOP_LEVEL_ROUTES.tools;
        return url.pathname + url.search + url.hash;
    }
    return null;
}
