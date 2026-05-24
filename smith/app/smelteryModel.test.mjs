import assert from 'node:assert/strict';

import {
    buildSmelteryTimingRows,
    calculateSmelteryGemshopMultiplier,
    calculateSmelteryEffectiveTime,
    calculateSmelteryMulticraftMultiplier,
    calculateSmelterySpeedFromMeasuredSeconds,
    formatSmelterySeconds,
    normalizeSmelteryGemshopLevel,
    normalizeSmelterySpeed,
    parseSmelteryMeasuredDuration
} from './smelteryModel.js';

assert.equal(normalizeSmelterySpeed(''), '');
assert.equal(normalizeSmelterySpeed('25'), '25');
assert.equal(normalizeSmelterySpeed(12.5), '12.5');
assert.equal(normalizeSmelterySpeed('bad'), '');
assert.equal(normalizeSmelteryGemshopLevel('', 4), '0');
assert.equal(normalizeSmelteryGemshopLevel('3', 4), '3');
assert.equal(normalizeSmelteryGemshopLevel('10', 4), '4');
assert.equal(normalizeSmelteryGemshopLevel('-2', 4), '0');

assert.equal(calculateSmelteryGemshopMultiplier('0', { initMultiplier: 1, tierStep: 0.5 }), 1);
assert.equal(calculateSmelteryGemshopMultiplier('4', { initMultiplier: 1, tierStep: 0.5 }), 3);
assert.equal(calculateSmelteryMulticraftMultiplier('0', { initMultiplier: 1, tierStep: 0.5 }), 1);
assert.equal(calculateSmelteryMulticraftMultiplier('2', { initMultiplier: 1, tierStep: 0.5 }), 2);

assert.equal(calculateSmelteryEffectiveTime(20, 0), 20);
assert.equal(calculateSmelteryEffectiveTime(20, 100), 10);
assert.equal(calculateSmelteryEffectiveTime(20, 100, 2), 5);
assert.equal(calculateSmelteryEffectiveTime(15, -50), 30);
assert.equal(calculateSmelteryEffectiveTime(null, 50), null);
assert.equal(calculateSmelteryEffectiveTime(15, -100), null);
assert.equal(calculateSmelterySpeedFromMeasuredSeconds(900, 600), 50);
assert.equal(calculateSmelterySpeedFromMeasuredSeconds(900, 300, 3), 0);
assert.equal(calculateSmelterySpeedFromMeasuredSeconds(900, 150, 3), 100);
assert.equal(calculateSmelterySpeedFromMeasuredSeconds(900, 300), 200);
assert.equal(calculateSmelterySpeedFromMeasuredSeconds(900, 1800), -50);
assert.equal(calculateSmelterySpeedFromMeasuredSeconds(900, 0), null);
assert.equal(calculateSmelterySpeedFromMeasuredSeconds(null, 600), null);
assert.equal(parseSmelteryMeasuredDuration('', '', ''), null);
assert.equal(parseSmelteryMeasuredDuration('0', '10', '0'), 600);
assert.equal(parseSmelteryMeasuredDuration('1', '2', '3'), 3723);
assert.equal(parseSmelteryMeasuredDuration('0', '60', '0'), null);
assert.equal(parseSmelteryMeasuredDuration('0', '0', '-1'), null);

assert.equal(formatSmelterySeconds(9245), '2h 34m 5s');
assert.equal(formatSmelterySeconds(10800), '3h 0m 0s');
assert.equal(formatSmelterySeconds(292), '4m 52s');
assert.equal(formatSmelterySeconds(8), '8s');
assert.equal(formatSmelterySeconds(8.3), '8.3s');
assert.equal(formatSmelterySeconds(0.7), '0.7s');
assert.equal(formatSmelterySeconds(null), '--');

assert.deepEqual(
    buildSmelteryTimingRows({ item_id: 'steel_bar', base_time: 30 }, '50', 2),
    [
        { id: 'base_time', label: 'Base Time', value: '15s' },
        { id: 'effective_time', label: 'Effective Time', value: '10s' }
    ]
);

assert.deepEqual(
    buildSmelteryTimingRows({ item_id: 'steel_bar' }, ''),
    [
        { id: 'base_time', label: 'Base Time', value: 'Not added yet' },
        { id: 'effective_time', label: 'Effective Time', value: 'Not available' }
    ]
);

console.log('smith/app/smelteryModel.test.mjs passed');
