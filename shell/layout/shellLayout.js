export function renderShellLayoutMarkup(initialMobileTitle = 'Menu') {
    return `
    <header id="shell-shared-header" class="app-header">
        <div class="app-header-inner">
            <div class="mobile-header-bar">
                <button id="shell-mobile-open" class="mobile-header-burger" type="button" aria-label="Open menu">&#9776;</button>
                <div id="shell-mobile-title" class="mobile-header-title">${initialMobileTitle}</div>
                <div id="shell-mobile-inline-actions" class="mobile-header-inline-actions shell-hidden"></div>
                <button id="shell-mobile-secondary"
                        class="mobile-settings-btn mobile-header-settings-btn shell-hidden"
                        type="button"
                        aria-label="Open page settings">&#9881;</button>
            </div>
            <nav class="app-nav">
                <a class="app-nav-link" data-shell-route="about" href="/">About</a>
                <a class="app-nav-link" data-shell-route="bonus" href="/bonuses">Bonuses</a>
                <a class="app-nav-link" data-shell-route="item" href="/bonuses?v=i">Items and Stats</a>
                <a class="app-nav-link" data-shell-route="cards" href="/cards">Cards</a>
                <a class="app-nav-link" data-shell-route="tools" href="/tools">Calculators</a>
            </nav>
            <a class="app-nav-link app-nav-report" href="https://github.com/badbotexe/evi/issues/new" target="_blank">Report Issue</a>
        </div>
    </header>

    <main id="shell-route-host"></main>
    <div id="shell-loader" class="shell-loader" aria-hidden="true">
        <div class="shell-loader-panel">
            <div id="shell-loader-frame-host" class="shell-loader-frame-host" aria-hidden="true"></div>
            <div class="shell-loader-label">Loading</div>
        </div>
    </div>

    <div id="shell-mobile-drawer-overlay" class="mobile-drawer-overlay"></div>
    <div id="shell-mobile-drawer" class="mobile-drawer">
        <div class="mobile-drawer-header">
            <div class="mobile-drawer-handle"></div>
            <button id="shell-mobile-close" class="mobile-drawer-close" type="button">&times;</button>
            <div class="mobile-drawer-title">Navigation</div>
        </div>
        <div class="mobile-drawer-body">
            <div class="mobile-drawer-nav">
                <a class="mobile-drawer-nav-btn" data-shell-route="about" href="/">About</a>
                <a class="mobile-drawer-nav-btn" data-shell-route="bonus" href="/bonuses">Bonuses</a>
                <a class="mobile-drawer-nav-btn" data-shell-route="item" href="/bonuses?v=i">Items and Stats</a>
                <a class="mobile-drawer-nav-btn" data-shell-route="cards" href="/cards">Cards</a>
                <a class="mobile-drawer-nav-btn" data-shell-route="tools" href="/tools">Calculators</a>
            </div>
            <a class="mobile-drawer-report" href="https://github.com/badbotexe/evi/issues/new" target="_blank">Report an Issue</a>
        </div>
    </div>
`;
}
