import { atlasEntryToImageAsset, atlasSourcePathToImageAsset, isAtlasImageAsset, resolveImageAssetCandidate } from './imageAtlas.js';

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}: expected "${expected}", got "${actual}"`);
    }
}

function assertDeepEqual(actual, expected, label) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
        throw new Error(`${label}: expected ${expectedJson}, got ${actualJson}`);
    }
}

function run() {
    {
        const manifest = {
            atlases: {
                'items:gear:act1': { path: '../../items/images/gear/act1/__atlas.svg', width: 256, height: 128 }
            },
            entries: {
                'items:gear:act1:bronze_axe': {
                    atlas: 'items:gear:act1',
                    x: 4,
                    y: 6,
                    width: 24,
                    height: 18
                }
            }
        };

        const result = atlasEntryToImageAsset(manifest, 'items:gear:act1:bronze_axe', value => `/resolved/${value}`);
        assertDeepEqual(result, {
            kind: 'atlas',
            ref: 'items:gear:act1:bronze_axe',
            url: '/resolved/../../items/images/gear/act1/__atlas.svg',
            x: 4,
            y: 6,
            width: 24,
            height: 18,
            sheetWidth: 256,
            sheetHeight: 128
        }, 'atlas entry resolves into sprite descriptor');
        assertEqual(isAtlasImageAsset(result), true, 'resolved descriptor is identified as atlas asset');
    }

    {
        const manifest = {
            atlases: {
                'items:gear:act1': { path: '../../items/images/gear/act1/__atlas.svg', width: 256, height: 128 }
            },
            entries: {
                'items:gear:act1:bronze_axe': {
                    atlas: 'items:gear:act1',
                    x: 4,
                    y: 6,
                    width: 24,
                    height: 18,
                    source: {
                        root: 'items',
                        dir: 'images/gear/act1',
                        name: 'bronze_axe',
                        extension: 'png'
                    }
                }
            }
        };

        const result = atlasSourcePathToImageAsset(manifest, '/items/images/gear/act1/bronze_axe.png?v=1', value => `/resolved/${value}`);
        assertDeepEqual(result, {
            kind: 'atlas',
            ref: 'items:gear:act1:bronze_axe',
            url: '/resolved/../../items/images/gear/act1/__atlas.svg',
            x: 4,
            y: 6,
            width: 24,
            height: 18,
            sheetWidth: 256,
            sheetHeight: 128
        }, 'legacy source path resolves into sprite descriptor');
    }

    {
        const fallback = resolveImageAssetCandidate(null, '../items/images/gold.png?v=1');
        assertEqual(fallback, '../items/images/gold.png?v=1', 'fallback URL is preserved when atlas ref is absent');
        assertEqual(resolveImageAssetCandidate('', ''), null, 'empty values resolve to null');
    }

    console.log('imageAtlas tests passed');
}

run();
