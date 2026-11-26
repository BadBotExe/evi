import { buildTopLevelHref } from '../routing/routeResolver.js?v=bd3cd1048e';

export function renderAboutSectionMarkup() {
    return `
        <div class="layout about-view about-mobile-browser">
            <main class="content-center">
                <section class="about-shell">
                    <div class="about-hero">
                        <div class="about-eyebrow" data-i18n="about.eyebrow">Evitania Reference</div>
                        <h1 class="about-title" data-i18n="about.title">Everything is grouped under one menu.</h1>
                        <p class="about-copy" data-i18n="about.copy">Use the sections above to move between bonuses, items, cards, and calculators without bouncing through separate controls.</p>
                    </div>

                    <div class="about-grid">
                        <a class="about-card" data-shell-link data-shell-route="bonus" href="${buildTopLevelHref('bonuses')}">
                            <span class="about-card-kicker" data-i18n="nav.bonus">Bonuses</span>
                            <strong data-i18n="about.bonus.title">Browse all bonus sources</strong>
                            <span data-i18n="about.bonus.copy">Find a bonus and see where it comes from, what affects it, and how much you can stack.</span>
                        </a>
                        <a class="about-card" data-shell-link data-shell-route="item" href="/bonuses?v=i">
                            <span class="about-card-kicker" data-i18n="nav.item">Items and Stats</span>
                            <strong data-i18n="about.item.title">Browse items and stat details</strong>
                            <span data-i18n="about.item.copy">Inspect item categories, slots, and embedded stat breakdowns in one place.</span>
                        </a>
                        <a class="about-card" data-shell-link data-shell-route="cards" href="${buildTopLevelHref('cards')}">
                            <span class="about-card-kicker" data-i18n="nav:cards">Cards</span>
                            <strong data-i18n="about.cards.title">Open the cards viewer</strong>
                            <span data-i18n="about.cards.copy">Browse cards, bonuses, drops, and tiers.</span>
                        </a>
                        <a class="about-card" data-shell-link data-shell-route="smith" href="${buildTopLevelHref('smith')}">
                            <span class="about-card-kicker" data-i18n="nav:smith">Smithing</span>
                            <strong data-i18n="about.smith.title">Browse craftable smith gear</strong>
                            <span data-i18n="about.smith.copy">Inspect item stats, tab layouts, and recipe requirements in one place.</span>
                        </a>
                        <a class="about-card" data-shell-link data-shell-route="tools" href="${buildTopLevelHref('tools')}">
                            <span class="about-card-kicker" data-i18n="nav.tools">Calculators</span>
                            <strong data-i18n="about.tools.title">Use planning tools</strong>
                            <span data-i18n="about.tools.copy">Open calculators and planning panels.</span>
                        </a>
                    </div>
                </section>
            </main>
        </div>
    `;
}
