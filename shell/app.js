import { renderAboutSectionMarkup } from './routes/aboutSection.js?v=47860ff5ab';
import { renderShellLayoutMarkup } from './layout/shellLayout.js?v=fde251c4be';
import {
    maybeNormalizeLegacyTopLevelRoute,
    resolveShellRoute,
    resolveTopLevelRoute
} from './routing/routeResolver.js?v=3423744c01';

const sectionCache = {
    about: null,
    bonuses: null,
    cards: null,
    tools: null
};

function ensureShellLayout() {
    const root = document.getElementById('shell-root');
    if (!root) return;
    if (document.getElementById('shell-route-host')) return;
    const initialMobileTitle = root.dataset.shellMobileTitle || 'Menu';
    root.innerHTML = renderShellLayoutMarkup(initialMobileTitle);
}

function currentBonusesMode(search = window.location.search) {
    const params = new URLSearchParams(search);
    return params.get('v') === 'i' ? 'item' : 'bonus';
}

function currentMobileTitle(routeId, search = window.location.search) {
    if (routeId === 'cards') return 'Cards';
    if (routeId === 'tools') return 'Calculators';
    if (routeId === 'bonuses') {
        return currentBonusesMode(search) === 'item' ? 'Items and Stats' : 'Bonuses';
    }
    return 'Menu';
}

function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
}

function setDisplay(node, visible) {
    if (!node) return;
    node.classList.toggle('shell-hidden', !visible);
}

function resetShellMobileInlineActions() {
    const slot = document.getElementById('shell-mobile-inline-actions');
    if (!slot) return;
    slot.classList.remove('cards-shell-inline-actions-visible');
    setDisplay(slot, false);
}

function currentSectionHandle(routeId) {
    if (routeId === 'cards') return sectionCache.cards?.handle ?? null;
    if (routeId === 'tools') return sectionCache.tools?.handle ?? null;
    if (routeId === 'bonuses') return sectionCache.bonuses?.handle ?? null;
    return null;
}

function closeShellDrawer() {
    document.getElementById('shell-mobile-drawer-overlay')?.classList.remove('open');
    document.getElementById('shell-mobile-drawer')?.classList.remove('open');
}

function updateActiveNav(routeId, search = window.location.search) {
    const bonusesMode = currentBonusesMode(search);
    document.querySelectorAll('[data-shell-route]').forEach((node) => {
        const target = node.dataset.shellRoute;
        const isActive = target === 'about'
            ? routeId === 'about'
            : target === 'bonus'
                ? routeId === 'bonuses' && bonusesMode === 'bonus'
                : target === 'item'
                    ? routeId === 'bonuses' && bonusesMode === 'item'
                    : target === 'cards'
                        ? routeId === 'cards'
                        : routeId === 'tools';
        node.classList.toggle('active', isActive);
    });
    setText('shell-mobile-title', currentMobileTitle(routeId, search));
}

function configureShellMobileSecondaryAction(routeId, search = window.location.search) {
    const button = document.getElementById('shell-mobile-secondary');
    if (!button) return;

    resetShellMobileInlineActions();

    const bonusesMode = currentBonusesMode(search);
    const shouldShow = routeId === 'bonuses' && bonusesMode === 'bonus';
    setDisplay(button, shouldShow);
    button.onclick = null;

    if (routeId === 'cards') {
        currentSectionHandle(routeId)?.syncShellMobileActions?.();
        return;
    }

    if (!shouldShow) return;

    button.onclick = () => {
        currentSectionHandle(routeId)?.openMobileSettings?.();
    };
}

function createSectionMount(className = '') {
    const mount = document.createElement('div');
    if (className) mount.className = className;
    mount.classList.add('shell-hidden');
    return mount;
}

function ensureAboutSection() {
    if (sectionCache.about) return sectionCache.about;
    const mount = createSectionMount();
    mount.innerHTML = renderAboutSectionMarkup();
    sectionCache.about = { mount };
    return sectionCache.about;
}

async function ensureBonusesSection(routeId) {
    const cacheKey = routeId === 'tools' ? 'tools' : 'bonuses';
    if (sectionCache[cacheKey]) return sectionCache[cacheKey];
    const mount = createSectionMount();
    const section = { mount, handle: null };
    sectionCache[cacheKey] = section;
    ensureMountAttached(section);
    const { mountBonusesSection } = await import('/bonuses/app.js?v=767748bb27');
    section.handle = await mountBonusesSection({
        container: mount,
        sectionKind: cacheKey === 'tools' ? 'tools' : 'bonuses'
    });
    return section;
}

async function ensureCardsSection(search = window.location.search) {
    if (sectionCache.cards) return sectionCache.cards;
    const mount = createSectionMount('cards-root cards-app-section');
    const section = { mount, handle: null };
    sectionCache.cards = section;
    ensureMountAttached(section);
    const { mountCardsSection, resolveCardsRouteState } = await import('/cards/app.js?v=cdb380a8d9');
    section.handle = await mountCardsSection({
        container: mount,
        initialRouteState: resolveCardsRouteState(search)
    });
    return section;
}

function host() {
    return document.getElementById('shell-route-host');
}

function ensureMountAttached(section) {
    const routeHost = host();
    if (section?.mount && routeHost && !routeHost.contains(section.mount)) {
        routeHost.appendChild(section.mount);
    }
}

function attachMount(routeId, section) {
    ensureMountAttached(section);
    Object.entries(sectionCache).forEach(([, cached]) => {
        if (cached?.mount) {
            setDisplay(cached.mount, cached === section);
        }
    });

    const rootHeader = document.getElementById('shell-shared-header');
    const drawerOverlay = document.getElementById('shell-mobile-drawer-overlay');
    const drawer = document.getElementById('shell-mobile-drawer');
    setDisplay(rootHeader, true);
    setDisplay(drawerOverlay, true);
    setDisplay(drawer, true);
    closeShellDrawer();
}

async function activateRoute(routeId, {
    search = window.location.search,
    routeKey = null,
    restoreFromSectionState = false
} = {}) {
    if (routeId === 'about') {
        const section = ensureAboutSection();
        attachMount(routeId, section);
        updateActiveNav(routeId, search);
        configureShellMobileSecondaryAction(routeId, search);
        return;
    }

    if (routeId === 'cards') {
        const section = await ensureCardsSection(search);
        if (restoreFromSectionState) {
            section.handle.restoreRoute?.();
        } else {
            const { resolveCardsRouteState } = await import('/cards/app.js?v=cdb380a8d9');
            section.handle.updateRouteState?.(resolveCardsRouteState(search));
        }
        section.handle.refresh?.();
        attachMount(routeId, section);
        updateActiveNav(routeId, window.location.search);
        configureShellMobileSecondaryAction(routeId, window.location.search);
        return;
    }

    const section = await ensureBonusesSection(routeId);
    if (restoreFromSectionState) {
        await section.handle.activateShellRoute?.(routeKey ?? (routeId === 'tools' ? 'tools' : 'bonus'));
    } else {
        section.handle.syncRouteState?.(search);
    }
    attachMount(routeId, section);
    updateActiveNav(routeId, window.location.search);
    configureShellMobileSecondaryAction(routeId, window.location.search);
}

async function syncFromLocation() {
    const normalized = maybeNormalizeLegacyTopLevelRoute(window.location.href);
    if (normalized) {
        history.replaceState(null, '', normalized);
    }
    const routeId = resolveTopLevelRoute(window.location.pathname);
    await activateRoute(routeId, { search: window.location.search });
}

async function navigate(path) {
    const target = new URL(path, window.location.origin);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const next = `${target.pathname}${target.search}${target.hash}`;
    if (current !== next) {
        history.pushState(null, '', next);
    }
    closeShellDrawer();
    await syncFromLocation();
}

async function navigateToRoute(routeKey) {
    const targetRoute = resolveShellRoute(routeKey);
    const target = new URL(targetRoute.href, window.location.origin);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const next = `${target.pathname}${target.search}${target.hash}`;
    if (current !== next) {
        history.pushState(null, '', next);
    }
    closeShellDrawer();
    await activateRoute(targetRoute.routeId, {
        search: target.search,
        routeKey,
        restoreFromSectionState: true
    });
}

function installShellNavigation() {
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[data-shell-link], a[data-shell-route]');
        if (!link) return;
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (link.dataset.shellRoute) {
            navigateToRoute(link.dataset.shellRoute).catch((error) => console.error(error));
            return;
        }
        const href = link.getAttribute('href');
        if (!href) return;
        navigate(href).catch((error) => console.error(error));
    });

    window.addEventListener('popstate', () => {
        syncFromLocation().catch((error) => console.error(error));
    });
}

function installMobileDrawer() {
    const overlay = document.getElementById('shell-mobile-drawer-overlay');
    const drawer = document.getElementById('shell-mobile-drawer');
    const openButton = document.getElementById('shell-mobile-open');
    const closeButton = document.getElementById('shell-mobile-close');
    if (!overlay || !drawer || !openButton || !closeButton) return;

    const close = () => closeShellDrawer();
    openButton.addEventListener('click', () => {
        overlay.classList.add('open');
        drawer.classList.add('open');
    });
    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', close);
    drawer.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', close);
    });
}

window.EvitaniaShell = {
    navigate,
    navigateToRoute
};

ensureShellLayout();
installMobileDrawer();
installShellNavigation();
syncFromLocation()
    .catch((error) => {
        console.error(error);
        const routeHost = host();
        if (routeHost) {
            routeHost.innerHTML = '<p style="color:#f88;padding:2rem;font-size:16px">Could not load the requested section.</p>';
        }
    })
    .finally(() => {
        document.getElementById('shell-root')?.removeAttribute('data-shell-cloak');
    });
