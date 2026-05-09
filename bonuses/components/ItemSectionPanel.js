export const ItemSectionPanel = {
    props: ['panel', 'app'],
    template: `
        <section class="item-section-panel" :style="{ '--section-color': panel.color || app.typeColor(app.activeItemType) }">
            <div class="item-section-panel-head">
                <div>
                    <div class="item-section-panel-title">{{ panel.title }}</div>
                    <div v-if="panel.description" class="item-section-panel-desc">{{ panel.description }}</div>
                </div>
            </div>
            <div v-if="panel.actions?.length" class="item-section-panel-actions">
                <button v-for="action in panel.actions"
                        :key="action.id"
                        type="button"
                        class="item-section-panel-btn"
                        @click.stop="app.openDataTablePopover(panel, action, $event)">
                    {{ action.label }}
                </button>
            </div>
        </section>
    `
};
