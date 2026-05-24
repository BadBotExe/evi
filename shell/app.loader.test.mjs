import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

assert.match(
    source,
    /import \{[\s\S]*createShellLoaderController,[\s\S]*installGlobalShellLoader,[\s\S]*runWithGlobalShellLoader[\s\S]*\} from '\.\/loading\/shellLoader\.js\?v=[0-9a-f]+';/,
    'shell app should import the shared loader controller helpers'
);

assert.match(
    source,
    /function ensureShellLoader\(\) \{[\s\S]*?shellLoader = createShellLoaderController\(\);[\s\S]*?installGlobalShellLoader\(shellLoader\);[\s\S]*?\}/,
    'shell app should install a singleton global loader controller'
);

assert.match(
    source,
    /return runWithGlobalShellLoader\(async \(\) => \{[\s\S]*?\}, \{ immediate: true \}\);\s*\}/,
    'shell route activation should be wrapped by the shared loader in immediate mode'
);

assert.match(
    source,
    /function prepareRouteTransition\(\) \{[\s\S]*?resetShellMobileInlineActions\(\);[\s\S]*?Object\.values\(sectionCache\)\.forEach\(\(cached\) => \{[\s\S]*?setDisplay\(cached\.mount, false\);[\s\S]*?\}\);[\s\S]*?closeShellDrawer\(\);[\s\S]*?\}/,
    'shell route transitions should immediately hide cached section mounts and reset inline actions'
);

assert.match(
    source,
    /return runWithGlobalShellLoader\(async \(\) => \{\s*prepareRouteTransition\(\);[\s\S]*?\}, \{ immediate: true \}\);\s*\}/,
    'shell route activation should hide the previous section before awaiting the next mount'
);

assert.match(
    source,
    /ensureShellLayout\(\);\s*ensureShellLoader\(\);\s*document\.getElementById\('shell-root'\)\?\.removeAttribute\('data-shell-cloak'\);[\s\S]*?runWithGlobalShellLoader\(\(\) => syncFromLocation\(\), \{ immediate: true \}\)/,
    'shell bootstrap should initialize the loader before the initial route sync and use immediate mode'
);

assert.match(
    source,
    /button\.onclick = \(event\) => \{\s*currentSectionHandle\(routeId\)\?\.toggleMobileSettings\?\.\(event\);\s*\};/,
    'shell mobile secondary action should toggle the bonuses settings drawer on repeated taps'
);

assert.match(
    source,
    /async function ensureSmithSection\(search = window\.location\.search\) \{[\s\S]*?await import\('\/smith\/app\.js\?v=[0-9a-f]+'\);[\s\S]*?section\.handle = await mountSmithSection\(/,
    'shell app should lazy-load smith through the shared section mount pattern'
);

console.log('shell/app.loader.test.mjs passed');
