import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { bonusMethods } from './bonuses.js';
import { BonusDataLoader } from './dataLoader.js';
import { parseSaveText } from './saveCodec.js';
import { BonusSaveIntegration } from './saveIntegration.js';
import { PROGRESSION_KEYS } from './saveMappings.js';

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const catalog = readJson('../bonuses.json');
const baseStats = readJson('../sources/base_stats.json').bonuses;
const fishingTalents = readJson('../sources/progression.json').bonuses.filter(source => source.category === 'progression_fishing');

test('Fishing progression exposes all 25 nodes with a rank cap and stat for each effect', () => {
    const nodeCaps = new Map();
    for (const source of fishingTalents) {
        assert.ok(existsSync(new URL(`../${source.image}`, import.meta.url)));
        const groups = PROGRESSION_KEYS[source.id];
        assert.equal(groups.length, source.bonuses.length);
        source.bonuses.forEach((bonus, index) => {
            assert.ok(catalog.bonus_types.some(type => type.id === bonus.bonus));
            const [key] = groups[index];
            const rankCap = bonus.tiers_formula.max_tier;
            if (nodeCaps.has(key)) assert.equal(nodeCaps.get(key), rankCap);
            nodeCaps.set(key, rankCap);
        });
    }
    assert.equal(nodeCaps.size, 25);
    assert.equal([...nodeCaps.values()].reduce((total, ranks) => total + ranks, 0), 91);
});

test('Fishing starts at level one and imports level, INT and per-hero node ranks', () => {
    const context = parseSaveText('{"Heroes":{"Heroes":[{"skillModels":[{"ESkill":3,"currentLevel":42}],"Enhancements":{"profession_fishing_m2":1}},{"skillModels":[]}]}}');
    assert.equal(context.heroes[1].fishingLevel, 1);
    const sources = [...baseStats.filter(source => source.id.startsWith('base_stats_fishing_')), ...fishingTalents];
    const app = {
        data: { _base_sources: sources, parameters: catalog.parameters, conditions: [] },
        resetMaxPanel() {},
        resolveSourceBonusValue(_source, bonus) { return bonus.value; },
        _calcItems() { return []; },
        _compoundTotal() { return { value: this.selectedBonus === 'intelligence' ? 60 : 0 }; }
    };
    app._dataLoader = new BonusDataLoader(app);
    new BonusSaveIntegration(app).applySaveContext(context, 0);
    assert.equal(app.parameters.find(parameter => parameter.id === 'int').value, 60);
    assert.equal(app.parameters.find(parameter => parameter.id === 'fishing_level').value, 42);
    const power = app.data.sources.find(source => source.id === 'base_stats_fishing_power').bonuses[0];
    const speed = app.data.sources.find(source => source.id === 'base_stats_fishing_speed').bonuses[0];
    assert.equal(bonusMethods._calculateValue.call(app, power.value, power.scales_with), 42);
    assert.equal(speed.value, 100);
    const focus = app.data.sources.find(source => source.id === 'progression_fishing_focus');
    assert.deepEqual(focus.bonuses.map(bonus => [bonus.bonus, bonus._actualTier]), [
        ['fishing_focus_multiloot', 1],
        ['fishing_focus_multiloot', 0]
    ]);
});
