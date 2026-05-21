import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resourceBreakdownMethods } from '../app/resourceBreakdown.js';

const hunterUpgrades = JSON.parse(
    readFileSync(new URL('./hunter_upgrades.json', import.meta.url), 'utf8')
);
const items = JSON.parse(
    readFileSync(new URL('../../items/items.json', import.meta.url), 'utf8')
);

const itemIds = new Set(items.map(item => item.id));

for (const source of hunterUpgrades.bonuses) {
    const enhancement = source.enhancement;
    assert.ok(enhancement, `${source.id} must define enhancement costs`);
    assert.equal(typeof enhancement.$ref, 'string', `${source.id} enhancement must reuse a shared template`);
    assert.ok(itemIds.has(enhancement.$vars?.item), `${source.id} item must exist in items/items.json`);
}

for (const [templateId, template] of Object.entries(hunterUpgrades.enhancements ?? {})) {
    assert.equal(template.segments?.length, 1, `${templateId} template must use a single enhancement segment`);
    const segment = template.segments[0];
    assert.equal(typeof segment.$ref, 'string', `${templateId} template must reuse a shared enhancement segment`);
}

const context = {
    ...resourceBreakdownMethods
};

for (const source of [
    hunterUpgrades.bonuses[0],
    hunterUpgrades.bonuses.find(entry => entry.id === 'hunter_upgrades_attack_speed_training'),
    hunterUpgrades.bonuses.find(entry => entry.id === 'hunter_upgrades_movement_speed_training')
]) {
    const resolvedEnhancement = resourceBreakdownMethods._resolveResourceBreakdownRef.call(
        context,
        hunterUpgrades,
        source,
        'enhancement'
    );
    const configuredEnhancement = resourceBreakdownMethods._resolveLocalRef(
        hunterUpgrades,
        source.enhancement.$ref
    );
    const enhancementOverride = source.enhancement;
    const configuredSegments = Array.isArray(enhancementOverride.segments)
        ? enhancementOverride.segments
        : configuredEnhancement.segments;
    const resolvedConfiguredSegments = resourceBreakdownMethods._resolveResourceBreakdownNodeRefs.call(
        context,
        hunterUpgrades,
        configuredSegments,
        source,
        'enhancement'
    );
    const resolvedConfiguredSegment = resolvedConfiguredSegments[0];

    assert.equal(
        resolvedEnhancement.max_level,
        configuredEnhancement.max_level,
        `${source.id} keeps its configured max level after breakdown refs are resolved`
    );
    assert.equal(
        resolvedEnhancement.display?.totals?.group_by,
        configuredEnhancement.display?.totals?.group_by,
        `${source.id} keeps its totals grouping after breakdown refs are resolved`
    );
    assert.equal(
        resolvedEnhancement.segments[0].to_level,
        resolvedConfiguredSegment.to_level,
        `${source.id} resolves the configured enhancement segment`
    );
    assert.equal(
        resolvedEnhancement.segments[0].costs[0].item,
        source.enhancement.$vars.item,
        `${source.id} substitutes the configured enhancement item`
    );
    assert.deepEqual(
        resolvedEnhancement.segments[0].costs[0].amount,
        resolvedConfiguredSegment.costs[0].amount,
        `${source.id} keeps the configured enhancement amount formula`
    );
}

console.log('bonuses/sources/hunter_upgrades.test.mjs passed');
