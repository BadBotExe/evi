export class BonusDataLoader {
    constructor(app) {
        this.app = app;
    }

    async load() {
        const response = await fetch('bonuses.json?v=4f434a7403');
        this.app.data = await response.json();

        const sourceArrays = await Promise.all(
            this.app.data.source_files.map(async filePath => ({
                filePath,
                data: await fetch(filePath).then(r => r.json())
            }))
        );
        const resolvedSourceArrays = sourceArrays.map(({ data }) => this.app._resolveSourceRefs(data));
        const itemArrays = await Promise.all(
            (this.app.data.item_files ?? []).map(async filePath => ({
                filePath,
                data: await fetch(filePath).then(r => r.json())
            }))
        );

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
        this.app.data.engineeringPlanner = resolvedSourceArrays.find(file =>
            !Array.isArray(file) && file.type === 'engineering_production'
        )?.planner ?? null;
        this.app.data.items = itemArrays
            .flatMap(({ filePath, data }) => this.app._resolveItemFileRefs(data, filePath))
            .reduce((acc, item) => {
                if (!item?.id) return acc;
                acc.set(item.id, item);
                return acc;
            }, new Map());

        this.app.parameters = (this.app.data.parameters ?? []).map(parameter => this.buildParameter(parameter));
        this.initializeEngineeringPlannerState();
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

    initializeEngineeringPlannerState() {
        const planner = this.app.data.engineeringPlanner;
        const slots = planner?.slots ?? [];

        this.app.engineeringPlannerState.anchorSlot =
            planner?.default_anchor_slot
            ?? slots[0]?.id
            ?? null;
        this.app.engineeringPlannerState.inputMode = 'items';
        this.app.engineeringPlannerState.anchorItemsPerHour = null;
        this.app.engineeringPlannerState.slotUpgradeLevel = this.app.engineeringPlannerSlotUpgrade()?.defaultLevel ?? 0;
        this.app.engineeringPlannerState.throughputSpeeds = slots.reduce((acc, slot) => {
            acc[slot.id] = 0;
            return acc;
        }, {});
        this.app.engineeringPlannerState.throughputItemsPerHour = slots.reduce((acc, slot) => {
            acc[slot.id] = null;
            return acc;
        }, {});
    }
}
