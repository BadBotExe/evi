import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./module.js', import.meta.url), 'utf8');

assert.match(
    source,
    /import \{ loadSmithData \} from '\.\/app\/dataLoader\.js\?v=[0-9a-f]+';/,
    'smith module should import the smith data loader adapter'
);

assert.match(
    source,
    /import \{ runWithGlobalShellLoader \} from '\.\.\/shell\/loading\/shellLoader\.js\?v=[0-9a-f]+';/,
    'smith module should import the shared shell loader helper'
);

assert.match(
    source,
    /await runWithGlobalShellLoader\(async \(\) => \{\s*DATA = await loadSmithData\(\{\s*fetchImpl: fetch,\s*moduleUrl: import\.meta\.url\s*\}\);\s*\}\);/,
    'smith module should wrap smith data loading in the shared loader'
);

console.log('smith/module.loader.test.mjs passed');
