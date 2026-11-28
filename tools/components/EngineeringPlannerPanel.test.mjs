import assert from 'node:assert/strict';
import test from 'node:test';

import { EngineeringPlannerPanel } from './EngineeringPlannerPanel.js';

test('planner closes its shared popover when the calculator is unmounted', () => {
    let closed = false;
    EngineeringPlannerPanel.beforeUnmount.call({
        helpPopover: { close() { closed = true; } }
    });
    assert.equal(closed, true);
    assert.doesNotThrow(() => EngineeringPlannerPanel.beforeUnmount.call({ helpPopover: null }));
});

test('planner renders its help contents in the shared popover body', () => {
    const template = EngineeringPlannerPanel.template;
    assert.match(template, /<teleport v-if="helpPopover" :to="helpPopover.body">[\s\S]*?helpNotes[\s\S]*?helpRows[\s\S]*?<\/teleport>/);
    assert.doesNotMatch(template, /v-click-outside="closeHelp"/);
});
