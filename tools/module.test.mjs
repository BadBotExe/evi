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

console.log('tools/module.test.mjs passed');
