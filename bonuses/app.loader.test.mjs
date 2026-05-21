import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

assert.match(
    source,
    /import \{ runWithGlobalShellLoader \} from '\.\.\/shell\/loading\/shellLoader\.js\?v=[0-9a-f]+';/,
    'bonuses app should import the shared shell loader helper'
);

assert.match(
    source,
    /await runWithGlobalShellLoader\(async \(\) => \{\s*await this\._dataLoader\.load\(\);[\s\S]*?await this\._restorePersistedSave\(\);[\s\S]*?this\.selectedClass = resolveSelectedClassId\(this\.data\?\.classes, this\.selectedClass\);[\s\S]*?\}\);/,
    'bonuses app should keep data loading, save restore, and selected class resolution under the shared loader'
);

console.log('bonuses/app.loader.test.mjs passed');
