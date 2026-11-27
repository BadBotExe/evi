import gemShop from '../../bonuses/sources/gem_shop.json?v=9d586e3ffc' with { type: 'json' };
import campSource from '../../bonuses/sources/camp_production.json' with { type: 'json' };
import { availableCampTiers, campRarity } from '../../bonuses/app/campCatReference.js';

const buildings = campSource.bonuses.filter(({ id }) => id.endsWith('_building'));
const cats = buildings.find(({ id }) => id === 'camp_tavern_building').cat_reference;
const availableTiers = availableCampTiers(cats);
const purchase = id => gemShop.bonuses.find(source => source.id === id).bonuses[0].tiers_formula;

function buildingValues(id, bonus) {
    return buildings.find(building => building.id === id)
        .bonuses.find(entry => entry.bonus === bonus).tiers_formula.values;
}

// CampConfig, resources.assets (2026-11-25), PathID 25468.
const targetConfig = {
    mine: [
        ["copper_ore", 1],
        ["tin_ore", 1],
        ["iron_ore", 1],
        ["thorium_ore", 2],
        ["sunstone_ore", 3],
    ],
    lumber: [
        ["ash_log", 1],
        ["goak_log", 1],
        ["pyrewood_log", 1],
        ["ironwood_log", 2],
        ["palm_tree_log", 3],
    ],
    pier: [
        ["grey_bream", 1, 0],
        ["orange_snapper", 1, 1],
        ["daisy_scad", 1, 3],
        ["toot_tang", 1, 2],
        ["yellowfin_tang", 2, 0],
        ["tube_zander", 2, 1],
        ["ghost_snapper", 2, 2],
        ["swordfish", 2, 3],
        ["sun_sprattus", 3, 0],
        ["horned_snapper", 3, 1],
        ["pog_blowfish", 3, 2],
        ["bolt_fish", 3, 3],
    ],
    hunt: [
        ["boar_meat", 1, null, "1_2"],
        ["honeycomb", 1, null, "1_3"],
        ["stoney_mcstoneface", 1, null, "1_4"],
        ["leaf", 1, null, "1_5"],
        ["mini_plants", 1, null, "1_6"],
        ["wolf_fang", 1, null, "1_8"],
        ["fruit", 1, null, "1_9"],
        ["ectoplasm", 1, null, "1_10"],
        ["crab_claw", 1, null, "1_11"],
        ["bat_dust", 1, null, "1_12"],
        ["candle", 1, null, "1_13"],
        ["weird_page", 1, null, "1_14"],
        ["d20_dice", 1, null, "1_15"],
        ["fire_essence", 1, null, "1_16"],
        ["icy_needles", 2, null, "2_1"],
        ["helmet_helmet", 2, null, "2_2"],
        ["iceghost_doll", 2, null, "2_3"],
        ["distinguished_glasses", 2, null, "2_4"],
        ["nut", 2, null, "2_5"],
        ["pocketwatch", 2, null, "2_6"],
        ["carrot", 2, null, "2_7"],
        ["troll_idol", 2, null, "2_8"],
        ["monocle", 2, null, "2_9"],
        ["slightly_damaged_glass", 2, null, "2_10"],
        ["matryoska_doll", 2, null, "2_11"],
        ["spearhead", 2, null, "2_12"],
        ["sun_essence", 3, null, "3_1"],
        ["poop_ball", 3, null, "3_2"],
        ["cactus", 3, null, "3_3"],
        ["kangaroo_boomerang", 3, null, "3_4"],
        ["fez_fez", 3, null, "3_5"],
        ["serpent_feather", 3, null, "3_6"],
        ["bandiff_star", 3, null, "3_7"],
        ["beetleman_sting", 3, null, "3_8"],
        ["bow_tie", 3, null, "3_9"],
        ["mummy_wraps", 3, null, "3_10"],
        ["djinn_lamp", 3, null, "3_11"],
        ["horus_idle", 3, null, "3_12"],
    ],
};

export const CAMP = {
    buildings: buildings.filter(({ id }) => id !== 'camp_tavern_building').map(source => ({
        id: source.id.slice('camp_'.length, -'_building'.length),
        name: source.name,
        image: '/bonuses/' + source.image,
        starting_star: source.starting_star ?? 0,
        stars: source.enhancement.max_level,
        workerSlots: source.bonuses.find(({ bonus }) => bonus.endsWith('_slots'))?.tiers_formula.values ?? []
    })),
    targets: Object.fromEntries(Object.entries(targetConfig).map(([building, targets]) => [
        building, targets.map(([item, act, rank, zone]) => [zone ?? item, item, act, rank ?? undefined])
    ])),
    norms: {
        mine: [[[1000.0, 0, 20], [6000.0, 1, 30], [12000.0, 2, 40]], [[1000.0, 0, 20], [6000.0, 1, 30], [12000.0, 2, 40]], [[1000.0, 2, 40], [6000.0, 2, 40], [12000.0, 2, 40]]],
        lumber: [[[1000.0, 0, 20], [6000.0, 1, 30], [12000.0, 2, 40]], [[1000.0, 0, 20], [6000.0, 1, 30], [12000.0, 2, 40]], [[1000.0, 2, 40], [6000.0, 2, 40], [12000.0, 2, 40]]],
        pier: [[[100.0, 0, 20], [200.0, 1, 30], [300.0, 2, 40]], [[400.0, 0, 20], [800.0, 1, 30], [1200.0, 2, 40]], [[1500.0, 2, 40], [3000.0, 2, 40], [4500.0, 2, 40]]],
        hunt: [[[250.0, 0, 20], [1000.0, 1, 30], [4000.0, 2, 40]], [[250.0, 0, 20], [1000.0, 1, 30], [4000.0, 2, 40]], [[250.0, 2, 40], [1000.0, 2, 40], [4000.0, 2, 40]]],
    },
    zones: [["N", "", ""], ["H", "H", ""], ["NM", "NM", "N"], ["NM", "NM", "H"]],
    rpRate: buildingValues('camp_hall_building', 'camp_rp_rate'),
    rpCap: buildingValues('camp_hall_building', 'camp_rp_cap'),
    chestCap: [0, ...buildingValues('camp_store_building', 'camp_storage_capacity')],
    activePurchase: purchase('gem_shop_camp_active_cat'),
    slotPurchase: purchase('gem_shop_camp_chest_slots'),
    housingActive: [0, ...buildingValues('camp_house_building', 'camp_active_cats')],
    rarities: availableTiers.map(campRarity),
    maxLevels: availableTiers.map(tier => cats.max_levels[tier]),
    tierStep: cats.tier_step,
    levelGrowth: cats.level_growth,
    perkNames: cats.perk_names,
    perks: Object.fromEntries(cats.perks.map(([key, values]) => [key, availableTiers.map(tier => values[tier])])),
    jobPerks: Object.fromEntries(cats.perks.flatMap(([key, , jobs]) =>
        jobs.length === 1 ? [[jobs[0], key]] : [])),
};
