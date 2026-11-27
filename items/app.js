import { clampPopover, formatFixedNumber, makeDraggable, observePopoverResize, positionPopover } from '../bonuses/lib/utils.js?v=cb138a904c';
import { gameTerm, onLocaleChange, t, translateLabel } from '../i18n/locale.js?v=c846ac840a';
import { loadSmithData } from '../smith/app/dataLoader.js?v=411e79c9b0';
import { createAssetNode, renderSmithRecipeRows } from '../smith/module.js?v=3c7e6f6b4c';
import { isAtlasImageAsset } from '../shell/lib/imageAtlas.js?v=2593e30b08';
import { buildFlattenedSmithRecipeRows, hasSmithRecipe } from '../smith/app/recipeTree.js?v=b35f588051';
import gameRu from '../i18n/game-ru.js?v=c7562d5845';
import { buildCatalog, catalogFilterTypes, catalogHref, catalogQueryLimit, catalogRouteKeys, catalogSourceGroups, filterCatalog, parseCatalogFilters, parseCatalogSearch } from './catalog.js?v=fd2f2dacd6';

async function readJson(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
    return response.json();
}

function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
}

const itemName = item => gameTerm('item', item.id, translateLabel(item.name));
const searchNames = item => [item.name, itemName(item), gameRu.item[item.id]].filter(Boolean);
function populateSelect(select, options, labelFor, emptyLabel) {
    const current = select.value;
    const entries = options.map(id => [id, labelFor(id)]);
    entries.sort((a, b) => a[1].localeCompare(b[1]));
    select.replaceChildren(new Option(t(emptyLabel), ''), ...entries.map(([id, label]) => new Option(label, id)));
    select.value = current;
}

function dropLink(drop, source) {
    const link = node('a', source, 'catalog-drop-link');
    link.title = t('catalog.dropTable');
    link.setAttribute('aria-label', t('catalog.dropCard', { source }));
    const modeKeys = { normal: 'n', hard: 'h', nightmare: 'nm' };
    const params = new URLSearchParams({ c: drop.card.key ?? drop.card.id, t: 'd' });
    if (modeKeys[drop.modes[0]]) params.set('m', modeKeys[drop.modes[0]]);
    link.href = '/cards?' + params;
    link.dataset.shellLink = '';
    return link;
}

function sourceLocation(source, drop) {
    const act = source?.act ?? drop?.act;
    if (!act) return null;
    const actLabel = translateLabel('Act {0}', [String(act)]);
    if (source?.place) return t('catalog.location.' + source.place, { act }, actLabel);
    return source?.zone ? translateLabel('Act {0} Zone {1}', [String(act), String(source.zone)]) : actLabel;
}

function ingredientCombination(components, chance) {
    const combination = node('strong', null, 'catalog-source-requirements');
    components.forEach((component, index) => {
        if (index) combination.append(' + ');
        combination.append(component);
    });
    if (Number.isFinite(chance)) {
        const value = formatFixedNumber(chance, { maximumFractionDigits: 1 });
        combination.append(' ', node('small', t('catalog.recipeChance', { chance: value })));
    }
    return combination;
}

function itemSources(item, details, resolveRequirements) {
    const section = node('section', null, 'catalog-acquisition');
    const groups = catalogSourceGroups(item);
    if (groups.size) {
        const list = node('ul', null, 'catalog-sources');
        for (const entries of groups.values()) {
            for (const { source, modes, drop } of entries) {
                const entry = node('li');
                const isZone = source?.type === 'zone';
                const location = sourceLocation(source, drop);
                const sourceName = isZone ? source.zone_name : source?.name;
                const name = sourceName ? translateLabel(sourceName) : null;
                const dropName = drop ? name ?? gameTerm('card', drop.card.id, drop.name) : null;
                if (location || dropName) {
                    const heading = node('strong', null, 'catalog-source-heading');
                    if (location) heading.append(node('span', location, 'tag catalog-source-location'));
                    if (dropName) heading.append(dropLink(drop, dropName));
                    entry.append(heading);
                }
                const description = source?.description ? translateLabel(source.description) : null;
                if (description) entry.append(node('span', description));
                else if (!drop && name) entry.append(node(source.type === 'source_group' ? 'strong' : 'span', name));
                for (const { components, chance } of resolveRequirements(source)) {
                    entry.append(ingredientCombination(components, chance));
                }
                const events = (source?.during ?? []).map(event => translateLabel(event.name));
                if (events.length) entry.append(node('small', events.join(', ')));
                if (modes.length) {
                    const difficulties = modes.map(mode => gameTerm('difficulty', mode)).join(', ');
                    entry.append(node('small', t('catalog.difficulty', { modes: difficulties }), 'catalog-source-difficulty'));
                }
                list.append(entry);
            }
        }
        section.append(list);
    } else {
        const descriptions = [...new Set(details.map(entry => translateLabel(entry.where_to_get ?? entry.whereToGet)).filter(Boolean))];
        for (const description of descriptions) section.append(node('p', description));
        if (!descriptions.length) section.append(node('p', t('catalog.noSources')));
    }
    return section;
}

function itemTitle(item, tag, typeLabel, atlasAsset) {
    const title = node(tag, null, 'catalog-item-name');
    const asset = item.icon ?? item.image;
    if (asset) {
        const usesAtlas = isAtlasImageAsset(atlasAsset);
        const image = createAssetNode(
            usesAtlas ? atlasAsset : new URL(asset, location.origin + '/items/').href,
            '', 'catalog-item-icon'
        );
        if (!usesAtlas) image.loading = 'lazy';
        image.setAttribute('aria-hidden', 'true');
        title.append(image);
    }
    const label = node('span', null, 'catalog-item-label');
    label.append(node('span', itemName(item)));
    const types = item.types.map(typeLabel);
    label.append(node('span', types.join(' - ') || t('catalog.unknownType'), 'catalog-item-type'));
    title.append(label);
    return title;
}

function itemGroupLink(data, source) {
    const type = data.types[source.type];
    if (!type?.key) return null;

    const group = translateLabel(type.label);
    const params = new URLSearchParams({ v: 'i', iy: type.key });
    return {
        href: '/bonuses?' + params,
        label: t('catalog.itemGroup', { group }),
        text: source.type === 'curios' ? t('catalog.allCurios') : t('catalog.groupShort', { group })
    };
}

function popoverAnchor(event) {
    if (event.detail) return { x: event.clientX, y: event.clientY };
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: bounds.left, y: bounds.bottom };
}

function createItemCard(item, openItem, typeLabel, mechanicBonusLabels, atlasAsset) {
    const card = node('li', null, 'catalog-card');
    const title = itemTitle(item, 'button', typeLabel, atlasAsset);
    if (mechanicBonusLabels.length) {
        title.querySelector('.catalog-item-label').append(node('span',
            t('catalog.matchedBonuses', { bonuses: mechanicBonusLabels.join(', ') }), 'catalog-item-type'));
    }
    title.type = 'button';
    title.setAttribute('aria-haspopup', 'dialog');
    title.addEventListener('click', event => openItem(item, popoverAnchor(event)));
    card.append(title);
    return card;
}

export async function mountCatalog(root, getBonusesApp) {
    const [data, initialBonuses, initialSmith] = await Promise.all([
        Promise.all(['/items/items.json?v=a5b417563e', '/items/item-sources.json?v=f6879db9dc', '/cards/cards.json?v=cc69dd6db9'].map(readJson)),
        getBonusesApp().catch(error => { console.error(error); return null; }),
        loadSmithData().catch(error => { console.error(error); return null; })
    ]);
    let items = buildCatalog(...data, initialBonuses?.data.sources);
    const { keyById, idByKey } = catalogRouteKeys(items);
    let itemsById = new Map(items.map(item => [item.id, item]));
    const hiddenTypes = new Set(data[1].hidden_type_filters ?? []);
    const types = catalogFilterTypes(items).filter(type => !hiddenTypes.has(type));
    const hiddenMechanics = new Set(data[1].hidden_mechanic_filters ?? []);
    const filterKeys = data[1].filter_keys;
    const visibleMechanics = () => [...new Set(items.flatMap(item => [...item.mechanics]))]
        .filter(mechanic => !hiddenMechanics.has(mechanic));
    let route = parseCatalogSearch('');
    const heading = node('h1');
    const controls = node('div', null, 'item-browser-sticky catalog-controls');
    const filterPanel = node('div', null, 'item-browser-panel');
    const toolbar = node('div', null, 'item-browser-toolbar');
    const query = node('input', null, 'item-search');
    query.autocomplete = 'off';
    query.spellcheck = false;
    query.type = 'search';
    query.maxLength = catalogQueryLimit;
    const type = node('select', null, 'engineering-input');
    const mechanic = node('select', null, 'engineering-input');
    const openAll = node('a');
    openAll.href = catalogHref();
    openAll.dataset.shellLink = '';
    toolbar.append(query, type, mechanic);
    filterPanel.append(toolbar);
    controls.append(filterPanel);
    const summary = node('p', null, 'catalog-count');
    const count = node('span');
    summary.append(count, openAll);
    const results = node('ul', null, 'catalog-results');
    const panels = new Map();
    const mobileLayout = window.matchMedia('(max-width: 900px)');
    let topLayer = 410;
    let bonusesApp = initialBonuses;
    let smithData = initialSmith;
    let bonusesPromise;
    let smithPromise;
    let bonusDetailsError = !bonusesApp;
    let urlTimer;
    root.append(heading, controls, summary, results);

    function typeLabel(id) {
        const category = bonusesApp?.data.categories?.find(category => category.id === id);
        const fallback = category ? translateLabel(category.label) : t('catalog.unknownType');
        return t('catalog.type.' + id, {}, fallback);
    }

    function mechanicLabel(id) {
        return t('catalog.mechanic.' + id, {}, t('catalog.otherSources'));
    }

    function updateUrl() {
        clearTimeout(urlTimer);
        if (location.pathname.replace(/\/$/, '') !== '/items') return;
        const ids = route.shared ? route.ids : [...panels.keys()];
        const href = catalogHref(ids, keyById, {
            query: query.value, type: type.value, mechanic: mechanic.value, shared: route.shared
        }, filterKeys);
        if (href !== location.pathname + location.search) {
            history.replaceState(history.state, '', href + location.hash);
        }
    }

    function removeSharedContent(state) {
        if (!bonusesApp) return;
        for (const target of state.targets) bonusesApp.catalogItemPanels.delete(target);
        state.targets = [];
    }

    function renderBonuses(body, state, sources) {
        const links = new Map();
        for (const source of sources) {
            const target = node('div');
            body.append(target);
            state.targets.push(target);
            bonusesApp.catalogItemPanels.set(target, source);
            const link = itemGroupLink(bonusesApp.data, source);
            if (link) links.set(link.href, link);
        }
        for (const { href, label, text } of links.values()) {
            const link = node('a', text + ' \u2192', 'catalog-group-link price-breakdown-tab');
            link.title = label;
            link.setAttribute('aria-label', label);
            link.href = href;
            link.dataset.shellLink = '';
            body.append(link);
        }
    }

    function ingredientLinks(ingredients) {
        return ingredients.map(ingredient => requirementLink({ item_id: ingredient.item }, ingredient.quantity));
    }

    function renderRecipe(body, state, productionRecipe) {
        if (productionRecipe) {
            body.append(ingredientCombination(ingredientLinks(productionRecipe)));
            return;
        }
        const list = node('div', null, 'smith-root smith-recipe-list');
        body.append(list);
        function renderRows() {
            const rows = buildFlattenedSmithRecipeRows({
                itemId: state.item.id,
                recipesByItemId: smithData.recipesByItemId,
                itemsById: smithData.itemsById,
                expandedPaths: state.expandedRecipePaths,
                smelteryItemIds: smithData.smelteryItemIds
            });
            renderSmithRecipeRows(list, rows, smithData, path => {
                if (!state.expandedRecipePaths.delete(path)) state.expandedRecipePaths.add(path);
                renderRows();
            });
        }
        renderRows();
    }

    function requirementLink(component, quantity = 1) {
        const item = itemsById.get(component.item_id ?? component.id);
        const name = item ? itemName(item) : translateLabel(component.name);
        const prefix = quantity > 1 ? '\u00d7' + formatFixedNumber(quantity) + ' ' : '';
        if (!item) return node('span', prefix + name);

        const link = node('a', name, 'catalog-requirement-link');
        link.href = catalogHref([item.id], keyById);
        link.setAttribute('aria-haspopup', 'dialog');
        link.addEventListener('click', event => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            openItem(item, popoverAnchor(event));
        });
        if (!prefix) return link;
        const ingredient = document.createDocumentFragment();
        ingredient.append(prefix, link);
        return ingredient;
    }

    function renderItem(state) {
        const { panel, item, focusPanel, mobile } = state;
        const scroll = panel.querySelector('.catalog-popover-scroll')?.scrollTop ?? 0;
        removeSharedContent(state);
        const header = node('header', null, 'item-popover-header catalog-card-header');
        const title = itemTitle(item, 'h2', typeLabel, smithData?.itemsById[item.id]?.image);
        title.id = 'catalog-item-popover-' + item.id;
        const label = title.querySelector('.catalog-item-label');
        label.firstElementChild.classList.add('item-popover-name');
        label.lastElementChild.classList.add('item-popover-type');
        header.append(title);
        if (!mobile) {
            const close = node('button', '\u00d7', 'popover-close');
            close.type = 'button';
            close.setAttribute('aria-label', t('catalog.close'));
            close.addEventListener('mousedown', event => event.stopPropagation());
            close.addEventListener('click', () => dismissItem(state));
            header.append(close);
            makeDraggable(panel, header, focusPanel);
        }
        const sources = bonusesApp?.data.sources.filter(source => (source.item_id ?? source.id) === item.id) ?? [];
        const productionRecipe = bonusesApp?.data.production_recipes?.get(item.id);
        const tabs = [
            ...(sources.length ? [['bonuses', 'catalog.stats']] : []),
            ['acquisition', 'catalog.acquisition'],
            ...(productionRecipe || hasSmithRecipe(smithData?.recipesByItemId, item.id) ? [['recipe', 'catalog.recipe']] : [])
        ];
        const active = state.tab ?? tabs[0][0];
        const navigation = node('div', null, 'price-breakdown-tabbar catalog-popover-tabs');
        for (const [id, labelKey] of tabs) {
            const tab = node('button', t(labelKey), 'price-breakdown-tab');
            tab.type = 'button';
            tab.classList.toggle('active', active === id);
            tab.setAttribute('aria-pressed', String(active === id));
            tab.addEventListener('click', () => {
                state.tab = id;
                renderItem(state);
                if (!mobile) clampPopover(panel);
            });
            navigation.append(tab);
        }

        const body = node('div', null, 'catalog-popover-body');
        if (active === 'bonuses') renderBonuses(body, state, sources);
        else if (active === 'recipe') renderRecipe(body, state, productionRecipe);
        else {
            if (!sources.length && item.description) body.append(node('p', translateLabel(item.description), 'item-popover-description'));
            const resolveRequirements = acquisitionSource => {
                const recipes = (acquisitionSource?.recipes ?? []).map(recipe => ({
                    chance: recipe.chance,
                    components: ingredientLinks(recipe.ingredients)
                }));
                if (!acquisitionSource?.requirements || !bonusesApp) return recipes;
                const required = sources.flatMap(source => {
                    const ids = source[acquisitionSource.requirements];
                    if (!Array.isArray(ids) || !ids.length) return [];
                    const components = ids.map(id => bonusesApp.data.sources.find(entry => entry.id === id));
                    if (components.some(component => !component)) return [];
                    return [{ components: components.map(component => requirementLink(component)) }];
                });
                return [...recipes, ...required];
            };
            body.append(itemSources(item, sources, resolveRequirements));
        }
        if (!bonusesApp && (bonusesPromise || bonusDetailsError)) {
            body.prepend(node('p', t(bonusDetailsError ? 'catalog.statsError' : 'catalog.statsLoading')));
        }
        const scrollContainer = node('div', null, 'catalog-popover-scroll');
        scrollContainer.append(body);
        panel.replaceChildren(header, navigation, scrollContainer);
        scrollContainer.scrollTop = scroll;
    }

    function removeItemPanel(state) {
        state.stopWatchingSize?.();
        removeSharedContent(state);
        state.panel.remove();
    }

    function dismissItem(state) {
        if (panels.get(state.item.id) !== state) return;
        removeItemPanel(state);
        panels.delete(state.item.id);
        updateUrl();
    }

    async function openItem(item, anchor) {
        const existing = panels.get(item.id);
        if (existing) {
            existing.focusPanel();
            return;
        }
        const mobile = mobileLayout.matches;
        const panel = node('section', null, mobile
            ? 'catalog-item-sheet'
            : 'item-popover floating-panel catalog-item-popover');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-labelledby', 'catalog-item-popover-' + item.id);
        const focusPanel = () => { panel.style.zIndex = String(bonusesApp?.nextZ() ?? ++topLayer); };
        if (!mobile) panel.addEventListener('pointerdown', focusPanel);
        panel.addEventListener('click', event => {
            if (!event.target.closest('a[data-shell-link]')) event.stopPropagation();
        });
        const state = { panel, item, focusPanel, mobile, targets: [], expandedRecipePaths: new Set() };
        if (!mobile) root.append(panel);
        panels.set(item.id, state);
        loadDetails();
        if (mobile) {
            await bonusesPromise;
            if (!bonusesApp || panels.get(item.id) !== state) {
                dismissItem(state);
                return;
            }
            const previous = bonusesApp.catalogItemSheet;
            if (previous) previous.onClose();
            bonusesApp.closeMobilePopovers('item');
            bonusesApp.catalogItemSheet = { onClose: () => dismissItem(state) };
            bonusesApp.itemSheetOpen = true;
            await bonusesApp.$nextTick();
            if (panels.get(item.id) !== state) return;
            bonusesApp.$refs.catalogItemSheetBody?.append(panel);
            renderItem(state);
            updateUrl();
            return;
        }
        renderItem(state);
        positionPopover(panel, anchor.x, anchor.y);
        clampPopover(panel);
        state.stopWatchingSize = observePopoverResize(panel);
        focusPanel();
        updateUrl();
    }

    function receiveBonuses(promise) {
        bonusesPromise = promise.then(app => {
            bonusesApp = app;
            bonusDetailsError = !app;
            if (app) {
                items = buildCatalog(...data, app.data.sources);
                itemsById = new Map(items.map(item => [item.id, item]));
                render();
            }
        }).finally(() => {
            bonusesPromise = null;
            renderOpenItems();
        });
    }

    function receiveSmith(promise) {
        smithPromise = promise.then(data => {
            smithData = data;
            if (data) renderResults();
        }).finally(() => {
            smithPromise = null;
            renderOpenItems();
        });
    }

    function loadDetails() {
        if (!bonusesApp && !bonusesPromise) {
            bonusDetailsError = false;
            receiveBonuses(getBonusesApp().catch(error => { console.error(error); return null; }));
        }
        if (!smithData && !smithPromise) {
            receiveSmith(loadSmithData().catch(error => { console.error(error); return null; }));
        }
    }

    function renderOpenItems() {
        for (const state of panels.values()) {
            if (!state.panel.isConnected) continue;
            renderItem(state);
            if (!state.mobile) clampPopover(state.panel);
        }
    }

    function renderResults() {
        const candidates = route.shared ? filterCatalog(items, route, searchNames) : items;
        const filtered = filterCatalog(candidates, {
            query: query.value, type: type.value, mechanic: mechanic.value
        }, searchNames);
        if (!route.shared) filtered.sort((a, b) => itemName(a).localeCompare(itemName(b)));
        count.textContent = t('catalog.count', { count: filtered.length });
        count.hidden = filtered.length === 0;
        summary.hidden = count.hidden && !route.shared;
        const missing = route.ids.filter(id => !itemsById.has(id));
        const cards = filtered.map(item => {
            const matching = item.mechanicBonuses.get(mechanic.value) ?? [];
            const labels = matching.map(id => gameTerm('stat', id, translateLabel(bonusesApp.bonusLabel(id))));
            return createItemCard(item, openItem, typeLabel, labels, smithData?.itemsById[item.id]?.image);
        });
        if (!cards.length) {
            const empty = node('li', null, 'catalog-message empty-state item-empty-state');
            empty.append(
                node('div', translateLabel('No matching items'), 'empty-title'),
                node('div', translateLabel('Adjust the search or filters to see matching items.'), 'empty-sub')
            );
            cards.push(empty);
        }
        if (missing.length) cards.push(node('li', t('catalog.missing', { ids: missing.join(', ') }), 'catalog-message'));
        results.replaceChildren(...cards);
    }

    function render(search) {
        heading.textContent = t('nav.catalog');
        openAll.textContent = t('catalog.openAll');
        openAll.hidden = !route.shared;
        query.placeholder = t('catalog.search');
        query.setAttribute('aria-label', t('catalog.search'));
        type.setAttribute('aria-label', t('catalog.type'));
        mechanic.setAttribute('aria-label', t('catalog.mechanic'));
        populateSelect(type, types, typeLabel, 'catalog.allTypes');
        const mechanics = visibleMechanics();
        populateSelect(mechanic, mechanics, mechanicLabel, 'catalog.allMechanics');
        if (search !== undefined) {
            const filters = parseCatalogFilters(search, types, mechanics, filterKeys);
            query.value = filters.query;
            type.value = filters.type;
            mechanic.value = filters.mechanic;
        }
        renderResults();
        renderOpenItems();
    }

    function commitFilters() {
        renderResults();
        updateUrl();
    }

    query.addEventListener('input', () => {
        renderResults();
        clearTimeout(urlTimer);
        urlTimer = setTimeout(updateUrl, 250);
    });
    query.addEventListener('change', updateUrl);
    type.addEventListener('change', commitFilters);
    mechanic.addEventListener('change', commitFilters);
    onLocaleChange(() => render());

    window.addEventListener('resize', () => {
        for (const { panel, mobile } of panels.values()) if (!mobile) clampPopover(panel);
    });

    mobileLayout.addEventListener('change', () => {
        if (!panels.size) return;
        closeItem();
        if (root.isConnected && !root.classList.contains('shell-hidden')) updateUrl();
    });

    function closeItem() {
        clearTimeout(urlTimer);
        if (bonusesApp?.catalogItemSheet) {
            bonusesApp.catalogItemSheet = null;
            bonusesApp.closeItemPopover();
        }
        for (const state of panels.values()) removeItemPanel(state);
        bonusesApp?.closeTierPopover();
        bonusesApp?.closePriceBreakdownPopover();
        panels.clear();
        topLayer = 410;
    }

    return {
        closeItem,
        syncRouteState(search) {
            closeItem();
            if (bonusesApp) bonusesApp.viewMode = 'item';
            route = parseCatalogSearch(search, idByKey);
            render(search ?? '');
            updateUrl();
        }
    };
}
