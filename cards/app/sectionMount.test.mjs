import assert from 'node:assert/strict';

import { resolveCardsRouteState } from './sectionMount.js';

assert.deepEqual(resolveCardsRouteState('?card=wolf&mode=hard&stars=2&filter=atk,def&tab=drops'), {
    card: 'wolf',
    mode: 'hard',
    stars: '2',
    filter: 'atk,def',
    tab: 'drops'
});

assert.deepEqual(resolveCardsRouteState(''), {
    card: '',
    mode: '',
    stars: '',
    filter: '',
    tab: ''
});

console.log('cards/app/sectionMount.test.mjs passed');
