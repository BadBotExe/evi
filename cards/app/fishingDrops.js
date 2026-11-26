import { fishingDropRows, fishingLandChance, guaranteedFishingWeight } from './fishingOdds.js';

let fishingPower = 1;
const percent = chance => `${Number((chance * 100).toFixed(6))}%`;

function rollOdds(chance) {
    return chance > 0 ? `1 in ${Number((1 / chance).toFixed(3))}` : '';
}

function createPowerField() {
    const wrapper = document.createElement('label');
    wrapper.textContent = 'Fishing Power';
    const input = document.createElement('input');
    input.className = 'browser-search-input';
    input.type = 'number';
    input.min = '0';
    input.step = 'any';
    input.value = String(fishingPower);
    wrapper.appendChild(input);
    return { wrapper, input };
}

export function appendFishingDrops(root, fishing, pond, cardItem, drops, mode, appendDropRows) {
    const { settings, weightByDifficulty } = fishing;
    const rows = fishingDropRows(settings, pond, cardItem, drops);

    const details = document.createElement('div');
    details.className = 'fishing-drop-controls';
    const power = createPowerField();
    const note = document.createElement('small');
    note.textContent = 'Roll odds use base Magic Find. AFK landing is conditional on rolling that fish and uses the selected difficulty and base weight, before personal weight bonuses and records.';
    const list = document.createElement('div');
    list.className = 'drop-list fishing-drop-rows';
    function updateOdds() {
        const weightMultiplier = weightByDifficulty[mode] ?? 1;
        const sureKg = guaranteedFishingWeight(settings, fishingPower);
        list.replaceChildren();
        appendDropRows(list, rows.map(row => ({
            ...row,
            rate: row.fishKg == null
                ? `${rollOdds(row.rollChance)}`
                : `${rollOdds(row.rollChance)}\nOffline ${percent(fishingLandChance(settings, row.fishKg, fishingPower, weightMultiplier))}
Always up to ${sureKg} kg`
        })));
    }

    power.input.addEventListener('input', () => {
        const value = power.input.valueAsNumber;
        if (!Number.isFinite(value) || !power.input.validity.valid) return;
        fishingPower = value;
        updateOdds();
    });
    details.append(power.wrapper, note);
    const xpNote = document.createElement('small');
    xpNote.className = 'fishing-drop-note';
    xpNote.textContent = 'Fishing XP = 10 × credited weight per fish (kg) × fish count × Fishing XP multiplier. Higher difficulties can give more XP by increasing the weight of the catch.';
    root.append(details, list, xpNote);
    updateOdds();
}
