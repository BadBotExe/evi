import assert from 'node:assert/strict';
import { ItemPopoverContent } from './ItemPopoverContent.js';

assert.match(
    ItemPopoverContent.template,
    /<sprite-image :image="badge\.icon"[\s\S]*img-class="item-enhancement-icon"[\s\S]*placeholder-class="item-enhancement-icon"><\/sprite-image>/,
    'item popover renders breakdown badges through SpriteImage so atlas assets are not stringified into img src'
);

assert.doesNotMatch(
    ItemPopoverContent.template,
    /<img :src="badge\.icon"/,
    'item popover no longer renders breakdown badges as raw img src values'
);

console.log('bonuses/components/ItemPopoverContent.test.mjs passed');
