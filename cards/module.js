import {
    buildCardIndex,
    buildFooterItems,
    countCardsForBonus,
    findFirstCardForMode,
    resolveActiveModeId,
    resolveCardField,
    resolveCardFooter,
    resolveItemReference,
    resolveSelectedCardId
} from './app/cardDataModel.js?v=528bdb6394';
import {
    loadCardsData
} from './app/cardsDataLoader.js?v=859f802c99';
import {
    decodeCardsRouteState,
    normalizeCardsRouteState,
    serializeCardsRouteState
} from './app/urlState.js?v=e3f74fc3ab';
import {
    buildDesktopBrowserSections,
    buildMobileBrowserSections,
    normalizeCardSearchQuery
} from './app/browserModel.js?v=ca3b41d914';
import {
    atlasSourcePathToImageAsset,
    isAtlasImageAsset,
    resolveAtlasPathFromManifest
} from '../shell/lib/imageAtlas.js?v=2593e30b08';
import { runWithGlobalShellLoader } from '../shell/loading/shellLoader.js?v=55923b6437';

const TEMPLATE = `
    <div class="global-bar">
        <div class="global-bar-left"></div>
        <div class="global-bar-center">
            <div class="mode-group" id="mode-group"></div>
        </div>
        <div class="global-bar-right">
            <div class="filter-wrap" id="filter-wrap">
                <button class="filter-trigger" id="filter-trigger">
                    <div class="filter-trigger-left">
                        <span>Filter by Bonus</span>
                        <span class="filter-count-badge" id="filter-count-badge"></span>
                    </div>
                    <div class="filter-trigger-right">
                        <span class="filter-clear-x" id="filter-clear-x" title="Clear filter">&times;</span>
                        <span class="filter-chevron">&#x25BC;</span>
                    </div>
                </button>
            </div>
        </div>
    </div>

    <div class="app">
        <div class="drop-panel">
            <div class="drop-title">Drop Table</div>
            <div class="drop-list" id="drop-list"></div>
            <div class="drop-footer" id="drop-footer"></div>
        </div>

        <div class="card-panel">
            <div class="game-card" id="game-card">
                <div class="card-art" id="card-art">
                    <div class="art-ph">
                        <svg viewBox="0 0 24 24">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                        </svg>
                    </div>
                </div>
                <div class="card-name" id="card-name">Select a card</div>
                <div class="card-mode-lbl" id="card-mode-lbl"></div>
                <div class="divider" id="divider"></div>
                <div class="stats" id="stats">
                    <div class="stat-box">
                        <div class="stat-swatch stat-swatch-health"></div>
                        <div><span class="stat-val">&ndash;</span><span class="stat-lbl">Health</span></div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-swatch stat-swatch-attack"></div>
                        <div><span class="stat-val">&ndash;</span><span class="stat-lbl">Attack</span></div>
                    </div>
                    <div class="stat-box wide">
                        <div class="stat-swatch stat-swatch-armor"></div>
                        <div><span class="stat-val">&ndash;</span><span class="stat-lbl">Armor</span></div>
                    </div>
                </div>
                <div class="bonus-area">
                    <div class="bonus-stars" id="bonus-stars"></div>
                    <div class="bonus-txt none" id="bonus-txt">No bonus</div>
                    <div class="cycle-bubble" id="m-cycle-bubble">Tap to cycle<br>bonuses</div>
                </div>
                <div class="card-bottom">
                    <div class="bot-box">
                        <div class="bot-val" id="collected">&ndash;</div>
                        <div class="bot-lbl">Cards collected</div>
                    </div>
                    <div class="bot-box">
                        <div class="bot-val" id="next-tier">&ndash;</div>
                        <div class="bot-lbl">Cards until next tier</div>
                    </div>
                </div>
            </div>

            <div class="star-sel" id="star-sel">
                <label>Stars</label>
            </div>
        </div>

        <div class="browser-panel">
            <div class="browser-search-wrap">
                <input
                    class="browser-search-input"
                    id="browser-search-input"
                    type="search"
                    placeholder="Search cards&mldr;"
                    autocomplete="off"
                    spellcheck="false"
                >
            </div>
            <div id="browser"></div>
        </div>
    </div>

    <div class="filter-dropdown" id="filter-dropdown">
        <div class="filter-actions">
            <button class="filter-action-btn" id="filter-select-all">Select all</button>
            <button class="filter-action-btn" id="filter-clear">Clear</button>
        </div>
        <div class="filter-options-scroll" id="filter-options"></div>
    </div>

    <div class="mobile-root">
        <div class="mobile-panel-wrap">
            <div class="m-panel m-card-tab" data-panel="card">
                <div class="mode-group shell-inline-mode-hidden" id="m-mode-group"></div>
                <div id="m-card-slot"></div>
                <div class="star-sel" id="m-star-sel">
                    <label>Stars</label>
                </div>
            </div>

            <div class="m-panel m-drops-tab" data-panel="drops">
                <div class="drop-panel-title" id="m-drop-title">Drop Table</div>
                <div class="drop-list" id="m-drop-list"></div>
                <div class="drop-footer" id="m-drop-footer"></div>
            </div>

            <div class="m-panel m-browse-tab active" data-panel="browse">
                <div class="browse-search-bar">
                    <div class="icon-btn-wrap" id="m-filter-btn-wrap">
                        <button class="icon-btn" id="m-filter-btn" title="Filter by Bonus">&#9879;</button>
                        <span class="filter-badge-dot" id="m-filter-badge"></span>
                    </div>
                    <input
                        class="browse-search-input"
                        id="m-search-input-panel"
                        type="search"
                        placeholder="Search cards&#8230;"
                        autocomplete="off"
                        spellcheck="false"
                    >
                </div>
                <div class="browse-content" id="m-browse-content"></div>
            </div>
        </div>

        <nav class="mobile-tab-bar">
            <button class="m-tab" data-tab="card">
                <span class="m-tab-icon">&#127183;</span>
                Card
            </button>
            <button class="m-tab" data-tab="drops">
                <span class="m-tab-icon">&#128230;</span>
                Drop Table
            </button>
            <button class="m-tab active" data-tab="browse">
                <span class="m-tab-icon">&#128203;</span>
                Browse
            </button>
        </nav>
    </div>

    <div class="mobile-filter-dropdown" id="m-filter-dropdown">
        <div class="filter-actions">
            <button class="filter-action-btn" id="m-filter-select-all">Select all</button>
            <button class="filter-action-btn" id="m-filter-clear">Clear</button>
        </div>
        <div class="filter-options-scroll" id="m-filter-options"></div>
    </div>
`;

function resolveCardsBaseUrl(moduleUrl = import.meta.url) {
    return new URL('./', moduleUrl);
}

function resolveCardsAtlasManifestUrl(moduleUrl = import.meta.url) {
    return new URL('../generated/image-atlas-manifest.json?v=8bd831398f', moduleUrl).toString();
}

function resolveLegacyCardsAtlasManifestUrl(moduleUrl = import.meta.url) {
    return resolveCardsAtlasManifestUrl(moduleUrl).replace('/generated/', '/bonuses/generated/');
}

function resolveCardsAtlasPathFromManifest(atlasPath, {
    manifestUrl = '',
    legacyManifestUrl = '',
    legacyPrefixes = []
} = {}) {
    if (typeof resolveAtlasPathFromManifest === 'function') {
        return resolveAtlasPathFromManifest(atlasPath, { manifestUrl, legacyManifestUrl, legacyPrefixes });
    }

    const trimmed = typeof atlasPath === 'string' ? atlasPath.trim() : '';
    if (!trimmed) return atlasPath;

    const baseUrl = legacyManifestUrl && legacyPrefixes.some(prefix => trimmed.startsWith(prefix))
        ? legacyManifestUrl
        : manifestUrl;
    return new URL(trimmed, baseUrl || undefined).toString();
}

function resolveCardsAtlasAssetUrl(atlasPath, moduleUrl = import.meta.url) {
    return resolveCardsAtlasPathFromManifest(atlasPath, {
        manifestUrl: resolveCardsAtlasManifestUrl(moduleUrl),
        legacyManifestUrl: resolveLegacyCardsAtlasManifestUrl(moduleUrl),
        legacyPrefixes: ['../../cards/']
    });
}

let cardsAtlasManifestContext = null;
let cardsAtlasPathResolver = null;

function normalizeCardsAssetPaths(node, moduleUrl = import.meta.url, atlasManifest = null) {
    const baseUrl = resolveCardsBaseUrl(moduleUrl);
    cardsAtlasManifestContext = atlasManifest;
    cardsAtlasPathResolver = atlasPath => resolveCardsAtlasAssetUrl(atlasPath, moduleUrl);
    normalizeCardsAssetNode(node, baseUrl);
    cardsAtlasManifestContext = null;
    cardsAtlasPathResolver = null;
    return node;
}

function resolveCardsAtlasSourcePath(value) {
    if (typeof value !== 'string') return null;
    if (value.startsWith('images/')) return `cards/${value}`;
    if (value.startsWith('../items/images/')) return value.slice(3);
    return null;
}

function normalizeCardsAssetNode(node, baseUrl) {
    if (Array.isArray(node)) {
        node.forEach(entry => normalizeCardsAssetNode(entry, baseUrl));
        return;
    }
    if (!node || typeof node !== 'object') return;

    Object.entries(node).forEach(([key, value]) => {
        const atlasSourcePath = resolveCardsAtlasSourcePath(value);
        if (atlasSourcePath) {
            const atlasAsset = cardsAtlasManifestContext
                ? atlasSourcePathToImageAsset(cardsAtlasManifestContext, atlasSourcePath, cardsAtlasPathResolver)
                : null;
            node[key] = atlasAsset ?? new URL(value, baseUrl).toString();
            return;
        }
        normalizeCardsAssetNode(value, baseUrl);
    });
}

let DATA = null;
let cardIndex = {};
let selectedId = null;
let currentMode = null;
let currentStars = 0;
let maxStars = 0;
let isInitialLoad = true;
let activeFilters = new Set();
let initPromise = null;
let currentTab = 'browse';
let mobileAdopted = false;
let hostApi = null;
let hostContainer = null;
let dynamicStyleSheet = null;
const dynamicClassRegistry = new Map();
let atlasSpriteClipPathSequence = 0;

const TAB_ORDER = ['card', 'drops', 'browse'];

function resolveMobileTab(routeTab) {
    return TAB_ORDER.includes(routeTab) ? routeTab : 'browse';
}

function resolveMobileTabScrollLeft(tab, clientWidth) {
    const tabIndex = TAB_ORDER.indexOf(resolveMobileTab(tab));
    return Math.max(0, tabIndex) * Math.max(0, clientWidth || 0);
}

function routeStateFromHost() {
    return normalizeCardsRouteState(hostApi.initialRouteState);
}

function updateHostRouteState() {
    const nextState = {
        card: selectedId ?? '',
        mode: currentMode ?? '',
        stars: currentStars ? String(currentStars) : '',
        filter: activeFilters.size ? [...activeFilters].join(',') : '',
        tab: isMobile() ? currentTab : ''
    };

    if (hostApi.onRouteChange) {
        hostApi.initialRouteState = nextState;
        hostApi.onRouteChange(nextState);
        return;
    }

    const params = serializeCardsRouteState(nextState, {
        data: DATA,
        cardIndex
    });
    history.replaceState(null, '', `?${params.toString()}`);
}

function isMobile() {
    if (matchMedia('(pointer: coarse)').matches) return true;
    if (matchMedia('(hover: none)').matches) return true;
    if (/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)) return true;
    return window.innerWidth < 980;
}

function adoptCardForMobile() {
    const card = document.getElementById('game-card');
    const slot = document.getElementById('m-card-slot');
    if (!card || !slot) return;
    if (isMobile() && card.parentElement.id !== 'm-card-slot') {
        slot.appendChild(card);
        mobileAdopted = true;
    } else if (!isMobile() && mobileAdopted) {
        const panel = document.querySelector('.card-panel');
        if (panel) {
            const starSel = document.getElementById('star-sel');
            panel.insertBefore(card, starSel);
            mobileAdopted = false;
        }
    }
}

function getShellMobileInlineActionsHost() {
    return document.getElementById('shell-mobile-inline-actions');
}

function syncShellMobileModeMount() {
    const modeGroup = document.getElementById('m-mode-group');
    const shellHost = getShellMobileInlineActionsHost();
    if (!modeGroup) return;

    if (shellHost && isMobile()) {
        if (modeGroup.parentElement !== shellHost) {
            shellHost.replaceChildren(modeGroup);
        }
        return;
    }

    const cardTab = document.querySelector('.m-card-tab');
    if (!cardTab) return;

    if (modeGroup.parentElement !== cardTab) {
        cardTab.insertBefore(modeGroup, cardTab.firstChild);
    }
}

function getParams() {
    const state = decodeCardsRouteState(routeStateFromHost(), {
        data: DATA,
        cardIndex
    });
    return {
        card: state.card || null,
        mode: state.mode || null,
        stars: parseInt(state.stars ?? '0', 10) || 0,
        filter: state.filter ? state.filter.split(',').filter(Boolean) : [],
        tab: resolveMobileTab(state.tab)
    };
}

function pushParams() {
    updateHostRouteState();
}

function sc(n) {
    if (DATA.starColors?.[n]) return DATA.starColors[n];
    const m = { '0': '#c8a020', '1': '#3aaa44', '2': '#3a80dd', '3': '#9c44dd' };
    return { border: m[n] || '#c8a020', glow: `${m[n] || '#c8a020'}44` };
}

function mc(id) {
    return DATA.modes.find(m => m.id === id) || { id, label: `${id[0].toUpperCase()}${id.slice(1)}`, color: '#c8a020' };
}

function mkImg(src, alt) {
    const i = document.createElement('img');
    i.src = src;
    i.alt = alt || '';
    return i;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function roundAtlasCropRect(rect, asset) {
    const maxX = asset.x + asset.width;
    const maxY = asset.y + asset.height;
    const x = clamp(Math.round(rect.x), asset.x, maxX);
    const y = clamp(Math.round(rect.y), asset.y, maxY);
    const right = clamp(Math.round(rect.x + rect.width), x, maxX);
    const bottom = clamp(Math.round(rect.y + rect.height), y, maxY);

    return {
        x,
        y,
        width: Math.max(1, right - x),
        height: Math.max(1, bottom - y)
    };
}

function resolveAtlasCropRect(asset, {
    targetAspectRatio = null,
    focusX = 50,
    focusY = 50
} = {}) {
    const rect = {
        x: asset.x,
        y: asset.y,
        width: asset.width,
        height: asset.height
    };

    if (!(targetAspectRatio > 0) || !(asset.width > 0) || !(asset.height > 0)) {
        return rect;
    }

    const assetAspectRatio = asset.width / asset.height;
    if (Math.abs(assetAspectRatio - targetAspectRatio) < 0.0001) {
        return rect;
    }

    if (assetAspectRatio > targetAspectRatio) {
        const cropWidth = asset.height * targetAspectRatio;
        const maxOffsetX = asset.width - cropWidth;
        const offsetX = maxOffsetX * clamp(focusX, 0, 100) / 100;
        return roundAtlasCropRect({
            x: asset.x + offsetX,
            y: asset.y,
            width: cropWidth,
            height: asset.height
        }, asset);
    }

    const cropHeight = asset.width / targetAspectRatio;
    const maxOffsetY = asset.height - cropHeight;
    const offsetY = maxOffsetY * clamp(focusY, 0, 100) / 100;
    return roundAtlasCropRect({
        x: asset.x,
        y: asset.y + offsetY,
        width: asset.width,
        height: cropHeight
    }, asset);
}

function createAtlasSprite(asset, alt, {
    className = '',
    preserveAspectRatio = 'xMidYMid meet',
    decorative = false,
    targetAspectRatio = null,
    focusX = 50,
    focusY = 50
} = {}) {
    const viewBox = resolveAtlasCropRect(asset, { targetAspectRatio, focusX, focusY });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    if (className) svg.setAttribute('class', className);
    svg.setAttribute('viewBox', `${asset.x} ${asset.y} ${asset.width} ${asset.height}`);
    svg.setAttribute('viewBox', `0 0 ${viewBox.width} ${viewBox.height}`);
    svg.setAttribute('overflow', 'hidden');
    svg.setAttribute('preserveAspectRatio', preserveAspectRatio);
    if (decorative) {
        svg.setAttribute('aria-hidden', 'true');
    } else {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', alt || '');
    }

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    const clipPathId = `cards-atlas-sprite-clip-${atlasSpriteClipPathSequence++}`;
    clipPath.setAttribute('id', clipPathId);
    clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');

    const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('width', String(viewBox.width));
    clipRect.setAttribute('height', String(viewBox.height));
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    svg.appendChild(defs);

    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', asset.url);
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('clip-path', `url(#${clipPathId})`);
    image.setAttribute('x', String(-viewBox.x));
    image.setAttribute('y', String(-viewBox.y));
    image.setAttribute('width', String(asset.sheetWidth));
    image.setAttribute('height', String(asset.sheetHeight));
    image.setAttribute('image-rendering', 'pixelated');
    image.setAttribute('style', 'image-rendering: pixelated; shape-rendering: crispEdges;');
    image.setAttribute('preserveAspectRatio', 'none');
    svg.appendChild(image);
    return svg;
}

function createAtlasThumbSprite(asset, alt, {
    className = '',
    decorative = false,
    focusX = 50,
    focusY = 50,
    targetAspectRatio = 2 / 3
} = {}) {
    const viewBox = resolveAtlasCropRect(asset, { targetAspectRatio, focusX, focusY });
    const svg = createAtlasSprite(asset, alt, {
        className,
        decorative,
        preserveAspectRatio: 'none',
        targetAspectRatio,
        focusX,
        focusY
    });
    return svg;
}

function createAssetNode(asset, alt, options = {}) {
    if (isAtlasImageAsset(asset)) {
        if (options.targetAspectRatio) {
            return createAtlasThumbSprite(asset, alt, options);
        }
        return createAtlasSprite(asset, alt, options);
    }

    const image = mkImg(asset, alt);
    if (options.className) image.className = options.className;
    return image;
}

function ensureDynamicStyleSheet() {
    if (dynamicStyleSheet) return dynamicStyleSheet;
    const styleEl = document.createElement('style');
    styleEl.id = 'cards-dynamic-styles';
    document.head.appendChild(styleEl);
    dynamicStyleSheet = styleEl.sheet;
    return dynamicStyleSheet;
}

function normalizeDynamicClassToken(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'value';
}

function ensureDynamicClass(prefix, key, declarations) {
    const registryKey = `${prefix}:${key}`;
    if (dynamicClassRegistry.has(registryKey)) return dynamicClassRegistry.get(registryKey);

    const className = `${prefix}-${normalizeDynamicClassToken(key)}`;
    const sheet = ensureDynamicStyleSheet();
    sheet.insertRule(`.${className} { ${declarations} }`, sheet.cssRules.length);
    dynamicClassRegistry.set(registryKey, className);
    return className;
}

function replaceDynamicClass(node, slot, className) {
    if (!node) return;
    const key = `cards${slot[0].toUpperCase()}${slot.slice(1)}Class`;
    const previousClass = node.dataset[key];
    if (previousClass) node.classList.remove(previousClass);
    if (className) {
        node.classList.add(className);
        node.dataset[key] = className;
        return;
    }
    delete node.dataset[key];
}

function createArtPlaceholder() {
    const wrapper = document.createElement('div');
    wrapper.className = 'art-ph';
    wrapper.innerHTML = `
        <svg class="art-ph-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
    `;
    return wrapper;
}

function showCardLoadError() {
    if (hostContainer) {
        hostContainer.innerHTML = '<p class="cards-load-error">Could not load cards.json</p>';
    }
}

function createFooterIconPlaceholder(color) {
    const placeholder = document.createElement('div');
    placeholder.className = 'footer-icon-ph';
    replaceDynamicClass(
        placeholder,
        'footerPlaceholder',
        ensureDynamicClass('cards-footer-placeholder', color || '#888', `background-color: ${color || '#888'};`)
    );
    return placeholder;
}

function resolve(field, md, card, cat) {
    return resolveCardField(field, md, card, cat, currentMode);
}

function resolveFooter(md, card, cat) {
    return resolveCardFooter(md, card, cat, currentMode);
}

function resolveItem(ref) {
    return resolveItemReference(DATA.items, ref);
}

function buildReportUrl() {
    const title = selectedId ? `[${selectedId}] Issue` : 'Issue';
    const body = `**Card:** ${selectedId ?? 'N/A'}\n**Mode:** ${currentMode}\n**Stars:** ${currentStars}\n\n**Description:**\n`;
    return `https://github.com/badbotexe/evi/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function initAppNav() {
    const reportBtn = document.getElementById('m-report-btn');
    if (reportBtn) {
        reportBtn.addEventListener('click', ev => {
            ev.currentTarget.href = buildReportUrl();
        });
    }
}

function cardPassesFilter(card) {
    if (!activeFilters.size) return true;
    return activeFilters.has(card.bonus_type);
}

function countForBonus(bonusId) {
    return countCardsForBonus(DATA.categories, bonusId);
}

function firstForMode(modeId) {
    return findFirstCardForMode(DATA.categories, modeId, cardPassesFilter);
}

function buildFilterOptions(container) {
    container.innerHTML = '';
    DATA.bonus_types.sort((a, b) => a.id.localeCompare(b.id));
    for (const bt of DATA.bonus_types) {
        const count = countForBonus(bt.id);
        if (!count) continue;

        const opt = document.createElement('label');
        opt.className = 'filter-option';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = bt.id;
        cb.checked = activeFilters.has(bt.id);
        cb.addEventListener('change', () => {
            if (cb.checked) activeFilters.add(bt.id);
            else activeFilters.delete(bt.id);
            onFilterChange();
        });

        const lbl = document.createElement('span');
        lbl.className = 'filter-option-label';
        lbl.textContent = bt.label;

        const cnt = document.createElement('span');
        cnt.className = 'filter-option-count';
        cnt.textContent = count;

        opt.append(cb, lbl, cnt);
        container.appendChild(opt);
    }
}

function buildDesktopFilterUI() {
    buildFilterOptions(document.getElementById('filter-options'));
}

function syncFilterCheckboxes(container) {
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = activeFilters.has(cb.value);
    });
}

function updateFilterBadge() {
    const badge = document.getElementById('filter-count-badge');
    const trigger = document.getElementById('filter-trigger');
    if (badge && trigger) {
        if (activeFilters.size > 0) {
            badge.textContent = activeFilters.size;
            badge.classList.add('visible');
            trigger.classList.add('active');
        } else {
            badge.classList.remove('visible');
            trigger.classList.remove('active');
        }
    }

    const dot = document.getElementById('m-filter-badge');
    const button = document.getElementById('m-filter-btn');
    if (dot && button) {
        dot.textContent = activeFilters.size || '';
        dot.classList.toggle('visible', activeFilters.size > 0);
        button.classList.toggle('active', activeFilters.size > 0);
    }
}

function onFilterChange() {
    syncFilterCheckboxes(document.getElementById('filter-options'));
    syncFilterCheckboxes(document.getElementById('m-filter-options'));
    updateFilterBadge();
    renderBrowser();
    renderMobileBrowse();
    pushParams();
}

function initDesktopFilterDropdown() {
    const wrap = document.getElementById('filter-wrap');
    const trigger = document.getElementById('filter-trigger');
    const dropdown = document.getElementById('filter-dropdown');
    if (!wrap || !trigger || !dropdown) return;

    function openDropdown() {
        const rect = trigger.getBoundingClientRect();
        applyDynamicNodeClass(
            dropdown,
            'desktopDropdownPlacement',
            'cards-desktop-dropdown-placement',
            `${rect.bottom + 6}-${rect.left}-${rect.width}`,
            `top: ${rect.bottom + 6}px; left: ${rect.left}px; width: ${rect.width}px;`
        );
        dropdown.classList.add('open');
        wrap.classList.add('open');
    }

    function closeDropdown() {
        dropdown.classList.remove('open');
        wrap.classList.remove('open');
    }

    trigger.addEventListener('click', e => {
        e.stopPropagation();
        dropdown.classList.contains('open') ? closeDropdown() : openDropdown();
    });

    dropdown.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', closeDropdown);

    document.getElementById('filter-select-all').addEventListener('click', () => {
        DATA.bonus_types.forEach(bt => {
            if (countForBonus(bt.id) > 0) activeFilters.add(bt.id);
        });
        onFilterChange();
    });

    document.getElementById('filter-clear').addEventListener('click', () => {
        activeFilters.clear();
        onFilterChange();
    });
}

function initMobileFilter() {
    const button = document.getElementById('m-filter-btn');
    const dropdown = document.getElementById('m-filter-dropdown');
    if (!button || !dropdown) return;

    buildFilterOptions(document.getElementById('m-filter-options'));

    function openFilter() {
        const rect = button.getBoundingClientRect();
        applyDynamicNodeClass(
            dropdown,
            'mobileDropdownPlacement',
            'cards-mobile-dropdown-placement',
            `${rect.bottom + 6}`,
            `top: ${rect.bottom + 6}px;`
        );
        dropdown.classList.add('open');
    }

    function closeFilter() {
        dropdown.classList.remove('open');
    }

    button.addEventListener('click', e => {
        e.stopPropagation();
        dropdown.classList.contains('open') ? closeFilter() : openFilter();
    });

    dropdown.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', closeFilter);

    document.getElementById('m-filter-select-all').addEventListener('click', () => {
        DATA.bonus_types.forEach(bt => {
            if (countForBonus(bt.id) > 0) activeFilters.add(bt.id);
        });
        onFilterChange();
    });

    document.getElementById('m-filter-clear').addEventListener('click', () => {
        activeFilters.clear();
        onFilterChange();
    });
}

function updateModeBtns() {
    document.querySelectorAll('.gmode-btn').forEach(button => {
        const mode = mc(button.dataset.id);
        const hasMode = !selectedId || cardIndex[selectedId].card.modes[button.dataset.id];
        button.disabled = !hasMode;
        button.classList.toggle('active', button.dataset.id === currentMode);
        replaceDynamicClass(
            button,
            'modeColor',
            button.dataset.id === currentMode
                ? ensureDynamicClass('cards-mode-color', mode.color, `background: ${mode.color};`)
                : null
        );
    });
}

function buildModeBar() {
    document.querySelectorAll('.mode-group').forEach(group => {
        group.innerHTML = '';
        for (const mode of DATA.modes || []) {
            const button = document.createElement('button');
            button.className = 'gmode-btn';
            button.textContent = mode.label;
            button.dataset.id = mode.id;
            button.addEventListener('click', () => setGlobalMode(mode.id));
            group.appendChild(button);
        }
    });
    setGlobalMode(DATA.modes?.[0]?.id || 'normal');
}

function setGlobalMode(id) {
    currentMode = id;
    document.querySelectorAll('.gmode-btn').forEach(button => {
        const mode = mc(button.dataset.id);
        button.classList.toggle('active', button.dataset.id === id);
        replaceDynamicClass(
            button,
            'modeColor',
            button.dataset.id === id
                ? ensureDynamicClass('cards-mode-color', mode.color, `background: ${mode.color};`)
                : null
        );
    });
    if (selectedId) {
        const { card } = cardIndex[selectedId];
        if (!card.modes[currentMode]) {
            const firstCard = firstForMode(currentMode);
            firstCard ? selectCard(firstCard.id) : clearCard();
            return;
        }
    }
    renderStars();
    renderCard();
    renderDrops();
    renderMobileDrops();
    pushParams();
    updateModeBtns();
}

function createDesktopPlaceholderThumb(grid) {
    const placeholder = document.createElement('div');
    placeholder.className = 'thumb-card thumb-placeholder';
    grid.appendChild(placeholder);
}

function createDesktopThumbCard(entry) {
    const { card, isSelected } = entry;
    const colors = sc(0);
    const cardEl = document.createElement('div');
    cardEl.className = `thumb-card${isSelected ? ' selected' : ''}`;
    cardEl.id = `thumb-${card.id}`;
    applyDynamicNodeClass(cardEl, 'thumbBorder', 'cards-thumb-border', colors.border, `border-color: ${colors.border};`);

    const src = card.image_thumb || card.image_card;
    const name = card.short_name || card.name;
    if (src) {
        const shiftX = card.thumb_x ?? 50;
        const assetNode = createAssetNode(src, name, {
            className: 'thumb-img',
            preserveAspectRatio: 'xMidYMid slice',
            targetAspectRatio: 2 / 3,
            focusX: shiftX
        });
        if (!isAtlasImageAsset(src)) {
            applyDynamicNodeClass(assetNode, 'thumbPosition', 'cards-thumb-position', shiftX, `object-position: ${shiftX}% 50%;`);
            assetNode.onerror = function onThumbError() {
                this.remove();
                const ph = document.createElement('div');
                ph.className = 'thumb-ph';
                ph.textContent = name;
                cardEl.prepend(ph);
            };
        }
        cardEl.appendChild(assetNode);
    } else {
        const ph = document.createElement('div');
        ph.className = 'thumb-ph';
        ph.textContent = name;
        cardEl.appendChild(ph);
    }

    const nameLabel = document.createElement('div');
    nameLabel.className = 'thumb-name-lbl';
    nameLabel.textContent = name;
    cardEl.appendChild(nameLabel);

    const allModes = Object.keys(card.modes || {});
    if (allModes.length === 1 && allModes[0] !== 'normal') {
        const badge = document.createElement('div');
        badge.className = 'mode-badge';
        const modeColor = mc(allModes[0]).color;
        applyDynamicNodeClass(badge, 'modeBadgeColor', 'cards-mode-badge-color', modeColor, `color: ${modeColor};`);
        badge.textContent = allModes[0].toUpperCase();
        cardEl.appendChild(badge);
    }

    cardEl.addEventListener('click', () => selectCard(card.id));
    return cardEl;
}

function createMobileThumbCard(entry) {
    const { card, isSelected } = entry;
    const colors = sc(0);
    const thumb = document.createElement('div');
    thumb.className = `m-thumb${isSelected ? ' selected' : ''}`;
    thumb.id = `m-thumb-${card.id}`;
    applyDynamicNodeClass(thumb, 'mobileThumbBorder', 'cards-mobile-thumb-border', colors.border, `border-color: ${colors.border};`);

    const src = card.image_thumb || card.image_card;
    const name = card.short_name || card.name;
    if (src) {
        const shiftX = card.thumb_x ?? 50;
        const assetNode = createAssetNode(src, name, {
            className: 'thumb-img',
            preserveAspectRatio: 'xMidYMid slice',
            targetAspectRatio: 2 / 3,
            focusX: shiftX
        });
        if (!isAtlasImageAsset(src)) {
            applyDynamicNodeClass(assetNode, 'mobileThumbPosition', 'cards-mobile-thumb-position', shiftX, `object-position: ${shiftX}% 50%;`);
            assetNode.onerror = function onMobileThumbError() {
                this.remove();
                const ph = document.createElement('div');
                ph.className = 'm-thumb-ph';
                ph.textContent = name;
                thumb.prepend(ph);
            };
        }
        thumb.appendChild(assetNode);
    } else {
        const ph = document.createElement('div');
        ph.className = 'm-thumb-ph';
        ph.textContent = name;
        thumb.appendChild(ph);
    }

    const labelEl = document.createElement('div');
    labelEl.className = 'm-thumb-lbl';
    labelEl.textContent = name;
    thumb.appendChild(labelEl);

    thumb.addEventListener('click', () => {
        selectCard(card.id);
        switchTab('card');
    });

    return thumb;
}

function renderBrowser() {
    const el = document.getElementById('browser');
    if (!el) return;
    el.innerHTML = '';
    const query = normalizeCardSearchQuery(document.getElementById('browser-search-input').value);
    const browserState = buildDesktopBrowserSections(DATA.categories, {
        activeFilters,
        query,
        selectedId
    });

    for (const section of browserState.sections) {
        const block = document.createElement('div');
        block.className = 'cat-block';
        const label = document.createElement('div');
        label.className = 'cat-lbl';
        label.textContent = section.label;
        block.appendChild(label);
        const grid = document.createElement('div');
        grid.className = 'thumb-grid';

        for (const entry of section.entries) {
            if (entry.kind === 'placeholder') {
                createDesktopPlaceholderThumb(grid);
                continue;
            }
            grid.appendChild(createDesktopThumbCard(entry));
        }

        block.appendChild(grid);
        el.appendChild(block);
    }

    if (browserState.showEmptyMessage) {
        const msg = document.createElement('div');
        msg.className = 'browser-empty-msg';
        msg.textContent = 'No cards found';
        el.appendChild(msg);
    }
}

function renderMobileBrowse() {
    const container = document.getElementById('m-browse-content');
    if (!container) return;
    container.innerHTML = '';
    const query = normalizeCardSearchQuery(document.getElementById('m-search-input-panel').value);
    const browserState = buildMobileBrowserSections(DATA.categories, {
        activeFilters,
        query,
        selectedId
    });

    for (const section of browserState.sections) {
        const block = document.createElement('div');
        block.className = 'm-cat-block';
        const label = document.createElement('div');
        label.className = 'm-cat-lbl';
        label.textContent = section.label;
        block.appendChild(label);
        const row = document.createElement('div');
        row.className = 'm-card-row';

        for (const entry of section.entries) {
            row.appendChild(createMobileThumbCard(entry));
        }

        block.appendChild(row);
        container.appendChild(block);
    }

    if (browserState.showEmptyMessage) {
        const msg = document.createElement('div');
        msg.className = 'browser-empty-msg';
        msg.textContent = 'No cards found';
        container.appendChild(msg);
    }
}

function selectCard(id) {
    if (selectedId) {
        const previousDesktopThumb = document.getElementById(`thumb-${selectedId}`);
        if (previousDesktopThumb) previousDesktopThumb.classList.remove('selected');
        const previousMobileThumb = document.getElementById(`m-thumb-${selectedId}`);
        if (previousMobileThumb) previousMobileThumb.classList.remove('selected');
    }

    selectedId = id;
    const { card, cat } = cardIndex[selectedId];

    if (!card.modes[currentMode]) {
        const availableMode = Object.keys(card.modes)[0];
        setGlobalMode(availableMode);
        return;
    }

    const desktopThumb = document.getElementById(`thumb-${id}`);
    if (desktopThumb) {
        desktopThumb.classList.add('selected');
        if (isInitialLoad) {
            desktopThumb.scrollIntoView({ block: 'center', behavior: 'smooth' });
            isInitialLoad = false;
        }
    }

    const mobileThumb = document.getElementById(`m-thumb-${id}`);
    if (mobileThumb) {
        mobileThumb.classList.add('selected');
    }

    const md = card.modes[currentMode];
    const newMax = resolve('stars', md, card, cat) ?? 0;
    currentStars = Math.min(currentStars, newMax);

    renderStars();
    renderCard();
    renderDrops();
    renderMobileDrops();
    pushParams();
    updateModeBtns();
}

function clearCard() {
    selectedId = null;
    const name = document.getElementById('card-name');
    if (name) name.textContent = 'No card';
    if (document.getElementById('drop-list')) document.getElementById('drop-list').innerHTML = '';
    if (document.getElementById('drop-footer')) document.getElementById('drop-footer').innerHTML = '';
    document.getElementById('star-sel').querySelectorAll('.star-btn').forEach(button => button.remove());
    renderMobileDrops();
}

function applyLayoutClass(layoutName) {
    if (!hostContainer) return;
    hostContainer.classList.toggle('cards-layout-desktop', layoutName === 'desktop');
    hostContainer.classList.toggle('cards-layout-mobile', layoutName === 'mobile');
}

function applyDynamicNodeClass(node, slot, prefix, key, declarations) {
    replaceDynamicClass(node, slot, ensureDynamicClass(prefix, key, declarations));
}

function appendDropRows(listEl, drops) {
    for (const ref of drops ?? []) {
        const drop = resolveItem(ref);
        const row = document.createElement('div');
        row.className = 'drop-row';
        const iconWrap = document.createElement('div');
        iconWrap.className = 'drop-icon';
        if (drop.image) {
            const assetNode = createAssetNode(drop.image, drop.name, { className: 'atlas-sprite-fill', decorative: true });
            if (!isAtlasImageAsset(drop.image)) {
                assetNode.onerror = () => {
                    iconWrap.innerHTML = '<div class="icon-ph"></div>';
                };
            }
            iconWrap.appendChild(assetNode);
        } else {
            iconWrap.innerHTML = '<div class="icon-ph"></div>';
        }
        const name = document.createElement('div');
        name.className = 'drop-name';
        name.textContent = drop.name;
        const rate = document.createElement('div');
        rate.className = 'drop-rate';
        rate.textContent = drop.rate;
        row.append(iconWrap, name, rate);
        listEl.appendChild(row);
    }
}

function appendFooterPills(footerEl, items) {
    for (const ref of items) {
        const item = resolveItem(ref);
        const pill = document.createElement('div');
        pill.className = 'footer-pill';
        const iconWrap = document.createElement('div');
        iconWrap.className = 'footer-icon';
        if (item.image) {
            const assetNode = createAssetNode(item.image, item.label || '', { className: 'atlas-sprite-fill', decorative: true });
            if (!isAtlasImageAsset(item.image)) {
                assetNode.onerror = () => {
                    iconWrap.replaceChildren(createFooterIconPlaceholder(item.color));
                };
            }
            iconWrap.appendChild(assetNode);
        } else {
            iconWrap.appendChild(createFooterIconPlaceholder(item.color));
        }
        const value = document.createElement('span');
        value.className = 'footer-val';
        value.textContent = item.value;
        pill.append(iconWrap, value);
        footerEl.appendChild(pill);
    }
}

function renderStars() {
    ['star-sel'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.querySelectorAll('.star-btn').forEach(button => button.remove());
        if (!selectedId) return;

        const { card, cat } = cardIndex[selectedId];
        const md = card.modes[currentMode];
        maxStars = resolve('stars', md, card, cat) ?? 0;

        for (let i = 0; i <= maxStars; i++) {
            const button = document.createElement('button');
            button.className = `star-btn${i === currentStars ? ' active' : ''}`;
            button.innerHTML = i === 0 ? '0&#x2605;' : '&#x2605;'.repeat(i);
            const colors = sc(i);
            replaceDynamicClass(
                button,
                'starButtonTheme',
                i === currentStars
                    ? ensureDynamicClass(
                        'cards-star-button-theme',
                        colors.border,
                        `background: ${colors.border}; border-color: ${colors.border}; color: #1a1530;`
                    )
                    : null
            );
            button.addEventListener('click', () => {
                currentStars = i;
                renderStars();
                renderCard();
                pushParams();
            });
            sel.appendChild(button);
        }
    });
}

function renderCard() {
    if (!selectedId) return;
    const { card, cat } = cardIndex[selectedId];
    const md = card.modes[currentMode];
    if (!md) return;
    const colors = sc(currentStars);

    const gc = document.getElementById('game-card');
    if (!gc) return;
    applyDynamicNodeClass(
        gc,
        'cardTheme',
        'cards-card-theme',
        `${colors.border}-${colors.glow}`,
        `--cards-accent-color: ${colors.border}; --cards-accent-glow: ${colors.glow}; border-color: ${colors.border}; box-shadow: 0 0 30px 5px ${colors.glow};`
    );

    const divider = document.getElementById('divider');
    if (divider) divider.classList.add('card-divider-themed');

    const art = document.getElementById('card-art');
    if (art) {
        art.innerHTML = '';
        if (card.image_card) {
            const assetNode = createAssetNode(card.image_card, card.name, { className: 'card-art-image' });
            if (!isAtlasImageAsset(card.image_card)) {
                assetNode.onerror = () => {
                    art.replaceChildren(createArtPlaceholder());
                };
            }
            art.appendChild(assetNode);
        } else {
            art.appendChild(createArtPlaceholder());
        }
    }

    const name = document.getElementById('card-name');
    if (name) name.textContent = card.name;

    const modeLabel = document.getElementById('card-mode-lbl');
    if (modeLabel) {
        if (currentMode !== 'normal') {
            const mode = mc(currentMode);
            modeLabel.textContent = `(${mode.label})`;
            modeLabel.classList.remove('card-mode-lbl-empty');
            applyDynamicNodeClass(modeLabel, 'modeLabelColor', 'cards-mode-label-color', mode.color, `color: ${mode.color};`);
        } else {
            modeLabel.innerHTML = '&nbsp;';
            modeLabel.classList.add('card-mode-lbl-empty');
            replaceDynamicClass(modeLabel, 'modeLabelColor', null);
        }
    }

    const statsEl = document.getElementById('stats');
    if (statsEl) {
        statsEl.innerHTML = '';
        const stats = resolve('stats', md, card, cat) ?? {};
        const present = DATA.statDefs.filter(def => def.key in stats);
        present.forEach((def, i) => {
            const box = document.createElement('div');
            const isWide = def.wide || (present.length % 2 === 1 && i === present.length - 1);
            box.className = `stat-box${isWide ? ' wide' : ''}`;
            const sw = document.createElement('div');
            sw.className = 'stat-swatch';
            applyDynamicNodeClass(sw, 'statSwatchBg', 'cards-stat-swatch-bg', def.bg, `background: ${def.bg};`);
            if (def.icon) {
                sw.appendChild(createAssetNode(def.icon, def.label, { className: 'stat-swatch-icon', decorative: true }));
            }
            box.appendChild(sw);
            const text = document.createElement('div');
            text.innerHTML = `<span class="stat-val">${stats[def.key]}</span><span class="stat-lbl">${def.label}</span>`;
            box.appendChild(text);
            box.appendChild(document.createElement('div'));
            statsEl.appendChild(box);
        });
    }

    const bonuses = md.bonuses ?? card.bonuses ?? {};
    const bonusStars = document.getElementById('bonus-stars');
    if (bonusStars) {
        bonusStars.innerHTML = '';
        for (let i = 1; i <= maxStars; i++) {
            const star = document.createElement('span');
            star.className = `bstar${i <= currentStars ? '' : ' dim'}`;
            star.innerHTML = '&#x2605;';
            bonusStars.appendChild(star);
        }
    }

    const bonusText = document.getElementById('bonus-txt');
    if (bonusText) {
        const value = bonuses[String(currentStars)];
        bonusText.textContent = value || 'No bonus';
        bonusText.className = `bonus-txt${value ? ' has-bonus' : ' none'}`;
    }

    const tiers = resolve('tiers', md, card, cat);
    const collected = document.getElementById('collected');
    const nextTier = document.getElementById('next-tier');
    if (collected && nextTier) {
        if (tiers && tiers.length > currentStars) {
            collected.textContent = tiers[currentStars] ?? '-';
            const next = tiers[currentStars + 1];
            nextTier.textContent = next != null ? String(next - tiers[currentStars]) : 'MAX';
        } else {
            collected.textContent = '-';
            nextTier.textContent = '-';
        }
    }

    const bonusArea = gc.querySelector('.bonus-area');
    if (bonusArea && !bonusArea.dataset.cycleAttached) {
        bonusArea.dataset.cycleAttached = '1';
        bonusArea.classList.add('bonus-area-cyclable');
        bonusArea.addEventListener('click', () => {
            currentStars = currentStars >= maxStars ? 0 : currentStars + 1;
            renderStars();
            renderCard();
            pushParams();
        });
    }

    if (isMobile()) showCycleBubble();
    document.title = `Evitania - ${card.name}`;
}

function renderDrops() {
    if (!selectedId) return;
    const { card, cat } = cardIndex[selectedId];
    const md = card.modes[currentMode];
    const list = document.getElementById('drop-list');
    if (!list) return;
    list.innerHTML = '';
    appendDropRows(list, md.drops);

    const footer = document.getElementById('drop-footer');
    if (footer) {
        footer.innerHTML = '';
        const footerItemsRef = resolveFooter(md, card, cat);
        appendFooterPills(footer, buildFooterItems(md, footerItemsRef));
    }
}

function renderMobileDrops() {
    const titleEl = document.getElementById('m-drop-title');
    const listEl = document.getElementById('m-drop-list');
    const footerEl = document.getElementById('m-drop-footer');
    if (!titleEl || !listEl || !footerEl) return;

    if (!selectedId) {
        titleEl.textContent = 'Drop Table';
        listEl.innerHTML = '';
        footerEl.innerHTML = '';
        return;
    }

    const { card, cat } = cardIndex[selectedId];
    const md = card.modes[currentMode];

    titleEl.textContent = card.name;
    listEl.innerHTML = '';
    footerEl.innerHTML = '';
    appendDropRows(listEl, md.drops);

    const footerItemsRef = resolveFooter(md, card, cat);
    appendFooterPills(footerEl, buildFooterItems(md, footerItemsRef));
}

function switchTab(tab) {
    currentTab = tab;

    document.querySelectorAll('.m-tab').forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tab);
    });

    document.querySelectorAll('.m-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.panel === tab);
    });

    syncMobilePanelPosition(tab, 'smooth');

    syncMobileChrome();

    if (tab !== 'browse') {
        document.getElementById('m-filter-dropdown').classList.remove('open');
    }

    pushParams();
}

function syncMobilePanelPosition(tab, behavior = 'auto', attempt = 0) {
    const wrap = document.querySelector('.mobile-panel-wrap');
    if (!wrap) return;

    const targetLeft = resolveMobileTabScrollLeft(tab, wrap.clientWidth);
    if (!targetLeft && wrap.clientWidth <= 0 && attempt < 2) {
        requestAnimationFrame(() => syncMobilePanelPosition(tab, behavior, attempt + 1));
        return;
    }

    wrap.scrollTo({ left: targetLeft, behavior });
}

function initMobileSwipe() {
    const wrap = document.querySelector('.mobile-panel-wrap');
    if (!wrap) return;

    let snapTimer = null;
    wrap.addEventListener('scroll', () => {
        clearTimeout(snapTimer);
        snapTimer = setTimeout(() => {
            const idx = Math.round(wrap.scrollLeft / (wrap.clientWidth || 1));
            const tab = TAB_ORDER[Math.max(0, Math.min(idx, TAB_ORDER.length - 1))];
            if (tab === currentTab) return;
            currentTab = tab;

            document.querySelectorAll('.m-tab').forEach(button => {
                button.classList.toggle('active', button.dataset.tab === tab);
            });
            document.querySelectorAll('.m-panel').forEach(panel => {
                panel.classList.toggle('active', panel.dataset.panel === tab);
            });

            syncMobileChrome();
            if (tab !== 'browse') document.getElementById('m-filter-dropdown').classList.remove('open');

            pushParams();
        }, 80);
    });

    window.addEventListener('resize', () => {
        syncMobilePanelPosition(currentTab, 'auto');
    });
}

function initMobileTabs() {
    document.querySelectorAll('.m-tab').forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
}

function applyLayoutMode() {
    const desktopMode = !isMobile();
    applyLayoutClass(desktopMode ? 'desktop' : 'mobile');

    adoptCardForMobile();
}


function onResize() {
    applyLayoutMode();
    adoptCardForMobile();
    syncMobilePanelPosition(currentTab, 'auto');
    syncMobileChrome();
}

function showCycleBubble() {
    if (localStorage.getItem('cycle_hint_seen')) return;
    const bubble = document.getElementById('m-cycle-bubble');
    if (!bubble) return;
    bubble.classList.add('visible');
    bubble.addEventListener('click', e => {
        e.stopPropagation();
        localStorage.setItem('cycle_hint_seen', '1');
        bubble.classList.remove('visible');
    }, { once: true });
}

function syncMobileChrome() {
    syncShellMobileModeMount();

    const modeWrap = document.getElementById('m-mode-group');
    const shellHost = getShellMobileInlineActionsHost();
    const modeInShellHeader = Boolean(shellHost && modeWrap?.parentElement === shellHost && isMobile() && currentTab !== 'browse');
    if (modeWrap) {
        modeWrap.classList.toggle('shell-inline-mode-hidden', currentTab === 'browse' && !modeInShellHeader);
    }

    if (shellHost) {
        shellHost.classList.toggle('cards-shell-inline-actions-visible', modeInShellHeader);
        shellHost.classList.toggle('shell-hidden', !modeInShellHeader);
    }
}

function applyRouteState(state) {
    hostApi.initialRouteState = normalizeCardsRouteState(state);
    if (!DATA) return;

    const params = getParams();
    activeFilters = new Set(params.filter);
    const modeId = resolveActiveModeId(DATA, params.mode);
    const nextSelected = resolveSelectedCardId(DATA, cardIndex, params.card);

    currentStars = params.stars;
    renderBrowser();
    renderMobileBrowse();
    setGlobalMode(modeId);
    if (nextSelected) {
        selectCard(nextSelected);
    } else {
        clearCard();
    }
    switchTab(resolveMobileTab(params.tab));
    updateFilterBadge();
    syncMobileChrome();
}

async function init() {
    if (initPromise) return initPromise;

        initPromise = (async () => {
            initAppNav();
            try {
                await runWithGlobalShellLoader(async () => {
                    const [atlasManifest, cardsData] = await Promise.all([
                        fetch(resolveCardsAtlasManifestUrl(import.meta.url))
                            .then(result => result.ok ? result.json() : null)
                            .catch(() => null),
                        loadCardsData({
                            fetchImpl: fetch,
                            moduleUrl: import.meta.url
                        })
                    ]);
                    DATA = cardsData;
                    normalizeCardsAssetPaths(DATA, import.meta.url, atlasManifest);
                });
            } catch {
                initPromise = null;
                showCardLoadError();
                throw new Error('Could not load cards.json');
            }

            cardIndex = buildCardIndex(DATA);

            const params = getParams();
            activeFilters = new Set(params.filter);
            const startMode = resolveActiveModeId(DATA, params.mode);

            applyLayoutMode();
            syncShellMobileModeMount();
            buildModeBar();
            buildDesktopFilterUI();
            initDesktopFilterDropdown();
            initMobileFilter();
            initMobileTabs();
            initMobileSwipe();
            updateFilterBadge();

            document.getElementById('filter-clear-x').addEventListener('click', e => {
                e.stopPropagation();
                activeFilters.clear();
                onFilterChange();
            });

            document.getElementById('browser-search-input').addEventListener('input', renderBrowser);
            document.getElementById('m-search-input-panel').addEventListener('input', renderMobileBrowse);

            window.addEventListener('resize', onResize);

            renderBrowser();
            renderMobileBrowse();
            setGlobalMode(startMode);

            if (isMobile()) {
                switchTab(resolveMobileTab(params.tab));
            } else {
                switchTab('browse');
            }

            requestAnimationFrame(() => syncMobilePanelPosition(currentTab, 'auto'));

            syncMobileChrome();

            const startCard = resolveSelectedCardId(DATA, cardIndex, params.card);

            if (startCard) {
                currentStars = params.stars;
                requestAnimationFrame(() => requestAnimationFrame(() => selectCard(startCard)));
            }
        })();

    return initPromise;
}

export async function mountCardsApp({ container, initialRouteState, onRouteChange }) {
    hostContainer = container;
    hostApi = { initialRouteState: initialRouteState ?? {}, onRouteChange };

    container.classList.add('cards-root');

    if (!container.querySelector('.global-bar')) {
        container.innerHTML = TEMPLATE;
    }

    await init();
    applyRouteState(initialRouteState ?? {});

    return {
        updateRouteState(nextState) {
            applyRouteState(nextState ?? {});
        },
        restoreRoute() {
            updateHostRouteState();
        },
        syncShellMobileActions() {
            syncMobileChrome();
        },
        refresh() {
            onResize();
            syncMobileChrome();
        }
    };
}


