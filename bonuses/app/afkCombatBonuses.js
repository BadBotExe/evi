import { bonusMethods } from './bonuses.js?v=5f3711aeeb';
import { BonusDataLoader } from './dataLoader.js?v=1f78f84f19';
import { resourceBreakdownMethods } from './resourceBreakdown.js?v=9519dfd7ce';
import { BonusSourceResolver } from './sourceResolver.js?v=b1f3f40d87';
import { optimizeAdditivePair } from '../lib/optimizer.v2.js?v=b72ef6935b';

const SPAWN_TIME = 'respawn_time';
const COMBAT_GAINS = 'combat_offline_gains';

export async function loadAfkCombatBonusCatalog() {
    const app = {
        ...resourceBreakdownMethods,
        ...bonusMethods,
        bonusesBaseUrl: new URL('../', import.meta.url).href,
        activeConditions: new Set()
    };
    const resolver = app._sourceResolver = new BonusSourceResolver(app);
    app._resolveItemFileRefs = resolver.resolveItemFileRefs.bind(resolver);
    app._resolveItemSourceFileRefs = resolver.resolveItemSourceFileRefs.bind(resolver);
    app._resolveItemSources = resolver.resolveItemSources.bind(resolver);
    await new BonusDataLoader(app).load();
    app.selectedClass = app.data.classes[0]?.id;
    app.activeConditions = new Set(app.data.conditions.map(condition => condition.id));

    return {
        build: restrictions => buildAfkCombatBonusOptions(app, restrictions)
    };
}

export function buildAfkCombatBonusOptions(app, {
    excluded = [],
    required = {},
    includeChristmasWeapons = true,
    includeBonfire = true
} = {}) {
    const spawnIds = app._resolveBonusIds(SPAWN_TIME);
    const gainIds = app._resolveBonusIds(COMBAT_GAINS);
    const ids = [...new Set([...spawnIds, ...gainIds])];
    const bucket = { containers: app._buildAllContainers(), exclusive: [], stackable: [] };
    const base = { flat: 0, percent: 0 };
    const requiredIds = Object.values(required);
    const items = [];

    for (const src of app.data.sources) {
        if (src.available === false || src.optimization?.exclude) continue;
        if (!includeChristmasWeapons && src.slot === 'weapon' && src.id.startsWith('xmas_')) continue;
        const bonuses = app._sourceResolver.bonusEntriesForBonusView(src, ids)
            .filter(bonus => (includeBonfire || bonus.condition !== 'bonfire') && app._bonusPassesFilters(bonus, src))
            .map(bonus => ({ ...bonus, value: app.resolveSourceBonusValue(src, bonus) }))
            .filter(bonus => bonus.value);
        if (src.slot) {
            items.push({
                id: src.id,
                slot: src.slot,
                name: src.name,
                type: app.data.slot_types.find(slot => slot.id === src.slot)?.label ?? src.slot
            });
            if (!excluded.includes(src.id) && (bonuses.length || requiredIds.includes(src.id))) {
                app._routeSlottedItem(src, bonuses, bucket);
            }
        } else {
            for (const bonus of bonuses) {
                if (spawnIds.includes(bonus.bonus)) base.flat -= bonus.value;
                if (gainIds.includes(bonus.bonus)) base.percent += bonus.value;
            }
        }
    }

    const encode = items => items.map(item => ({
        ...item,
        requiredSourceId: requiredIds.find(id => id === (item._optimizer_base_id ?? item.id)),
        bonuses: [
            { bonus: COMBAT_GAINS, unit_type: 'flat', value: -sumPercent(item, spawnIds) },
            { bonus: COMBAT_GAINS, unit_type: 'percent', value: sumPercent(item, gainIds) }
        ]
    }));
    const frontier = optimizeAdditivePair(bucket.containers, encode(bucket.exclusive), encode(bucket.stackable), COMBAT_GAINS, requiredIds);
    const options = frontier.map(({ contrib, assignment }) => ({
        mobSpawnMultiplier: -(base.flat + contrib.flat),
        offlineRate: base.percent + contrib.percent,
        slots: assignment.flatMap(container => container.items.map((item, index) => ({
            key: `${container.id}:${index}`,
            type: app.data.slot_types.find(slot => slot.id === container.slot_type)?.label ?? container.slot_type,
            name: item.name,
            id: item._optimizer_base_id ?? item.id,
            slot: container.slot_type
        })))
    }));
    return { options, items };
}

function sumPercent(item, ids) {
    return item.bonuses.reduce((sum, bonus) => {
        if (!ids.includes(bonus.bonus)) return sum;
        if (bonus.unit_type !== 'percent') throw new Error(`Unexpected AFK bonus unit: ${bonus.unit_type}`);
        return sum + bonus.value;
    }, 0);
}
