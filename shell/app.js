import { renderAboutSectionMarkup } from './routes/aboutSection.js?v=fece70dd24';
import { renderShellLayoutMarkup } from './layout/shellLayout.js?v=32889adb34';
import {
    createShellLoaderController,
    installGlobalShellLoader,
    runWithGlobalShellLoader
} from './loading/shellLoader.js?v=55923b6437';
import { syncShellRouteStyles } from './loading/routeStyles.js?v=b92e3a8d0b';
import {
    maybeNormalizeLegacyTopLevelRoute,
    resolveShellRoute,
    resolveTopLevelRoute
} from './routing/routeResolver.js?v=bd3cd1048e';

const sectionCache = {
    about: null,
    bonuses: null,
    cards: null,
    smith: null,
    tools: null
};
let shellLoader = null;

function ensureShellLayout() {
    const root = document.getElementById('shell-root');
    if (!root) return;
    if (document.getElementById('shell-route-host')) return;
    const initialMobileTitle = root.dataset.shellMobileTitle || 'Menu';
    root.innerHTML = renderShellLayoutMarkup(initialMobileTitle);
}

function ensureShellLoader() {
    if (!shellLoader) {
        shellLoader = createShellLoaderController();
        installGlobalShellLoader(shellLoader);
    }
    return shellLoader;
}

function currentBonusesMode(search = window.location.search) {
    const params = new URLSearchParams(search);
    return params.get('v') === 'i' ? 'item' : 'bonus';
}

function currentMobileTitle(routeId, search = window.location.search) {
    if (routeId === 'cards') return 'Cards';
    if (routeId === 'smith') return 'Smith';
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

function prepareRouteTransition() {
    resetShellMobileInlineActions();
    Object.values(sectionCache).forEach((cached) => {
        if (cached?.mount) {
            setDisplay(cached.mount, false);
        }
    });
    closeShellDrawer();
}

function currentSectionHandle(routeId) {
    if (routeId === 'cards') return sectionCache.cards?.handle ?? null;
    if (routeId === 'smith') return sectionCache.smith?.handle ?? null;
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
                        : target === 'smith'
                            ? routeId === 'smith'
                        : routeId === 'tools';
        node.classList.toggle('active', isActive);
    });
    setText('shell-mobile-title', currentMobileTitle(routeId, search));
}

function configureShellMobileSecondaryAction(routeId, search = window.location.search) {
    const button = document.getElementById('shell-mobile-secondary');
    const searchButton = document.getElementById('shell-mobile-search');
    if (!button) return;

    resetShellMobileInlineActions();
    currentSectionHandle(routeId)?.syncShellMobileActions?.();

    const bonusesMode = currentBonusesMode(search);
    const shouldShow = routeId === 'bonuses' && bonusesMode === 'bonus';
    const shouldShowSearch = routeId === 'bonuses' && (bonusesMode === 'bonus' || bonusesMode === 'item');
    setDisplay(button, shouldShow);
    button.onclick = null;
    if (searchButton) {
        setDisplay(searchButton, shouldShowSearch);
        searchButton.onclick = null;
    }

    if (shouldShowSearch && searchButton) {
        searchButton.onclick = (event) => {
            currentSectionHandle(routeId)?.toggleMobileSearchPopover?.(event);
        };
    }

    if (!shouldShow) return;

    button.onclick = (event) => {
        currentSectionHandle(routeId)?.toggleMobileSettings?.(event);
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
    const cacheKey = 'bonuses';
    if (sectionCache[cacheKey]) return sectionCache[cacheKey];
    const mount = createSectionMount();
    const section = { mount, handle: null };
    sectionCache[cacheKey] = section;
    ensureMountAttached(section);
    const { mountBonusesSection } = await import('/bonuses/app.js?v=ef51e06c0e');
    section.handle = await mountBonusesSection({
        container: mount,
        sectionKind: 'bonuses'
    });
    return section;
}

async function ensureToolsSection(search = window.location.search) {
    if (sectionCache.tools) return sectionCache.tools;
    const mount = createSectionMount();
    const section = { mount, handle: null };
    sectionCache.tools = section;
    ensureMountAttached(section);
    const { mountToolsSection } = await import('/tools/app.js?v=4c432caa16');
    section.handle = await mountToolsSection({
        container: mount,
        initialRouteState: search
    });
    return section;
}

async function ensureCardsSection(search = window.location.search) {
    if (sectionCache.cards) return sectionCache.cards;
    const mount = createSectionMount('cards-root cards-app-section');
    const section = { mount, handle: null };
    sectionCache.cards = section;
    ensureMountAttached(section);
    const { mountCardsSection, resolveCardsRouteState } = await import('/cards/app.js?v=0affc5e971');
    section.handle = await mountCardsSection({
        container: mount,
        initialRouteState: resolveCardsRouteState(search)
    });
    return section;
}

async function ensureSmithSection(search = window.location.search) {
    if (sectionCache.smith) return sectionCache.smith;
    const mount = createSectionMount('smith-root');
    const section = { mount, handle: null };
    sectionCache.smith = section;
    ensureMountAttached(section);
    const { mountSmithSection, resolveSmithRouteState } = await import('/smith/app.js?v=4538180b20');
    section.handle = await mountSmithSection({
        container: mount,
        initialRouteState: resolveSmithRouteState(search)
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
    return runWithGlobalShellLoader(async () => {
        prepareRouteTransition();
        syncShellRouteStyles(routeId);

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
                const { resolveCardsRouteState } = await import('/cards/app.js?v=0affc5e971');
                section.handle.updateRouteState?.(resolveCardsRouteState(search));
            }
            section.handle.refresh?.();
            attachMount(routeId, section);
            updateActiveNav(routeId, window.location.search);
            configureShellMobileSecondaryAction(routeId, window.location.search);
            return;
        }

        if (routeId === 'smith') {
            const section = await ensureSmithSection(search);
            if (restoreFromSectionState) {
                section.handle.restoreRoute?.();
            } else {
                const { resolveSmithRouteState } = await import('/smith/app.js?v=4538180b20');
                section.handle.updateRouteState?.(resolveSmithRouteState(search));
            }
            section.handle.refresh?.();
            attachMount(routeId, section);
            updateActiveNav(routeId, window.location.search);
            configureShellMobileSecondaryAction(routeId, window.location.search);
            return;
        }

        if (routeId === 'tools') {
            const section = await ensureToolsSection(search);
            if (restoreFromSectionState) {
                section.handle.restoreRoute?.();
            } else {
                section.handle.syncRouteState?.(search);
            }
            section.handle.refresh?.();
            attachMount(routeId, section);
            updateActiveNav(routeId, window.location.search);
            configureShellMobileSecondaryAction(routeId, window.location.search);
            return;
        }

        const section = await ensureBonusesSection(routeId);
        if (restoreFromSectionState) {
            await section.handle.activateShellRoute?.(routeKey ?? 'bonus');
        } else {
            section.handle.syncRouteState?.(search);
        }
        attachMount(routeId, section);
        updateActiveNav(routeId, window.location.search);
        configureShellMobileSecondaryAction(routeId, window.location.search);
    }, { immediate: true });
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
ensureShellLoader();
document.getElementById('shell-root')?.removeAttribute('data-shell-cloak');
installMobileDrawer();
installShellNavigation();
runWithGlobalShellLoader(() => syncFromLocation(), { immediate: true })
    .catch((error) => {
        console.error(error);
        const routeHost = host();
        if (routeHost) {
            routeHost.innerHTML = '<p style="color:#f88;padding:2rem;font-size:16px">Could not load the requested section.</p>';
        }
    });
