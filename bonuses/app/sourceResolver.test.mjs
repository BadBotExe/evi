import assert from 'node:assert/strict';
import { BonusSourceResolver } from './sourceResolver.js';
import { resourceBreakdownMethods } from './resourceBreakdown.js';

const resolver = new BonusSourceResolver({
    bonusesBaseUrl: 'http://localhost:8081/bonuses/',
    data: {
        image_atlas_manifest: {
            atlases: {
                bonuses: {
                    path: '../images/__atlas.png?v=atlas-bonuses',
                    width: 54,
                    height: 55
                },
                items: {
                    path: '../../items/images/__atlas.png?v=atlas-items',
                    width: 48,
                    height: 88
                }
            },
            entries: {
                'bonuses:salvage': {
                    atlas: 'bonuses',
                    x: 8,
                    y: 8,
                    width: 16,
                    height: 16,
                    source: {
                        root: 'bonuses',
                        dir: 'images',
                        name: 'salvage',
                        extension: 'png'
                    }
                },
                'items:gold': {
                    atlas: 'items',
                    x: 8,
                    y: 8,
                    width: 32,
                    height: 32,
                    source: {
                        root: 'items',
                        dir: 'images',
                        name: 'gold',
                        extension: 'png'
                    }
                }
            }
        }
    }
});

assert.equal(
    resolver.resolveRelativeAssetPath('./', 'images/progression/warrior_max_hp.png?v=1'),
    '/bonuses/images/progression/warrior_max_hp.png?v=1',
    'bonus source images resolve from the bonuses root'
);

assert.equal(
    resolver.resolveRelativeAssetPath('sources/base_stats.json?v=1', 'images/progression/warrior_max_hp.png?v=1'),
    '/bonuses/sources/images/progression/warrior_max_hp.png?v=1',
    'file-relative resolution would incorrectly point inside sources'
);

assert.deepEqual(
    resolver.resolveBonusEntryAssetRefs('./', {
        bonus: 'Cost',
        icon: 'images/gem_shop/gem.png?v=7baa400b18'
    }),
    {
        bonus: 'Cost',
        icon: '/bonuses/images/gem_shop/gem.png?v=7baa400b18',
        image: undefined
    },
    'bonus entry icons resolve from the bonuses root'
);

const breakdownContext = {
    _sourceResolver: resolver,
    _resolveResourceBreakdownImage: resourceBreakdownMethods._resolveResourceBreakdownImage,
    data: {
        items: new Map([
            ['gold', {
                id: 'gold',
                icon: 'images/gold.png?v=68c77ec774',
                _asset_base_path: '../items/items.json'
            }]
        ])
    },
    hasPriceBreakdown() {
        return true;
    },
    getResourceBreakdownMeta: resourceBreakdownMethods.getResourceBreakdownMeta
};

assert.deepEqual(
    resourceBreakdownMethods.getResourceBreakdownBadges.call(breakdownContext, {}),
    [
        {
            kind: 'enhancement',
            icon: {
                kind: 'atlas',
                ref: 'items:gold',
                url: '/items/images/__atlas.png?v=atlas-items',
                x: 8,
                y: 8,
                width: 32,
                height: 32,
                sheetWidth: 48,
                sheetHeight: 88
            },
            ariaLabel: 'Open enhancement price breakdown popover'
        },
        {
            kind: 'disenchantment',
            icon: {
                kind: 'atlas',
                ref: 'bonuses:salvage',
                url: '/bonuses/images/__atlas.png?v=atlas-bonuses',
                x: 8,
                y: 8,
                width: 16,
                height: 16,
                sheetWidth: 54,
                sheetHeight: 55
            },
            ariaLabel: 'Open disenchantment return breakdown popover'
        }
    ],
    'resource breakdown badge icons resolve to atlas assets'
);

assert.deepEqual(
    resourceBreakdownMethods.resourceBreakdownResourceImage.call(breakdownContext, 'gold'),
    {
        kind: 'atlas',
        ref: 'items:gold',
        url: '/items/images/__atlas.png?v=atlas-items',
        x: 8,
        y: 8,
        width: 32,
        height: 32,
        sheetWidth: 48,
        sheetHeight: 88
    },
    'resource breakdown resource icons resolve through atlas-aware item assets'
);

console.log('bonuses/app/sourceResolver.test.mjs passed');
