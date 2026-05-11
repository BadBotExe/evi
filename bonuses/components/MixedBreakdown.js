export const MixedBreakdown = {
    props: ['app', 'bonusId', 'flat', 'percent', 'percentStages', 'multiplier', 'text', 'rowsData', 'className'],
    computed: {
        rows() {
            if (Array.isArray(this.rowsData) && this.rowsData.length) {
                return this.rowsData.map(row => typeof row === 'string' ? { text: row } : row);
            }
            if (this.percentStages && Object.keys(this.percentStages).length) {
                return this.app.formatCompoundBreakdownRows({
                    flat: this.flat,
                    percent: this.percent,
                    percentStages: this.percentStages,
                    multiplier: this.multiplier
                }, this.bonusId);
            }
            const rows = [];
            if (this.flat != null) {
                rows.push({ text: this.app.formatBonusValue(this.flat, this.bonusId, 'flat') });
            }
            if (this.percent != null) {
                rows.push({ text: this.app.formatBonusValue(this.percent, this.bonusId, 'percent') });
            }
            if (this.multiplier != null && this.multiplier !== 1) {
                rows.push({ text: this.app.formatBonusValue(this.multiplier, this.bonusId, 'multiplier') });
            }
            if (!rows.length && this.text) rows.push({ text: this.text });
            return rows;
        }
    },
    template: `
        <div class="max-panel-breakdown" :class="className || ''">
            <span v-for="(row, i) in rows"
                  :key="i"
                  @mousemove="app.showTooltip($event)"
                  @mouseleave="app.hideTooltip()"
                  v-html="row.html || row.text"></span>
        </div>
    `
};
