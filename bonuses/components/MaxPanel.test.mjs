import assert from 'node:assert/strict';
import { MaxPanel } from './MaxPanel.js';

assert.match(
    MaxPanel.template,
    /<sprite-image :image="deleteIcon" alt="" img-class="max-delete-icon"><\/sprite-image>/,
    'max panel delete action renders through SpriteImage instead of raw img src'
);

const atlasAwareDeleteIcon = MaxPanel.computed.deleteIcon.call({
    app: {
        _sourceResolver: {
            resolveImageAsset(assetBasePath, assetRef, assetPath) {
                return { assetBasePath, assetRef, assetPath, kind: 'atlas' };
            }
        }
    }
});

assert.deepEqual(
    atlasAwareDeleteIcon,
    {
        assetBasePath: '../items/items.json',
        assetRef: 'items:delete',
        assetPath: '../items/images/delete.png?v=dd6946db7e',
        kind: 'atlas'
    },
    'max panel delete icon is resolved through atlas-aware source resolver'
);

assert.equal(
    MaxPanel.computed.shouldUseBreakdownAsTotal.call({
        filteredResult: { unit_type: 'percent', isMixed: true },
        totalBreakdownRows: [{ text: '+1,496%' }, { text: 'x3' }]
    }),
    true,
    'max panel reuses breakdown as total for multi-part non-flat totals'
);

assert.equal(
    MaxPanel.computed.shouldUseBreakdownAsTotal.call({
        filteredResult: { unit_type: 'flat', isMixed: true },
        totalBreakdownRows: [{ text: '+4,488' }, { text: '+1,496%' }, { text: 'x3' }]
    }),
    false,
    'max panel keeps aggregate total when flat exists'
);

assert.equal(
    MaxPanel.computed.shouldShowTotalBreakdown.call({
        totalBreakdownColumns: [{ value: '+1,496%', label: '%' }, { value: 'x3', label: 'Multiplier' }],
        isTotalEquivalentToBreakdown: true
    }),
    false,
    'max panel hides duplicate total breakdown when total already matches it'
);

assert.equal(
    MaxPanel.computed.shouldShowTotalBreakdown.call({
        totalBreakdownColumns: [{ value: '+4,488', label: 'Flat' }, { value: '+1,496%', label: '%' }, { value: 'x3', label: 'Multiplier' }],
        isTotalEquivalentToBreakdown: false
    }),
    true,
    'max panel keeps total breakdown for normal compound totals'
);

assert.equal(
    MaxPanel.computed.isTotalEquivalentToBreakdown.call({
        totalDisplayRows: [{ text: '+1,496%' }, { text: 'x3' }],
        totalBreakdownRows: [{ text: '+1,496%' }, { text: 'x3' }]
    }),
    true,
    'max panel treats identical total and breakdown rows as equivalent'
);

console.log('bonuses/components/MaxPanel.test.mjs passed');
