import { renderLanguageSelect } from '../lib/siteLanguage.js?v=37d23cc251';

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
        <div class="mobile-drawer-header">
            <div class="mobile-drawer-handle"></div>
            <button id="shell-mobile-close" class="mobile-drawer-close" type="button">&times;</button>
            <div class="mobile-drawer-title" data-i18n="shell.navigation">Navigation</div>
        </div>
        <div class="mobile-drawer-body">
            <div class="mobile-drawer-nav">
                <a class="mobile-drawer-nav-btn" data-shell-route="about" href="/" data-i18n="nav.about">About</a>
                <a class="mobile-drawer-nav-btn" data-shell-route="bonus" href="/bonuses" data-i18n="nav.bonus">Bonuses</a>
                <a class="mobile-drawer-nav-btn" data-shell-route="item" href="/bonuses?v=i" data-i18n="nav.item">Items and Stats</a>
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
