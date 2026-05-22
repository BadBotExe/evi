import assert from 'node:assert/strict';
import { computeEngineeringThroughput } from './engineeringThroughput.js';

function assertClose(actual, expected, message) {
    assert.equal(Number(actual.toFixed(3)), Number(expected.toFixed(3)), message);
}

function rowMap(rows) {
    return rows.reduce((acc, row) => {
        acc[row.slotId] = row;
        return acc;
    }, {});
}

function assertChainInvariants(rows, anchorSlotId) {
    const anchorIndex = rows.findIndex(row => row.slotId === anchorSlotId);
    assert.ok(anchorIndex >= 0, `anchor ${anchorSlotId} exists`);

    rows.forEach((row, index) => {
        if (index <= anchorIndex) {
            assert.equal(row.inDependencyChain, true, `${row.slotId} stays active up to anchor`);
            assertClose(row.actualOutputRatePerHour, row.grossOutputRatePerHour, `${row.slotId} actual output follows gross output in the game-style model`);
            assertClose(row.netRatePerHour, row.grossOutputRatePerHour - row.spendRatePerHour, `${row.slotId} net equals gross minus spend`);
            assertClose(row.lossOutputRatePerHour, Math.max(0, row.spendRatePerHour - row.grossOutputRatePerHour), `${row.slotId} loss equals the missing gross demand`);
            assert.equal(row.starved, row.netRatePerHour < -1e-9, `${row.slotId} starved flag follows negative net`);
        } else {
            assert.equal(row.inDependencyChain, false, `${row.slotId} is inactive after anchor`);
        }
    });
}

function assertNoSurplusShortageContradictions(rows, messagePrefix) {
    const byId = rowMap(rows);
    for (const row of rows) {
        for (const producerId of row.shortageProducerIds ?? []) {
            const producer = byId[producerId];
            assert.ok(
                !producer || producer.netRatePerHour < -1e-9,
                `${messagePrefix}: ${row.slotId} cannot blame non-short producer ${producerId}`
            );
        }
    }
}

{
    const rows = computeEngineeringThroughput({
        slots: [
            {
                id: 'idea',
                producedAmount: 1,
                currentRatePerHour: 600,
                produces: { idea: 1 }
            },
            {
                id: 'blueprint',
                producedAmount: 1,
                currentRatePerHour: 40,
                consumes: { idea: 30 },
                produces: { blueprint: 1 }
            }
        ],
        anchorSlotId: 'idea'
    });
    const byId = rowMap(rows);

    assertChainInvariants(rows, 'idea');
    assertClose(byId.idea.spendRatePerHour, 0, 'idea-only anchor has no downstream spend');
    assertClose(byId.idea.netRatePerHour, 600, 'idea-only anchor keeps all output as surplus');
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

    assertChainInvariants(rows, 'sun_scroll');
    assertClose(byId.idea.spendRatePerHour, 15780, 'idea spend uses downstream gross demand');
    assertClose(byId.idea.netRatePerHour, 60, 'idea net matches the in-game sample');
    assertClose(byId.blueprint.netRatePerHour, 46, 'blueprint net is gross minus runic and sun gross demand');
    assertClose(byId.runic_blueprint.netRatePerHour, 2, 'runic net is gross minus sun gross demand');
    assertClose(byId.sun_scroll.netRatePerHour, 10, 'anchor net equals its own gross output');
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

    assertChainInvariants(rows, 'sun_scroll');
    assertClose(byId.idea.netRatePerHour, 240.33333333333326, 'idea keeps a positive surplus when gross demand does not exhaust it');
    assertClose(byId.blueprint.netRatePerHour, -20.121212121212118, 'blueprint can go negative when downstream gross demand exceeds its gross output');
    assertClose(byId.runic_blueprint.netRatePerHour, -11.515151515151514, 'runic can also go negative without global chain rescaling');
    assert.deepEqual(byId.runic_blueprint.shortageProducerIds, ['blueprint'], 'runic blames the direct upstream slot that is itself short');
    assert.deepEqual(byId.sun_scroll.shortageProducerIds.sort(), ['blueprint', 'runic_blueprint'], 'sun blames every direct upstream slot that is short');
}

{
    const anchors = ['blueprint', 'runic_blueprint', 'sun_scroll'];
    const ideaValues = [0, 20, 40, 80, 300, 600, 1067];
    const blueprintValues = [0, 0.5, 1, 5, 10, 12];
    const runicValues = [0, 0.5, 1, 4, 6];
    const sunValues = [0, 0.5, 1];

    for (const anchorSlotId of anchors) {
        for (const idea of ideaValues) {
            for (const blueprint of blueprintValues) {
                for (const runic of runicValues) {
                    for (const sun of sunValues) {
                        const rows = computeEngineeringThroughput({
                            slots: [
                                {
                                    id: 'idea',
                                    producedAmount: 1,
                                    currentRatePerHour: idea,
                                    produces: { idea: 1 }
                                },
                                {
                                    id: 'blueprint',
                                    producedAmount: 1,
                                    currentRatePerHour: blueprint,
                                    consumes: { idea: 30 },
                                    produces: { blueprint: 1 }
                                },
                                {
                                    id: 'runic_blueprint',
                                    producedAmount: 1,
                                    currentRatePerHour: runic,
                                    consumes: { idea: 70, blueprint: 1 },
                                    produces: { runic_blueprint: 1 }
                                },
                                {
                                    id: 'sun_scroll',
                                    producedAmount: 1,
                                    currentRatePerHour: sun,
                                    consumes: { blueprint: 14, runic_blueprint: 10 },
                                    produces: { sun_scroll: 1 }
                                }
                            ],
                            anchorSlotId
                        });

                        assertChainInvariants(rows, anchorSlotId);
                        assertNoSurplusShortageContradictions(
                            rows,
                            `anchor=${anchorSlotId} idea=${idea} blueprint=${blueprint} runic=${runic} sun=${sun}`
                        );
                    }
                }
            }
        }
    }
}

console.log('bonuses/lib/engineeringThroughput.test.mjs passed');
