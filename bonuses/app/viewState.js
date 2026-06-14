import {
    DEFAULT_ITEM_CATEGORY_ID,
} from '../lib/utils.js?v=a60e1a39f6';

export const viewStateComputed = {
    appRef() {
        return this;
    },

    reportUrl() {
        const titlePrefix = this.sectionKind === 'tools' ? '[Tools] Issue' : '[Bonuses] Issue';
        return `https://github.com/badbotexe/evi/issues/new?title=${encodeURIComponent(titlePrefix)}&body=${encodeURIComponent('**Bonus:** ' + (this.selectedBonus ?? 'N/A') + '\n\n**Description:**\n')}`;
    },

    visibleSourceTypes() {
        if (!this.data?.sources?.length) return [];
        return Object.entries(this.data.types).filter(([type]) =>
            this.data.sources.some(src => src.type === type)
        );
    },

    filteredBonusTypes() {
        if (!this.data) return [];
        const q = this.bonusSearch.toLowerCase();
        return [...this.data.bonus_types]
            .sort((a, b) => a.label.localeCompare(b.label))
            .filter(bt => !q || bt.label.toLowerCase().includes(q));
    },

    groupedSources() {
        if (!this.data || !this.selectedBonus) return {};
        const ids = this._resolveBonusIds(this.selectedBonus);
        const groups = {};
        for (const src of this.data.sources) {
            const matching = this._bonusEntriesForBonusView(src, ids);
            if (!matching.length) continue;
            if (!groups[src.type]) groups[src.type] = [];
            groups[src.type].push({ src, bonuses: matching });
        }
        return groups;
    },

    filteredGroupedSources() {
        const q = this.bonusSourceSearch.trim().toLowerCase();
        if (!q) return this.groupedSources;
        const groups = {};
        for (const [type, entries] of Object.entries(this.groupedSources)) {
            const filteredEntries = entries.filter(({ src }) => this.sourceSearchText(src).includes(q));
            if (filteredEntries.length) groups[type] = filteredEntries;
        }
        return groups;
    },

    visibleTypes() {
        if (!this.data) return [];
        return Object.entries(this.data.types).filter(([type]) => this.filteredGroupedSources[type]?.length);
    },

    itemTypeEntries() {
        if (!this.data?.sources?.length) return [];
        return this.visibleSourceTypes.map(([type, def]) => ({
            type,
            def,
            count: this.data.sources.filter(src => src.type === type).length
        }));
    },

    calcEntries() {
        return [];
    },

    activeCalc() {
        return this.selectedCalc ?? this.calcEntries[0]?.id ?? null;
    },

    mobileSearchFilterCount() {
        if (this.viewMode === 'item') {
            let count = 0;
            if (this.itemSearch.trim()) count += 1;
            if (!this.itemSectionAllMode) count += 1;
            return count;
        }
        if (this.viewMode === 'bonus') {
            return this.bonusSourceSearch.trim() ? 1 : 0;
        }
        return 0;
    },

    hasActiveMobileSearchFilters() {
        return this.mobileSearchFilterCount > 0;
    },

    mobileSearchFilterIndicator() {
        return this.mobileSearchFilterCount > 0 ? String(this.mobileSearchFilterCount) : '';
    },

    activeItemType() {
        return this.itemType ?? this.itemTypeEntries[0]?.type ?? null;
    },

    itemSubfilterMode() {
        const sources = this.data?.sources?.filter(src => src.type === this.activeItemType) ?? [];
        if (!sources.length) return null;
        if (sources.some(src => src.category)) return 'category';
        const slots = [...new Set(sources.map(src => src.slot).filter(Boolean))];
        return slots.length > 1 ? 'slot' : null;
    },

    itemSubfilterEntries() {
        const sources = this.filteredItemSources;
        if (!sources.length) return [];
        if (this.itemSubfilterMode === 'category') {
            const entries = (this.data.categories ?? [])
                .map(category => ({
                    id: category.id,
                    label: category.label,
                    color: category.color,
                    count: sources.filter(src => src.category === category.id).length
                }))
                .filter(entry => entry.count);
            const defaultCount = sources.filter(src => !src.category).length;
            if (defaultCount) {
                entries.push({
                    id: DEFAULT_ITEM_CATEGORY_ID,
                    label: this.itemTypeLabel(this.activeItemType),
                    color: this.typeColor(this.activeItemType),
                    count: defaultCount
                });
            }
            return entries;
        }
        if (this.itemSubfilterMode === 'slot') {
            return [...new Set(sources.map(src => src.slot).filter(Boolean))]
                .map(slot => ({
                    id: slot,
                    label: this.slotLabel(slot),
                    color: this.slotColor(slot),
                    count: sources.filter(src => src.slot === slot).length
                }))
                .filter(entry => entry.count);
        }
        return [];
    },

    filteredItemSources() {
        if (!this.data?.sources?.length || !this.activeItemType) return [];
        const q = this.itemSearch.trim().toLowerCase();
        return this.data.sources
            .filter(src => src.type === this.activeItemType)
            .filter(src => !q || this.sourceSearchText(src).includes(q));
    },

    itemSections() {
        if (!this.filteredItemSources.length) return [];
        if (this.itemSubfilterMode === 'category') {
            return this.itemSubfilterEntries
                .map(filter => ({
                    id: filter.id,
                    label: filter.label,
                    color: filter.color,
                    items: this.filteredItemSources.filter(src =>
                        filter.id === DEFAULT_ITEM_CATEGORY_ID ? !src.category : src.category === filter.id
                    )
                }))
                .filter(section => section.items.length);
        }
        if (this.itemSubfilterMode === 'slot') {
            return this.itemSubfilterEntries
                .map(filter => ({
                    id: filter.id,
                    label: filter.label,
                    color: filter.color,
                    items: this.filteredItemSources.filter(src => src.slot === filter.id)
                }))
                .filter(section => section.items.length);
        }
        const typeDef = this.data?.types?.[this.activeItemType];
        return [{
            id: this.activeItemType,
            label: typeDef?.label ?? this.activeItemType,
            color: typeDef?.tag_style?.color ?? '#888',
            items: this.filteredItemSources
        }];
    },

    visibleItemSections() {
        if (this.itemSectionAllMode) return this.itemSections;
        return this.itemSections.filter(section => !this.hiddenItemSections.has(section.id));
    },

    itemSectionPanels() {
        if (!this.activeItemType) return [];
        const panelsByType = {
            pet: [this.petReferencePanel()]
        };
        return panelsByType[this.activeItemType]?.filter(Boolean) ?? [];
    },

    allItemSectionsVisible() {
        return this.itemSectionAllMode;
    },

    maxItemsAvail() {
        if (!this.data || !this.selectedBonus) return [];
        return this._applyMaxPanelEdits(this._calcItems(true, this.data._base_sources, 'base'), 'avail', 'base');
    },

    maxItemsActual() {
        if (!this.data || !this.selectedBonus) return [];
        return this._applyMaxPanelEdits(this._calcItems(true, this.data.sources, 'actual'), 'actual', 'actual');
    },

    maxItems() {
        if (this.maxTab === 'actual' && this.saveContext) return this.maxItemsActual;
        return this.maxItemsAvail;
    },

    maxResult() {
        return this._compoundTotal(this.maxItems);
    },

    relevantConditions() {
        if (!this.data || !this.selectedBonus) return this.data?.conditions ?? [];
        const ids = this._resolveBonusIds(this.selectedBonus);
        return this.data.conditions.map(cond => {
            const hasRelevant = Object.values(this.groupedSources)
                .flat()
                .some(({ bonuses }) =>
                    bonuses.some(b => ids.includes(b.bonus) && b.condition === cond.id)
                );
            return { ...cond, disabled: !hasRelevant };
        });
    },
};
