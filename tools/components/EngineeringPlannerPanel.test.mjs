import assert from 'node:assert/strict';

import { EngineeringPlannerPanel } from './EngineeringPlannerPanel.js';

const template = EngineeringPlannerPanel.template;
const mountedSource = String(EngineeringPlannerPanel.mounted);
const beforeUnmountSource = String(EngineeringPlannerPanel.beforeUnmount);

assert.match(
    mountedSource,
    /if\s*\(!this\.helpOpen\s*\|\|\s*this\.isMobileViewport\(\)\)\s*return;[\s\S]*?popover\?\.contains\(event\.target\)\s*\|\|\s*button\?\.contains\(event\.target\)[\s\S]*?this\.closeHelp\(\)/,
    'engineering planner help popover should close on outside pointerdown only while the desktop help popover is open'
);

assert.match(
    mountedSource,
    /addEventListener\('pointerdown', this\._engineeringHelpOutsidePointerDown\)/,
    'engineering planner should register a dedicated outside pointerdown handler for help popover closing'
);

assert.match(
    beforeUnmountSource,
    /removeEventListener\('pointerdown', this\._engineeringHelpOutsidePointerDown\)/,
    'engineering planner should remove the help popover outside pointerdown handler on unmount'
);

assert.doesNotMatch(
    template,
    /v-click-outside="closeHelp"/,
    'engineering planner help popover should not rely on the generic clickOutside directive'
);

console.log('tools/components/EngineeringPlannerPanel.test.mjs passed');
