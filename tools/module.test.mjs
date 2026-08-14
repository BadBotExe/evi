import assert from 'node:assert/strict';

globalThis.document = {
    body: {},
    createElement() {
        return {};
    }
};

const { createToolsApp } = await import('./module.js');
const { methods } = createToolsApp()._component;

{
    const context = {
        isMobileViewport: true,
        formatSmithCalculatorExactQuantity(value) {
            return methods.formatSmithCalculatorExactQuantity.call(this, value);
        }
    };

    assert.equal(methods.formatSmithCalculatorDisplayQuantity.call(context, 999), '999');
    assert.equal(methods.formatSmithCalculatorDisplayQuantity.call(context, 1000), '1k');
    assert.equal(methods.formatSmithCalculatorDisplayQuantity.call(context, 1250000), '1.25m');
    assert.equal(methods.smithCalculatorValueIsCompacted.call(context, 1000), true);
    assert.equal(methods.smithCalculatorValueIsCompacted.call(context, 999), false);
}

{
    const context = {
        isMobileViewport: true,
        smithValuePopover: {
            open: false,
            label: '',
            value: ''
        },
        formatSmithCalculatorExactQuantity(value) {
            return methods.formatSmithCalculatorExactQuantity.call(this, value);
        },
        formatSmithCalculatorDisplayQuantity(value) {
            return methods.formatSmithCalculatorDisplayQuantity.call(this, value);
        },
        smithCalculatorValueIsCompacted(value) {
            return methods.smithCalculatorValueIsCompacted.call(this, value);
        }
    };

    methods.openSmithCalculatorValuePopover.call(context, 'Copper Bar Required', 1250000);
    assert.deepEqual(context.smithValuePopover, {
        open: true,
        label: 'Copper Bar Required',
        value: '1,250,000'
    });

    methods.closeSmithCalculatorValuePopover.call(context);
    assert.deepEqual(context.smithValuePopover, {
        open: false,
        label: '',
        value: ''
    });
}

{
    const persisted = [];
    const context = {
        smithCalculatorState: {
            rows: [],
            nextRowId: 1
        },
        persistSmithCalculatorState() {
            persisted.push(this.smithCalculatorState.rows.map(row => ({ ...row })));
        }
    };

    methods.addSmithCalculatorRow.call(context, 'copper_bar');

    assert.deepEqual(context.smithCalculatorState.rows, [
        { id: 1, itemId: 'copper_bar', quantity: 1 }
    ], 'first smith recipe selection should append a new row with quantity 1');
    assert.equal(context.smithCalculatorState.nextRowId, 2, 'new rows should still consume the next row id');
    assert.equal(persisted.length, 1, 'adding a new row should persist calculator state');
}

{
    const persisted = [];
    const context = {
        smithCalculatorState: {
            rows: [
                { id: 4, itemId: 'copper_bar', quantity: 2 },
                { id: 5, itemId: 'iron_bar', quantity: 1 }
            ],
            nextRowId: 6
        },
        persistSmithCalculatorState() {
            persisted.push(this.smithCalculatorState.rows.map(row => ({ ...row })));
        }
    };

    methods.addSmithCalculatorRow.call(context, 'copper_bar');

    assert.deepEqual(context.smithCalculatorState.rows, [
        { id: 4, itemId: 'copper_bar', quantity: 3 },
        { id: 5, itemId: 'iron_bar', quantity: 1 }
    ], 'selecting an already chosen smith recipe should increment its quantity instead of creating a duplicate row');
    assert.equal(context.smithCalculatorState.nextRowId, 6, 'incrementing an existing row should not consume a new row id');
    assert.equal(persisted.length, 1, 'incrementing an existing row should persist calculator state');
}

{
    const persisted = [];
    const context = {
        smithCalculatorState: {
            showCompletedPerItemRows: true
        },
        persistSmithCalculatorState() {
            persisted.push(this.smithCalculatorState.showCompletedPerItemRows);
        }
    };

    methods.setSmithCalculatorShowCompletedPerItemRows.call(context, false);

    assert.equal(context.smithCalculatorState.showCompletedPerItemRows, false, 'per-item completed-row visibility should be stored separately');
    assert.deepEqual(persisted, [false], 'changing per-item completed-row visibility should persist calculator state');
}

{
    const persisted = [];
    const context = {
        smithCalculatorState: {
            showCompositeCombinedRows: true
        },
        persistSmithCalculatorState() {
            persisted.push(this.smithCalculatorState.showCompositeCombinedRows);
        }
    };

    methods.setSmithCalculatorShowCompositeCombinedRows.call(context, false);

    assert.equal(context.smithCalculatorState.showCompositeCombinedRows, false, 'combined composite-row visibility should be stored separately');
    assert.deepEqual(persisted, [false], 'changing combined composite-row visibility should persist calculator state');
}

{
    const shellHost = {
        innerHTML: 'x',
        children: [],
        classList: {
            values: new Set(['shell-hidden']),
            add(...names) {
                names.forEach(name => this.values.add(name));
            },
            remove(...names) {
                names.forEach(name => this.values.delete(name));
            },
            contains(name) {
                return this.values.has(name);
            }
        },
        appendChild(node) {
            this.children.push(node);
            return node;
        }
    };
    const helpTrigger = {
        clicked: false,
        click() {
            this.clicked = true;
        }
    };
    const originalDocument = globalThis.document;
    globalThis.document = {
        getElementById(id) {
            return id === 'shell-mobile-inline-actions' ? shellHost : null;
        },
        querySelector(selector) {
            return selector === '.engineering-planner-panel .engineering-planner-help-btn' ? helpTrigger : null;
        },
        createElement() {
            return {
                className: '',
                textContent: '',
                type: 'button',
                listeners: {},
                setAttribute() {},
                addEventListener(name, handler) {
                    this.listeners[name] = handler;
                }
            };
        }
    };

    const context = {
        isMobileViewport: true,
        activeCalc: 'engineering-planner'
    };

    methods.syncShellMobileActions.call(context);

    assert.equal(shellHost.classList.contains('tools-shell-inline-actions-visible'), true);
    assert.equal(shellHost.classList.contains('shell-hidden'), false);
    assert.equal(shellHost.children.length, 1, 'shell header should receive a single planner help button');
    assert.equal(shellHost.children[0].textContent, '?');
    shellHost.children[0].listeners.click();
    assert.equal(helpTrigger.clicked, true, 'shell planner help button should delegate to the panel help trigger');

    globalThis.document = originalDocument;
}

{
    const syncCalls = [];
    const context = {
        selectedCalc: 'engineering-planner',
        calcDropdownOpen: true,
        syncUrl(options) {
            syncCalls.push(options);
        }
    };

    methods.selectCalc.call(context, 'smith-calculator');

    assert.equal(context.selectedCalc, 'smith-calculator');
    assert.equal(context.calcDropdownOpen, false, 'calculator selection should close the mobile dropdown');
    assert.deepEqual(syncCalls, [{ push: true }], 'calculator selection should still push route state');
}

{
    let persistedSpeed = null;
    let closed = false;
    const context = {
        data: {
            smith: {
                recipesByItemId: {
                    copper_bar: { base_time: 900 }
                },
                smelteryGemshop: {
                    initMultiplier: 1,
                    tierStep: 0.5
                },
                smelteryItemIds: new Set(['copper_bar'])
            }
        },
        smithCalculatorState: {
            rows: [{ id: 1, itemId: 'copper_bar', quantity: 1 }],
            smelteryGemshopLevel: 2
        },
        smithSmelteryCalculator: {
            itemId: 'copper_bar',
            hours: '0',
            minutes: '2',
            seconds: '30'
        },
        resolveSmithSmelteryCalculatorItemId(itemId) {
            return itemId;
        },
        setSmithCalculatorSmelterySpeed(value) {
            persistedSpeed = value;
        },
        closeSmithSmelteryCalculator() {
            closed = true;
        }
    };

    methods.applySmithSmelteryCalculator.call(context);

    assert.equal(
        persistedSpeed,
        '200',
        'smeltery speed calculator should convert measured time into the remaining speed percent using the selected gemshop tier'
    );
    assert.equal(closed, true, 'smeltery speed calculator should close after applying a valid result');
}

{
    const component = createToolsApp()._component;
    const hiddenEntries = component.computed.calcEntries.call({ saveToolsVisible: false });

    assert.deepEqual(
        hiddenEntries.map(entry => [entry.id, entry.key, entry.label]),
        [
            ['engineering-planner', 'e', 'Engineering Planner'],
            ['smith-calculator', 's', 'Smith Recipe Calculator'],
            ['afk-combat', 'a', 'AFK Combat Calculator']
        ],
        'tools calculator nav should hide curio gacha history until save tools are enabled'
    );

    const visibleEntries = component.computed.calcEntries.call({ saveToolsVisible: true });

    assert.deepEqual(
        visibleEntries.map(entry => [entry.id, entry.key, entry.label]),
        [
            ['engineering-planner', 'e', 'Engineering Planner'],
            ['smith-calculator', 's', 'Smith Recipe Calculator'],
            ['afk-combat', 'a', 'AFK Combat Calculator'],
            ['curio-gacha', 'g', 'Curio Gacha History']
        ],
        'tools calculator nav should include curio gacha history when save tools are enabled'
    );
    assert.equal(
        component.computed.showCurioGacha.call({ saveToolsVisible: true, activeCalc: 'curio-gacha', data: { curioGacha: {} } }),
        true,
        'curio gacha panel should be visible for the curio calculator when save tools are enabled'
    );
    assert.equal(
        component.computed.showCurioGacha.call({ saveToolsVisible: false, activeCalc: 'curio-gacha', data: { curioGacha: {} } }),
        false,
        'curio gacha panel should stay hidden for direct curio route when save tools are disabled'
    );
}

{
    const component = createToolsApp()._component;
    const context = {
        saveToolsVisible: false,
        selectedCalc: null,
        engineeringPlannerState: {
            mode: '',
            inputMode: '',
            anchorSlot: null,
            anchorSpeed: 0,
            anchorItemsPerHour: null,
            slotUpgradeLevel: 0,
            throughputSpeeds: {},
            throughputItemsPerHour: {}
        },
        calcEntries: component.computed.calcEntries.call({ saveToolsVisible: false }),
        engineeringPlannerDefaultAnchorSlot() { return 'idea'; },
        engineeringPlannerSlotUpgrade() { return null; },
        engineeringPlannerConfig() { return { slots: [] }; },
        engineeringPlannerSlotByKey() { return null; },
        engineeringPlannerSpeedParamKey() { return ''; },
        engineeringPlannerItemsParamKey() { return ''; },
        syncShellMobileActions() {}
    };

    methods.applyResolvedRouteState.call(context, { calc: 'g' }, '?x=g');

    assert.equal(
        context.selectedCalc,
        'engineering-planner',
        'direct curio gacha route should fall back to the first available calculator when save tools are disabled'
    );
}

{
    const component = createToolsApp()._component;
    const context = {
        data: {
            cards: {
                modes: [{ id: 'normal' }, { id: 'hard' }],
                categories: [
                    {
                        id: 'act1',
                        label: 'Act 1',
                        modes: {
                            hard: {
                                stats: { hp: '3000000', atk: '1400', arm: '0' },
                                footer: [{ item: 'gold', value: '28' }, { item: 'exp', value: '990000' }]
                            }
                        },
                        cards: [
                            {
                                id: 'boar',
                                name: 'Boar',
                                item_id: 'boar_card',
                                spawn: 3,
                                max_spawns: 2,
                                modes: {
                                    normal: {
                                        stats: { hp: '3', atk: '0', arm: '0' },
                                        footer: [{ item: 'gold', value: '1' }, { item: 'exp', value: '10' }]
                                    }
                                }
                            }
                        ]
                    }
                ]
            },
            items: new Map([
                ['boar_card', { id: 'boar_card', name: 'Boar Card', image: '../items/images/cards/act1/boar_card.png' }],
                ['starter_sword', { id: 'starter_sword', name: 'Starter Sword', image: '../items/images/gear/starter_sword.png' }],
                ['thorium_longsword', { id: 'thorium_longsword', name: 'Thorium Longsword', image: '../items/images/gear/act2/thorium_longsword.png' }],
                ['thorium_bow', { id: 'thorium_bow', name: 'Thorium Bow', image: '../items/images/gear/act2/thorium_bow.png' }],
                ['infinite_longsword_2', { id: 'infinite_longsword_2', name: 'Infinite Longsword II', image: '../items/images/gear/hard/infinite_longsword_2.png' }]
            ]),
            gearSources: [
                { id: 'thorium_longsword', bonuses: [{ bonus: 'Alive Time', unit_type: 'percent', value: 20 }] },
                { id: 'infinite_longsword_2', bonuses: [{ bonus: 'drop_quantity', unit_type: 'flat', value: 30 }] }
            ]
        },
        afkCombatState: {
            locationId: '',
            difficulty: 'hard',
            hours: 2,
            player: {
                attack: 3000000,
                attackSpeed: 1,
                maxHp: 10000000,
                defense: 0,
                damageReductionPercent: 0,
                critChancePercent: 0,
                critDamagePercent: 200,
                doubleCritChancePercent: 0,
                moveSpeed: 100,
                mobSpawnPercent: 0,
                goldMultiplierPercent: 0,
                combatExpPercent: 0,
                offlineRatePercent: 0,
                combatOfflineRatePercent: 0,
                critChanceCapPercent: 100,
                weaponId: '',
                attackRange: 0
            }
        },
        afkCombatLocations() {
            return methods.afkCombatLocations.call(this);
        },
        ensureAfkCombatSelection() {
            return methods.ensureAfkCombatSelection.call(this);
        },
        afkCombatSelectedLocation() {
            return methods.afkCombatSelectedLocation.call(this);
        },
        afkCombatSelectedEnemy() {
            return methods.afkCombatSelectedEnemy.call(this);
        },
        afkCombatResult() {
            return methods.afkCombatResult.call(this);
        },
        afkCombatAvailableDifficulties() {
            return methods.afkCombatAvailableDifficulties.call(this);
        },
        afkCombatWeaponOptions() {
            return methods.afkCombatWeaponOptions.call(this);
        },
        isAfkCombatWeaponItem(item) {
            return methods.isAfkCombatWeaponItem.call(this, item);
        },
        afkCombatWeaponAttackRange(weaponId) {
            return methods.afkCombatWeaponAttackRange.call(this, weaponId);
        },
        afkCombatWeaponGearSource(weaponId) {
            return methods.afkCombatWeaponGearSource.call(this, weaponId);
        },
        afkCombatWeaponSurvivalMultiplier(weaponId) {
            return methods.afkCombatWeaponSurvivalMultiplier.call(this, weaponId);
        }
    };

    const enemy = methods.afkCombatSelectedEnemy.call(context);
    assert.equal(enemy.name, 'Boar');
    assert.equal(enemy.hp, 3000000);
    assert.deepEqual(
        methods.afkCombatAvailableDifficulties.call(context).map(entry => entry.id),
        ['normal', 'hard'],
        'AFK combat difficulty selector should only expose modes available for the selected location'
    );
    assert.equal(methods.afkCombatDurationRewards.call(context).hours, 2);
    assert.deepEqual(
        methods.afkCombatWeaponOptions.call(context).map(entry => entry.label),
        ['Starter Sword', 'Thorium Longsword', 'Thorium Bow', 'Infinite Longsword II'],
        'AFK combat weapon selector should expose concrete weapon items'
    );
    assert.equal(
        methods.afkCombatWeaponOptions.call(context).find(entry => entry.id === 'thorium_longsword')?.survivalMultiplier,
        1.2,
        'AFK combat weapon selector should use Alive Time from gear JSON'
    );
    assert.equal(
        methods.afkCombatWeaponOptions.call(context).find(entry => entry.id === 'infinite_longsword_2')?.survivalMultiplier,
        1,
        'AFK combat weapon selector should not infer Alive Time when gear JSON does not contain it'
    );
    assert.equal(
        context.afkCombatState.player.weaponId,
        '',
        'AFK combat should not select a default weapon before the user chooses one'
    );
    assert.equal(
        component.computed.showAfkCombatCalculator.call({ activeCalc: 'afk-combat', data: { cards: {} } }),
        true,
        'AFK combat panel should be visible for the AFK calculator route when data is loaded'
    );
}

{
    const persisted = [];
    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
        setItem(key, value) {
            persisted.push([key, JSON.parse(value)]);
        }
    };
    const context = {
        curioGachaState: {
            playFabId: '',
            page: 4,
            ordinaryPullsFrom: 1,
            ordinaryPulls: 100,
            pityClaimPulls: [],
            pityPopoverOpen: false,
            pityAnchorId: '',
            pityDragReady: false,
            finderRows: [{ id: 1, choices: ['', '', ''] }],
            finderNextRowId: 2,
            finderPopoverOpen: false,
            finderAnchorId: '',
            finderDragReady: false,
            rarities: [],
            definitionId: ''
        },
        persistCurioGachaState() {
            methods.persistCurioGachaState.call(this);
        },
        openCurioGachaPityPopover(anchorId) {
            methods.openCurioGachaPityPopover.call(this, anchorId);
        },
        closeCurioGachaPityPopover() {
            methods.closeCurioGachaPityPopover.call(this);
        },
        ensureCurioGachaPityPopoverDraggable() {},
        positionCurioGachaPityPopover() {},
        openCurioGachaFinderPopover(anchorId) {
            methods.openCurioGachaFinderPopover.call(this, anchorId);
        },
        closeCurioGachaFinderPopover() {
            methods.closeCurioGachaFinderPopover.call(this);
        },
        closeCurioGachaFinderChoicePicker() {
            methods.closeCurioGachaFinderChoicePicker.call(this);
        },
        ensureCurioGachaFinderPopoverDraggable() {},
        positionCurioGachaFinderPopover() {},
        isMobileViewport: true
    };

    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = callback => callback();

    methods.setCurioGachaPlayFabId.call(context, ' 506769617668B19A ');

    assert.equal(context.curioGachaState.playFabId, '506769617668B19A');
    assert.equal(context.curioGachaState.page, 1);
    assert.equal(persisted[0][0], 'evitania_tools_curio_gacha');
    assert.deepEqual(persisted[0][1], { playFabId: '506769617668B19A', page: 1, ordinaryPullsFrom: 1, ordinaryPulls: 100, pityClaimPulls: [], finderRows: [{ id: 1, type: 'pull', choices: ['', '', ''] }], finderNextRowId: 2, rarities: [], definitionId: '' });

    methods.setCurioGachaOrdinaryPullsFrom.call(context, 50);

    assert.equal(context.curioGachaState.ordinaryPullsFrom, 50);
    assert.equal(context.curioGachaState.ordinaryPulls, 100);
    assert.equal(context.curioGachaState.page, 1);
    assert.deepEqual(persisted[1][1], { playFabId: '506769617668B19A', page: 1, ordinaryPullsFrom: 50, ordinaryPulls: 100, pityClaimPulls: [], finderRows: [{ id: 1, type: 'pull', choices: ['', '', ''] }], finderNextRowId: 2, rarities: [], definitionId: '' });

    methods.setCurioGachaOrdinaryPulls.call(context, 250);

    assert.equal(context.curioGachaState.ordinaryPulls, 250);
    assert.equal(context.curioGachaState.page, 1);
    assert.deepEqual(persisted[2][1], { playFabId: '506769617668B19A', page: 1, ordinaryPullsFrom: 50, ordinaryPulls: 250, pityClaimPulls: [100, 200], finderRows: [{ id: 1, type: 'pull', choices: ['', '', ''] }], finderNextRowId: 2, rarities: [], definitionId: '' });

    methods.toggleCurioGachaPityPopover.call(context);

    assert.equal(context.curioGachaState.pityPopoverOpen, true);
    assert.deepEqual(context.curioGachaState.pityClaimPulls, [100, 200]);

    methods.setCurioGachaPityClaimPull.call(context, 0, 150);

    assert.deepEqual(context.curioGachaState.pityClaimPulls, [150, 200]);
    assert.deepEqual(persisted[persisted.length - 1][1], { playFabId: '506769617668B19A', page: 1, ordinaryPullsFrom: 50, ordinaryPulls: 250, pityClaimPulls: [150, 200], finderRows: [{ id: 1, type: 'pull', choices: ['', '', ''] }], finderNextRowId: 2, rarities: [], definitionId: '' });

    methods.setCurioGachaPityClaimPull.call(context, 1, 150);

    assert.deepEqual(context.curioGachaState.pityClaimPulls, [150, 200]);
    assert.deepEqual(persisted[persisted.length - 1][1], { playFabId: '506769617668B19A', page: 1, ordinaryPullsFrom: 50, ordinaryPulls: 250, pityClaimPulls: [150, 200], finderRows: [{ id: 1, type: 'pull', choices: ['', '', ''] }], finderNextRowId: 2, rarities: [], definitionId: '' });

    methods.resetCurioGachaPityClaims.call(context);

    assert.deepEqual(context.curioGachaState.pityClaimPulls, [100, 200]);
    assert.deepEqual(persisted[persisted.length - 1][1], {
        playFabId: '506769617668B19A',
        page: 1,
        ordinaryPullsFrom: 50,
        ordinaryPulls: 250,
        pityClaimPulls: [100, 200],
        finderRows: [{ id: 1, type: 'pull', choices: ['', '', ''] }],
        finderNextRowId: 2,
        rarities: [],
        definitionId: ''
    });

    methods.addCurioGachaFinderRow.call(context);
    methods.setCurioGachaFinderChoice.call(context, 0, 0, 'a');
    methods.setCurioGachaFinderChoice.call(context, 0, 1, 'b');
    methods.setCurioGachaFinderChoice.call(context, 0, 2, 'c');

    assert.deepEqual(context.curioGachaState.finderRows[0].choices, ['a', 'b', 'c']);

    for (let index = 0; index < 20; index += 1) {
        methods.addCurioGachaFinderRow.call(context);
    }

    assert.equal(context.curioGachaState.finderRows.length, 10);

    methods.applyCurioGachaFinderMatch.call(context, { start_pull: 777, end_pull: 779 });

    assert.equal(context.curioGachaState.ordinaryPullsFrom, 777);
    assert.equal(context.curioGachaState.ordinaryPulls, 779);
    assert.equal(context.curioGachaState.finderPopoverOpen, false);

    methods.toggleCurioGachaRarity.call(context, 'legendary');

    assert.deepEqual(context.curioGachaState.rarities, ['legendary']);
    assert.equal(context.curioGachaState.definitionId, '');

    methods.setCurioGachaDefinitionFilter.call(context, 'abc');

    assert.equal(context.curioGachaState.definitionId, 'abc');
    assert.equal(context.curioGachaState.page, 1);

    methods.resetCurioGachaFilters.call(context);

    assert.deepEqual(context.curioGachaState.rarities, []);
    assert.equal(context.curioGachaState.definitionId, '');

    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.localStorage = originalLocalStorage;
}

{
    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
        getItem(key) {
            assert.equal(key, 'evitania_tools_curio_gacha');
            return JSON.stringify({
                playFabId: '506769617668B19A',
                page: 3,
                ordinaryPullsFrom: 50,
                ordinaryPulls: 250,
                pityClaimPulls: [150, 200],
                rarities: ['legendary'],
                definitionId: 'curio-id'
            });
        }
    };
    const context = {
        curioGachaState: {
            playFabId: '',
            page: 1,
            ordinaryPullsFrom: 1,
            ordinaryPulls: 100,
            pityClaimPulls: [],
            pityPopoverOpen: true,
            rarities: [],
            definitionId: ''
        }
    };

    methods.restoreCurioGachaState.call(context);

    assert.deepEqual(context.curioGachaState, {
        playFabId: '506769617668B19A',
        page: 3,
        ordinaryPullsFrom: 50,
        ordinaryPulls: 250,
        pityClaimPulls: [150, 200],
        pityPopoverOpen: false,
        finderRows: [{ id: 1, type: 'pull', choices: ['', '', ''] }],
        finderNextRowId: 2,
        finderPopoverOpen: false,
        rarities: ['legendary'],
        definitionId: 'curio-id'
    });

    globalThis.localStorage = originalLocalStorage;
}

console.log('tools/module.test.mjs passed');
