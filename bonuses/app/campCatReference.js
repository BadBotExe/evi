import { formatFixedNumber } from '../lib/utils.js?v=cb138a904c';

const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const perkNames = {
    mine: 'Mine Power',
    cut: 'Nursery Power',
    fish: 'Pier Power',
    hunt: 'Hunting Lodge Power',
    lead: 'Crew Power',
    study: 'Cat XP Gain',
    treas: 'Camp RP Gain',
    jack: 'Work Power',
    keeper: 'Chest Capacity'
};
const columns = entries => entries.map(([key, label]) => ({ key, label }));
const whole = value => formatFixedNumber(value, { maximumFractionDigits: 0 });

function levelTable(data, tier) {
    const cap = data.max_levels[tier];
    const startingPower = data.power_base * data.tier_step ** tier;
    const capXp = data.xp_per_hour * 24 * data.xp_days[tier] * (1 + data.xp_modifiers[tier] / 100);
    const xpAt = level => capXp * ((level - 1) / (cap - 1)) ** data.xp_exponent;
    return {
        id: rarities[tier],
        title: rarities[tier],
        columns: columns([['level', 'Level'], ['power', 'Base Power'], ['next', 'XP to Next'], ['total', 'Total XP']]),
        rows: Array.from({ length: cap }, (_, index) => {
            const level = index + 1;
            const progress = index / (cap - 1);
            return {
                level,
                power: formatFixedNumber(startingPower * (1 + (data.level_growth - 1) * progress)),
                next: level === cap ? '-' : formatFixedNumber(xpAt(level + 1) - xpAt(level)),
                total: formatFixedNumber(xpAt(level))
            };
        })
    };
}

export function campCatReferencePanel(tavern) {
    const data = tavern?.cat_reference;
    if (!data) return null;
    const stars = data.odds.map((_, index) => [String(index), `★${index + 1}`]);

    const availableTiers = data.max_levels.map((_, tier) => tier)
        .filter(tier => data.odds.some(weights => weights[tier] > 0));

    return {
        id: 'camp-cat-reference',
        title: 'Tavern - Camp Cats',
        description: `${data.perk_count} perks per cat at every rarity. Levels increase Base Power. Base training rate ${whole(data.xp_per_hour)} XP/h. Housing upgrades and the XP perk increase this rate.`,
        actions: [
            {
                id: 'camp-cat-hire',
                label: 'Hire Prices & Rarities',
                title: 'Tavern Hire Prices',
                description: 'Configured hire prices in Camp RP. The in-game offer shows the actual price. Candidate weights are at reference Glory.',
                tables: [{
                    id: 'camp-cat-rarity',
                    columns: columns([['rarity', 'Rarity'], ['price', 'Hire (Camp RP)'], ['cap', 'Max Level'], ...stars]),
                    rows: availableTiers.map(tier => ({
                        rarity: rarities[tier],
                        price: whole(data.hire_prices[tier]),
                        cap: data.max_levels[tier],
                        ...Object.fromEntries(data.odds.map((weights, index) => [
                            index, weights[tier] == null ? '-' : `${weights[tier]}%`
                        ]))
                    }))
                }]
            },
            {
                id: 'camp-cat-perks',
                label: 'Perks',
                title: 'Camp Cat Perks',
                description: 'Each cat has two perks. Their values depend on rarity and stay fixed as the cat levels up. Job perks apply at the matching building.',
                tables: [{
                    id: 'camp-cat-perk-values',
                    columns: columns([['perk', 'Effect'], ...availableTiers.map(tier => [rarities[tier], rarities[tier]])]),
                    rows: data.perks.map(([id, values]) => ({
                        perk: perkNames[id] ?? id,
                        ...Object.fromEntries(availableTiers.map(tier => [rarities[tier], `+${values[tier]}%`]))
                    }))
                }]
            },
            {
                id: 'camp-cat-levels',
                label: 'Levels',
                title: 'Camp Cat Levels',
                description: 'Each level increases Base Power, which contributes to production at the assigned building. This table shows power before perks and building effects.',
                tabbed: true,
                tables: availableTiers.map(tier => levelTable(data, tier))
            }
        ]
    };
}
