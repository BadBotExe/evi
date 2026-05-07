export const TooltipMixin = {
    data() {
        return { tooltipText: '', tooltipX: 0, tooltipY: 0, tooltipVisible: false };
    },
    methods: {
        showTooltip(e, text = null) {
            const target = e.currentTarget || e.target;
            if (!target) return;
            if (!text && target.offsetWidth >= target.scrollWidth) return;
            this.tooltipText = text ?? target.textContent.trim();
            this.tooltipVisible = true;
            this.$nextTick(() => {
                const el = document.querySelector('.bd-tooltip-global');
                if (!el) return;
                const w = el.offsetWidth;
                let x = e.clientX + 12;
                if (x + w > window.innerWidth) x = e.clientX - w - 12;
                if (x < 8) x = 8;
                this.tooltipX = x;
                this.tooltipY = e.clientY + 12;
            });
        },
        hideTooltip() { this.tooltipVisible = false; },
    }
};
