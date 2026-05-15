import { nextTick } from 'vue';
import { DEFAULT_ITEM_CATEGORY_ID, DEFAULT_ITEM_CATEGORY_KEY } from '../utils.js?v=7e5a144c2d';
import {
    BONUS_TYPE_ALL_SUBFILTER,
    buildBonusTypeSubfilterEntries,
    filterBonusTypeEntries,
    resolveActiveBonusTypeSubfilter,
    shouldShowBonusTypeSubfilters
} from './bonusTypeSubfilters.js?v=2e8f40dcee';

export const actionsMethods = {
    setMobileTab(val) {
        this.mobileTab = val;
        this.syncUrl();
        let idx;
        switch (val) {
            case 'sources': idx = 0; break;
            case 'avail': idx = 1; break;
            case 'all': idx = 2; break;
        }
        if (this._scrollTo) this._scrollTo(idx);
    },

    _bindMobileScroll() {
        const scroller = this.$refs.mobileScroll;
        if (!scroller) {
            this._scrollTo = null;
            return;
        }
        if (this._mobileScrollEl === scroller) return;
        if (this._mobileScrollEl && this._mobileScrollEndHandler) {
            this._mobileScrollEl.removeEventListener('scrollend', this._mobileScrollEndHandler);
        }
        this._mobileScrollEl = scroller;
        this._scrollTo = idx => {
            scroller.scrollTo({ left: idx * window.innerWidth, behavior: 'smooth' });
        };
        this._mobileScrollEndHandler = () => {
            const idx = Math.round(scroller.scrollLeft / window.innerWidth);
            this.mobileTab = ['sources', 'avail', 'all'][idx] ?? 'sources';
        };
        scroller.addEventListener('scrollend', this._mobileScrollEndHandler);
    },

    selectBonus(id) {
        const shouldPush = this.viewMode !== 'bonus' || this.selectedBonus !== id;
        this.viewMode = 'bonus';
        this.selectedBonus = id;
        this.itemTypeDropdownOpen = false;
        this.openDetails = new Set();
        this.syncUrl({ push: shouldPush });
    },

    setViewMode(mode) {
        const shouldPush = this.viewMode !== mode;
        this.viewMode = mode;
        this.dropdownOpen = false;
        this.itemTypeDropdownOpen = false;
        if (mode === 'item' && !this.itemType) {
            this.itemType = this.itemTypeEntries[0]?.type ?? null;
        }
        if (mode === 'calc' && !this.selectedCalc) {
            this.selectedCalc = this.calcEntries[0]?.id ?? null;
        }
        if (mode === 'bonus') {
            nextTick(() => {
                this._bindMobileScroll();
                this._scrollTo?.(['sources', 'avail', 'all'].indexOf(this.mobileTab));
            });
        } else {
            this._scrollTo = null;
        }
        this.syncUrl({ push: shouldPush });
    },

    selectCalc(id) {
        const shouldPush = this.viewMode !== 'calc' || this.selectedCalc !== id;
        this.viewMode = 'calc';
        this.selectedCalc = id;
        this.dropdownOpen = false;
        this.itemTypeDropdownOpen = false;
        this._scrollTo = null;
        this.syncUrl({ push: shouldPush });
    },

    selectItemType(type) {
        const shouldPush = this.viewMode !== 'item' || this.itemType !== type;
        this.itemType = type;
        this.itemTypeDropdownOpen = false;
        this.hiddenItemSections = new Set();
        this.itemSectionAllMode = true;
        this.syncUrl({ push: shouldPush });
    },

    normalizeHiddenItemSections(hiddenIds) {
        const validIds = new Set(this.itemSubfilterEntries.map(entry => entry.id));
        const normalized = new Set(
            [...hiddenIds].filter(id => validIds.has(id))
        );
        if (validIds.size && normalized.size >= validIds.size) {
            return new Set();
        }
        return normalized;
    },

    toggleItemSection(id) {
        if (this.itemSectionAllMode) {
            this.hiddenItemSections = this.normalizeHiddenItemSections(new Set(
                this.itemSubfilterEntries
                    .map(entry => entry.id)
                    .filter(entryId => entryId !== id)
            ));
            this.itemSectionAllMode = false;
            this.syncUrl();
            return;
        }
        this.hiddenItemSections = this.normalizeHiddenItemSections(new Set(
            this.itemSubfilterEntries
                .map(entry => entry.id)
                .filter(entryId => entryId !== id)
        ));
        this.itemSectionAllMode = false;
        this.syncUrl();
    },

    showAllItemSections() {
        this.hiddenItemSections = new Set();
        this.itemSectionAllMode = true;
        this.syncUrl();
    },

    isItemSectionVisible(id) {
        return this.itemSectionAllMode || !this.hiddenItemSections.has(id);
    },

    isItemSectionSelected(id) {
        return !this.itemSectionAllMode && !this.hiddenItemSections.has(id);
    },

    toggleSection(type) {
        const s = new Set(this.collapsedSections);
        s.has(type) ? s.delete(type) : s.add(type);
        this.collapsedSections = s;
        this.syncUrl();
    },

    itemSectionKey(section) {
        return `item:${this.activeItemType}:${section.id}`;
    },

    toggleDetail(srcId) {
        const s = new Set(this.openDetails);
        s.has(srcId) ? s.delete(srcId) : s.add(srcId);
        this.openDetails = s;
    },

    toggleCondition(condId) {
        const s = new Set(this.activeConditions);
        s.has(condId) ? s.delete(condId) : s.add(condId);
        this.activeConditions = s;
    },

    bonusTypeSubfilterEntries(type) {
        return buildBonusTypeSubfilterEntries({
            entries: this.groupedSources[type] ?? [],
            dataCategories: this.data?.categories ?? [],
            defaultCategoryId: DEFAULT_ITEM_CATEGORY_ID,
            type,
            categoryLabel: id => this.categoryLabel(id),
            categoryColor: id => this.categoryColor(id),
            itemTypeLabel: id => this.itemTypeLabel(id),
            typeColor: id => this.typeColor(id),
            slotLabel: id => this.slotLabel(id),
            slotColor: id => this.slotColor(id)
        });
    },

    activeBonusTypeSubfilter(type) {
        return resolveActiveBonusTypeSubfilter(
            this.bonusTypeSubfilters?.[type],
            this.bonusTypeSubfilterEntries(type)
        );
    },

    isBonusTypeSubfilterSelected(type, id = BONUS_TYPE_ALL_SUBFILTER) {
        return this.activeBonusTypeSubfilter(type) === id;
    },

    shouldShowBonusTypeSubfilters(type) {
        return shouldShowBonusTypeSubfilters(
            this.collapsedSections.has(type),
            this.bonusTypeSubfilterEntries(type)
        );
    },

    setBonusTypeSubfilter(type, id = BONUS_TYPE_ALL_SUBFILTER) {
        const nextId = id ?? BONUS_TYPE_ALL_SUBFILTER;
        this.bonusTypeSubfilters = {
            ...(this.bonusTypeSubfilters ?? {}),
            [type]: nextId
        };
    },

    columnEntries(type) {
        return filterBonusTypeEntries(
            this.groupedSources[type] ?? [],
            this.activeBonusTypeSubfilter(type),
            DEFAULT_ITEM_CATEGORY_ID
        );
    },

    itemSectionStyle(section) {
        return { '--section-color': section.color };
    },

    _buildBonusViewParams() {
        const params = new URLSearchParams();
        if (this.selectedBonus) {
            const bt = this.data.bonus_types.find(b => b.id === this.selectedBonus);
            if (bt?.key) params.set('b', bt.key);
        }
        if (this.selectedClass) {
            const cls = this.data.classes.find(c => c.id === this.selectedClass);
            if (cls?.key) params.set('c', cls.key);
        }
        this.parameters.forEach(p => {
            const def = p.default ?? p.min ?? 0;
            p.value !== def
                ? params.set(p.key, p.value)
                : params.delete(p.key);
        });
        if (this.activeConditions.size) {
            params.set('cd', [...this.activeConditions].map(id =>
                this.data.conditions?.find(c => c.id === id)?.key ?? id
            ).join('-'));
        }
        const visCollapsed = [...this.collapsedSections].filter(t => !!this.groupedSources[t]);
        if (visCollapsed.length) {
            params.set('s', visCollapsed.map(t => this.data.types[t]?.key ?? t).join('-'));
        }
        if (this.mobileTab !== 'sources') {
            params.set('t', this.mobileTab === 'avail' ? 'a' : 'l');
        }
        return params;
    },

    _buildItemViewParams() {
        const params = new URLSearchParams();
        params.set('v', 'i');
        if (this.itemSearch) params.set('iq', this.itemSearch);
        if (this.itemType) params.set('iy', this.data.types[this.itemType]?.key);
        const visibleItemSections = this.itemSubfilterEntries
            .map(entry => entry.id)
            .filter(id => !this.hiddenItemSections.has(id));
        if (!this.itemSectionAllMode && visibleItemSections.length) {
            const selectedItemSectionKey = (() => {
                const id = visibleItemSections[0];
                if (this.itemSubfilterMode !== 'category') return id;
                if (id === DEFAULT_ITEM_CATEGORY_ID) return DEFAULT_ITEM_CATEGORY_KEY;
                return this.data.categories?.find(category => category.id === id)?.key;
            })();
            if (selectedItemSectionKey) params.set('is', selectedItemSectionKey);
        }
        return params;
    },

    _buildCalcViewParams() {
        const params = new URLSearchParams();
        params.set('v', 'c');
        if (this.activeCalc) {
            const calcEntry = this.calcEntries.find(entry => entry.id === this.activeCalc);
            params.set('x', calcEntry?.key ?? this.activeCalc);
        }
        if (this.activeCalc === 'engineering-planner') {
            if (this.engineeringPlannerCollapsed) {
                params.set('ec', '1');
            }
            if (this.engineeringPlannerInputMode() === 'percent') {
                params.set('ei', 'p');
            }
            const plannerAnchor = this.engineeringPlannerSlotById(this.engineeringPlannerState.anchorSlot);
            if (plannerAnchor?.key && this.engineeringPlannerState.anchorSlot !== this.engineeringPlannerDefaultAnchorSlot()) {
                params.set('ea', plannerAnchor.key);
            }
            if (this.engineeringPlannerState.anchorSpeed) {
                params.set('ev', this.normalizeValue(this.engineeringPlannerState.anchorSpeed, 3));
            }
            if (this.engineeringPlannerState.anchorItemsPerHour) {
                params.set('evi', this.normalizeValue(this.engineeringPlannerState.anchorItemsPerHour, 3));
            }
            const plannerSlotUpgrade = this.engineeringPlannerSlotUpgrade();
            if (this.engineeringPlannerState.slotUpgradeLevel !== (plannerSlotUpgrade?.defaultLevel ?? 0)) {
                params.set('eu', this.engineeringPlannerState.slotUpgradeLevel);
            }
        }
        return params;
    },

    _buildCurrentViewUrl() {
        const params = this.viewMode === 'item'
            ? this._buildItemViewParams()
            : this.viewMode === 'calc'
                ? this._buildCalcViewParams()
                : this._buildBonusViewParams();
        const query = params.toString();
        return `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    },

    syncUrl({ push = false } = {}) {
        if (!this.data) return;
        const url = this._buildCurrentViewUrl();
        if (push) {
            history.pushState(null, '', url);
            return;
        }
        history.replaceState(null, '', url);
    },
};
