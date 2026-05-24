import assert from 'node:assert/strict';

import { resolveSmithRouteState } from './sectionMount.js';

assert.deepEqual(resolveSmithRouteState('?a=if&i=i2b'), {
    act: 'if',
    item: 'i2b',
    tab: '',
    speed: '',
    gemshop: ''
});

assert.deepEqual(resolveSmithRouteState(''), {
    act: '',
    item: '',
    tab: '',
    speed: '',
    gemshop: ''
});

console.log('smith/app/sectionMount.test.mjs passed');
