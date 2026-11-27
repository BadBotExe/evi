export const TOOLS_TAB_ICONS = {
    input: 'M4 5h16M4 12h16M4 19h10',
    results: 'M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8',
    formula: 'M4 7h16M7 4v6M17 4v6M8 15h8M10 19h4'
};

export const ToolsMobileTabs = {
    props: {
        tabs: { type: Array, required: true },
        activeTab: { type: String, required: true },
        label: { type: String, required: true },
        scrollable: Boolean
    },
    emits: ['select'],
    mounted() {
        if (!this.scrollable || typeof ResizeObserver !== 'function') return;
        this.resizeObserver = new ResizeObserver(() => this.revealActiveTab());
        this.resizeObserver.observe(this.$el);
        this.revealActiveTab();
    },
    beforeUnmount() {
        this.resizeObserver?.disconnect();
    },
    methods: {
        scrollWithWheel(event) {
            if (!this.scrollable || event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
            const nav = event.currentTarget;
            const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? nav.clientWidth : 1;
            const previous = nav.scrollLeft;
            nav.scrollLeft += event.deltaY * scale;
            if (nav.scrollLeft !== previous) event.preventDefault();
        },
        startDrag(event) {
            this.ignoreDragClick = false;
            if (!this.scrollable || event.pointerType !== 'mouse' || event.button !== 0) return;
            const nav = event.currentTarget;
            if (nav.scrollWidth <= nav.clientWidth) return;
            this.tabDrag = { id: event.pointerId, startX: event.clientX, startScroll: nav.scrollLeft };
        },
        dragTabs(event) {
            const drag = this.tabDrag;
            if (!drag || drag.id !== event.pointerId) return;
            if (!(event.buttons & 1)) {
                this.tabDrag = null;
                return;
            }
            const offset = event.clientX - drag.startX;
            if (!this.ignoreDragClick && Math.abs(offset) < 5) return;
            const nav = event.currentTarget;
            if (!this.ignoreDragClick) {
                nav.setPointerCapture(event.pointerId);
                this.ignoreDragClick = true;
            }
            nav.scrollLeft = drag.startScroll - offset;
        },
        endDrag(event) {
            if (this.tabDrag?.id === event.pointerId) this.tabDrag = null;
        },
        preventDragClick(event) {
            if (!this.ignoreDragClick || event.detail === 0) return;
            event.preventDefault();
            event.stopPropagation();
        },
        revealActiveTab() {
            if (!this.scrollable) return;
            this.$nextTick(() => {
                const nav = this.$el;
                const active = nav?.querySelector('button[aria-pressed="true"]');
                if (active && nav.clientWidth) {
                    const view = nav.getBoundingClientRect();
                    const tab = active.getBoundingClientRect();
                    if (tab.left < view.left) nav.scrollLeft += tab.left - view.left;
                    else if (tab.right > view.right) nav.scrollLeft += tab.right - view.right;
                }
            });
        }
    },
    template: `
        <nav class="mobile-tabbar tools-afk-mobile-tabs" :class="{ 'tools-mobile-tabs-scroll': scrollable }" :aria-label="label"
             @wheel="scrollWithWheel" @pointerdown="startDrag" @pointermove="dragTabs"
             @pointerup="endDrag" @pointercancel="endDrag" @click.capture="preventDragClick">
            <button v-for="tab in tabs" :key="tab.id" type="button" class="mobile-tab" :data-tab="tab.id"
                    :class="{ active: activeTab === tab.id }" :aria-pressed="activeTab === tab.id"
                    :aria-label="tab.ariaLabel" @click="$emit('select', tab.id)">
                <span v-if="tab.badge" class="tools-hourglass-tab-overflow tools-hourglass-no" aria-hidden="true">{{ tab.badge }}</span>
                <span v-else class="mobile-tab-icon tools-afk-tab-icon" aria-hidden="true">
                    <img v-if="tab.image" :src="tab.image" width="20" height="20" alt="" draggable="false">
                    <svg v-else viewBox="0 0 24 24"><path :d="tab.icon"></path></svg>
                </span>
                <span>{{ tab.label }}</span>
            </button>
        </nav>`
};
