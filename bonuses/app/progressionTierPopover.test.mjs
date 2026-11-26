import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { itemBonusMethods } from './ItemBonus.js';
import { popoverMethods } from './popovers.js';

test('opening any warrior defence row shows every node group in one tier popover', () => {
    const progression = JSON.parse(readFileSync(new URL('../sources/progression.json', import.meta.url), 'utf8'));
    const defence = progression.bonuses.find(source => source.id === 'progression_warrior_defence');
    const source = { ...defence, type: progression.type };
    let opened;
    const context = {
        ...itemBonusMethods,
        ...popoverMethods,
        itemPopoverBonusResult: () => ({}),
        openTierPopover: entry => { opened = entry; }
    };
    const rows = context.popoverBonuses(source);
    for (const row of rows) {
        context.openTierPopoverForBonus(source, row, {});
        assert.deepEqual(opened.bonuses, defence.bonuses);
    }
});
