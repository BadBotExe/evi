import { runWithGlobalShellLoader } from '../shell/loading/shellLoader.js?v=55923b6437';
import {
    buildSmithGridEntries,
    buildSmithMobileBrowseSections,
    buildSmithTabSummaries,
    resolveSelectedSmithActId,
    resolveSelectedSmithItemId
} from './app/browserModel.js?v=3075122576';
import { loadSmithData } from './app/dataLoader.js?v=f2673c30b2';
import { normalizeSmithRouteState, serializeSmithRouteState } from './app/urlState.js?v=37d2bf766f';
import { isAtlasImageAsset } from '../shell/lib/imageAtlas.js?v=2593e30b08';

const TEMPLATE = `
    <div class="smith-page">
        <aside class="smith-sidebar-left">
            <div class="smith-detail-panel">
                <div class="smith-item-card">
                    <div class="smith-cell-frame smith-item-thumb" id="smith-item-thumb"></div>
                    <div class="smith-item-meta">
                        <div class="smith-item-name" id="smith-item-name">Select an item</div>
                        <table class="smith-stats-table" id="smith-stats-table"></table>
                    </div>
                </div>

                <section class="smith-recipe-panel">
                    <div class="smith-section-label">Recipe</div>
                    <div class="smith-recipe-list" id="smith-recipe-list"></div>
                    <div class="smith-empty-state shell-hidden" id="smith-recipe-empty">Recipe data has not been added yet.</div>
                </section>
            </div>
        </aside>

        <main class="smith-content-center smith-browser-panel">
            <div class="smith-tab-bar" id="smith-tab-bar"></div>
            <div class="smith-grid" id="smith-grid"></div>
        </main>
    </div>

    <div class="smith-mobile-root">
        <div class="smith-mobile-panel-wrap">
            <section class="smith-mobile-panel smith-mobile-item-panel" data-panel="item">
                <div class="smith-mobile-detail-panel">
                    <div class="smith-item-card">
                        <div class="smith-cell-frame smith-item-thumb" id="m-smith-item-thumb"></div>
                        <div class="smith-item-meta">
                            <div class="smith-item-name" id="m-smith-item-name">Select an item</div>
                            <table class="smith-stats-table" id="m-smith-stats-table"></table>
                        </div>
                    </div>

                    <section class="smith-recipe-panel">
                        <div class="smith-section-label">Recipe</div>
                        <div class="smith-recipe-list" id="m-smith-recipe-list"></div>
                        <div class="smith-empty-state shell-hidden" id="m-smith-recipe-empty">Recipe data has not been added yet.</div>
                    </section>
                </div>
            </section>

            <section class="smith-mobile-panel smith-mobile-browse-panel active" data-panel="browse">
                <div class="smith-mobile-browse-content" id="m-smith-browse-content"></div>
            </section>
        </div>

        <nav class="smith-mobile-tab-bar">
            <button class="smith-mobile-tab" data-tab="item">
                <span class="smith-mobile-tab-icon">&#9881;</span>
                Item
            </button>
            <button class="smith-mobile-tab active" data-tab="browse">
                <span class="smith-mobile-tab-icon">&#128203;</span>
                Browse
            </button>
        </nav>
    </div>
`;

let DATA = null;
let initPromise = null;
let hostApi = null;
let hostContainer = null;
let selectedActId = '';
let selectedItemId = '';
let currentTab = 'browse';
let atlasSpriteClipPathSequence = 0;
const MOBILE_TAB_ORDER = ['item', 'browse'];

function routeStateFromHost() {
    return normalizeSmithRouteState(hostApi.initialRouteState);
}

function updateHostRouteState() {
    const nextState = {
        act: selectedActId,
        item: selectedItemId,
        tab: isMobile() ? currentTab : ''
    };

    if (hostApi.onRouteChange) {
        hostApi.initialRouteState = nextState;
        hostApi.onRouteChange(nextState);
        return;
    }

    const params = serializeSmithRouteState(nextState);
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
}

function createImage(src, alt, className) {
    const image = document.createElement('img');
    image.src = src;
    image.alt = alt;
    if (className) image.className = className;
    return image;
}

function createAtlasSprite(asset, alt, className) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    if (className) svg.setAttribute('class', className);
    svg.setAttribute('viewBox', `0 0 ${asset.width} ${asset.height}`);
    svg.setAttribute('overflow', 'hidden');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', alt || '');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    const clipPathId = `smith-atlas-sprite-clip-${atlasSpriteClipPathSequence++}`;
    clipPath.setAttribute('id', clipPathId);
    clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');

    const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('width', String(asset.width));
    clipRect.setAttribute('height', String(asset.height));
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    svg.appendChild(defs);

    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', asset.url);
    image.setAttribute('clip-path', `url(#${clipPathId})`);
    image.setAttribute('x', String(-asset.x));
    image.setAttribute('y', String(-asset.y));
    image.setAttribute('width', String(asset.sheetWidth));
    image.setAttribute('height', String(asset.sheetHeight));
    image.setAttribute('image-rendering', 'pixelated');
    image.setAttribute('style', 'image-rendering: pixelated; shape-rendering: crispEdges;');
    image.setAttribute('preserveAspectRatio', 'none');
    svg.appendChild(image);
    return svg;
}

function createAssetNode(asset, alt, className) {
    if (isAtlasImageAsset(asset)) {
        return createAtlasSprite(asset, alt, className);
    }
    return createImage(asset, alt, className);
}

function isMobile() {
    if (matchMedia('(pointer: coarse)').matches) return true;
    if (matchMedia('(hover: none)').matches) return true;
    if (/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)) return true;
    return window.innerWidth <= 980;
}

function resolveMobileTab(routeTab) {
    return MOBILE_TAB_ORDER.includes(routeTab) ? routeTab : 'browse';
}

function resolveMobileTabScrollLeft(tab, clientWidth) {
    const tabIndex = MOBILE_TAB_ORDER.indexOf(resolveMobileTab(tab));
    return Math.max(0, tabIndex) * Math.max(0, clientWidth || 0);
}

function clearNode(node) {
    if (node) node.replaceChildren();
}

function renderTabs() {
    const tabBar = document.getElementById('smith-tab-bar');
    if (!tabBar || !DATA) return;
    clearNode(tabBar);

    const tabs = buildSmithTabSummaries(DATA, selectedActId);
    tabs.forEach(tab => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `smith-tab${tab.isActive ? ' active' : ''}`;
        button.textContent = tab.label;
        button.addEventListener('click', () => {
            selectedActId = resolveSelectedSmithActId(DATA, tab.id);
            selectedItemId = resolveSelectedSmithItemId(DATA, selectedItemId, selectedActId);
            renderAll();
            updateHostRouteState();
        });
        tabBar.appendChild(button);
    });
}

function createGridCell(entry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `smith-cell${entry.isSelected ? ' is-selected' : ''}`;
    button.addEventListener('click', () => {
        selectedItemId = entry.item.id;
        renderDetail();
        renderGrid();
        updateHostRouteState();
    });

    const frame = document.createElement('div');
    frame.className = 'smith-cell-frame';
    if (entry.item.image) {
        frame.appendChild(createAssetNode(entry.item.image, entry.item.name, 'smith-cell-image'));
    } else {
        const fallback = document.createElement('div');
        fallback.className = 'smith-cell-fallback';
        fallback.textContent = entry.item.name.slice(0, 1).toUpperCase();
        frame.appendChild(fallback);
    }

    const name = document.createElement('span');
    name.className = 'smith-cell-name';
    name.textContent = entry.item.name;

    button.append(frame, name);
    return button;
}

function createMobileBrowseCell(entry, actId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `smith-mobile-cell${entry.isSelected ? ' is-selected' : ''}`;
    button.addEventListener('click', () => {
        selectedActId = actId;
        selectedItemId = entry.item.id;
        renderAll();
        switchTab('item');
    });

    const frame = document.createElement('div');
    frame.className = 'smith-mobile-cell-frame';
    if (entry.item.image) {
        frame.appendChild(createAssetNode(entry.item.image, entry.item.name, 'smith-mobile-cell-image'));
    } else {
        const fallback = document.createElement('div');
        fallback.className = 'smith-cell-fallback';
        fallback.textContent = entry.item.name.slice(0, 1).toUpperCase();
        frame.appendChild(fallback);
    }

    const name = document.createElement('span');
    name.className = 'smith-mobile-cell-name';
    name.textContent = entry.item.name;

    button.append(frame, name);
    return button;
}

function renderGrid() {
    const grid = document.getElementById('smith-grid');
    if (!grid || !DATA) return;
    clearNode(grid);

    const tab = DATA.tabs.find(entry => entry.id === selectedActId) ?? null;
    if (!tab) return;

    buildSmithGridEntries(tab, DATA.itemsById, selectedItemId).forEach(entry => {
        grid.appendChild(createGridCell(entry));
    });
}

function renderStatsTable(tableId, stats) {
    const table = document.getElementById(tableId);
    if (!table) return;
    clearNode(table);

    stats.forEach(stat => {
        const row = document.createElement('tr');
        const labelCell = document.createElement('td');
        const valueCell = document.createElement('td');
        labelCell.textContent = stat.label;
        valueCell.textContent = stat.value;
        row.append(labelCell, valueCell);
        table.appendChild(row);
    });
}

function renderRecipe(listId, emptyId, recipe) {
    const list = document.getElementById(listId);
    const empty = document.getElementById(emptyId);
    if (!list || !empty) return;
    clearNode(list);

    const ingredients = recipe?.ingredients ?? [];
    const shouldShowEmpty = ingredients.length === 0;
    empty.classList.toggle('shell-hidden', !shouldShowEmpty);
    if (shouldShowEmpty) return;

    ingredients.forEach(entry => {
        const ingredient = document.createElement('div');
        ingredient.className = 'smith-ingredient';

        const icon = document.createElement('div');
        icon.className = 'smith-ingredient-icon';
        if (entry.item.image) {
            icon.appendChild(createAssetNode(entry.item.image, entry.item.name, 'smith-ingredient-image'));
        } else {
            const fallback = document.createElement('div');
            fallback.className = 'smith-ingredient-fallback';
            fallback.textContent = entry.item.name.slice(0, 1).toUpperCase();
            icon.appendChild(fallback);
        }

        const body = document.createElement('div');
        body.className = 'smith-ingredient-body';

        const name = document.createElement('div');
        name.className = 'smith-ingredient-name';
        name.textContent = entry.item.name;
        body.appendChild(name);

        if (entry.item.description) {
            const hint = document.createElement('div');
            hint.className = 'smith-ingredient-hint';
            hint.textContent = entry.item.description;
            body.appendChild(hint);
        }

        const quantity = document.createElement('div');
        quantity.className = 'smith-ingredient-quantity';
        quantity.textContent = String(entry.quantity);

        ingredient.append(icon, body, quantity);
        list.appendChild(ingredient);
    });
}

function renderDetailPanel({ thumbId, nameId, statsTableId, recipeListId, recipeEmptyId }) {
    const item = DATA?.itemsById?.[selectedItemId] ?? null;
    const gear = DATA?.gearByItemId?.get(selectedItemId) ?? null;
    const recipe = DATA?.recipesByItemId?.[selectedItemId] ?? null;

    const thumb = document.getElementById(thumbId);
    const name = document.getElementById(nameId);
    if (!thumb || !name) return;

    clearNode(thumb);
    if (item?.image) {
        thumb.appendChild(createAssetNode(item.image, item.name, 'smith-item-image'));
    } else if (item) {
        const fallback = document.createElement('div');
        fallback.className = 'smith-item-fallback';
        fallback.textContent = item.name.slice(0, 1).toUpperCase();
        thumb.appendChild(fallback);
    }

    name.textContent = item?.name ?? 'Select an item';
    renderStatsTable(statsTableId, gear?.stats ?? []);
    renderRecipe(recipeListId, recipeEmptyId, recipe);
}

function renderDetail() {
    renderDetailPanel({
        thumbId: 'smith-item-thumb',
        nameId: 'smith-item-name',
        statsTableId: 'smith-stats-table',
        recipeListId: 'smith-recipe-list',
        recipeEmptyId: 'smith-recipe-empty'
    });
    renderDetailPanel({
        thumbId: 'm-smith-item-thumb',
        nameId: 'm-smith-item-name',
        statsTableId: 'm-smith-stats-table',
        recipeListId: 'm-smith-recipe-list',
        recipeEmptyId: 'm-smith-recipe-empty'
    });
}

function renderMobileBrowse() {
    const root = document.getElementById('m-smith-browse-content');
    if (!root || !DATA) return;
    clearNode(root);

    buildSmithMobileBrowseSections(DATA, selectedItemId).forEach(section => {
        const block = document.createElement('section');
        block.className = 'smith-mobile-section';

        const label = document.createElement('div');
        label.className = 'smith-mobile-section-label';
        label.textContent = section.label;

        const grid = document.createElement('div');
        grid.className = 'smith-mobile-grid';

        section.entries.forEach(entry => {
            grid.appendChild(createMobileBrowseCell(entry, section.actId));
        });

        block.append(label, grid);
        root.appendChild(block);
    });
}

function switchTab(tab) {
    currentTab = resolveMobileTab(tab);

    document.querySelectorAll('.smith-mobile-tab').forEach(button => {
        button.classList.toggle('active', button.dataset.tab === currentTab);
    });

    document.querySelectorAll('.smith-mobile-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.panel === currentTab);
    });

    syncMobilePanelPosition(currentTab, 'smooth');
    updateHostRouteState();
}

function syncMobilePanelPosition(tab, behavior = 'auto', attempt = 0) {
    const wrap = document.querySelector('.smith-mobile-panel-wrap');
    if (!wrap) return;

    const targetLeft = resolveMobileTabScrollLeft(tab, wrap.clientWidth);
    if (!targetLeft && wrap.clientWidth <= 0 && attempt < 2) {
        requestAnimationFrame(() => syncMobilePanelPosition(tab, behavior, attempt + 1));
        return;
    }

    wrap.scrollTo({ left: targetLeft, behavior });
}

function initMobileSwipe() {
    const wrap = document.querySelector('.smith-mobile-panel-wrap');
    if (!wrap) return;

    let snapTimer = null;
    wrap.addEventListener('scroll', () => {
        clearTimeout(snapTimer);
        snapTimer = setTimeout(() => {
            const idx = Math.round(wrap.scrollLeft / (wrap.clientWidth || 1));
            const tab = MOBILE_TAB_ORDER[Math.max(0, Math.min(idx, MOBILE_TAB_ORDER.length - 1))];
            if (tab === currentTab) return;

            currentTab = tab;

            document.querySelectorAll('.smith-mobile-tab').forEach(button => {
                button.classList.toggle('active', button.dataset.tab === tab);
            });
            document.querySelectorAll('.smith-mobile-panel').forEach(panel => {
                panel.classList.toggle('active', panel.dataset.panel === tab);
            });

            updateHostRouteState();
        }, 80);
    });
}

function initMobileTabs() {
    document.querySelectorAll('.smith-mobile-tab').forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
}

function applyLayoutClass(layoutName) {
    if (!hostContainer) return;
    hostContainer.classList.toggle('smith-layout-desktop', layoutName === 'desktop');
    hostContainer.classList.toggle('smith-layout-mobile', layoutName === 'mobile');
}

function applyLayoutMode() {
    applyLayoutClass(isMobile() ? 'mobile' : 'desktop');
}

function onResize() {
    applyLayoutMode();
    syncMobilePanelPosition(currentTab, 'auto');
}

function renderAll() {
    renderTabs();
    renderGrid();
    renderDetail();
    renderMobileBrowse();
}

function applyRouteState(state) {
    hostApi.initialRouteState = normalizeSmithRouteState(state);
    if (!DATA) return;

    const routeState = routeStateFromHost();
    selectedActId = resolveSelectedSmithActId(DATA, routeState.act || DATA.default_act_id);
    selectedItemId = resolveSelectedSmithItemId(DATA, routeState.item, selectedActId);
    currentTab = resolveMobileTab(routeState.tab);
    renderAll();
    if (isMobile()) {
        switchTab(currentTab);
        return;
    }
    currentTab = 'browse';
    syncMobilePanelPosition(currentTab, 'auto');
}

function showSmithLoadError() {
    if (!hostContainer) return;
    hostContainer.innerHTML = '<p style="color:#f88;padding:2rem;font-size:16px">Could not load smith data</p>';
}

async function init() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            await runWithGlobalShellLoader(async () => {
                DATA = await loadSmithData({
                    fetchImpl: fetch,
                    moduleUrl: import.meta.url
                });
            });
        } catch(error) {
            console.log(error);
            initPromise = null;
            showSmithLoadError();
            throw new Error('Could not load smith data');
        }
    })();

    return initPromise;
}

export async function mountSmithApp({ container, initialRouteState, onRouteChange } = {}) {
    hostContainer = container;
    hostApi = { initialRouteState: initialRouteState ?? {}, onRouteChange };

    container.classList.add('smith-root');

    if (!container.querySelector('.smith-page')) {
        container.innerHTML = TEMPLATE;
    }

    await init();
    applyLayoutMode();
    initMobileTabs();
    initMobileSwipe();
    window.addEventListener('resize', onResize);
    applyRouteState(initialRouteState ?? {});
    requestAnimationFrame(() => syncMobilePanelPosition(currentTab, 'auto'));

    return {
        updateRouteState(nextState) {
            applyRouteState(nextState ?? {});
        },
        restoreRoute() {
            updateHostRouteState();
        },
        refresh() {
            onResize();
            renderAll();
        }
    };
}
