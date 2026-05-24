import assert from 'node:assert/strict';

import { createToolsRouteMemory, resolveToolsRouteState } from './sectionMount.js';

assert.deepEqual(resolveToolsRouteState('?x=s&ec=1&em=t&ei=p&ea=s&ev=12.5&evi=9&eu=2'), {
    calc: 's',
    engineeringCollapsed: true,
    engineeringMode: 'throughput_game',
    engineeringInputMode: 'percent',
    engineeringAnchor: 's',
    engineeringAnchorSpeed: 12.5,
    engineeringAnchorItemsPerHour: 9,
    engineeringSlotUpgradeLevel: 2
});

{
    const memory = createToolsRouteMemory('?x=s');

    assert.equal(memory.current(), '?x=s');
    assert.equal(memory.restore('?x=e'), '?x=s');
    assert.equal(memory.sync('?x=e&ec=1'), '?x=e&ec=1');
    assert.equal(memory.current(), '?x=e&ec=1');
    assert.equal(memory.restore(''), '?x=e&ec=1');
}

{
    const memory = createToolsRouteMemory('');

    assert.equal(memory.current(), '');
    assert.equal(memory.restore('?x=s'), '?x=s');
    assert.equal(memory.sync('?x=e'), '?x=e');
    assert.equal(memory.restore('?x=s'), '?x=e');
}

console.log('tools/app/sectionMount.test.mjs passed');
