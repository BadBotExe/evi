export const ToolsResultsTable = {
    props: {
        columns: { type: Array, required: true },
        rows: { type: Array, required: true },
        hideHeader: Boolean
    },
    template: `
        <div class="tools-results-table-wrap">
            <table class="tools-results-table">
                <thead v-if="!hideHeader">
                    <tr>
                        <th v-for="column in columns" :key="column.key" scope="col"
                            :class="{ 'tools-number-col': column.numeric }">{{ column.label }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(row, index) in rows" :key="row.key ?? index">
                        <td v-for="column in columns" :key="column.key" :class="{ 'tools-number-col': column.numeric }">
                            <slot :name="column.key" :row="row">{{ row[column.key] }}</slot>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>`
};

export const ToolsDisclosure = {
    props: { label: { type: String, required: true } },
    template: `
        <details class="tools-hourglass-plan">
            <summary>{{ label }}</summary>
            <slot></slot>
        </details>`
};

export const ToolsSplitLayout = {
    props: { stickyResults: Boolean },
    template: `
        <div class="tools-afk-layout" :class="{ 'tools-split-layout-sticky': stickyResults }">
            <slot></slot>
        </div>`
};
