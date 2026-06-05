import assert from 'node:assert/strict';

import { resolveToolsRouteState } from './urlState.js';

{
    const state = resolveToolsRouteState('?x=e&em=c&ei=p&ea=s&ev=33.5&evi=4.2&eu=3&evi=4.2');

    assert.equal(state.calc, 'e');
    assert.equal(state.engineeringMode, 'throughput_calc');
    assert.equal(state.engineeringInputMode, 'percent');
    assert.equal(state.engineeringAnchor, 's');
    assert.equal(state.engineeringAnchorSpeed, 33.5);
    assert.equal(state.engineeringAnchorItemsPerHour, 4.2);
    assert.equal(state.engineeringSlotUpgradeLevel, 3);
}

console.log('tools/app/urlState.test.mjs passed');
