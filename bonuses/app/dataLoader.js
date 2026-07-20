import { CARD_SAVE_KEYS } from './saveMappings.js?v=434569d500';

const BONUSES_BASE_URL = new URL('../', import.meta.url);
const BONUSES_DATA_URL = new URL('../bonuses.json?v=024371d2df', import.meta.url);
const ATLAS_MANIFEST_URL = new URL('../../generated/image-atlas-manifest.json?v=8bd831398f', import.meta.url);

export class BonusDataLoader {
    constructor(app) {
        this.app = app;
    }

    async load() {
        const [response, atlasManifest] = await Promise.all([
            fetch(BONUSES_DATA_URL),
            this.loadAtlasManifest()
        ]);
        this.app.data = await response.json();
        this.app.data.image_atlas_manifest = atlasManifest;

        const itemArrays = await Promise.all(
            (this.app.data.item_files ?? []).map(async filePath => ({
                filePath,
                assetBasePath: filePath,
                data: await fetch(new URL(filePath, BONUSES_BASE_URL)).then(r => r.json())
            }))
        );
        const itemSourceArrays = await Promise.all(
            (this.app.data.item_source_files ?? []).map(async filePath => ({
                filePath,
                data: await fetch(new URL(filePath, BONUSES_BASE_URL)).then(r => r.json())
            }))
        );
        const sourceArrays = await Promise.all(
            this.app.data.source_files.map(async filePath => ({
                filePath,
                assetBasePath: './',
                data: await fetch(new URL(filePath, BONUSES_BASE_URL)).then(r => r.json())
            }))
        );

        this.app.data.item_sources = itemSourceArrays
            .flatMap(({ data }) => this.app._resolveItemSourceFileRefs(data))
            .reduce((acc, source) => {
                if (!source?.id) return acc;
                acc.set(source.id, source);
                return acc;
            }, new Map());
        this.app.data.items = itemArrays
            .flatMap(({ assetBasePath, data }) => this.app._resolveItemFileRefs(data, assetBasePath))
            .map(item => this.app._resolveItemSources(item))
            .reduce((acc, item) => {
                if (!item?.id) return acc;
                acc.set(item.id, item);
                return acc;
            }, new Map());
        const resolvedSourceArrays = sourceArrays.map(({ assetBasePath, data }) => this.app._resolveSourceRefs(data, assetBasePath));

        this.app.data.sources = resolvedSourceArrays.flatMap(file => {
            const sources = Array.isArray(file) ? file : (file.bonuses ?? []);
            return sources.map(src => {
                const resolvedSrc = {
                    ...src,
                    type: src.type ?? file.type,
                    available: src.available ?? true,
                    _file_tiers_formula: file.tiers_formula ?? null,
                    _file_pet_progression: file.pet_progression ?? null,
                    _file_item_popover: file.item_popover ?? null,
                };

                const bonuses = (src.bonuses ?? []).map(bonusEntry => ({
                    ...bonusEntry,
                    value: this.app.resolveSourceBonusValue(resolvedSrc, bonusEntry)
                }));

                const ascensionBonuses = (src.ascension_bonuses ?? []).map(bonusEntry => ({
                    ...bonusEntry,
                    value: this.app.resolveSourceBonusValue(resolvedSrc, bonusEntry),
                    _is_ascension: true
                }));

                return {
                    ...resolvedSrc,
                    bonuses: [...bonuses, ...ascensionBonuses]
                };
            });
        });
        this.app.data._base_sources = this.clonePlainData(this.app.data.sources);
        this.app.data.card_thresholds = this.buildCardThresholds(this.app.data.sources);
        this.app.data.card_save_keys = this.buildCardSaveKeys(CARD_SAVE_KEYS);

        this.app.parameters = (this.app.data.parameters ?? []).map(parameter => this.buildParameter(parameter));
    }

    async loadAtlasManifest() {
        try {
            const response = await fetch(ATLAS_MANIFEST_URL);
            if (!response.ok) return { atlases: {}, entries: {} };
            return await response.json();
        } catch {
            return { atlases: {}, entries: {} };
        }
    }

    clonePlainData(value) {
        return JSON.parse(JSON.stringify(value));
    }

    buildCardThresholds(sources) {
        const map = new Map();
        for (const src of sources ?? []) {
            if (src?.type !== 'card' || !src?.item_id || !Array.isArray(src?.tier)) continue;
            map.set(src.item_id, src.tier.map(Number));
        }
        return map;
    }

    buildCardSaveKeys(entries) {
        const map = new Map();
        for (const [id, saveName] of Object.entries(entries ?? {})) {
            if (!id || !saveName) continue;
            map.set(id, saveName);
        }
        return map;
    }

    buildParameter(parameter) {
        const min = parameter.min ?? 0;
        const max = parameter.max ?? Infinity;
        let value = Math.min(max, Math.max(min, Number(parameter.default ?? min)));

        Object.defineProperty(parameter, 'value', {
            get: () => value,
            set: nextValue => {
                value = Math.min(max, Math.max(min, Number(nextValue ?? min)));
            }
        });

        return parameter;
    }
}
