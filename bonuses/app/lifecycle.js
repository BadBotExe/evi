import { clampPopover } from '../utils.js?v=7e5a144c2d';
import { installTabRestoreRecovery } from '../restore.js?v=4fc4623910';
import { SAVE_TOOL_TOGGLE_CODE } from './saveMappings.js?v=8051e324a0';

export class BonusAppLifecycle {
    constructor(app) {
        this.app = app;
    }

    _saveCodeBuffer = '';

    install() {
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('popstate', this.handlePopstate);

        installTabRestoreRecovery({
            rehydrate: () => {
                if (!this.app.data) return false;
                this.app._applyUrlState(window.location.search);
                this.clampAllPopovers();
                return true;
            }
        });

        document.addEventListener('click', this.handleDocumentClick);
        document.addEventListener('keydown', this.handleKeydown);
    }

    clampAllPopovers() {
        clampPopover(document.getElementById('item-popover'));
        clampPopover(document.getElementById('popover'));
        clampPopover(document.getElementById('price-breakdown-popover'));
        clampPopover(document.getElementById('data-table-popover'));
    }

    handleResize = () => {
        this.app.isMobileViewport = window.matchMedia('(max-width: 900px)').matches;
        this.clampAllPopovers();
    };

    handlePopstate = () => {
        this.app._applyUrlState(window.location.search);
    };

    handleDocumentClick = (event) => {
        const desktop = document.querySelector('.sidebar-left .bonus-select-wrap');
        const mobile = document.querySelector('.mobile-bonus-wrap');
        if (!desktop?.contains(event.target) && !mobile?.contains(event.target)) {
            this.app.dropdownOpen = false;
            this.app.itemTypeDropdownOpen = false;
        }
        this.app.popoverEntry = null;
        if (!document.getElementById('item-popover')?.contains(event.target)) {
            this.app.itemPopoverEntry = null;
        }
        if (!document.getElementById('tier-popover')?.contains(event.target)) {
            this.app.tierPopoverEntry = null;
        }
        if (!document.getElementById('price-breakdown-popover')?.contains(event.target)) {
            this.app.priceBreakdownEntry = null;
        }
        if (!document.getElementById('data-table-popover')?.contains(event.target)) {
            this.app.dataTableEntry = null;
        }
    };

    handleKeydown = (event) => {
        if (event.key?.length === 1 && /[a-z]/i.test(event.key)) {
            this._saveCodeBuffer = (this._saveCodeBuffer + event.key.toLowerCase()).slice(-SAVE_TOOL_TOGGLE_CODE.length);
            if (this._saveCodeBuffer === SAVE_TOOL_TOGGLE_CODE) {
                this.app.saveToolsVisible = !this.app.saveToolsVisible;
                localStorage.setItem('evitania_bonuses_save_tools', this.app.saveToolsVisible ? '1' : '0');
                this._saveCodeBuffer = '';
            }
        }
        if (event.key !== 'Escape') return;
        if (this.app.tierSheetEntry) { this.app.closeTierPopover(); return; }
        if (this.app.dataTableSheetOpen) { this.app.closeDataTablePopover(); return; }
        if (this.app.priceBreakdownSheetOpen) { this.app.closePriceBreakdownPopover(); return; }
        if (this.app.itemSheetOpen) { this.app.closeItemPopover(); return; }
        if (this.app.dataTableEntry) { this.app.closeDataTablePopover(); return; }
        if (this.app.tierPopoverEntry) { this.app.closeTierPopover(); return; }
        if (this.app.priceBreakdownEntry) { this.app.closePriceBreakdownPopover(); return; }
        if (this.app.itemPopoverEntry) { this.app.closeItemPopover(); return; }
        if (this.app.popoverEntry) { this.app.closePopover(); return; }
    };
}
