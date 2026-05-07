export const EmptyState = {
    props: ['selectedBonus'],
    template: `
        <div class="empty-state" v-if="!selectedBonus">
            <div class="empty-icon">&#x2726;</div>
            <div class="empty-title">No bonus selected</div>
            <div class="empty-sub">Select a bonus from the dropdown to see all sources and maximum obtainable values</div>
        </div>
    `
};
