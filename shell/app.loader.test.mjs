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
    /ensureShellLayout\(\);\s*ensureShellLoader\(\);\s*document\.getElementById\('shell-root'\)\?\.removeAttribute\('data-shell-cloak'\);[\s\S]*?runWithGlobalShellLoader\(\(\) => syncFromLocation\(\), \{ immediate: true \}\)/,
    'shell bootstrap should initialize the loader before the initial route sync and use immediate mode'
);

console.log('shell/app.loader.test.mjs passed');
