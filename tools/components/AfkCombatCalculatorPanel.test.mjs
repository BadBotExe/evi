import assert from 'node:assert/strict';

import { AfkCombatCalculatorPanel } from './AfkCombatCalculatorPanel.js';

const template = AfkCombatCalculatorPanel.template;
const methods = AfkCombatCalculatorPanel.methods;

assert.match(
    template,
    /<span>Mob Spawn Time<\/span><strong>\{\{ formatTime\(result\.spawnSeconds\) \}\}<\/strong>/,
    'combat model should identify calculated spawn time as Mob Spawn Time'
);

assert.match(
    template,
    /<span>Mob Spawn Limit<\/span><strong>\{\{ formatFixed\(result\.spawnCapKillsPerHour, 2\) \}\}<\/strong>/,
    'combat model should identify spawn cap as Mob Spawn Limit'
);

assert.match(
    template,
    /<span>Damage Taken per Second<\/span><strong>\{\{ formatNonNegativeFixed\(result\.incomingDps, 4\) \}\}<\/strong>/,
    'combat model should clamp displayed damage taken per second through the panel formatter'
);

assert.doesNotMatch(
    template,
    /<span>Crit Chance<\/span>|<span>Offline Gains Rate<\/span>/,
    'combat model should not repeat user-entered percent fields'
);

assert.doesNotMatch(
    template,
    /<span>Spawn Time<\/span>|<span>Spawn Limit<\/span>|Enemy PDef|gear JSON/,
    'AFK panel should not regress to ambiguous or implementation-specific labels'
);

assert.equal(
    methods.formatNonNegativeFixed.call(methods, -3.682, 4),
    '0',
    'damage taken display should not show negative values'
);

assert.equal(
    Number(methods.formatNonNegativeFixed.call(methods, 1.23456, 4).replace(',', '.')),
    1.2346,
    'damage taken display should preserve positive values'
);

console.log('tools/components/AfkCombatCalculatorPanel.test.mjs passed');
