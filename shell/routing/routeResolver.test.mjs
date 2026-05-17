import assert from 'node:assert/strict';
import {
    buildTopLevelHref,
    maybeNormalizeLegacyTopLevelRoute,
    resolveShellRoute,
    resolveTopLevelRoute
} from './routeResolver.js';

assert.equal(resolveTopLevelRoute('/'), 'about');
assert.equal(resolveTopLevelRoute('/index.html'), 'about');
assert.equal(resolveTopLevelRoute('/bonuses'), 'bonuses');
assert.equal(resolveTopLevelRoute('/bonuses/'), 'bonuses');
assert.equal(resolveTopLevelRoute('/cards'), 'cards');
assert.equal(resolveTopLevelRoute('/tools'), 'tools');
assert.equal(resolveTopLevelRoute('/unknown'), 'about');

assert.equal(buildTopLevelHref('about'), '/');
assert.equal(buildTopLevelHref('bonuses'), '/bonuses');
assert.equal(buildTopLevelHref('cards'), '/cards');
assert.equal(buildTopLevelHref('tools'), '/tools');

assert.deepEqual(resolveShellRoute('about'), { routeId: 'about', href: '/' });
assert.deepEqual(resolveShellRoute('bonus'), { routeId: 'bonuses', href: '/bonuses' });
assert.deepEqual(resolveShellRoute('item'), { routeId: 'bonuses', href: '/bonuses?v=i' });
assert.deepEqual(resolveShellRoute('cards'), { routeId: 'cards', href: '/cards' });
assert.deepEqual(resolveShellRoute('tools'), { routeId: 'tools', href: '/tools' });
assert.deepEqual(resolveShellRoute('unknown'), { routeId: 'about', href: '/' });

assert.equal(
    maybeNormalizeLegacyTopLevelRoute('https://evitania.local/bonuses?v=cards&card=ghost'),
    '/cards?card=ghost'
);
assert.equal(
    maybeNormalizeLegacyTopLevelRoute('https://evitania.local/bonuses?v=c&x=e'),
    '/tools?v=c&x=e'
);
assert.equal(
    maybeNormalizeLegacyTopLevelRoute('https://evitania.local/cards?card=ghost'),
    null
);
