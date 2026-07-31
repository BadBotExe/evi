import assert from 'node:assert/strict';
import { CurioGachaPanel } from './CurioGachaPanel.js';

const template = CurioGachaPanel.template;

assert.match(
    template,
    /<input class="engineering-input tools-input-surface tools-input-filled tools-input-full"[\s\S]*placeholder="506769617668B19A"/,
    'curio gacha panel should use the existing engineering input surface for PlayFabId'
);

assert.match(
    template,
    /<span class="engineering-field-label">Pulls From<\/span>[\s\S]*:value="state\.ordinaryPullsFrom"[\s\S]*@change="setOrdinaryPullsFrom\(\$event\.target\.value\)"[\s\S]*<span class="engineering-field-label">Pulls To<\/span>[\s\S]*@change="setOrdinaryPulls\(\$event\.target\.value\)"/,
    'curio gacha panel should expose editable pull range with the existing field style'
);

assert.match(
    template,
    /Paste the account PlayFabId to calculate deterministic gacha events\.[\s\S]*once you see the future, you cannot unknow it[\s\S]*By entering your PlayFabId, you confirm that you understand what this tool does\./,
    'empty state should warn players before revealing deterministic future gacha results'
);

assert.match(
    template,
    /tools-curio-simulation-card[\s\S]*<div class="tools-recipe-section-label">Simulation<\/div>[\s\S]*tools-curio-stat-grid[\s\S]*tools-curio-summary-grid/,
    'simulation summary should render above the best picks grid as a metric grid'
);

assert.match(
    template,
    /tools-curio-pity-toggle[\s\S]*Pity Claims[\s\S]*Every ordinary pull adds 1 pity point[\s\S]*Delaying pity can change which legendary curio you get[\s\S]*its three choices are replaced by the pity reward[\s\S]*Claim after pull[\s\S]*Reset to immediate/,
    'pity badge should open a described schedule popover with editable claim rows and delay rationale'
);

assert.match(
    template,
    /\{\{ tierStatus\(item\) \}\} · \{\{ copyStatus\(item\) \}\}/,
    'best picks progress should show curio tier and copy count together'
);

assert.match(
    template,
    /class="tools-curio-progress-item tools-curio-progress-button"[\s\S]*@click="selectCurio\(item\)"/,
    'best picks should be clickable curio filters'
);

assert.match(
    template,
    /tools-curio-best-actions[\s\S]*class="item-chip tools-curio-reset-chip"[\s\S]*:disabled="!hasSelectedCurioFilter"/,
    'best picks should expose a nearby reset chip for selected curio filters'
);

assert.match(
    template,
    /class="item-chip item-section-chip"[\s\S]*:style="\{ '--item-chip-color': entry\.color, '--item-chip-color-soft': entry\.color \+ '22' \}"/,
    'rarity filters should reuse the existing item chip color contract'
);

assert.match(
    template,
    /class="item-chip tools-curio-reset-chip"[\s\S]*@click="resetFilters\(\)"/,
    'filter controls should include a reset chip'
);

assert.match(
    template,
    /<td v-for="choice in event\.choices"[\s\S]*<sprite-image v-if="choice\.image"/,
    'normal pull rows should render each of the three choices with SpriteImage'
);

assert.match(
    template,
    /<td colspan="3"[\s\S]*event\.reward[\s\S]*<sprite-image v-if="event\.reward\.image"/,
    'pity rows should render one guaranteed reward spanning the three choice columns'
);

assert.match(
    template,
    /tools-curio-choice-selected/,
    'best choice should be represented by the selected choice class'
);
