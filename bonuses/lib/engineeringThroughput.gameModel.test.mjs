import assert from 'node:assert/strict';
import { computeEngineeringThroughput } from './engineeringThroughput.js';

function rowMap(rows) {
    return rows.reduce((acc, row) => {
        acc[row.slotId] = row;
        return acc;
    }, {});
}

function assertClose(actual, expected, message) {
    assert.equal(Number(actual.toFixed(3)), Number(expected.toFixed(3)), message);
}

{
    const rows = computeEngineeringThroughput({
        slots: [
            {
                id: 'idea',
                producedAmount: 1,
                currentRatePerHour: 15840,
                produces: { idea: 1 }
            },
            {
                id: 'blueprint',
                producedAmount: 1,
                currentRatePerHour: 288,
                consumes: { idea: 30 },
                produces: { blueprint: 1 }
            },
            {
                id: 'runic_blueprint',
                producedAmount: 1,
                currentRatePerHour: 102,
                consumes: { idea: 70, blueprint: 1 },
                produces: { runic_blueprint: 1 }
            },
            {
                id: 'sun_scroll',
                producedAmount: 1,
                currentRatePerHour: 10,
                consumes: { blueprint: 14, runic_blueprint: 10 },
                produces: { sun_scroll: 1 }
            }
        ],
        anchorSlotId: 'sun_scroll'
    });
    const byId = rowMap(rows);

    assertClose(byId.idea.grossOutputRatePerHour, 15840, 'idea gross output stays independent from downstream shortages');
    assertClose(byId.idea.spendRatePerHour, 15780, 'idea spend is the sum of downstream gross recipe demand');
    assertClose(byId.idea.netRatePerHour, 60, 'idea net matches the in-game surplus example');
    assertClose(byId.blueprint.spendRatePerHour, 242, 'blueprint spend is runic plus sun gross demand');
    assertClose(byId.blueprint.netRatePerHour, 46, 'blueprint net is gross minus downstream gross demand');
    assertClose(byId.runic_blueprint.spendRatePerHour, 100, 'runic spend is sun gross demand only');
    assertClose(byId.runic_blueprint.netRatePerHour, 2, 'runic net can stay near zero without global chain rescaling');
    assertClose(byId.sun_scroll.netRatePerHour, 10, 'anchor net equals its own gross output when there are no downstream consumers');
}

{
    const rows = computeEngineeringThroughput({
        slots: [
            {
                id: 'idea',
                producedAmount: 1,
                currentRatePerHour: 1067,
                produces: { idea: 1 }
            },
            {
                id: 'blueprint',
                producedAmount: 1,
                currentRatePerHour: 12,
                consumes: { idea: 30 },
                produces: { blueprint: 1 }
            },
            {
                id: 'runic_blueprint',
                producedAmount: 1,
                currentRatePerHour: 6.666666666666667,
                consumes: { idea: 70, blueprint: 1 },
                produces: { runic_blueprint: 1 }
            },
            {
                id: 'sun_scroll',
                producedAmount: 1,
                currentRatePerHour: 1.8181818181818181,
                consumes: { blueprint: 14, runic_blueprint: 10 },
                produces: { sun_scroll: 1 }
            }
        ],
        anchorSlotId: 'sun_scroll'
    });
    const byId = rowMap(rows);

    assertClose(byId.idea.netRatePerHour, 240.33333333333326, 'idea keeps surplus when downstream gross demand does not exhaust it');
    assertClose(byId.blueprint.netRatePerHour, -20.121212121212118, 'intermediate slots can show negative net when downstream gross demand exceeds their gross output');
    assertClose(byId.runic_blueprint.netRatePerHour, -11.515151515151514, 'runic blueprint can also go negative without forcing a global chain rescale');
    assert.equal(byId.blueprint.starved, true, 'negative net marks the slot as short');
    assert.equal(byId.runic_blueprint.starved, true, 'negative net marks the slot as short even when its own gross output is unchanged');
}

console.log('bonuses/lib/engineeringThroughput.gameModel.test.mjs passed');
