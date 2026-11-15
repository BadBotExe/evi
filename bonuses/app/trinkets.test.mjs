import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { bonusMethods } from './bonuses.js';
import { itemBonusMethods } from './ItemBonus.js';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const gear = JSON.parse(readFileSync(resolve(repoRoot, 'bonuses/sources/gear.json'), 'utf8'));
const bonuses = JSON.parse(readFileSync(resolve(repoRoot, 'bonuses/bonuses.json'), 'utf8'));
const items = JSON.parse(readFileSync(resolve(repoRoot, 'items/items.json'), 'utf8'));
const expected = new Map([
    ['black_candle', { maxLevel: 6, total: 2, additional: 1, initialXp: 16, maxXp: 20.8 }],
    ['black_candlestick', { maxLevel: 9, total: 3, additional: 2, initialXp: 24, maxXp: 34.8 }],
    ['black_candelabra', { maxLevel: 12, total: 4, additional: 3, initialXp: 32, maxXp: 51.2 }],
    ['luminor', { maxLevel: 15, total: 5, additional: 4, initialXp: 40, maxXp: 70 }],
    ['bountiful_tusk', { maxLevel: 6, total: 2, additional: 1, initialXp: 16, maxXp: 20.8 }],
    ['generous_cornucopia', { maxLevel: 9, total: 3, additional: 2, initialXp: 24, maxXp: 34.8 }],
    ['plentiful_bihorn', { maxLevel: 12, total: 4, additional: 3, initialXp: 32, maxXp: 51.2 }],
    ['abundant_overgrowth', { maxLevel: 15, total: 5, additional: 4, initialXp: 40, maxXp: 70 }]
]);

test('trinkets expose the complete random stat pool with item-specific bases', () => {
    assert.deepEqual(
        bonuses.slot_types.find(slot => slot.id === 'trinket'),
        { id: 'trinket', label: 'Trinket', max: 1, color: '#b37adf' }
    );

    for (const [id, values] of expected) {
        const source = gear.bonuses.find(entry => entry.id === id);
        assert.ok(source, `missing gear source ${id}`);
        const item = items.find(entry => entry.id === id);
        assert.ok(item, `missing item ${id}`);
        assert.equal(item.source_refs[0].ref, 'event_reward');
        assert.match(item.description, /^At Levels /);
        assert.match(item.description, new RegExp(`up to Tier ${values.additional + 2}\\)\\.$`));
        assert.equal(source.slot, 'trinket');
        assert.equal(source.tier_label, 'Level {tier}');
        assert.equal(source.max_ascension, values.maxLevel);
        assert.equal(source.random_bonus_count, values.total);
        assert.equal(source.random_main_bonus_count, 1);
        assert.equal(source.random_additional_bonus_count, values.additional);
        assert.equal(source.bonuses.length, 19);
        assert.equal(source.bonuses.filter(entry => entry.trinket_stat_group === 'main').length, 6);
        assert.equal(source.bonuses.filter(entry => entry.trinket_stat_group === 'additional').length, 12);
        assert.equal(source.bonuses.some(entry => entry.bonus.endsWith('_v2')), false);
        const appliedCount = source.bonuses.find(entry => entry.bonus === 'Random Bonuses Applied');
        assert.match(appliedCount.value, new RegExp(`^${values.total} \\(`));
        assert.equal(source.bonuses.some(entry => entry.bonus === 'Additional Tier Growth'), false);

        const xp = source.bonuses.find(entry => entry.bonus === 'all_experience');
        assert.equal(xp.tiers_formula.values[0], values.initialXp);
        assert.equal(bonusMethods._applyFormula(xp.tiers_formula, 0), values.maxXp);

        for (const additional of source.bonuses.filter(entry => entry.trinket_stat_group === 'additional')) {
            assert.equal(additional.unlock_at_tier, 1);
            assert.equal(additional.tier_label, 'Tier {tier}');
            assert.equal(additional.tiers_formula.max_tier, values.additional + 2);
            assert.equal(additional.tiers_formula.values.length, values.additional + 2);
        }
    }
});

test('trinket additional stats advance at three-level milestones', () => {
    const luminor = gear.bonuses.find(entry => entry.id === 'luminor');
    const hpPercent = luminor.bonuses.find(entry => entry.bonus === 'hp' && entry.unit_type === 'percent');
    assert.deepEqual(hpPercent.tiers_formula.values, [4, 8, 12, 15, 20, 24]);
    assert.equal(bonusMethods._applyFormula(hpPercent.tiers_formula, 1), 24);
});

test('trinket main and additional stats stay in separate display groups', () => {
    const luminor = gear.bonuses.find(entry => entry.id === 'luminor');
    const context = {
        bonusLabel: id => bonuses.bonus_types.find(entry => entry.id === id)?.label ?? id
    };
    const groups = itemBonusMethods.itemBonusGroups.call(context, luminor);
    const hpGroups = groups.filter(entry => entry.bonus === 'hp');

    assert.equal(hpGroups.length, 2);
    assert.deepEqual(hpGroups.map(entry => entry.trinket_stat_group), ['main', 'additional']);
    assert.deepEqual(
        hpGroups.map(entry => itemBonusMethods.itemBonusLabel.call(context, entry)),
        ['HP', 'HP']
    );
    const popoverContext = {
        resolveBonusPopover: () => true,
        itemPopoverBonusResult: () => ({})
    };
    const popoverGroups = itemBonusMethods.popoverBonuses.call(popoverContext, luminor);
    assert.equal(popoverGroups.filter(entry => entry.bonus === 'hp').length, 2);
    const mainIndex = popoverGroups.findIndex(entry => entry.trinket_stat_group === 'main');
    assert.equal(itemBonusMethods.itemBonusGroupTitle(popoverGroups, mainIndex), 'Main stat');
    const additionalIndex = popoverGroups.findIndex(entry => entry.trinket_stat_group === 'additional');
    assert.equal(itemBonusMethods.itemBonusGroupTitle(popoverGroups, additionalIndex), 'Additional stats');
    assert.equal(itemBonusMethods.itemBonusGroupTitle(popoverGroups, additionalIndex + 1), null);
});

test('Halloween and Harvest trinkets keep their event-specific gathering bases', () => {
    const pairs = [
        ['black_candle', 'bountiful_tusk', 40, 20, 56, 28],
        ['black_candlestick', 'generous_cornucopia', 60, 30, 96, 48],
        ['black_candelabra', 'plentiful_bihorn', 80, 40, 144, 72],
        ['luminor', 'abundant_overgrowth', 100, 50, 200, 100]
    ];

    for (const [halloweenId, harvestId, halloweenBase, harvestBase, halloweenMax, harvestMax] of pairs) {
        const halloween = gear.bonuses.find(entry => entry.id === halloweenId);
        const harvest = gear.bonuses.find(entry => entry.id === harvestId);
        for (const bonusId of ['mining_power', 'woodcutting_power']) {
            const halloweenStat = halloween.bonuses.find(entry => entry.bonus === bonusId && entry.unit_type === 'flat');
            const harvestStat = harvest.bonuses.find(entry => entry.bonus === bonusId && entry.unit_type === 'flat');
            assert.equal(halloweenStat.tiers_formula.values[0], halloweenBase);
            assert.equal(harvestStat.tiers_formula.values[0], harvestBase);
            assert.equal(halloweenStat.tiers_formula.values.at(-1), halloweenMax);
            assert.equal(harvestStat.tiers_formula.values.at(-1), harvestMax);
        }
    }
});
