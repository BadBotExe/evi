import assert from 'node:assert/strict';
import { SAVE_STORAGE_KEY, saveActionMethods } from './saveActions.js';

function createLocalStorage() {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        }
    };
}

const originalLocalStorage = globalThis.localStorage;
const originalWindow = globalThis.window;

globalThis.localStorage = createLocalStorage();
globalThis.window = {
    location: {
        search: '?v=i'
    }
};

try {
    {
        const context = {
            saveError: '',
            _persistLoadedSave: saveActionMethods._persistLoadedSave
        };
        context._persistLoadedSave.call(context, 'encoded-save', 3);

        assert.deepEqual(
            JSON.parse(globalThis.localStorage.getItem(SAVE_STORAGE_KEY)),
            { saveText: 'encoded-save', heroIndex: 3 },
            'persisted save stores both save text and selected hero index'
        );
    }

    {
        globalThis.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
            saveText: 'encoded-save',
            heroIndex: 1
        }));

        const context = {
            selectedSaveHeroIndex: 7,
            _persistLoadedSaveSelection: saveActionMethods._persistLoadedSaveSelection
        };
        context._persistLoadedSaveSelection.call(context);

        assert.deepEqual(
            JSON.parse(globalThis.localStorage.getItem(SAVE_STORAGE_KEY)),
            { saveText: 'encoded-save', heroIndex: 7 },
            'persisted save selection rewrites only the hero index'
        );
    }

    {
        const applied = [];
        const context = {
            saveError: '',
            _parseSaveText: async (saveText) => ({
                raw: saveText,
                heroes: [
                    { index: 4 },
                    { index: 8 }
                ]
            }),
            _applyLoadedSave(parsedContext, heroIndex) {
                applied.push({ parsedContext, heroIndex });
            },
            _restorePersistedSave: saveActionMethods._restorePersistedSave
        };

        globalThis.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
            saveText: 'stored-save',
            heroIndex: 8
        }));

        await context._restorePersistedSave.call(context);

        assert.equal(applied.length, 1);
        assert.equal(applied[0].heroIndex, 8, 'stored hero index is restored when still present');
    }

    {
        const applied = [];
        const context = {
            saveError: '',
            _parseSaveText: async () => ({
                heroes: [
                    { index: 4 },
                    { index: 8 }
                ]
            }),
            _applyLoadedSave(parsedContext, heroIndex) {
                applied.push({ parsedContext, heroIndex });
            },
            _restorePersistedSave: saveActionMethods._restorePersistedSave
        };

        globalThis.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
            saveText: 'stored-save',
            heroIndex: 99
        }));

        await context._restorePersistedSave.call(context);

        assert.equal(applied.length, 1);
        assert.equal(applied[0].heroIndex, 4, 'restore falls back to the first hero when stored one is missing');
    }

    {
        let syncCount = 0;
        const appliedStates = [];
        const saveIntegrationCalls = [];
        const context = {
            saveContext: { raw: { ok: true } },
            saveError: 'old',
            selectedSaveHeroIndex: 5,
            _saveIntegration: {
                applySaveContext(saveContext, heroIndex) {
                    saveIntegrationCalls.push({ saveContext, heroIndex });
                }
            },
            _applyUrlState(search) {
                appliedStates.push(search);
            },
            syncUrl() {
                syncCount += 1;
            },
            clearSaveContext: saveActionMethods.clearSaveContext
        };

        globalThis.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
            saveText: 'stored-save',
            heroIndex: 5
        }));

        context.clearSaveContext.call(context);

        assert.equal(context.saveContext, null);
        assert.equal(context.selectedSaveHeroIndex, null);
        assert.equal(context.saveError, '');
        assert.deepEqual(saveIntegrationCalls, [{ saveContext: null, heroIndex: null }]);
        assert.deepEqual(appliedStates, ['?v=i']);
        assert.equal(syncCount, 1);
        assert.equal(globalThis.localStorage.getItem(SAVE_STORAGE_KEY), null, 'stored save is removed on clear');
    }
} finally {
    globalThis.localStorage = originalLocalStorage;
    globalThis.window = originalWindow;
}

console.log('bonuses/app/saveActions.test.mjs passed');
