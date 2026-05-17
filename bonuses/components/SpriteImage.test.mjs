import assert from 'node:assert/strict';
import { SpriteImage } from './SpriteImage.js';

assert.match(
    SpriteImage.template,
    /<clipPath :id="atlasClipPathId" clipPathUnits="userSpaceOnUse">/,
    'atlas sprites define a clip path to prevent atlas bleed outside sprite bounds'
);

assert.match(
    SpriteImage.template,
    /image-rendering="pixelated"/,
    'atlas sprites force pixelated rendering on the sampled atlas image'
);

assert.match(
    SpriteImage.template,
    /shape-rendering: crispEdges;/,
    'atlas sprites request crisp edge rendering on the sampled atlas image'
);

console.log('bonuses/components/SpriteImage.test.mjs passed');
