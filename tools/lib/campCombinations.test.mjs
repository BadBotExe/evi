import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMP } from './campData.js';
import { campHiringGuide } from './campCalculator.js';

test('hiring guide recommends a pair for each building and number of worker slots', () => {
    for (const building of CAMP.buildings) {
        const job = CAMP.jobPerks[building.id];
        const rows = campHiringGuide(building);
        if (!job) {
            assert.deepEqual(rows, []);
            continue;
        }

        assert.deepEqual(rows.map(({ stars, crew }) =>
            [stars, crew.map(({ job, perk, count }) => [job, perk, count])]), [
            [1, [[job, 'jack', 1]]],
            [2, [[job, 'lead', 2]]],
            [3, [[job, 'lead', 3]]]
        ]);
    }
});
