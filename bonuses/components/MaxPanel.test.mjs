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

console.log('bonuses/components/MaxPanel.test.mjs passed');
