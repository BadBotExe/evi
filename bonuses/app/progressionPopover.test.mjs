import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { setLocale, translateLabel } from '../../i18n/locale.js';
import { itemBonusMethods } from './ItemBonus.js';

test('the warrior defence popover preserves each node label and its own point range', () => {
    const data = JSON.parse(readFileSync(new URL('../sources/progression.json', import.meta.url), 'utf8'));
    const defence = data.bonuses.find(source => source.id === 'progression_warrior_defence');
    const context = { ...itemBonusMethods, itemPopoverBonusResult: () => ({}) };
    const rows = context.popoverBonuses({ ...defence, type: data.type });

    assert.deepEqual(rows.map(row => row.label), ['Nodes 1-3', 'Node 4', 'Nodes 5-6']);
    assert.deepEqual(rows.map(row => row._groupBonuses.map(bonus => bonus.tiers_formula)), [
        [{ coeff: 1, max_tier: 13 }],
        [{ coeff: 2, max_tier: 2 }],
        [{ coeff: 1, max_tier: 20 }]
    ]);
    const pointLabel = data.tiers_formula.label_prefix + ' 1';
    setLocale('ru');
    try {
        assert.deepEqual(rows.map(row => translateLabel(row.label)), ['Узлы 1-3', 'Узел 4', 'Узлы 5-6']);
        assert.equal(translateLabel(pointLabel), 'Добавлено очков: 1');
    } finally {
        setLocale('en');
    }
    assert.equal(translateLabel(pointLabel), 'Points added 1');
});
