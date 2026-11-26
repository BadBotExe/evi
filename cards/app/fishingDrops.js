import { formatDropRate } from './dropRates.js?v=bf0882b30d';
import { fishingDropRows, fishingLandChance, guaranteedFishingWeight, minimumFishingPower } from './fishingOdds.js?v=5af2fb72fc';

let fishingPower = 1;
const percent = chance => `${Number((chance * 100).toFixed(6))}%`;

function createPowerField() {
    const wrapper = document.createElement('label');
    wrapper.className = 'drop-input-field';
    wrapper.setAttribute('data-fishing-power', '');
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

export function appendFishingDrops(root, controls, fishing, pond, cardItem, drops, mode, dr, appendDropRows) {
    const { settings, weightByDifficulty } = fishing;
    const weightMultiplier = weightByDifficulty[mode] ?? 1;
    const rows = fishingDropRows(settings, pond, cardItem, drops, dr).map(row => ({
        ...row,
        minimumPower: row.fishKg == null ? null : minimumFishingPower(settings, row.fishKg, weightMultiplier)
    }));

    const power = createPowerField();
    const note = document.createElement('small');
    note.className = 'drop-note';
    const weightLabel = document.createElement('strong');
    weightLabel.textContent = `fish weight ×${weightMultiplier}`;
    note.append(
        'Drop Quantity affects which catch is rolled. Selected difficulty: ',
        weightLabel,
        '. Heavier fish can be harder to land Offline and require more Fishing Power to reach 100%. Offline estimates use base weight before personal weight bonuses and records.'
    );
    const list = document.createElement('div');
    list.className = 'drop-list fishing-drop-rows';
    function updateOdds() {
        const sureKg = guaranteedFishingWeight(settings, fishingPower);
        list.replaceChildren();
        appendDropRows(list, rows.map(row => ({
            ...row,
            rate: row.fishKg == null
                ? `${formatDropRate(row.rollChance)}`
                : `${formatDropRate(row.rollChance)}\nOffline ${percent(fishingLandChance(settings, row.fishKg, fishingPower, weightMultiplier))}
Always up to ${sureKg} kg
Power for 100% Offline: ${row.minimumPower}`
        })));
    }

    power.input.addEventListener('input', () => {
        const value = power.input.valueAsNumber;
        if (!Number.isFinite(value) || !power.input.validity.valid) return;
        fishingPower = value;
        updateOdds();
    });
    controls.append(power.wrapper);
    const xpNote = document.createElement('small');
    xpNote.className = 'drop-note';
    xpNote.textContent = 'Fishing XP = 10 × credited weight per fish (kg) × fish count × Fishing XP multiplier. Higher difficulties can give more XP by increasing the weight of the catch.';
    root.append(note, list, xpNote);
    updateOdds();
}
