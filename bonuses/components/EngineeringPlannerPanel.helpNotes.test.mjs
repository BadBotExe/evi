import assert from 'node:assert/strict';
import { EngineeringPlannerPanel } from './EngineeringPlannerPanel.js';

assert.doesNotMatch(
    EngineeringPlannerPanel.template,
    /engineering-planner-note/,
    'engineering planner should no longer render inline planner notes in the main body'
);

assert.ok(
    EngineeringPlannerPanel.template.includes(`<div class="engineering-planner-help-copy">
                        <p v-for="(note, index) in helpNotes" :key="'desktop-note-' + index">{{ note }}</p>
                    </div>
                    <table class="engineering-planner-help-table">`),
    'desktop planner help should render the extracted explanatory notes before the help table'
);

assert.ok(
    EngineeringPlannerPanel.template.includes(`<div class="engineering-planner-help-copy">
                                        <p v-for="(note, index) in helpNotes" :key="'mobile-note-' + index">{{ note }}</p>
                                    </div>
                                    <table class="engineering-planner-help-table">`),
    'mobile planner help sheet should render the same extracted explanatory notes before the help table'
);

{
    const notes = EngineeringPlannerPanel.computed.helpNotes.call({
        isItemsInputMode: true,
        isThroughputMode: false,
        isCalculatorThroughputMode: false,
        ratioText: 'Idea 70 : Blueprint 1 : Runic Blueprint 10'
    });

    assert.deepEqual(
        notes,
        [
            'Stable dependency ratio: Idea 70 : Blueprint 1 : Runic Blueprint 10.',
            'Select the slot you want to produce, enter its current items per hour, and the planner works backward through its dependencies only. Downstream products are ignored. Required speeds are calculated with Reduced Time = Base Time / (1 + Speed%).'
        ],
        'requirements mode help includes both the dependency ratio note and the reduced-time explanation'
    );
}

{
    const notes = EngineeringPlannerPanel.computed.helpNotes.call({
        isItemsInputMode: false,
        isThroughputMode: true,
        isCalculatorThroughputMode: true,
        ratioText: 'Idea 70 : Blueprint 1 : Runic Blueprint 10'
    });

    assert.deepEqual(
        notes,
        [
            'Stable dependency ratio: Idea 70 : Blueprint 1 : Runic Blueprint 10.',
            'Select the last slot you care about, then enter the current speed of all engineering slots to see real steady-state pipeline output, starvation loss, and which upstream resources are limiting that selected chain. This view assumes a continuously running pipeline after startup, not the initial fill or first-fire timing.'
        ],
        'steady-state throughput help keeps the full calculator-specific explanation inside Planner Help'
    );
}

{
    const notes = EngineeringPlannerPanel.computed.helpNotes.call({
        isItemsInputMode: false,
        isThroughputMode: true,
        isCalculatorThroughputMode: false,
        ratioText: 'Idea 70 : Blueprint 1 : Runic Blueprint 10'
    });

    assert.deepEqual(
        notes,
        [
            'Stable dependency ratio: Idea 70 : Blueprint 1 : Runic Blueprint 10.',
            'Select the last slot you care about, then enter the current speed of all engineering slots to mirror the in-game gross and net chain values for that selected anchor.'
        ],
        'in-game throughput help keeps its anchor-mirroring explanation inside Planner Help'
    );
}

console.log('bonuses/components/EngineeringPlannerPanel.helpNotes.test.mjs passed');
