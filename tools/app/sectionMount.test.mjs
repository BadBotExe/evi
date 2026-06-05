import assert from 'node:assert/strict';

import { createToolsRouteMemory, resolveToolsRouteState } from './sectionMount.js';

assert.deepEqual(resolveToolsRouteState('?x=s&em=t&ei=p&ea=s&ev=12.5&evi=9&eu=2'), {
    calc: 's',
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
    assert.equal(memory.sync('?x=e'), '?x=e');
    assert.equal(memory.current(), '?x=e');
    assert.equal(memory.restore(''), '?x=e');
}

{
    const memory = createToolsRouteMemory('');

    assert.equal(memory.current(), '');
    assert.equal(memory.restore('?x=s'), '?x=s');
    assert.equal(memory.sync('?x=e'), '?x=e');
    assert.equal(memory.restore('?x=s'), '?x=e');
}

{
    const memory = createToolsRouteMemory('?x=e');

    memory.sync('?x=s');

    assert.equal(
        memory.restore('?x=e'),
        '?x=s',
        'route memory should restore the most recent in-section calculator query after returning to tools'
    );
}

console.log('tools/app/sectionMount.test.mjs passed');
