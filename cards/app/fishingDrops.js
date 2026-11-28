import { toggleShellTextPopover } from '../../shell/layout/shellLayout.js?v=503e3ff71b';
import { gameTerm, t } from '../../i18n/locale.js?v=b7fe748fcc';
import { formatDropRate } from './dropRates.js?v=30beba3042';
import { fishingDropRows, fishingLandChance, guaranteedFishingWeight, minimumFishingPower } from './fishingOdds.js?v=b6dc540037';

let fishingPower = 1;
let weightBonusPercent = 0;
let fishingFieldId = 0;
const percent = chance => `${Number((chance * 100).toFixed(6))}%`;

function createFishingField(labelText, value, type) {
    const wrapper = document.createElement('div');
    wrapper.className = 'engineering-field';
    wrapper.setAttribute('data-fishing-field', '');
    const label = document.createElement('label');
    label.className = 'engineering-field-label';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.id = 'cards-fishing-field-' + ++fishingFieldId;
    label.htmlFor = input.id;
    input.className = 'engineering-input tools-number-input';
    input.type = type;
    input.value = String(value);
    wrapper.append(label, input);
    return { wrapper, input, label };
}

export function appendFishingDrops(root, controls, fishing, pond, cardItem, drops, mode, dr, appendDropRows) {
    const { settings, weightByDifficulty } = fishing;
    const weightMultiplier = weightByDifficulty[mode] ?? 1;
    const rows = fishingDropRows(settings, pond, cardItem, drops, dr);
    const power = createFishingField(gameTerm('stat', 'fishing_power'), fishingPower, 'number');
    power.input.min = '0';
    power.input.step = 'any';
    const bonus = createFishingField(t('cards.fishingWeightBonus'), weightBonusPercent, 'text');
    bonus.wrapper.classList.add('fishing-weight-field');
    bonus.input.inputMode = 'decimal';
    bonus.input.pattern = '[0-9]*[.,]?[0-9]+|[0-9]+[.,]';

    const heading = document.createElement('div');
    heading.className = 'fishing-weight-heading';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fishing-mechanics-button';
    button.textContent = 'i';
    const title = t('cards.fishingMechanicsTitle');
    button.setAttribute('aria-label', title);
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => toggleShellTextPopover(button, {
        title,
        text: t('cards.fishingMechanics'),
        closeLabel: t('catalog.close')
    }));
    bonus.label.before(heading);
    heading.append(bonus.label, button);

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
                    chance: percent(fishingLandChance(settings, row.fishKg, fishingPower, weightMultiplier, weightBonusPercent)),
                    kg: sureKg,
                    power: minimumFishingPower(settings, row.fishKg, weightMultiplier, weightBonusPercent)
                })}`
        })));
    }

    power.input.addEventListener('input', () => {
        const value = power.input.valueAsNumber;
        if (!Number.isFinite(value) || !power.input.validity.valid) return;
        fishingPower = value;
        updateOdds();
    });
    bonus.input.addEventListener('input', () => {
        const value = Number(bonus.input.value.replace(',', '.'));
        if (!Number.isFinite(value) || !bonus.input.validity.valid) return;
        weightBonusPercent = value;
        updateOdds();
    });
    controls.append(power.wrapper, bonus.wrapper);
    const xpNote = document.createElement('small');
    xpNote.className = 'drop-note';
    xpNote.textContent = t('cards.fishingXp');
    root.append(note, list, xpNote);
    updateOdds();
}
