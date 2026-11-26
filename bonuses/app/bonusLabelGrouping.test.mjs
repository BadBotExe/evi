import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itemBonusMethods } from './ItemBonus.js';
import { popoverMethods } from './popovers.js';

test('bonus rows preserve distinct labels across source types and share related tier details', () => {
    let opened;
    const context = {
        ...itemBonusMethods,
        ...popoverMethods,
        itemPopoverBonusResult: () => ({}),
        openTierPopover: entry => { opened = entry; }
    };
    const first = { bonus: 'hp', label: 'First' };
    const second = { bonus: 'hp', label: 'Second' };
    const sameLabel = { ...first, unit_type: 'percent' };
    const plain = { ...first, format: 'plain' };
    const ascension = { ...first, _is_ascension: true };
    const otherPool = { ...first, trinket_stat_group: 'additional' };
    const hidden = { ...first, label: 'Hidden', item_popover: false };
    const related = [first, second, sameLabel];
    for (const type of ['progression', 'gear', 'pet', 'camp_production', 'trinket']) {
        const source = { type, bonuses: [...related, plain, ascension, otherPool, hidden] };
        const rows = context.popoverBonuses(source);
        assert.deepEqual(rows.map(row => row._groupBonuses), [
            [first, sameLabel], [second], [plain], [ascension], [otherPool]
        ], type);
        for (const row of rows.slice(0, 2)) {
            context.openTierPopoverForBonus(source, row, {});
            assert.deepEqual(opened.bonuses, related, type);
        }
        context.openTierPopoverForBonus(source, rows[4], {});
        assert.deepEqual(opened.bonuses, [otherPool], type);
        context.openTierPopoverForBonus(source, rows[1], {}, { maxBonusRefs: ['selected'] });
        assert.deepEqual(opened.bonuses, [second], type);
    }
});
