import assert from 'node:assert/strict';
import { BonusSourceResolver } from './sourceResolver.js';
import { resourceBreakdownMethods } from './resourceBreakdown.js';

const resolver = new BonusSourceResolver({
    bonusesBaseUrl: 'http://localhost:8081/bonuses/',
    data: {
        item_sources: new Map([
            ['act1_zone_1', { id: 'act1_zone_1', type: 'zone', name: 'Act 1 Zone 1', act: 1, zone: 1, zone_name: 'Boars' }],
            ['act1_zone_2', { id: 'act1_zone_2', type: 'zone', name: 'Act 1 Zone 2', act: 1, zone: 2, zone_name: 'Wasps' }],
            ['act1_zone_3', { id: 'act1_zone_3', type: 'zone', name: 'Act 1 Zone 3', act: 1, zone: 3, zone_name: 'Pebbles' }],
            ['act1_zones_1_2', { id: 'act1_zones_1_2', type: 'source_group', name: 'Act 1 Zones 1-2', source_refs: ['act1_zone_1', 'act1_zone_2'] }],
            ['act1_nested_all', { id: 'act1_nested_all', type: 'source_group', name: 'Act 1 All Zones', source_refs: ['act1_zones_1_2', 'act1_zone_3'] }],
            ['cyclic_a', { id: 'cyclic_a', type: 'source_group', name: 'Cyclic A', source_refs: ['cyclic_b'] }],
            ['cyclic_b', { id: 'cyclic_b', type: 'source_group', name: 'Cyclic B', source_refs: ['cyclic_a'] }],
            ['night_event', { id: 'night_event', type: 'event', name: 'Night Event' }]
        ]),
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

assert.deepEqual(
    resolver.resolveItemSourceFileRefs({
        sources: [
            { id: 'group', type: 'source_group', source_refs: [' act1_zone_1 ', 'act1_zone_1', '', 'act1_zone_2'] }
        ]
    }),
    [
        { id: 'group', type: 'source_group', source_refs: ['act1_zone_1', 'act1_zone_2'] }
    ],
    'item source refs are normalized while preserving the rest of the source definition'
);

const nestedGroupItem = resolver.resolveItemSources({
    id: 'test-item',
    source_refs: [
        { ref: 'act1_nested_all', modes: ['hard'], during_refs: ['night_event'] },
        'act1_zone_1'
    ]
});

assert.equal(nestedGroupItem.sources[0].id, 'act1_nested_all');
assert.deepEqual(
    nestedGroupItem.sources[0].group_sources.map(source => source.id),
    ['act1_zones_1_2', 'act1_zone_3'],
    'top-level source groups resolve child refs in order'
);
assert.deepEqual(
    nestedGroupItem.sources[0].group_sources[0].group_sources.map(source => source.id),
    ['act1_zone_1', 'act1_zone_2'],
    'nested source groups resolve recursively'
);
assert.deepEqual(
    nestedGroupItem.sources[0].during_sources.map(source => source.id),
    ['night_event'],
    'group refs preserve during sources'
);
assert.deepEqual(
    resolver.itemSourceDisplayEntries(nestedGroupItem),
    [
        {
            kind: 'source',
            key: 'act1_nested_all|during:night_event|modes:hard',
            label: 'Act 1 All Zones during Night Event [Hard]'
        },
        {
            kind: 'zone-group',
            key: ':zone:1:Zone:Act',
            label: 'Act 1 Zone 1 (Boars)'
        }
    ],
    'display entries keep explicit group labels and leaf zone labels'
);

const unnamedGroupLabel = resolver.itemSourceLabel({
    id: 'unnamed_group',
    type: 'source_group',
    group_sources: [
        { id: 'act1_zone_1', type: 'zone', name: 'Act 1 Zone 1', act: 1, zone: 1, zone_name: 'Boars' },
        { id: 'act1_zone_2', type: 'zone', name: 'Act 1 Zone 2', act: 1, zone: 2, zone_name: 'Wasps' }
    ],
    during_sources: [],
    modes: []
});

assert.equal(
    unnamedGroupLabel,
    'Act 1 Zone 1 (Boars), Act 1 Zone 2 (Wasps)',
    'unnamed source groups derive a label from nested sources'
);

const cyclicGroup = resolver.resolveItemSourceEntry('cyclic_a');
assert.deepEqual(
    cyclicGroup.group_sources.map(source => source.id),
    ['cyclic_b'],
    'group recursion retains direct children'
);
assert.deepEqual(
    cyclicGroup.group_sources[0].group_sources,
    [],
    'group recursion stops when it detects a cycle'
);

console.log('bonuses/app/sourceResolver.test.mjs passed');
