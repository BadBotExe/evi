import { SpriteImage } from './SpriteImage.js?v=f6763a6b56';

export const SourceRow = {
    components: { SpriteImage },
    props: ['entry', 'selectedBonus', 'openDetails', 'app', 'fromPopover'],
    emits: ['toggle-detail'],
    computed: {
        src:            function() { return this.entry.src; },
        bonuses:        function() { return this.entry.bonuses; },
        isOpen:         function() { return false; },
        hasTiers:       function() { return this.app.hasTiers(this.entry); },
        tierGroups:     function() { return this.app.getTierGroups(this.entry); },
        valueHtml:      function() { return this.app.entryValueHtml(this.entry, { includeFormulaMeta: !this.fromPopover }); },
        slotMax:        function() { return this.entry.src.slot ? this.app.slotMax(this.entry.src.slot) : null; },
        aliasBonuses: function() { const sel = this.selectedBonus; return this.entry.bonuses.filter(function(b) { return b.bonus !== sel; }); },
        conditionBonus: function() { return this.entry.bonuses.find(function(b) { return b.condition; }) ?? null; },
        ascensionBonus() {
            const ids = this.app._resolveBonusIds(this.selectedBonus);
            return this.bonuses.find(b => b._is_ascension && ids.includes(b.bonus)) ?? null;
        },
        tierLabel() { return this.app.srcTierLabel(this.src, this.ascensionBonus); },
        canAddToMax() { return this.app.canAddSourceToMax(this.src); },
    },
    methods: {
        bonusLabel(id)    { return this.app.bonusLabel(id); },
        scalesLabel(id)   { return this.app.scalesLabel(id); },
        condLabel(id)     { return this.app.conditionLabel(id); },
        classLabel(id)    { return this.app.classLabel(id); },
        classColor(id)    { return this.app.classColor(id); },
        addToMax(event) { this.app.handleSourceAdd(this.src, event); },
        toggle(e)   { if (this.hasTiers) { e.stopPropagation(); this.app.openTierPopover(this.entry, e, this.fromPopover); } },
    },
    template: `
        <div class="source-row-wrap" :class="{ 'has-detail': hasTiers }" :data-id="src.id">
            <div class="source-row" @click="toggle">

                <!-- Image -->
                <div class="src-img"
                     :class="{ 'src-img-clickable': app.resolveItemPopover(src) !== false }"
                     @click.stop="app.openItemPopover(src, $event, fromPopover)">
                    <sprite-image :image="src.image" :alt="app.sourceName(src)"></sprite-image>
                </div>

                <!-- Info -->
                <div class="src-info">
                    <div class="src-name">
                        <span class="src-name-text"
                            :title="app.sourceName(src)"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()">{{ app.sourceName(src) }}</span>
                        <span v-if="tierLabel" class="tag tag-tier">{{ tierLabel }}</span>
                    </div>
                    <div class="src-tags">
                        <span v-for="b in aliasBonuses" :key="b.bonus" class="tag tag-alias"
                              :title="bonusLabel(b.bonus)"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()">
                            {{ bonusLabel(b.bonus) }}
                        </span>
                        <span v-if="bonuses[0]?.derived_from" class="tag src-derived"
                              :title="bonusLabel(bonuses[0].derived_from)"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()">
                            {{ bonusLabel(bonuses[0].derived_from) }}
                        </span>
                        <span v-if="src.available === false" class="tag tag-na"
                              title="Unavailable"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()">Unavailable</span>
                        <span v-if="src.category" class="tag tag-category"
                              :title="app.categoryLabel(src.category)"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()"
                              :style="{ background: app.categoryColor(src.category) + '22', color: app.categoryColor(src.category) }">
                            {{ app.categoryLabel(src.category) }}
                        </span>
                        <span v-if="bonuses[0]?.scales_with" class="tag src-scales"
                              :title="scalesLabel(bonuses[0].scales_with)"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()">
                            {{ scalesLabel(bonuses[0].scales_with) }}
                        </span>
                        <span v-if="conditionBonus" class="tag tag-conditional"
                              :title="'&#x2691; ' + condLabel(conditionBonus.condition)"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()"
                              :class="{ 'tag-conditional-fail': !app.activeConditions.has(conditionBonus.condition) }">
                            &#x2691; {{ condLabel(conditionBonus.condition) }}
                        </span>
                        <span v-for="[paramId, min] in Object.entries(bonuses[0].parameter_min ?? {})"
                              :key="paramId" class="tag tag-conditional"
                              :title="app.paramLabel(paramId) + ' &geq; ' + min"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()"
                              :class="{ 'tag-conditional-fail': !app.isParamMet(paramId, min) }">
                            {{ app.paramLabel(paramId) }} &geq; {{ min }}
                        </span>
                        <span v-if="src.slot && src.size > 1" class="tag tag-slot"
                              :title="app.slotLabel(src.slot) + (src.size > 1 ? ' &#215;' + src.size : '')"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()"
                              :style="{ background: app.slotColor(src.slot) + '22', color: app.slotColor(src.slot) }">
                            {{ app.slotLabel(src.slot) }}{{ src.size > 1 ? ' &#215;' + src.size : '' }}
                        </span>
                    </div>
                </div>

                <!-- Right -->
                <div class="src-right">
                    <div class="src-val" v-html="valueHtml"></div>
                </div>
                <div class="src-actions">
                    <button class="max-add-btn"
                            type="button"
                            :disabled="!canAddToMax"
                            :title="canAddToMax ? 'Add to max list' : 'No free slot'"
                            aria-label="Add to max list"
                            @click.stop="addToMax($event)">+</button>
                </div>
            </div>
        </div>
    `
};
