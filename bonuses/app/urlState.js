import { nextTick } from 'vue';
import { DEFAULT_ITEM_CATEGORY_ID, DEFAULT_ITEM_CATEGORY_KEY } from '../lib/utils.js?v=a60e1a39f6';

export function resolveSelectedClassId(classes, requestedClass = null) {
    const classEntries = Array.isArray(classes) ? classes : [];
    if (!classEntries.length) return null;
    if (!requestedClass) return classEntries[0].id;

    const matchedClass = classEntries.find(entry =>
        entry.id === requestedClass || entry.key === requestedClass
    );
    return matchedClass?.id ?? classEntries[0].id;
}

export function createRouteSyncBuffer(applyRouteState) {
    if (typeof applyRouteState !== 'function') {
        throw new TypeError('createRouteSyncBuffer requires an applyRouteState function');
    }

    let ready = false;
    let pendingSearch = null;

    return {
        sync(search) {
            if (!ready) {
                pendingSearch = search;
                return;
            }
            applyRouteState(search);
        },
        markReady(fallbackSearch) {
            if (ready) return;
            ready = true;
            applyRouteState(pendingSearch ?? fallbackSearch);
            pendingSearch = null;
        }
    };
}

export class BonusUrlState {
    constructor(app) {
        this.app = app;
    }

    apply(search = window.location.search) {
        if (!this.app.data) return;
        const params = new URLSearchParams(search);

        const bonusKey = params.get('b');
        const bonusId = bonusKey
            ? this.app.data.bonus_types.find(b => b.key === bonusKey)?.id ?? bonusKey
            : null;
        const viewParam = params.get('v');

        this.app.viewMode = this.app.sectionKind === 'tools'
            ? 'calc'
            : viewParam === 'i'
                ? 'item'
                : 'bonus';
        const requestedCalc = params.get('x');
        this.app.selectedCalc = this.app.calcEntries.some(entry => entry.id === requestedCalc || entry.key === requestedCalc)
            ? (this.app.calcEntries.find(entry => entry.id === requestedCalc || entry.key === requestedCalc)?.id ?? null)
            : (this.app.calcEntries[0]?.id ?? null);
        this.app.selectedBonus = bonusId;
        this.app.itemSearch = params.get('iq') ?? '';

        const classKey = params.get('c');
        this.app.selectedClass = resolveSelectedClassId(this.app.data.classes, classKey);

        this.applyConditions(params);
        this.applyCollapsedSections(params);
        this.applyParameters(params);
        this.applyEngineeringPlannerState(params);
        this.applyItemViewState(params);
        this.applyResourceBreakdownModifierState(params);
        this.applyMobileTab(params);
    }

    applyConditions(params) {
        this.app.activeConditions = new Set();
        const condParam = params.get('cd');
        if (!condParam) return;

        condParam.split('-').forEach(key => {
            const condition = this.app.data.conditions?.find(c => c.key === key);
            if (condition) this.app.activeConditions.add(condition.id);
        });
    }

    applyCollapsedSections(params) {
        this.app.collapsedSections = new Set();
        const collapsedParam = params.get('s');
        if (!collapsedParam) return;

        collapsedParam.split('-').forEach(key => {
            const type = Object.entries(this.app.data.types).find(([, value]) => value.key === key)?.[0];
            if (type) this.app.collapsedSections.add(type);
        });
    }

    applyParameters(params) {
        this.app.parameters.forEach(parameter => {
            const min = parameter.min ?? 0;
            const max = parameter.max ?? Infinity;
            const defaultValue = parameter.default ?? min;
            const parsed = Number(params.get(parameter.key) ?? defaultValue);
            parameter.value = Math.min(max, Math.max(min, parsed));
        });
    }

    applyEngineeringPlannerState(params) {
        const planner = this.app.data.engineeringPlanner;
        const slots = planner?.slots ?? [];

        this.app.engineeringPlannerCollapsed = params.get('ec') === '1';
        this.app.engineeringPlannerState.inputMode = params.get('ei') === 'p' ? 'percent' : 'items';
        this.app.engineeringPlannerState.anchorSlot =
            planner?.default_anchor_slot
            ?? slots[0]?.id
            ?? null;
        this.app.engineeringPlannerState.anchorSpeed = 0;
        this.app.engineeringPlannerState.anchorItemsPerHour = null;
        this.app.engineeringPlannerState.slotUpgradeLevel = this.app.engineeringPlannerSlotUpgrade()?.defaultLevel ?? 0;

        const plannerAnchor = params.get('ea');
        if (plannerAnchor) {
            const slot = this.app.engineeringPlannerSlotByKey(plannerAnchor);
            if (slot) this.app.engineeringPlannerState.anchorSlot = slot.id;
        }

        const plannerSpeed = params.get('ev');
        if (plannerSpeed != null && plannerSpeed !== '') {
            const parsed = Number(plannerSpeed);
            if (Number.isFinite(parsed)) this.app.engineeringPlannerState.anchorSpeed = parsed;
        }

        const plannerItems = params.get('evi');
        if (plannerItems != null && plannerItems !== '') {
            const parsed = Number(plannerItems);
            if (Number.isFinite(parsed)) this.app.engineeringPlannerState.anchorItemsPerHour = parsed;
        }

        const plannerUpgradeLevel = params.get('eu');
        if (plannerUpgradeLevel != null && plannerUpgradeLevel !== '') {
            const parsed = Number(plannerUpgradeLevel);
            const maxLevel = this.app.engineeringPlannerSlotUpgrade()?.maxLevel ?? 0;
            if (Number.isFinite(parsed)) {
                this.app.engineeringPlannerState.slotUpgradeLevel = Math.max(0, Math.min(parsed, maxLevel));
            }
        }
    }

    applyItemViewState(params) {
        const itemTypeParam = params.get('iy');
        const itemTypeId = itemTypeParam
            ? Object.entries(this.app.data.types).find(([, def]) => def.key === itemTypeParam)?.[0]
            : null;
        this.app.itemType = itemTypeId && this.app.data.types[itemTypeId] ? itemTypeId : (this.app.itemTypeEntries[0]?.type ?? null);

        this.app.hiddenItemSections = new Set();
        this.app.itemSectionAllMode = true;
        const hiddenItemSectionsParam = params.get('ih');
        const itemSubfilterParam = params.get('is');

        if (hiddenItemSectionsParam) {
            const hiddenIds = hiddenItemSectionsParam
                .split('-')
                .filter(Boolean)
                .map(id => this.resolveItemSectionId(id))
                .filter(Boolean);
            this.app.hiddenItemSections = this.app.normalizeHiddenItemSections(new Set(hiddenIds));
            this.app.itemSectionAllMode = this.app.hiddenItemSections.size === 0;
            return;
        }

        if (!itemSubfilterParam) return;

        const visibleIds = itemSubfilterParam
            .split('-')
            .filter(Boolean)
            .map(id => this.resolveItemSectionId(id))
            .filter(Boolean);
        const selectedId = visibleIds.find(id =>
            this.app.itemSubfilterEntries.some(entry => entry.id === id)
        );
        const visible = new Set(selectedId ? [selectedId] : []);
        const hidden = this.app.itemSubfilterEntries
            .map(entry => entry.id)
            .filter(id => !visible.has(id));
        this.app.hiddenItemSections = this.app.normalizeHiddenItemSections(new Set(hidden));
        this.app.itemSectionAllMode = visible.size === 0 || this.app.hiddenItemSections.size === 0;
    }

    applyResourceBreakdownModifierState(params) {
        const definitions = this.app.resourceBreakdownModifierDefinitionsByKey();
        const values = {};
        for (const [key, rawValue] of params.entries()) {
            const definition = definitions.get(key);
            if (!definition) continue;
            const parsed = Number(rawValue);
            if (!Number.isFinite(parsed)) continue;
            const clamped = definition.max == null
                ? Math.max(definition.min, parsed)
                : Math.min(definition.max, Math.max(definition.min, parsed));
            if (clamped !== definition.default) values[definition.id] = clamped;
        }
        this.app.resourceBreakdownModifierValues = values;
    }

    resolveItemSectionId(id) {
        if (this.app.itemSubfilterMode !== 'category') return id;
        if (id === DEFAULT_ITEM_CATEGORY_KEY) return DEFAULT_ITEM_CATEGORY_ID;
        return this.app.data.categories?.find(category => category.key === id)?.id;
    }

    applyMobileTab(params) {
        this.app.mobileTab = 'sources';
        const tabParam = params.get('t');
        if (tabParam) {
            this.app.mobileTab = tabParam === 'a' ? 'avail' : tabParam === 'l' ? 'all' : 'sources';
        }

        this.app._bindMobileScroll();
        if (this.app.viewMode === 'bonus') {
            nextTick(() => this.app._scrollTo?.(['sources', 'avail', 'all'].indexOf(this.app.mobileTab)));
        } else {
            this.app._scrollTo = null;
        }
    }
}
