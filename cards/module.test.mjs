import assert from 'node:assert/strict';
import fs from 'node:fs';
import { atlasSourcePathToImageAsset } from '../shell/lib/imageAtlas.js';

function createMockElement(tagName) {
    return {
        tagName,
        attributes: new Map(),
        children: [],
        setAttribute(name, value) {
            this.attributes.set(name, String(value));
        },
        getAttribute(name) {
            return this.attributes.get(name);
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        }
    };
}

function createMockDocument() {
    return {
        createElementNS(_namespace, tagName) {
            return createMockElement(tagName);
        }
    };
}

function createClassList(initial = []) {
    const names = new Set(initial);
    return {
        add(name) {
            names.add(name);
        },
        remove(name) {
            names.delete(name);
        },
        toggle(name, force) {
            if (force === undefined) {
                if (names.has(name)) {
                    names.delete(name);
                    return false;
                }
                names.add(name);
                return true;
            }
            if (force) {
                names.add(name);
                return true;
            }
            names.delete(name);
            return false;
        },
        contains(name) {
            return names.has(name);
        }
    };
}

function createElement(id, classNames = []) {
    return {
        id,
        parentElement: null,
        firstChild: null,
        classList: createClassList(classNames),
        replaceChildren(child) {
            child.parentElement = this;
            this.firstChild = child;
        },
        insertBefore(child) {
            child.parentElement = this;
            this.firstChild = child;
        }
    };
}

const moduleSource = fs.readFileSync(new URL('./module.js', import.meta.url), 'utf8');

function loadCardsAtlasHelpers() {
    const match = moduleSource.match(
        /function resolveCardsBaseUrl\(moduleUrl = import\.meta\.url\) \{[\s\S]*?function normalizeCardsAssetNode\(node, baseUrl\) \{[\s\S]*?\n\}/
    );
    if (!match) {
        throw new Error('cards atlas helpers were not found in cards/module.js');
    }
    const helperSource = match[0].replaceAll('import.meta.url', 'undefined');
    return Function('atlasSourcePathToImageAsset', `${helperSource}; return { resolveCardsAtlasManifestUrl, normalizeCardsAssetPaths };`)(
        atlasSourcePathToImageAsset
    );
}

function loadThumbCropHelpers() {
    const start = moduleSource.indexOf('function clamp(value, min, max) {');
    const end = moduleSource.indexOf('function createAssetNode(asset, alt, options = {}) {');
    if (start < 0 || end < 0 || end <= start) {
        throw new Error('thumb crop helpers were not found in cards/module.js');
    }
    const helperSource = moduleSource.slice(start, end);
    return Function(`${helperSource}; return { resolveAtlasCropRect };`)();
}

function loadSpriteHelpers() {
    const start = moduleSource.indexOf('function clamp(value, min, max) {');
    const end = moduleSource.indexOf('function ensureDynamicStyleSheet() {');
    if (start < 0 || end < 0 || end <= start) {
        throw new Error('sprite helpers were not found in cards/module.js');
    }
    const helperSource = moduleSource.slice(start, end);
    return Function(
        'document',
        'isAtlasImageAsset',
        `let atlasSpriteClipPathSequence = 0; ${helperSource}; return { createAtlasSprite, createAtlasThumbSprite, createAssetNode };`
    )(createMockDocument(), value => !!value && typeof value === 'object' && value.kind === 'atlas');
}

function loadMobileChromeHelpers() {
    const start = moduleSource.indexOf('function getShellMobileInlineActionsHost() {');
    const end = moduleSource.indexOf('function applyRouteState(state) {');
    if (start < 0 || end < 0 || end <= start) {
        throw new Error('mobile chrome helpers were not found in cards/module.js');
    }
    const helperSource = moduleSource.slice(start, end);
    return Function(
        'document',
        'isMobile',
        'currentTab',
        `${helperSource}; return { syncShellMobileModeMount, syncMobileChrome };`
    );
}

const { normalizeCardsAssetPaths } = loadCardsAtlasHelpers();
const moduleUrl = 'https://example.com/tools/cards/module.js';

const sample = {
    image_card: 'images/cards/alpha.png',
    nested: {
        image: 'images/icons/beta.png',
        untouched: '../shared/icon.png'
    },
    array: [
        { image_thumb: 'images/thumbs/gamma.png' },
        'images/not-an-object.png'
    ]
};

normalizeCardsAssetPaths(sample, moduleUrl);

assert.equal(sample.image_card, 'https://example.com/tools/cards/images/cards/alpha.png');
assert.equal(sample.nested.image, 'https://example.com/tools/cards/images/icons/beta.png');
assert.equal(sample.nested.untouched, '../shared/icon.png');
assert.equal(sample.array[0].image_thumb, 'https://example.com/tools/cards/images/thumbs/gamma.png');
assert.equal(sample.array[1], 'images/not-an-object.png');

assert.match(
    loadCardsAtlasHelpers().resolveCardsAtlasManifestUrl(moduleUrl),
    /^https:\/\/example\.com\/tools\/generated\/image-atlas-manifest\.json\?v=[0-9a-f]+$/
);

const atlasSample = {
    image_card: 'images/cards/alpha.png',
    item_icon: '../items/images/gold.png?v=123',
    nested: {
        image: 'images/icons/beta.png',
        untouched: '../shared/icon.png'
    },
    array: [
        { image_thumb: 'images/thumbs/gamma.png' },
        'images/not-an-object.png'
    ]
};

const manifest = {
    atlases: {
        'cards:cards': {
            path: '../../cards/images/cards/__atlas.png',
            width: 256,
            height: 128
        },
        'items:root': {
            path: '../items/images/__atlas.png',
            width: 512,
            height: 256
        }
    },
    entries: {
        alpha: {
            atlas: 'cards:cards',
            x: 0,
            y: 0,
            width: 64,
            height: 64,
            source: { root: 'cards', dir: 'images/cards', name: 'alpha', extension: 'png' }
        },
        beta: {
            atlas: 'cards:cards',
            x: 64,
            y: 0,
            width: 32,
            height: 32,
            source: { root: 'cards', dir: 'images/icons', name: 'beta', extension: 'png' }
        },
        gold: {
            atlas: 'items:root',
            x: 128,
            y: 32,
            width: 48,
            height: 48,
            source: { root: 'items', dir: 'images', name: 'gold', extension: 'png' }
        }
    }
};

const { normalizeCardsAssetPaths: normalizeCardsAssetPathsWithAtlas } = loadCardsAtlasHelpers();
normalizeCardsAssetPathsWithAtlas(atlasSample, moduleUrl, manifest);

assert.deepEqual(atlasSample.image_card, {
    kind: 'atlas',
    ref: 'alpha',
    url: 'https://example.com/tools/cards/images/cards/__atlas.png',
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    sheetWidth: 256,
    sheetHeight: 128
});
assert.deepEqual(atlasSample.nested.image, {
    kind: 'atlas',
    ref: 'beta',
    url: 'https://example.com/tools/cards/images/cards/__atlas.png',
    x: 64,
    y: 0,
    width: 32,
    height: 32,
    sheetWidth: 256,
    sheetHeight: 128
});
assert.deepEqual(atlasSample.item_icon, {
    kind: 'atlas',
    ref: 'gold',
    url: 'https://example.com/tools/items/images/__atlas.png',
    x: 128,
    y: 32,
    width: 48,
    height: 48,
    sheetWidth: 512,
    sheetHeight: 256
});
assert.equal(atlasSample.nested.untouched, '../shared/icon.png');
assert.equal(atlasSample.array[0].image_thumb, 'https://example.com/tools/cards/images/thumbs/gamma.png');
assert.equal(atlasSample.array[1], 'images/not-an-object.png');

const { resolveAtlasCropRect } = loadThumbCropHelpers();

assert.deepEqual(
    resolveAtlasCropRect(
        { x: 100, y: 200, width: 180, height: 120 },
        { targetAspectRatio: 2 / 3, focusX: 0 }
    ),
    { x: 100, y: 200, width: 80, height: 120 }
);
assert.deepEqual(
    resolveAtlasCropRect(
        { x: 100, y: 200, width: 180, height: 120 },
        { targetAspectRatio: 2 / 3, focusX: 50 }
    ),
    { x: 150, y: 200, width: 80, height: 120 }
);
assert.deepEqual(
    resolveAtlasCropRect(
        { x: 100, y: 200, width: 180, height: 120 },
        { targetAspectRatio: 2 / 3, focusX: 100 }
    ),
    { x: 200, y: 200, width: 80, height: 120 }
);
assert.deepEqual(
    resolveAtlasCropRect(
        { x: 10, y: 20, width: 60, height: 180 },
        { targetAspectRatio: 2 / 3, focusY: 100 }
    ),
    { x: 10, y: 110, width: 60, height: 90 }
);
assert.deepEqual(
    resolveAtlasCropRect(
        { x: 10, y: 20, width: 61, height: 180 },
        { targetAspectRatio: 2 / 3, focusY: 100 }
    ),
    { x: 10, y: 109, width: 61, height: 91 }
);

const { createAtlasSprite, createAtlasThumbSprite, createAssetNode } = loadSpriteHelpers();
const asset = {
    kind: 'atlas',
    ref: 'alpha',
    url: 'https://example.com/cards/__atlas.png',
    x: 100,
    y: 200,
    width: 180,
    height: 120,
    sheetWidth: 512,
    sheetHeight: 512
};

const sprite = createAtlasSprite(asset, 'Alpha');
const spriteImage = sprite.children.at(-1);
const spriteDefs = sprite.children[0];
const spriteClipPath = spriteDefs.children[0];

assert.equal(sprite.getAttribute('viewBox'), '0 0 180 120');
assert.equal(spriteImage.getAttribute('x'), '-100');
assert.equal(spriteImage.getAttribute('y'), '-200');
assert.equal(spriteImage.getAttribute('clip-path'), `url(#${spriteClipPath.getAttribute('id')})`);
assert.equal(spriteClipPath.getAttribute('clipPathUnits'), 'userSpaceOnUse');
assert.equal(spriteClipPath.children[0].getAttribute('width'), '180');
assert.equal(spriteClipPath.children[0].getAttribute('height'), '120');

const thumb = createAtlasThumbSprite(asset, 'Alpha', {
    targetAspectRatio: 2 / 3,
    focusX: 50
});
const thumbImage = thumb.children.at(-1);
const thumbClipPath = thumb.children[0].children[0];

assert.equal(thumb.getAttribute('viewBox'), '0 0 80 120');
assert.equal(thumbImage.getAttribute('x'), '-150');
assert.equal(thumbImage.getAttribute('y'), '-200');
assert.equal(thumbImage.getAttribute('clip-path'), `url(#${thumbClipPath.getAttribute('id')})`);
assert.equal(thumbClipPath.children[0].getAttribute('width'), '80');
assert.equal(thumbClipPath.children[0].getAttribute('height'), '120');

const createdNode = createAssetNode(asset, 'Alpha', {
    className: 'thumb-img',
    targetAspectRatio: 2 / 3,
    focusX: 100
});
const createdNodeImage = createdNode.children.at(-1);

assert.equal(createdNode.getAttribute('class'), 'thumb-img');
assert.equal(createdNode.getAttribute('viewBox'), '0 0 80 120');
assert.equal(createdNodeImage.getAttribute('x'), '-200');
assert.equal(createdNodeImage.getAttribute('y'), '-200');

assert.doesNotMatch(moduleSource, /\sstyle=/);
assert.doesNotMatch(moduleSource, /\.style\.cssText\s*=/);
assert.doesNotMatch(moduleSource, /\.style\./);

const shellHost = createElement('shell-mobile-inline-actions', ['shell-hidden']);
const modeGroup = createElement('m-mode-group', ['shell-inline-mode-hidden']);
const cardTab = createElement(null, ['m-card-tab']);
modeGroup.parentElement = cardTab;
cardTab.firstChild = modeGroup;

const documentMock = {
    getElementById(id) {
        if (id === 'shell-mobile-inline-actions') return shellHost;
        if (id === 'm-mode-group') return modeGroup;
        return null;
    },
    querySelector(selector) {
        if (selector === '.m-card-tab') return cardTab;
        return null;
    }
};

let helpers = loadMobileChromeHelpers()(documentMock, () => true, 'browse');
helpers.syncMobileChrome();

assert.equal(modeGroup.parentElement, shellHost);
assert.equal(modeGroup.classList.contains('shell-inline-mode-hidden'), true);
assert.equal(shellHost.classList.contains('cards-shell-inline-actions-visible'), false);
assert.equal(shellHost.classList.contains('shell-hidden'), true);

helpers = loadMobileChromeHelpers()(documentMock, () => true, 'card');
helpers.syncMobileChrome();

assert.equal(modeGroup.parentElement, shellHost);
assert.equal(modeGroup.classList.contains('shell-inline-mode-hidden'), false);
assert.equal(shellHost.classList.contains('cards-shell-inline-actions-visible'), true);
assert.equal(shellHost.classList.contains('shell-hidden'), false);

helpers = loadMobileChromeHelpers()(documentMock, () => true, 'drops');
helpers.syncMobileChrome();

assert.equal(modeGroup.parentElement, shellHost);
assert.equal(modeGroup.classList.contains('shell-inline-mode-hidden'), false);
assert.equal(shellHost.classList.contains('cards-shell-inline-actions-visible'), true);
assert.equal(shellHost.classList.contains('shell-hidden'), false);

helpers = loadMobileChromeHelpers()(documentMock, () => false, 'browse');
helpers.syncMobileChrome();

assert.equal(modeGroup.parentElement, cardTab);
assert.equal(modeGroup.classList.contains('shell-inline-mode-hidden'), true);
assert.equal(shellHost.classList.contains('cards-shell-inline-actions-visible'), false);
assert.equal(shellHost.classList.contains('shell-hidden'), true);

helpers = loadMobileChromeHelpers()(documentMock, () => true, 'card');
helpers.syncMobileChrome();
helpers = loadMobileChromeHelpers()(documentMock, () => true, 'browse');
helpers.syncMobileChrome();

assert.equal(modeGroup.parentElement, shellHost);
assert.equal(modeGroup.classList.contains('shell-inline-mode-hidden'), true);
assert.equal(shellHost.classList.contains('cards-shell-inline-actions-visible'), false);
assert.equal(shellHost.classList.contains('shell-hidden'), true);

helpers = loadMobileChromeHelpers()(documentMock, () => true, 'drops');
helpers.syncMobileChrome();
helpers = loadMobileChromeHelpers()(documentMock, () => true, 'browse');
helpers.syncMobileChrome();

assert.equal(
    modeGroup.parentElement,
    shellHost,
    'mobile browse should keep the mode group mounted in the shell host'
);
assert.equal(modeGroup.classList.contains('shell-inline-mode-hidden'), true);
assert.equal(shellHost.classList.contains('cards-shell-inline-actions-visible'), false);
assert.equal(shellHost.classList.contains('shell-hidden'), true);

assert.match(
    moduleSource,
    /<div class="m-panel m-card-tab" data-panel="card">\s*<div class="mode-group shell-inline-mode-hidden" id="m-mode-group"><\/div>\s*<div id="m-card-slot"><\/div>/s
);
assert.match(moduleSource, /let currentTab = 'browse';/);
assert.match(moduleSource, /function resolveMobileTab\(routeTab\)\s*{\s*return TAB_ORDER\.includes\(routeTab\) \? routeTab : 'browse';\s*}/);
assert.match(moduleSource, /requestAnimationFrame\(\(\) => syncMobilePanelPosition\(currentTab, 'auto'\)\);/);
assert.match(moduleSource, /const previousDesktopThumb = document\.getElementById\(`thumb-\$\{selectedId\}`\);\s*if \(previousDesktopThumb\) previousDesktopThumb\.classList\.remove\('selected'\);/);
assert.match(moduleSource, /const previousMobileThumb = document\.getElementById\(`m-thumb-\$\{selectedId\}`\);\s*if \(previousMobileThumb\) previousMobileThumb\.classList\.remove\('selected'\);/);
assert.match(moduleSource, /svg\.setAttribute\('viewBox', `\$\{asset\.x\} \$\{asset\.y\} \$\{asset\.width\} \$\{asset\.height\}`\);/);
assert.match(moduleSource, /svg\.setAttribute\('overflow', 'hidden'\);/);
assert.match(moduleSource, /image\.setAttribute\('x', '0'\);/);
assert.match(moduleSource, /image\.setAttribute\('y', '0'\);/);
assert.match(moduleSource, /image\.setAttribute\('image-rendering', 'pixelated'\);/);
assert.match(moduleSource, /shape-rendering: crispEdges;/);
assert.doesNotMatch(moduleSource, /<header class="mobile-header">/);
assert.match(moduleSource, /<div class="browse-search-bar">\s*<div class="icon-btn-wrap" id="m-filter-btn-wrap">/s);
assert.match(moduleSource, /document\.getElementById\('m-search-input-panel'\)\.addEventListener\('input', renderMobileBrowse\);/);

console.log('cards/module.test.mjs passed');
