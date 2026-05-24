import { runWithGlobalShellLoader } from '../shell/loading/shellLoader.js?v=55923b6437';
import {
    buildSmithGridEntries,
    buildSmithMobileBrowseSections,
    buildSmithTabSummaries,
    resolveSelectedSmithActId,
    resolveSelectedSmithItemId
} from './app/browserModel.js?v=78835da585';
import { formatCompactNumber } from '../bonuses/lib/utils.js?v=a60e1a39f6';
import { makeDraggable } from '../bonuses/lib/utils.js?v=a60e1a39f6';
import { buildFlattenedSmithRecipeRows } from './app/recipeTree.js?v=9f4c57e97c';
import { loadSmithData } from './app/dataLoader.js?v=52caed27e1';
import { decodeSmithRouteState, normalizeSmithRouteState, serializeSmithRouteState } from './app/urlState.js?v=4241cadb7c';
import {
    buildSmelteryTimingRows,
    calculateSmelteryGemshopMultiplier,
    calculateSmelterySpeedFromMeasuredSeconds,
    normalizeSmelteryGemshopLevel,
    normalizeSmelterySpeed,
    parseSmelteryMeasuredDuration
} from './app/smelteryModel.js?v=ae52f364a0';
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
                    <div class="smith-smeltery-control shell-hidden" id="smith-smeltery-control">
                        <div class="smith-smeltery-control-shell">
                            <div class="smith-smeltery-control-title">Smeltery Speed</div>
                            <div class="smith-smeltery-control-row">
                                <select class="engineering-input smith-smeltery-input smith-smeltery-gemshop-input"
                                        id="smith-smeltery-gemshop-input"
                                        aria-label="Gemshop Smeltery Speed"></select>
                                <input class="engineering-input smith-smeltery-input"
                                       id="smith-smeltery-speed-input"
                                       type="number"
                                       step="1"
                                       inputmode="decimal"
                                       aria-label="Smeltery Speed Percent">
                                <button type="button"
                                        class="smith-smeltery-calc-toggle"
                                        id="smith-smeltery-calc-toggle"
                                        aria-label="Open smeltery speed calculator">🧮</button>
                            </div>
                        </div>
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
                        <div class="smith-smeltery-control shell-hidden" id="m-smith-smeltery-control">
                            <div class="smith-smeltery-control-shell">
                                <div class="smith-smeltery-control-title">Smeltery Speed</div>
                                <div class="smith-smeltery-control-row">
                                    <select class="engineering-input smith-smeltery-input smith-smeltery-gemshop-input"
                                            id="m-smith-smeltery-gemshop-input"
                                            aria-label="Gemshop Smeltery Speed"></select>
                                    <input class="engineering-input smith-smeltery-input"
                                           id="m-smith-smeltery-speed-input"
                                           type="number"
                                           step="1"
                                           inputmode="decimal"
                                           aria-label="Smeltery Speed Percent">
                                    <button type="button"
                                            class="smith-smeltery-calc-toggle"
                                            id="m-smith-smeltery-calc-toggle"
                                            aria-label="Open smeltery speed calculator">🧮</button>
                                </div>
                            </div>
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

    <div class="smith-smeltery-calc-popover shell-hidden" id="smith-smeltery-calc-popover">
        <div class="smith-smeltery-calc-popover-header">
            <div>
                <div class="smith-smeltery-calc-popover-title">Smeltery Speed Calculator</div>
                <div class="smith-smeltery-calc-popover-subtitle">Uses the selected gemshop tier as the base and writes the remaining % speed</div>
            </div>
            <button type="button"
                    class="smith-smeltery-calc-close"
                    id="smith-smeltery-calc-close"
                    aria-label="Close smeltery speed calculator">&times;</button>
        </div>
        <div class="smith-smeltery-calc-form">
            <select class="engineering-input smith-smeltery-calc-field"
                    id="smith-smeltery-calc-item-input"
                    aria-label="Smeltery item"></select>
            <div class="smith-smeltery-calc-time-row">
                <input class="engineering-input smith-smeltery-calc-field"
                       id="smith-smeltery-calc-hours-input"
                       type="number"
                       min="0"
                       step="1"
                       inputmode="numeric"
                       placeholder="hh"
                       aria-label="Hours">
                <input class="engineering-input smith-smeltery-calc-field"
                       id="smith-smeltery-calc-minutes-input"
                       type="number"
                       min="0"
                       max="59"
                       step="1"
                       inputmode="numeric"
                       placeholder="mm"
                       aria-label="Minutes">
                <input class="engineering-input smith-smeltery-calc-field"
                       id="smith-smeltery-calc-seconds-input"
                       type="number"
                       min="0"
                       max="59"
                       step="1"
                       inputmode="numeric"
                       placeholder="ss"
                       aria-label="Seconds">
            </div>
            <button type="button"
                    class="smith-smeltery-calc-apply"
                    id="smith-smeltery-calc-apply">Calculate</button>
        </div>
    </div>

    <div class="mobile-drawer-overlay smith-smeltery-calc-overlay" id="smith-smeltery-calc-overlay"></div>
    <div class="mobile-drawer smith-smeltery-calc-sheet" id="smith-smeltery-calc-sheet">
        <div class="mobile-drawer-header">
            <div class="mobile-drawer-handle"></div>
            <button type="button"
                    class="mobile-drawer-close"
                    id="m-smith-smeltery-calc-close"
                    aria-label="Close smeltery speed calculator">&times;</button>
        </div>
        <div class="mobile-drawer-body">
            <div class="smith-smeltery-calc-sheet-card">
                <div class="smith-smeltery-calc-popover-header">
                    <div>
                        <div class="smith-smeltery-calc-popover-title">Smeltery Speed Calculator</div>
                        <div class="smith-smeltery-calc-popover-subtitle">Uses the selected gemshop tier as the base and writes the remaining % speed</div>
                    </div>
                </div>
                <div class="smith-smeltery-calc-form">
                    <select class="engineering-input smith-smeltery-calc-field"
                            id="m-smith-smeltery-calc-item-input"
                            aria-label="Smeltery item"></select>
                    <div class="smith-smeltery-calc-time-row">
                        <input class="engineering-input smith-smeltery-calc-field"
                               id="m-smith-smeltery-calc-hours-input"
                               type="number"
                               min="0"
                               step="1"
                               inputmode="numeric"
                               placeholder="hh"
                               aria-label="Hours">
                        <input class="engineering-input smith-smeltery-calc-field"
                               id="m-smith-smeltery-calc-minutes-input"
                               type="number"
                               min="0"
                               max="59"
                               step="1"
                               inputmode="numeric"
                               placeholder="mm"
                               aria-label="Minutes">
                        <input class="engineering-input smith-smeltery-calc-field"
                               id="m-smith-smeltery-calc-seconds-input"
                               type="number"
                               min="0"
                               max="59"
                               step="1"
                               inputmode="numeric"
                               placeholder="ss"
                               aria-label="Seconds">
                    </div>
                    <button type="button"
                            class="smith-smeltery-calc-apply"
                            id="m-smith-smeltery-calc-apply">Calculate</button>
                </div>
            </div>
        </div>
    </div>
`;

let DATA = null;
let initPromise = null;
let hostApi = null;
let hostContainer = null;
let selectedActId = '';
let selectedItemId = '';
let smelterySpeed = '';
let smelteryGemshopLevel = '0';
let smelteryCalculatorOpen = false;
let smelteryCalculatorItemId = '';
let smelteryCalculatorHours = '';
let smelteryCalculatorMinutes = '';
let smelteryCalculatorSeconds = '';
let smelteryCalculatorAnchorId = '';
let currentTab = 'browse';
let atlasSpriteClipPathSequence = 0;
let expandedRecipePaths = new Set();
let smelteryCalculatorDragReady = false;
let mobileBrowseScrollTop = 0;
const MOBILE_TAB_ORDER = ['item', 'browse'];

function routeStateFromHost() {
    return normalizeSmithRouteState(hostApi.initialRouteState);
}

function isSelectedSmelteryItem() {
    return DATA?.smelteryItemIds?.has(selectedItemId) ?? false;
}

function smelteryItems() {
    const tab = DATA?.tabs?.find(entry => entry.id === 'smeltery') ?? null;
    return (tab?.item_ids ?? [])
        .map(itemId => DATA?.itemsById?.[itemId] ?? null)
        .filter(Boolean);
}

function resolveSmelteryCalculatorItemId(itemId = '') {
    if (itemId && DATA?.smelteryItemIds?.has(itemId)) return itemId;
    if (isSelectedSmelteryItem()) return selectedItemId;
    return smelteryItems()[0]?.id ?? '';
}

function updateHostRouteState() {
    const nextState = {
        act: selectedActId,
        item: selectedItemId,
        tab: isMobile() ? currentTab : '',
        speed: isSelectedSmelteryItem() ? smelterySpeed : '',
        gemshop: isSelectedSmelteryItem() ? smelteryGemshopLevel : ''
    };

    const params = serializeSmithRouteState(nextState, { data: DATA });

    if (hostApi.onRouteChange) {
        const compactState = Object.fromEntries(params.entries());
        hostApi.initialRouteState = compactState;
        hostApi.onRouteChange(compactState);
        return;
    }

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

function mobileBrowsePanel() {
    return document.querySelector('.smith-mobile-browse-panel');
}

function captureMobileBrowseScroll() {
    const panel = mobileBrowsePanel();
    if (!panel) return;
    mobileBrowseScrollTop = panel.scrollTop;
}

function restoreMobileBrowseScroll() {
    const panel = mobileBrowsePanel();
    if (!panel) return;
    panel.scrollTop = mobileBrowseScrollTop;
}

function resetRecipeExpansion() {
    expandedRecipePaths = new Set();
}

function toggleRecipePath(path) {
    if (!path) return;
    if (expandedRecipePaths.has(path)) {
        expandedRecipePaths.delete(path);
        return;
    }
    expandedRecipePaths.add(path);
}

function formatRecipeQuantity(value) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        return formatCompactNumber(numeric, { compactFrom: 1_000_000_000 });
    }
    return String(value ?? '');
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
        resetRecipeExpansion();
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
        captureMobileBrowseScroll();
        selectedActId = actId;
        resetRecipeExpansion();
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

    const ingredients = buildFlattenedSmithRecipeRows({
        itemId: recipe?.item_id ?? '',
        recipesByItemId: DATA?.recipesByItemId,
        itemsById: DATA?.itemsById,
        expandedPaths: expandedRecipePaths
    });
    const shouldShowEmpty = ingredients.length === 0;
    empty.classList.toggle('shell-hidden', !shouldShowEmpty);
    if (shouldShowEmpty) return;

    ingredients.forEach(entry => {
        const ingredient = document.createElement('div');
        ingredient.className = `smith-ingredient${entry.canExpand ? ' is-craftable' : ''}${entry.isExpanded ? ' is-expanded' : ''}`;
        ingredient.style.setProperty('--smith-recipe-depth', String(entry.depth));
        if (entry.canExpand) {
            ingredient.addEventListener('click', () => {
                toggleRecipePath(entry.path);
                renderDetail();
            });
        }

        const icon = document.createElement('div');
        icon.className = 'smith-ingredient-icon';
        if (entry.item?.image) {
            icon.appendChild(createAssetNode(entry.item.image, entry.item.name, 'smith-ingredient-image'));
        } else {
            const fallback = document.createElement('div');
            fallback.className = 'smith-ingredient-fallback';
            fallback.textContent = (entry.item?.name ?? entry.item_id ?? '?').slice(0, 1).toUpperCase();
            icon.appendChild(fallback);
        }

        const body = document.createElement('div');
        body.className = 'smith-ingredient-body';

        const name = document.createElement('div');
        name.className = 'smith-ingredient-name';
        name.textContent = entry.item?.name ?? entry.item_id;
        body.appendChild(name);

        if (entry.item?.description) {
            const hint = document.createElement('div');
            hint.className = 'smith-ingredient-hint';
            hint.textContent = entry.item.description;
            body.appendChild(hint);
        }

        const quantity = document.createElement('div');
        quantity.className = 'smith-ingredient-quantity';
        if (entry.canExpand) {
            const badge = document.createElement('button');
            badge.type = 'button';
            badge.className = 'smith-subrecipe-badge';
            badge.setAttribute('aria-label', `${entry.isExpanded ? 'Collapse' : 'Expand'} ${entry.item?.name ?? entry.item_id} recipe`);
            badge.addEventListener('click', event => {
                event.stopPropagation();
                toggleRecipePath(entry.path);
                renderDetail();
            });

            const badgeCount = document.createElement('span');
            badgeCount.className = 'smith-subrecipe-badge-count';
            badgeCount.textContent = String(DATA?.recipesByItemId?.[entry.item_id]?.ingredients?.length ?? 0);

            const badgeLabel = document.createElement('span');
            badgeLabel.className = 'smith-subrecipe-badge-label';
            badgeLabel.textContent = 'sub';

            const chevron = document.createElement('span');
            chevron.className = `smith-subrecipe-badge-chevron${entry.isExpanded ? '' : ' collapsed'}`;
            chevron.innerHTML = '&#x25BC;';

            badge.append(badgeCount, badgeLabel, chevron);
            quantity.appendChild(badge);
        }

        const quantityValue = document.createElement('span');
        quantityValue.className = 'smith-ingredient-quantity-value';
        quantityValue.textContent = formatRecipeQuantity(entry.effectiveQuantity);
        quantity.appendChild(quantityValue);

        ingredient.append(icon, body, quantity);
        list.appendChild(ingredient);
    });
}

function renderSmelteryControl(controlId, inputId) {
    const control = document.getElementById(controlId);
    const input = document.getElementById(inputId);
    if (!control || !input) return;

    const shouldShow = isSelectedSmelteryItem();
    control.classList.toggle('shell-hidden', !shouldShow);
    if (!shouldShow) return;

    const normalizedSpeed = normalizeSmelterySpeed(smelterySpeed);
    smelterySpeed = normalizedSpeed;
    input.value = normalizedSpeed;
}

function renderSmelteryGemshopSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const config = DATA?.smelteryGemshop ?? {};

    if (select.dataset.smithOptionsBound !== 'true') {
        clearNode(select);
        const offOption = document.createElement('option');
        offOption.value = '0';
        offOption.textContent = 'Off';
        select.appendChild(offOption);

        for (let tier = 1; tier <= (config.maxLevel ?? 0); tier += 1) {
            const option = document.createElement('option');
            option.value = String(tier);
            option.textContent = `Tier ${tier}`;
            select.appendChild(option);
        }

        select.dataset.smithOptionsBound = 'true';
    }

    smelteryGemshopLevel = normalizeSmelteryGemshopLevel(smelteryGemshopLevel, config.maxLevel);
    select.value = smelteryGemshopLevel;
}

function renderSmelteryCalculatorSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const items = smelteryItems();
    if (select.dataset.smithOptionsBound !== 'true') {
        clearNode(select);
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            select.appendChild(option);
        });
        select.dataset.smithOptionsBound = 'true';
    }

    smelteryCalculatorItemId = resolveSmelteryCalculatorItemId(smelteryCalculatorItemId);
    select.value = smelteryCalculatorItemId;
}

function setSmelteryCalculatorInputValue(inputId, value) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.value = value;
}

function renderSmelteryCalculatorForm(prefix = '') {
    renderSmelteryCalculatorSelect(`${prefix}smith-smeltery-calc-item-input`);
    setSmelteryCalculatorInputValue(`${prefix}smith-smeltery-calc-hours-input`, smelteryCalculatorHours);
    setSmelteryCalculatorInputValue(`${prefix}smith-smeltery-calc-minutes-input`, smelteryCalculatorMinutes);
    setSmelteryCalculatorInputValue(`${prefix}smith-smeltery-calc-seconds-input`, smelteryCalculatorSeconds);
}

function positionSmelteryCalculatorPopover() {
    const popover = document.getElementById('smith-smeltery-calc-popover');
    const button = smelteryCalculatorAnchorId ? document.getElementById(smelteryCalculatorAnchorId) : null;
    if (!popover || !button || isMobile()) return;

    if (popover.dataset.dragged === 'true') return;

    const margin = 12;
    const gap = 10;
    const buttonRect = button.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const width = popoverRect.width || 320;
    const height = popoverRect.height || 220;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const preferredLeft = buttonRect.right - width;
    const left = Math.max(margin, Math.min(maxLeft, preferredLeft));
    const fitsBelow = buttonRect.bottom + gap + height <= window.innerHeight - margin;
    const top = fitsBelow
        ? buttonRect.bottom + gap
        : Math.max(margin, buttonRect.top - height - gap);

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
}

function closeSmelteryCalculator() {
    smelteryCalculatorOpen = false;
    smelteryCalculatorAnchorId = '';
    renderSmelteryCalculator();
}

function openSmelteryCalculator(anchorId) {
    smelteryCalculatorItemId = resolveSmelteryCalculatorItemId(smelteryCalculatorItemId);
    smelteryCalculatorOpen = true;
    smelteryCalculatorAnchorId = anchorId ?? '';
    const popover = document.getElementById('smith-smeltery-calc-popover');
    if (popover) popover.dataset.dragged = 'false';
    renderSmelteryCalculator();
}

function renderSmelteryCalculator() {
    const popover = document.getElementById('smith-smeltery-calc-popover');
    const overlay = document.getElementById('smith-smeltery-calc-overlay');
    const sheet = document.getElementById('smith-smeltery-calc-sheet');
    const mobileMode = isMobile();
    const showDesktopPopover = smelteryCalculatorOpen && !mobileMode;
    const showMobileSheet = smelteryCalculatorOpen && mobileMode;

    renderSmelteryCalculatorForm('');
    renderSmelteryCalculatorForm('m-');

    if (popover) {
        popover.classList.toggle('shell-hidden', !showDesktopPopover);
        popover.classList.toggle('open', showDesktopPopover);
        if (!smelteryCalculatorDragReady) {
            makeDraggable(popover, popover.querySelector('.smith-smeltery-calc-popover-header'), null);
            popover.querySelector('.smith-smeltery-calc-popover-header')?.addEventListener('mousedown', event => {
                if (event.button !== 0) return;
                popover.dataset.dragged = 'true';
            });
            popover.dataset.dragged = 'false';
            smelteryCalculatorDragReady = true;
        }
    }
    if (overlay) overlay.classList.toggle('open', showMobileSheet);
    if (sheet) sheet.classList.toggle('open', showMobileSheet);
    if (showDesktopPopover) {
        requestAnimationFrame(() => positionSmelteryCalculatorPopover());
    }
}

function applySmelteryCalculator() {
    const recipe = DATA?.recipesByItemId?.[resolveSmelteryCalculatorItemId(smelteryCalculatorItemId)] ?? null;
    const gemshopMultiplier = calculateSmelteryGemshopMultiplier(
        smelteryGemshopLevel,
        DATA?.smelteryGemshop
    );
    const measuredSeconds = parseSmelteryMeasuredDuration(
        smelteryCalculatorHours,
        smelteryCalculatorMinutes,
        smelteryCalculatorSeconds
    );
    const calculatedSpeed = calculateSmelterySpeedFromMeasuredSeconds(
        recipe?.base_time,
        measuredSeconds,
        gemshopMultiplier
    );
    if (!Number.isFinite(calculatedSpeed)) return;
    smelterySpeed = normalizeSmelterySpeed(Number(calculatedSpeed.toFixed(3)));
    closeSmelteryCalculator();
    renderDetail();
    updateHostRouteState();
}

function renderDetailPanel({ thumbId, nameId, statsTableId, recipeListId, recipeEmptyId }) {
    const item = DATA?.itemsById?.[selectedItemId] ?? null;
    const gear = DATA?.gearByItemId?.get(selectedItemId) ?? null;
    const recipe = DATA?.recipesByItemId?.[selectedItemId] ?? null;
    const gemshopMultiplier = calculateSmelteryGemshopMultiplier(
        smelteryGemshopLevel,
        DATA?.smelteryGemshop
    );
    const timingRows = isSelectedSmelteryItem() && recipe?.base_time
        ? buildSmelteryTimingRows(recipe, smelterySpeed, gemshopMultiplier)
        : [];

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
    renderStatsTable(statsTableId, isSelectedSmelteryItem() ? timingRows : (gear?.stats ?? []));
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
    renderSmelteryControl('smith-smeltery-control', 'smith-smeltery-speed-input');
    renderSmelteryGemshopSelect('smith-smeltery-gemshop-input');
    renderDetailPanel({
        thumbId: 'm-smith-item-thumb',
        nameId: 'm-smith-item-name',
        statsTableId: 'm-smith-stats-table',
        recipeListId: 'm-smith-recipe-list',
        recipeEmptyId: 'm-smith-recipe-empty'
    });
    renderSmelteryControl('m-smith-smeltery-control', 'm-smith-smeltery-speed-input');
    renderSmelteryGemshopSelect('m-smith-smeltery-gemshop-input');
    renderSmelteryCalculator();
}

function renderMobileBrowse() {
    const root = document.getElementById('m-smith-browse-content');
    if (!root || !DATA) return;
    captureMobileBrowseScroll();
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

    restoreMobileBrowseScroll();
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
    if (currentTab === 'browse') {
        requestAnimationFrame(() => restoreMobileBrowseScroll());
    }
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

function initMobileBrowseScrollTracking() {
    const panel = mobileBrowsePanel();
    if (!panel || panel.dataset.smithScrollBound === 'true') return;

    panel.addEventListener('scroll', () => {
        mobileBrowseScrollTop = panel.scrollTop;
    }, { passive: true });
    panel.dataset.smithScrollBound = 'true';
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
    if (smelteryCalculatorOpen) {
        renderSmelteryCalculator();
    }
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

    const routeState = decodeSmithRouteState(routeStateFromHost(), { data: DATA });
    smelterySpeed = normalizeSmelterySpeed(routeState.speed);
    smelteryGemshopLevel = normalizeSmelteryGemshopLevel(routeState.gemshop, DATA?.smelteryGemshop?.maxLevel);
    const previousSelectedItemId = selectedItemId;
    selectedActId = resolveSelectedSmithActId(DATA, routeState.act || DATA.default_act_id);
    selectedItemId = resolveSelectedSmithItemId(DATA, routeState.item, selectedActId);
    if (selectedItemId !== previousSelectedItemId) {
        resetRecipeExpansion();
    }
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

function updateSmelterySpeed(rawValue) {
    smelterySpeed = normalizeSmelterySpeed(rawValue);
    renderDetail();
    updateHostRouteState();
}

function updateSmelteryGemshopLevel(rawValue) {
    smelteryGemshopLevel = normalizeSmelteryGemshopLevel(rawValue, DATA?.smelteryGemshop?.maxLevel);
    renderDetail();
    updateHostRouteState();
}

function updateSmelteryCalculatorItem(rawValue) {
    smelteryCalculatorItemId = resolveSmelteryCalculatorItemId(rawValue);
    renderSmelteryCalculator();
}

function updateSmelteryCalculatorPart(part, rawValue) {
    const nextValue = rawValue == null ? '' : String(rawValue).trim();
    if (part === 'hours') smelteryCalculatorHours = nextValue;
    if (part === 'minutes') smelteryCalculatorMinutes = nextValue;
    if (part === 'seconds') smelteryCalculatorSeconds = nextValue;
    renderSmelteryCalculator();
}

function initSmelteryInputs() {
    [
        document.getElementById('smith-smeltery-speed-input'),
        document.getElementById('m-smith-smeltery-speed-input')
    ].forEach(input => {
        if (!input || input.dataset.smithBound === 'true') return;
        const handleInput = event => updateSmelterySpeed(event.target.value);
        input.addEventListener('input', handleInput);
        input.addEventListener('change', handleInput);
        input.dataset.smithBound = 'true';
    });

    [
        document.getElementById('smith-smeltery-gemshop-input'),
        document.getElementById('m-smith-smeltery-gemshop-input')
    ].forEach(select => {
        if (!select || select.dataset.smithBound === 'true') return;
        const handleChange = event => updateSmelteryGemshopLevel(event.target.value);
        select.addEventListener('input', handleChange);
        select.addEventListener('change', handleChange);
        select.dataset.smithBound = 'true';
    });

    [
        document.getElementById('smith-smeltery-calc-toggle'),
        document.getElementById('m-smith-smeltery-calc-toggle')
    ].forEach(button => {
        if (!button || button.dataset.smithBound === 'true') return;
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            openSmelteryCalculator(button.id);
        });
        button.dataset.smithBound = 'true';
    });

    [
        document.getElementById('smith-smeltery-calc-close'),
        document.getElementById('m-smith-smeltery-calc-close'),
        document.getElementById('smith-smeltery-calc-overlay')
    ].forEach(button => {
        if (!button || button.dataset.smithBound === 'true') return;
        button.addEventListener('click', closeSmelteryCalculator);
        button.dataset.smithBound = 'true';
    });

    [
        document.getElementById('smith-smeltery-calc-item-input'),
        document.getElementById('m-smith-smeltery-calc-item-input')
    ].forEach(select => {
        if (!select || select.dataset.smithBound === 'true') return;
        const handleChange = event => updateSmelteryCalculatorItem(event.target.value);
        select.addEventListener('input', handleChange);
        select.addEventListener('change', handleChange);
        select.dataset.smithBound = 'true';
    });

    [
        ['smith-smeltery-calc-hours-input', 'hours'],
        ['smith-smeltery-calc-minutes-input', 'minutes'],
        ['smith-smeltery-calc-seconds-input', 'seconds'],
        ['m-smith-smeltery-calc-hours-input', 'hours'],
        ['m-smith-smeltery-calc-minutes-input', 'minutes'],
        ['m-smith-smeltery-calc-seconds-input', 'seconds']
    ].forEach(([inputId, part]) => {
        const input = document.getElementById(inputId);
        if (!input || input.dataset.smithBound === 'true') return;
        const handleInput = event => updateSmelteryCalculatorPart(part, event.target.value);
        input.addEventListener('input', handleInput);
        input.addEventListener('change', handleInput);
        input.dataset.smithBound = 'true';
    });

    [
        document.getElementById('smith-smeltery-calc-apply'),
        document.getElementById('m-smith-smeltery-calc-apply')
    ].forEach(button => {
        if (!button || button.dataset.smithBound === 'true') return;
        button.addEventListener('click', applySmelteryCalculator);
        button.dataset.smithBound = 'true';
    });

    if (document.body.dataset.smithCalcDismissBound !== 'true') {
        document.addEventListener('click', event => {
            if (!smelteryCalculatorOpen || isMobile()) return;
            const popover = document.getElementById('smith-smeltery-calc-popover');
            const toggle = smelteryCalculatorAnchorId ? document.getElementById(smelteryCalculatorAnchorId) : null;
            if (popover?.contains(event.target) || toggle?.contains(event.target)) return;
            closeSmelteryCalculator();
        });
        window.addEventListener('keydown', event => {
            if (event.key === 'Escape' && smelteryCalculatorOpen) {
                closeSmelteryCalculator();
            }
        });
        document.body.dataset.smithCalcDismissBound = 'true';
    }
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
    initSmelteryInputs();
    initMobileTabs();
    initMobileSwipe();
    initMobileBrowseScrollTracking();
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
