import { nextTick } from 'vue';
import { makeDraggable, positionPopover } from '../lib/utils.js?v=a53a4fd0dd';

function closeMobilePopovers(state, except = null) {
    if (except !== 'source') {
        state.popoverEntry = null;
        state.popoverOpenDetails = new Set();
    }
    if (except !== 'item') {
        state.itemPopoverEntry = null;
        state.itemSheetOpen = false;
    }
    if (except !== 'tier') {
        state.tierPopoverEntry = null;
        state.tierSheetEntry = null;
    }
    if (except !== 'price-breakdown') {
        state.priceBreakdownEntry = null;
        state.priceBreakdownSheetOpen = false;
    }
    if (except !== 'data-table') {
        state.dataTableEntry = null;
        state.dataTableSheetOpen = false;
    }
    if (except !== 'quantity') {
        state.quantityPopoverEntry = null;
        state.quantitySheetOpen = false;
    }
}

export const popoverMethods = {
    openTierPopoverForBonus(src, bonus, event, options = {}) {
        const entry = {
            src,
            bonuses: bonus._groupBonuses ?? [bonus],
            maxItemContext: options.maxItemContext ?? null,
            _maxBonusRefs: options.maxBonusRefs ?? null
        };
        this.openTierPopover(entry, event, true);
    },

    openPopover(item, event) {
        const entry = this.groupedSources[item.src.type]?.find(e => e.src.id === item.src.id);
        if (!entry) return;
        this.closeItemPopover();
        this.closeTierPopover();
        this.closeDataTablePopover();
        this.popoverOpenDetails = new Set();
        this.popoverEntry = { entry, type: item.src.type };
        nextTick(() => this._setupPopover('popover', '.popover-header', event.clientX, event.clientY));
    },

    closePopover() {
        this.popoverEntry = null;
    },

    closeMobilePopovers(except = null) {
        closeMobilePopovers(this, except);
    },

    openItemPopover(src, event, fromPopover = false, options = {}) {
        if (this.resolveItemPopover(src) === false) return;
        if (!fromPopover) this.closePopover();
        this.closeTierPopover();
        this.closePriceBreakdownPopover();
        this.closeDataTablePopover();
        this.closeQuantityPopover();
        event.stopPropagation();
        const isMobile = window.innerWidth <= 900;
        if (isMobile) {
            this.closeMobilePopovers('item');
            this.itemPopoverEntry = { src, maxItemContext: options.maxItemContext ?? null };
            this.itemSheetOpen = true;
            return;
        }
        this.itemPopoverEntry = { src, maxItemContext: options.maxItemContext ?? null };
        this.$nextTick(() => this._setupPopover('item-popover', '.item-popover-header', event.clientX, event.clientY));
    },

    closeItemPopover() {
        this.itemPopoverEntry = null;
        this.itemSheetOpen = false;
    },

    openPriceBreakdownPopover(src, event, kind = 'enhancement') {
        if (!this.hasPriceBreakdown(src, kind)) return;
        event.stopPropagation();
        this.closePopover();
        this.closeTierPopover();
        this.closeItemPopover();
        this.closeDataTablePopover();
        this.closeQuantityPopover();
        const isMobile = window.innerWidth <= 900;
        if (isMobile) {
            this.closeMobilePopovers('price-breakdown');
            this.priceBreakdownEntry = { src, kind };
            this.priceBreakdownSheetOpen = true;
            return;
        }
        this.priceBreakdownSheetOpen = false;
        this.priceBreakdownEntry = { src, kind };
        this.$nextTick(() => this._setupPopover('price-breakdown-popover', '.price-breakdown-popover-header', event.clientX, event.clientY));
    },

    closePriceBreakdownPopover() {
        this.priceBreakdownEntry = null;
        this.priceBreakdownSheetOpen = false;
    },

    openDataTablePopover(panel, action, event) {
        if (!panel || !action) return;
        event.stopPropagation();
        this.closePopover();
        this.closeTierPopover();
        this.closeItemPopover();
        this.closePriceBreakdownPopover();
        this.closeQuantityPopover();
        const entry = { panel, action };
        const isMobile = window.innerWidth <= 900;
        if (isMobile) {
            this.closeMobilePopovers('data-table');
            this.dataTableEntry = entry;
            this.dataTableSheetOpen = true;
            return;
        }
        this.dataTableSheetOpen = false;
        this.dataTableEntry = entry;
        this.$nextTick(() => this._setupPopover('data-table-popover', '.price-breakdown-popover-header', event.clientX, event.clientY));
    },

    closeDataTablePopover() {
        this.dataTableEntry = null;
        this.dataTableSheetOpen = false;
    },

    togglePopoverDetail(srcId) {
        const s = new Set(this.popoverOpenDetails);
        s.has(srcId) ? s.delete(srcId) : s.add(srcId);
        this.popoverOpenDetails = s;
    },

    openTierPopover(entry, event, fromPopover = false) {
        const isMobile = window.innerWidth <= 900;
        if (isMobile) {
            this.closeMobilePopovers('tier');
            this.tierSheetEntry = entry;
        } else {
            if (!fromPopover) {
                this.itemPopoverEntry = null;
                this.popoverEntry = null;
            }
            this.closeDataTablePopover();
            this.closeQuantityPopover();
            this.tierPopoverEntry = entry;
            this.$nextTick(() => {
                const el = document.getElementById('tier-popover');
                if (!el) return;
                el._draggable = false;
                el.style.zIndex = this.nextZ();
                positionPopover(el, event.clientX, event.clientY);
                if (!el._draggable) {
                    makeDraggable(el, el.querySelector('.item-popover-header'), () => {
                        el.style.zIndex = this.nextZ();
                    });
                    el._draggable = true;
                }
            });
        }
    },

    closeTierPopover() {
        this.tierPopoverEntry = null;
        this.tierSheetEntry = null;
    },

    openQuantityPopover(entry, event) {
        if (!entry?.src) return;
        event?.stopPropagation?.();
        this.closePopover();
        this.closeTierPopover();
        this.closeItemPopover();
        this.closePriceBreakdownPopover();
        this.closeDataTablePopover();
        const isMobile = window.innerWidth <= 900;
        if (isMobile) {
            this.closeMobilePopovers('quantity');
            this.quantityPopoverEntry = entry;
            this.quantitySheetOpen = true;
            return;
        }
        this.quantitySheetOpen = false;
        this.quantityPopoverEntry = entry;
        this.$nextTick(() => this._setupPopover('quantity-popover', '.quantity-popover-header', event.clientX, event.clientY));
    },

    closeQuantityPopover() {
        this.quantityPopoverEntry = null;
        this.quantitySheetOpen = false;
    },

    openMobileSource(item) {
        this.setMobileTab('sources');

        if (this.collapsedSections.has(item.src.type)) {
            const s = new Set(this.collapsedSections);
            s.delete(item.src.type);
            this.collapsedSections = s;
        }

        nextTick(() => {
            setTimeout(() => {
                const panel = document.querySelector('.mobile-scroll-container .content-center.mobile-panel');
                const el = panel?.querySelector(`.source-row-wrap[data-id="${item.src.id}"]`);
                if (!el || !panel) return;
                panel.scrollTop = el.offsetTop - panel.clientHeight / 3;
                el.classList.add('highlight');
                setTimeout(() => el.classList.remove('highlight'), 1500);
            }, 100);
        });
    },

    onMaxItemClick(item, event) {
        const target = this.maxPanelTierPopoverTarget(item, this.maxTab);
        if (!target) return;
        this.openTierPopoverForBonus(target.src, target.bonus, event, {
            maxItemContext: { tab: this.maxTab, sourceId: item.src.id, instanceIndex: item?._instanceIndex ?? null },
            maxBonusRefs: this._maxPanelBonusRefsForEntry(target.bonus)
        });
    },

    onMaxItemInfoClick(item, event) {
        this.openItemPopover(this.maxPanelEditSource(item.src, this.maxTab, item?._instanceIndex ?? null), event, false, {
            maxItemContext: { tab: this.maxTab, sourceId: item.src.id, instanceIndex: item?._instanceIndex ?? null }
        });
    },

    nextZ() {
        return ++this._zCounter;
    },

    _setupPopover(id, headerSelector, clientX, clientY) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.zIndex = this.nextZ();
        positionPopover(el, clientX, clientY);
        if (!el._draggable) {
            makeDraggable(el, el.querySelector(headerSelector), () => {
                el.style.zIndex = this.nextZ();
            });
            el._draggable = true;
        }
    },
};
