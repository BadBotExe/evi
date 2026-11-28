import { renderLanguageSelect } from '../lib/siteLanguage.js?v=b33fdc6848';

export function renderShellLayoutMarkup(initialMobileTitle = 'Menu') {
    return `
    <header id="shell-shared-header" class="app-header">
        <div class="app-header-inner">
            <div class="mobile-header-bar">
                <button id="shell-mobile-open" class="mobile-header-burger" type="button" aria-label="Open menu" data-i18n-aria-label="shell.openMenu">&#9776;</button>
                <div id="shell-mobile-title" class="mobile-header-title">${initialMobileTitle}</div>
                <button id="shell-mobile-search"
                        class="mobile-settings-btn mobile-header-search-btn shell-hidden"
                        type="button"
                        aria-label="Open search" data-i18n-aria-label="shell.openSearch">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 .53 1.28L14.5 13.56v4.19a.75.75 0 0 1-.33.62l-3 2A.75.75 0 0 1 10 19.75v-6.19L3.22 7.28A.75.75 0 0 1 3 6.75Z" fill="currentColor"/></svg>
                    <span id="shell-mobile-search-badge" class="mobile-header-btn-badge shell-hidden"></span>
                </button>
                <div id="shell-mobile-inline-actions" class="mobile-header-inline-actions shell-hidden"></div>
                <button id="shell-mobile-secondary"
                        class="mobile-settings-btn mobile-header-settings-btn shell-hidden"
                        type="button"
                        aria-label="Open page settings" data-i18n-aria-label="shell.openSettings">&#9881;</button>
            </div>
            <nav class="app-nav">
                <a class="app-nav-link" data-shell-route="about" href="/" data-i18n="nav.about">About</a>
                <a class="app-nav-link" data-shell-route="bonus" href="/bonuses" data-i18n="nav.bonus">Bonuses</a>
                <a class="app-nav-link" data-shell-route="item" href="/bonuses?v=i" data-i18n="nav.item">Items and Stats</a>
                <a class="app-nav-link" data-shell-route="catalog" href="/items" data-i18n="nav.catalog">Item Catalog</a>
                <a class="app-nav-link" data-shell-route="cards" href="/cards" data-i18n="nav:cards">Cards</a>
                <a class="app-nav-link" data-shell-route="smith" href="/smith" data-i18n="nav:smith">Smithing</a>
                <a class="app-nav-link" data-shell-route="tools" href="/tools" data-i18n="nav.tools">Calculators</a>
            </nav>
            ${renderLanguageSelect('site-language-desktop')}
            <a class="app-nav-link app-nav-report" href="https://github.com/badbotexe/evi/issues/new" target="_blank" data-i18n="shell.report">Report Issue</a>
        </div>
    </header>

    <main id="shell-route-host"></main>
    <div id="shell-loader" class="shell-loader" aria-hidden="true">
        <div class="shell-loader-panel">
            <div id="shell-loader-frame-host" class="shell-loader-frame-host" aria-hidden="true"></div>
            <div data-i18n="shell.loading" class="shell-loader-label">Loading</div>
        </div>
    </div>

    <div id="shell-mobile-drawer-overlay" class="mobile-drawer-overlay"></div>
    <div id="shell-mobile-drawer" class="mobile-drawer">
        ${renderDrawerHeader({ closeAttributes: ' id="shell-mobile-close"', titleAttributes: ' data-i18n="shell.navigation"', title: 'Navigation' })}
        <div class="mobile-drawer-body">
            <div class="mobile-drawer-nav">
                <a class="mobile-drawer-nav-btn" data-shell-route="about" href="/" data-i18n="nav.about">About</a>
                <a class="mobile-drawer-nav-btn" data-shell-route="bonus" href="/bonuses" data-i18n="nav.bonus">Bonuses</a>
                <a class="mobile-drawer-nav-btn" data-shell-route="item" href="/bonuses?v=i" data-i18n="nav.item">Items and Stats</a>
                <a class="mobile-drawer-nav-btn" data-shell-route="catalog" href="/items" data-i18n="nav.catalog">Item Catalog</a>
                <a class="mobile-drawer-nav-btn" data-shell-route="cards" href="/cards" data-i18n="nav:cards">Cards</a>
                <a class="mobile-drawer-nav-btn" data-shell-route="smith" href="/smith" data-i18n="nav:smith">Smithing</a>
                <a class="mobile-drawer-nav-btn" data-shell-route="tools" href="/tools" data-i18n="nav.tools">Calculators</a>
            </div>
            ${renderLanguageSelect('site-language-mobile')}
            <a class="mobile-drawer-report" href="https://github.com/badbotexe/evi/issues/new" target="_blank" data-i18n="shell.reportMobile">Report an Issue</a>
        </div>
    </div>
`;
}

const CLOSE_POPOVER_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8m0-8-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function renderDrawerHeader({ closeAttributes = '', titleAttributes = '', title = '', closeIcon = '&times;' }) {
    return `<div class="mobile-drawer-header">
            <div class="mobile-drawer-handle"></div>
            <button${closeAttributes} class="mobile-drawer-close" type="button">${closeIcon}</button>
            <div class="mobile-drawer-title"${titleAttributes}>${title}</div>
        </div>`;
}

let activeTextPopover;

export function closeShellTextPopover(restoreFocus = false) {
    activeTextPopover?.close(restoreFocus);
}

export function toggleShellTextPopover(trigger, { title, text, closeLabel }) {
    const alreadyOpen = activeTextPopover?.trigger === trigger;
    closeShellTextPopover();
    if (alreadyOpen) return;

    const viewport = window.matchMedia('(max-width: 900px)');
    const mobile = viewport.matches;
    const panel = document.createElement('div');
    panel.className = mobile ? 'mobile-drawer item-sheet' : 'item-popover floating-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', title);
    panel.innerHTML = mobile
        ? renderDrawerHeader({ closeIcon: CLOSE_POPOVER_ICON })
        : `<div class="popover-header"><span></span><button type="button" class="popover-close">${CLOSE_POPOVER_ICON}</button></div>`;
    const heading = panel.querySelector(mobile ? '.mobile-drawer-title' : '.popover-header span');
    heading.textContent = title;
    const closeButton = panel.querySelector('button');
    closeButton.setAttribute('aria-label', closeLabel);

    const body = document.createElement('div');
    body.className = mobile ? 'mobile-drawer-body' : 'shell-text-popover-body';
    body.textContent = text;
    panel.append(body);

    const overlay = mobile ? document.createElement('div') : null;
    if (overlay) {
        overlay.className = 'mobile-drawer-overlay open';
        document.body.append(overlay);
    }
    document.body.append(panel);
    if (mobile) {
        // Resolve the closed position before starting the shared drawer transition.
        panel.getBoundingClientRect();
        panel.classList.add('open');
    } else {
        panel.classList.add('shell-text-popover');
        positionShellTextPopover(panel, trigger);
    }

    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    activeTextPopover = {
        trigger,
        close(restoreFocus) {
            activeTextPopover = null;
            listeners.abort();
            overlay?.remove();
            panel.remove();
            trigger.setAttribute('aria-expanded', 'false');
            if (restoreFocus) trigger.focus();
        }
    };
    trigger.setAttribute('aria-expanded', 'true');
    closeButton.addEventListener('click', () => closeShellTextPopover(true), options);
    overlay?.addEventListener('click', () => closeShellTextPopover(true), options);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeShellTextPopover(true);
    }, options);
    if (!mobile) {
        document.addEventListener('pointerdown', event => {
            if (!panel.contains(event.target) && !trigger.contains(event.target)) closeShellTextPopover();
        }, options);
        window.addEventListener('resize', () => positionShellTextPopover(panel, trigger), options);
    }
    viewport.addEventListener('change', () => closeShellTextPopover(), options);
    closeButton.focus({ preventScroll: true });
}

function positionShellTextPopover(panel, trigger) {
    const anchor = trigger.getBoundingClientRect();
    const rightLimit = window.innerWidth - panel.offsetWidth - 8;
    const bottomLimit = window.innerHeight - panel.offsetHeight - 8;
    panel.style.left = Math.max(8, Math.min(anchor.left, rightLimit)) + 'px';
    panel.style.top = Math.max(8, Math.min(anchor.bottom + 8, bottomLimit)) + 'px';
}
