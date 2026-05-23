import { buildTopLevelHref } from '../routing/routeResolver.js?v=5fb3e84e62';

export function renderAboutSectionMarkup() {
    return `
        <div class="layout about-view about-mobile-browser">
            <main class="content-center">
                <section class="about-shell">
                    <div class="about-hero">
                        <div class="about-eyebrow">Evitania Reference</div>
                        <h1 class="about-title">Everything is grouped under one menu.</h1>
                        <p class="about-copy">Use the sections above to move between bonuses, items, cards, and calculators without bouncing through separate controls.</p>
                    </div>

                    <div class="about-grid">
                        <a class="about-card" data-shell-link data-shell-route="bonus" href="${buildTopLevelHref('bonuses')}">
                            <span class="about-card-kicker">Bonuses</span>
                            <strong>Browse all bonus sources</strong>
                            <span>Find a bonus and see where it comes from, what affects it, and how much you can stack.</span>
                        </a>
                        <a class="about-card" data-shell-link data-shell-route="item" href="/bonuses?v=i">
                            <span class="about-card-kicker">Items and Stats</span>
                            <strong>Browse items and stat details</strong>
                            <span>Inspect item categories, slots, and embedded stat breakdowns in one place.</span>
                        </a>
                        <a class="about-card" data-shell-link data-shell-route="cards" href="${buildTopLevelHref('cards')}">
                            <span class="about-card-kicker">Cards</span>
                            <strong>Open the cards viewer</strong>
                            <span>Browse cards, bonuses, drops, and tiers.</span>
                        </a>
                        <a class="about-card" data-shell-link data-shell-route="smith" href="${buildTopLevelHref('smith')}">
                            <span class="about-card-kicker">Smith</span>
                            <strong>Browse craftable smith gear</strong>
                            <span>Inspect item stats, tab layouts, and recipe requirements in one place.</span>
                        </a>
                        <a class="about-card" data-shell-link data-shell-route="tools" href="${buildTopLevelHref('tools')}">
                            <span class="about-card-kicker">Calculators</span>
                            <strong>Use planning tools</strong>
                            <span>Open calculators and planning panels.</span>
                        </a>
                    </div>
                </section>
            </main>
        </div>
    `;
}
