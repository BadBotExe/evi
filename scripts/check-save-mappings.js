import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const bonusesDir = path.join(rootDir, 'bonuses');
const sourcesDir = path.join(bonusesDir, 'sources');

const saveMappingsPath = path.join(bonusesDir, 'app', 'saveMappings.js');
const mappings = await import(pathToFileURL(saveMappingsPath).href);

async function readJson(name) {
    return JSON.parse(await readFile(path.join(sourcesDir, name), 'utf8'));
}

function sortedIds(values) {
    return [...new Set(values.filter(Boolean))].sort();
}

function itemRefToId(value) {
    return typeof value === 'string' && value.startsWith('item:') ? value.slice(5) : null;
}

function diff(name, sourceFile, actualIds, mappedIds) {
    const actual = new Set(sortedIds(actualIds));
    const mapped = new Set(sortedIds(mappedIds));
    const missing = [...actual].filter((id) => !mapped.has(id));
    const stale = [...mapped].filter((id) => !actual.has(id));

    console.log(`${name} [${sourceFile}]: ${missing.length === 0 && stale.length === 0 ? 'OK' : 'FAIL'}`);
    console.log(`  actual: ${actual.size}`);
    console.log(`  mapped: ${mapped.size}`);

    if (missing.length) {
        console.log('  unmapped:');
        for (const id of missing) console.log(`    - ${id}`);
    }

    if (stale.length) {
        console.log('  stale:');
        for (const id of stale) console.log(`    - ${id}`);
    }
}

const [
    cardsData,
    hunterData,
    ashData,
    sacrificeData,
    gemShopData,
    engineerData,
    progressionData,
    gearData,
    curiosData,
    runesData
] = await Promise.all([
    readJson('cards.json'),
    readJson('hunter_upgrades.json'),
    readJson('bonfire_ash.json'),
    readJson('bonfire_sacrifice.json'),
    readJson('gem_shop.json'),
    readJson('engineer_upgrades.json'),
    readJson('progression.json'),
    readJson('gear.json'),
    readJson('curios.json'),
    readJson('runes.json')
]);

diff(
    'CARD_SAVE_KEYS',
    'cards.json',
    (cardsData.bonuses ?? []).map((entry) => itemRefToId(entry.$ref)),
    Object.keys(mappings.CARD_SAVE_KEYS ?? {})
);

diff(
    'HUNTER_UPGRADE_KEYS',
    'hunter_upgrades.json',
    (hunterData.bonuses ?? []).map((entry) => entry.id),
    Object.keys(mappings.HUNTER_UPGRADE_KEYS ?? {})
);

diff(
    'BONFIRE_ASH_KEYS',
    'bonfire_ash.json',
    (ashData.bonuses ?? []).map((entry) => entry.id),
    Object.keys(mappings.BONFIRE_ASH_KEYS ?? {})
);

diff(
    'BONFIRE_SACRIFICE_KEYS',
    'bonfire_sacrifice.json',
    (sacrificeData.bonuses ?? []).map((entry) => entry.id),
    Object.keys(mappings.BONFIRE_SACRIFICE_KEYS ?? {})
);

diff(
    'GEM_SHOP_KEYS',
    'gem_shop.json',
    (gemShopData.bonuses ?? []).map((entry) => entry.id),
    Object.keys(mappings.GEM_SHOP_KEYS ?? {})
);

diff(
    'ENGINEER_UPGRADE_KEYS',
    'engineer_upgrades.json',
    (engineerData.bonuses ?? []).map((entry) => entry.id),
    Object.keys(mappings.ENGINEER_UPGRADE_KEYS ?? {})
);

diff(
    'PROGRESSION_KEYS',
    'progression.json',
    (progressionData.bonuses ?? []).map((entry) => entry.id),
    Object.keys(mappings.PROGRESSION_KEYS ?? {})
);

diff(
    'GEAR_GUIDS',
    'gear.json',
    (gearData.bonuses ?? []).map((entry) => entry.id),
    Object.keys(mappings.GEAR_GUIDS ?? {})
);

diff(
    'CURIO_GUIDS',
    'curios.json',
    (curiosData.bonuses ?? []).map((entry) => entry.id),
    Object.keys(mappings.CURIO_GUIDS ?? {})
);

diff(
    'RUNE_GUIDS',
    'runes.json',
    (runesData.bonuses ?? [])
        .map((entry) => entry.id)
        .filter((id) => id && !id.startsWith('runes_rune_word_')),
    Object.keys(mappings.RUNE_GUIDS ?? {})
);

diff(
    'RUNEWORD_GUIDS',
    'runes.json',
    (runesData.bonuses ?? [])
        .map((entry) => entry.id)
        .filter((id) => id && id.startsWith('runes_rune_word_')),
    Object.keys(mappings.RUNEWORD_GUIDS ?? {})
);
