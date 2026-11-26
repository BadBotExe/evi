import { gameTerm, t } from '../../i18n/locale.js';
import { formatDropRate } from './dropRates.js?v=be5ceee63e';
import { fishingDropRows, fishingLandChance, guaranteedFishingWeight, minimumFishingPower } from './fishingOdds.js?v=74d8c0d79e';

let fishingPower = 1;
const percent = chance => `${Number((chance * 100).toFixed(6))}%`;

function createPowerField() {
    const wrapper = document.createElement('label');
    wrapper.className = 'drop-input-field';
    wrapper.setAttribute('data-fishing-power', '');
    wrapper.textContent = gameTerm('stat', 'fishing_power');
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
    note.textContent = t('cards.fishingNote', { multiplier: weightMultiplier });
    const list = document.createElement('div');
    list.className = 'drop-list fishing-drop-rows';
    function updateOdds() {
        const sureKg = guaranteedFishingWeight(settings, fishingPower);
        list.replaceChildren();
        appendDropRows(list, rows.map(row => ({
            ...row,
            rate: row.fishKg == null
                ? `${formatDropRate(row.rollChance)}`
                : `${formatDropRate(row.rollChance)}\n${t('cards.fishingOdds', {
                    chance: percent(fishingLandChance(settings, row.fishKg, fishingPower, weightMultiplier)),
                    kg: sureKg,
                    power: row.minimumPower
                })}`
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
    xpNote.textContent = t('cards.fishingXp');
    root.append(note, list, xpNote);
    updateOdds();
}
