import assert from 'node:assert/strict';

import { resolveCardsRouteState } from './sectionMount.js';

assert.deepEqual(resolveCardsRouteState('?c=wo&m=h&s=2&f=a-d&t=d'), {
    card: 'wo',
    mode: 'h',
    stars: '2',
    filter: 'a-d',
    tab: 'd'
});

assert.deepEqual(resolveCardsRouteState('?card=ghost&mode=hard&stars=3&filter=hp&tab=card'), {
    card: 'ghost',
    mode: 'hard',
    stars: '3',
    filter: 'hp',
    tab: 'card'
});

assert.deepEqual(resolveCardsRouteState('?c=wo&card=ghost&m=n&mode=hard&s=1&stars=3&f=a&filter=hp&t=b&tab=drops'), {
    card: 'wo',
    mode: 'n',
    stars: '1',
    filter: 'a',
    tab: 'b'
});

assert.deepEqual(resolveCardsRouteState(''), {
    card: '',
    mode: '',
    stars: '',
    filter: '',
    tab: ''
});

console.log('cards/app/sectionMount.test.mjs passed');
