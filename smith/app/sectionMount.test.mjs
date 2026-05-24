import assert from 'node:assert/strict';

import { resolveSmithRouteState } from './sectionMount.js';

assert.deepEqual(resolveSmithRouteState('?a=if&i=i2b'), {
    act: 'if',
    item: 'i2b',
    tab: '',
    speed: '',
    gemshop: '',
    multicraft: ''
});

assert.deepEqual(resolveSmithRouteState(''), {
    act: '',
    item: '',
    tab: '',
    speed: '',
    gemshop: '',
    multicraft: ''
});

console.log('smith/app/sectionMount.test.mjs passed');
