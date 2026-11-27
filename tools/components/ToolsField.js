export const ToolsField = {
    props: {
        label: { type: String, required: true },
        select: Boolean
    },
    template: `
        <component :is="$slots.actions ? 'div' : 'label'" class="engineering-field" :class="{ 'engineering-field-select': select }">
            <span class="engineering-field-label">{{ label }}</span>
            <div v-if="$slots.actions" class="tools-number-input-actions">
                <slot></slot>
                <slot name="actions"></slot>
            </div>
            <span v-else-if="select" class="engineering-field-control"><slot></slot></span>
            <slot v-else></slot>
        </component>`
};
