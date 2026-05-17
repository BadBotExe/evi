export const SAVE_STORAGE_KEY = 'evitania_bonuses_loaded_save';

export const saveActionMethods = {
    async onSaveFileChange(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        try {
            const saveText = await file.text();
            const context = await this._parseSaveText(saveText);
            const heroIndex = context.heroes[0]?.index ?? null;
            this._applyLoadedSave(context, heroIndex);
            this._persistLoadedSave(saveText, heroIndex);
        } catch (error) {
            console.error(error);
            this.saveError = error?.message ?? 'Could not decode save';
        } finally {
            if (event?.target) event.target.value = '';
        }
    },

    onSaveHeroChange() {
        this.saveError = '';
        this._saveIntegration.applySaveContext(this.saveContext, this.selectedSaveHeroIndex);
        this._persistLoadedSaveSelection();
        this.syncUrl();
    },

    clearSaveContext() {
        this.saveContext = null;
        this.saveError = '';
        this.selectedSaveHeroIndex = null;
        this._saveIntegration.applySaveContext(null, null);
        localStorage.removeItem(SAVE_STORAGE_KEY);
        this._applyUrlState(window.location.search);
        this.syncUrl();
    },

    async copyRawSaveToClipboard() {
        if (!this.saveContext?.raw) return;
        const text = JSON.stringify(this.saveContext.raw, null, 2);
        this.saveError = '';
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return;
            }
        } catch (error) {
            console.error(error);
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copied) {
            this.saveError = 'Could not copy raw save JSON';
        }
    },

    async _parseSaveText(saveText) {
        const { parseSaveText } = await import('./saveCodec.js?v=8bf871a44a');
        return parseSaveText(saveText);
    },

    _serializeSaveValue(value) {
        if (value instanceof Map) {
            return Object.fromEntries(
                [...value.entries()].map(([key, entryValue]) => [key, this._serializeSaveValue(entryValue)])
            );
        }
        if (Array.isArray(value)) {
            return value.map(entry => this._serializeSaveValue(entry));
        }
        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value).map(([key, entryValue]) => [key, this._serializeSaveValue(entryValue)])
            );
        }
        return value;
    },

    _applyLoadedSave(context, heroIndex) {
        this.saveContext = context;
        this.saveError = '';
        this.selectedSaveHeroIndex = heroIndex;
        this._saveIntegration.applySaveContext(context, heroIndex);
        this.syncUrl();
    },

    _persistLoadedSave(saveText, heroIndex) {
        try {
            localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
                saveText,
                heroIndex
            }));
        } catch (error) {
            console.error(error);
            this.saveError = 'Loaded save could not be stored locally';
        }
    },

    _persistLoadedSaveSelection() {
        try {
            const raw = localStorage.getItem(SAVE_STORAGE_KEY);
            if (!raw) return;
            const stored = JSON.parse(raw);
            if (!stored?.saveText) return;
            localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
                saveText: stored.saveText,
                heroIndex: this.selectedSaveHeroIndex
            }));
        } catch (error) {
            console.error(error);
        }
    },

    async _restorePersistedSave() {
        try {
            const raw = localStorage.getItem(SAVE_STORAGE_KEY);
            if (!raw) return;
            const stored = JSON.parse(raw);
            if (!stored?.saveText) return;
            const context = await this._parseSaveText(stored.saveText);
            const heroIndex = context.heroes.some(hero => hero.index === stored.heroIndex)
                ? stored.heroIndex
                : (context.heroes[0]?.index ?? null);
            this._applyLoadedSave(context, heroIndex);
        } catch (error) {
            console.error(error);
            this.saveError = 'Stored save could not be restored';
            localStorage.removeItem(SAVE_STORAGE_KEY);
        }
    },
};
