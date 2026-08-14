import assert from 'node:assert/strict';

import { AfkCombatCalculatorPanel } from './AfkCombatCalculatorPanel.js';

const template = AfkCombatCalculatorPanel.template;
const methods = AfkCombatCalculatorPanel.methods;
const mounted = AfkCombatCalculatorPanel.mounted;
const formulaTemplate = template.match(/<div class="tools-afk-formula-body">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/section>/)?.[0] ?? '';

assert.match(
    template,
    /<span>Mob Spawn Time<\/span><strong>\{\{ formatTime\(result\.spawnSeconds\) \}\}<\/strong>/,
    'combat model should identify calculated spawn time as Mob Spawn Time'
);

assert.match(
    template,
    /<span>Mob Spawn Limit<\/span><strong>\{\{ formatFixed\(result\.spawnCapKillsPerHour, 2\) \}\}<\/strong>/,
    'combat model should identify spawn cap as Mob Spawn Limit'
);

assert.match(
    template,
    /<span>Damage Taken per Second<\/span><strong>\{\{ formatNonNegativeFixed\(result\.incomingDps, 4\) \}\}<\/strong>/,
    'combat model should clamp displayed damage taken per second through the panel formatter'
);

assert.doesNotMatch(
    template,
    /Damage stat|Movement stat|Survival stat/,
    'location cap should not show meaningless stat-category rows'
);

assert.doesNotMatch(
    template,
    /<span>Spawn Time<\/span>|<span>Spawn Limit<\/span>|Enemy PDef|gear JSON/,
    'AFK panel should not regress to ambiguous or implementation-specific labels'
);

assert.match(
    template,
    /Attack Speed \(Cap: \{\{ statLimits\.attackSpeedMax \}\}\)/,
    'Attack Speed input should show the confirmed upper cap'
);

assert.match(
    template,
    /Movement Speed \(Cap: \{\{ statLimits\.movementSpeedMax \}\}\)/,
    'Movement Speed input should show the confirmed upper cap'
);

assert.match(
    template,
    /<div class="tools-recipe-section-label">Location Cap<\/div>/,
    'AFK panel should show per-location cap breakpoints'
);

assert.match(
    template,
    /<span class="tools-afk-cap-label">Offline Gains Rate <button[\s\S]*?afkHelp\.offlineRate[\s\S]*?i<\/button><\/span>\s*<strong>\{\{ formatFixed\(player\.offlineRate, 2\) \}\}%<\/strong>/,
    'location cap should state which Offline Gains Rate and Mob Spawn Time it uses'
);

assert.match(
    template,
    /<span class="tools-afk-cap-label">Mob Spawn Time <button[\s\S]*?afkHelp\.mobSpawnTime[\s\S]*?i<\/button><\/span>\s*<strong>\{\{ formatFixed\(player\.mobSpawnMultiplier, 2\) \}\}%<\/strong>/,
    'location cap should state which Mob Spawn Time it uses'
);

assert.match(
    template,
    /<span class="tools-afk-cap-label">Bottleneck <button[\s\S]*?afkHelp\.bottleneck[\s\S]*?i<\/button><\/span>\s*<strong>\{\{ capBreakpoints\.bottleneck \}\}<\/strong>/,
    'AFK panel should show the current cap bottleneck'
);

assert.doesNotMatch(
    template,
    /What to improve|capBreakpoints\.action/,
    'AFK panel should not render long next-step text in a label/value row'
);

assert.match(
    template,
    /<div class="tools-recipe-section-label">Limit Breakdown<\/div>/,
    'AFK panel should show grouped limit breakdown'
);

assert.match(
    template,
    /<div class="tools-recipe-section-label">Damage Group<\/div>/,
    'AFK panel should show damage stats as a group'
);

assert.match(
    template,
    /<span class="tools-afk-cap-label">DPS to Spawn Limit <button[\s\S]*?afkHelp\.dpsTarget[\s\S]*?i<\/button><\/span>\s*<strong>\{\{ format\(capBreakpoints\.requiredDps, 2\) \}\}<\/strong>/,
    'AFK panel should show DPS as the shared cap target'
);

assert.match(
    template,
    /@click\.stop="showHelp\(\$event, afkHelp\.[a-zA-Z]+\)"/,
    'AFK help buttons should open by click/tap, not only hover'
);

assert.doesNotMatch(
    template,
    /tools-afk-help-btn"[^>]*@mouse|tools-afk-help-btn"[^>]*@focus|tools-afk-help-btn"[^>]*@blur/,
    'AFK help buttons should not depend on hover/focus handlers'
);

assert.match(
    template,
    /class="mobile-drawer tools-smeltery-calc-sheet tools-afk-help-sheet open"\s*@click\.stop\s*@pointerdown\.stop/,
    'AFK mobile help should use the existing mobile drawer pattern and keep inside clicks from closing it'
);

assert.doesNotMatch(
    template,
    />\?<\/button>/,
    'AFK help buttons should not render old question-mark glyphs'
);

assert.match(
    template,
    /afkHelp\.status[\s\S]*afkHelp\.mobSpawnLimit[\s\S]*afkHelp\.combatLimit[\s\S]*afkHelp\.survivalLimit[\s\S]*afkHelp\.movementTime[\s\S]*afkHelp\.damageTaken[\s\S]*afkHelp\.timeToDeath[\s\S]*afkHelp\.survival/,
    'AFK cap rows should have help icons for each important result parameter'
);

assert.match(
    template,
    /Source: DPS = Atk \* Attack Speed \* \(1 \+ Crit Chance \* Crit Damage\)\./,
    'AFK panel should explain where DPS numbers come from'
);

assert.match(
    template,
    /<div class="tools-recipe-section-label tools-afk-section-label-help">\s*<span>Movement Group<\/span>\s*<button[\s\S]*?afkHelp\.movementImpact[\s\S]*?i<\/button>/,
    'AFK panel should show movement stats as a group with group-level help'
);

assert.match(
    template,
    /Source: movement time = max\(0, \(5 - weapon range\) \/ Movement Speed\)\./,
    'AFK panel should explain where movement numbers come from'
);

assert.match(
    template,
    /<div class="tools-recipe-section-label tools-afk-section-label-help">\s*<span>Survival Group<\/span>\s*<button[\s\S]*?afkHelp\.survivalImpact[\s\S]*?i<\/button>/,
    'AFK panel should show survival stats as a group with group-level help'
);

assert.doesNotMatch(
    template,
    /Effect on AFK|tools-afk-impact-note|movementImpactText|survivalImpactText/,
    'Long impact text should stay in group-level help and not render extra rows'
);

assert.match(
    template,
    /Source: survival uses HP, Phys\. Defence, HP Regeneration, and weapon survival\./,
    'AFK panel should explain where survival numbers come from'
);

assert.doesNotMatch(
    template,
    /Single Stat Targets|Damage Single Stat Examples|Atk Needed|Attack Speed Needed|Crit Chance Needed|Crit Damage Needed|Movement Speed Needed|Atk Only|Attack Speed Only|Crit Chance Only|Crit Damage Only|Movement Speed Only/,
    'AFK panel should not present interchangeable stats as independent one-stat targets'
);

assert.match(
    template,
    /<section class="tools-afk-formula-section">\s*<dl>\s*<dt>Percent inputs<\/dt><dd>[\s\S]*?<\/dd>\s*<\/dl>\s*<pre>CritChance = CritChancePercent \/ 100/,
    'formula popover should put the existing description block before its formula block'
);

assert.match(
    template,
    /<dt>Final Rewards<\/dt><dd>[\s\S]*?<\/dd>\s*<\/dl>\s*<pre>rawKillsPerHour = min\(spawnCap, killTravelCap\)[\s\S]*?<\/pre>\s*<\/section>\s*<dl>/,
    'formula popover should put reference-only descriptions after the formula sections'
);

assert.match(
    template,
    /<dt>Attack Speed<\/dt><dd>[\s\S]*?<\/dd>\s*<\/dl>\s*<pre>playerDps = critMultiplier \* Atk \* AttackSpeed/,
    'Attack Speed description should be next to the DPS formula where it is used'
);

assert.match(
    template,
    /<dt>Movement Speed<\/dt><dd>[\s\S]*?<\/dd>[\s\S]*?<pre>movementPenalty = max\(0, \(5 - WeaponRange\) \/ MovementSpeed\)/,
    'Movement Speed description should be next to the movement formula where it is used'
);

for (const sectionMatch of formulaTemplate.matchAll(/<section class="tools-afk-formula-section">[\s\S]*?<\/section>/g)) {
    assert.doesNotMatch(
        sectionMatch[0],
        /<h3>|<p>/,
        'formula sections should not use new heading/paragraph descriptions'
    );
}

assert.doesNotMatch(
    formulaTemplate,
    /Attack Speed \/ Movement Speed/,
    'formula popover should not keep detached combined speed descriptions'
);

assert.match(
    formulaTemplate,
    /if DoubleCrit:\s*critCap = 2\s*else:\s*critCap = 1/,
    'formula popover should use if/else instead of a ternary for Double Crit'
);

assert.doesNotMatch(
    formulaTemplate,
    /DoubleCrit \? 2 : 1/,
    'formula popover should not use ternary syntax for Double Crit'
);

assert.equal(
    methods.formatNonNegativeFixed.call(methods, -3.682, 4),
    '0',
    'damage taken display should not show negative values'
);

assert.equal(
    Number(methods.formatNonNegativeFixed.call(methods, 1.23456, 4).replace(',', '.')),
    1.2346,
    'damage taken display should preserve positive values'
);

{
    const tabWrites = [];
    const context = {
        app: {
            setAfkCombatMobileTab(tab) {
                tabWrites.push(tab);
            }
        },
        mobileTab: 'input',
        locationPickerOpen: true,
        weaponPickerOpen: true,
        formulaOpen: true,
        closeMobileHelp() {}
    };
    methods.setMobileTab.call(context, 'results');
    assert.equal(context.mobileTab, 'results', 'setMobileTab should switch to the requested tab');
    assert.deepEqual(tabWrites, ['results'], 'setMobileTab should sync the selected AFK mobile tab to app route state');
    assert.equal(context.locationPickerOpen, false, 'setMobileTab should close the location picker');
    assert.equal(context.weaponPickerOpen, false, 'setMobileTab should close the weapon picker');
    assert.equal(context.formulaOpen, false, 'setMobileTab should close the formula popover');
    methods.setMobileTab.call(context, 'bad-tab');
    assert.equal(context.mobileTab, 'results', 'setMobileTab should ignore unknown tab ids');
    assert.deepEqual(tabWrites, ['results'], 'setMobileTab should not sync unknown tab ids');
}

{
    let tooltipHidden = false;
    const context = {
        app: {
            isMobileViewport: true,
            hideTooltip() {
                tooltipHidden = true;
            }
        },
        mobileHelpOpen: false,
        mobileHelpText: ''
    };
    methods.toggleHelp.call(context, { preventDefault() {} }, 'help text');
    assert.equal(tooltipHidden, true, 'mobile help should hide the desktop tooltip');
    assert.equal(context.mobileHelpOpen, true, 'mobile help should open the drawer');
    assert.equal(context.mobileHelpText, 'help text', 'mobile help should render the selected help text');
    methods.closeMobileHelp.call(context);
    assert.equal(context.mobileHelpOpen, false, 'mobile help close should close the drawer');
    assert.equal(context.mobileHelpText, '', 'mobile help close should clear the text');
}

{
    const originalDocument = globalThis.document;
    const listeners = {};
    globalThis.document = {
        addEventListener(name, handler) {
            listeners[name] = handler;
        }
    };
    const context = {
        app: { afkCombatMobileTab: 'input', isMobileViewport: false },
        hideHelpCalled: false,
        formulaOpen: true,
        closePickersCalled: false,
        closeMobileHelpCalled: false,
        hideHelp() {
            this.hideHelpCalled = true;
        },
        closePickers() {
            this.closePickersCalled = true;
        },
        closeMobileHelp() {
            this.closeMobileHelpCalled = true;
        }
    };
    mounted.call(context);
    listeners.keydown({ key: 'Escape' });
    assert.equal(context.hideHelpCalled, true, 'Escape should close the desktop help tooltip');
    assert.equal(context.formulaOpen, false, 'Escape should close formula popover');
    assert.equal(context.closePickersCalled, true, 'Escape should close pickers');
    assert.equal(context.closeMobileHelpCalled, true, 'Escape should close mobile help');
    globalThis.document = originalDocument;
}

console.log('tools/components/AfkCombatCalculatorPanel.test.mjs passed');
