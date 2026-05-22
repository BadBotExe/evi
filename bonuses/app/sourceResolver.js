import { atlasEntryToImageAsset, atlasSourcePathToImageAsset, resolveAtlasPathFromManifest } from '../../shell/lib/imageAtlas.js?v=2593e30b08';

const ATLAS_MANIFEST_PATH = '../generated/image-atlas-manifest.json?v=0b94192dcd';
const LEGACY_BONUSES_ATLAS_MANIFEST_PATH = ATLAS_MANIFEST_PATH.slice(3);

export class BonusSourceResolver {
    constructor(app) {
        this.app = app;
    }

    resolveRelativeAssetPath(assetBasePath, assetPath) {
        if (typeof assetPath !== 'string') return assetPath;
        const trimmed = assetPath.trim();
        if (!trimmed) return assetPath;
        if (/^(?:[a-z]+:|\/\/|\/|#)/i.test(trimmed)) return assetPath;

        try {
            const baseUrl = new URL(assetBasePath ?? './', this.app.bonusesBaseUrl ?? window.location.href);
            const resolved = new URL(trimmed, baseUrl);
            return `${resolved.pathname}${resolved.search}${resolved.hash}`;
        } catch {
            return assetPath;
        }
    }

    resolveImageAsset(assetBasePath, refKey, assetPath) {
        const manifest = this.app.data?.image_atlas_manifest ?? { atlases: {}, entries: {} };
        const atlasAsset = atlasEntryToImageAsset(
            manifest,
            refKey,
            atlasPath => this.resolveAtlasAssetPath(atlasPath)
        );
        if (atlasAsset) return atlasAsset;
        const legacyAtlasAsset = this.resolveLegacyAtlasAsset(assetBasePath, assetPath, manifest);
        if (legacyAtlasAsset) return legacyAtlasAsset;
        return this.resolveRelativeAssetPath(assetBasePath, assetPath);
    }

    resolveAtlasAssetPath(atlasPath) {
        const resolved = resolveAtlasPathFromManifest(atlasPath, {
            manifestUrl: new URL(ATLAS_MANIFEST_PATH, this.app.bonusesBaseUrl ?? window.location.href).toString(),
            legacyManifestUrl: new URL(LEGACY_BONUSES_ATLAS_MANIFEST_PATH, this.app.bonusesBaseUrl ?? window.location.href).toString(),
            legacyPrefixes: ['../images/']
        });

        try {
            const url = new URL(resolved);
            return `${url.pathname}${url.search}${url.hash}`;
        } catch {
            return resolved;
        }
    }

    resolveLegacyAtlasAsset(assetBasePath, assetPath, manifest) {
        if (typeof assetPath !== 'string' || !assetPath.trim()) return null;

        let pathname = '';
        try {
            const resolved = new URL(this.resolveRelativeAssetPath(assetBasePath, assetPath), this.app.bonusesBaseUrl ?? window.location.href);
            pathname = resolved.pathname;
        } catch {
            return null;
        }

        const repoRelativePath = pathname.replace(/^\/+/, '');
        if (!repoRelativePath) return null;

        return atlasSourcePathToImageAsset(
            manifest,
            repoRelativePath,
            atlasPath => this.resolveAtlasAssetPath(atlasPath)
        );
    }

    resolveItemFileRefs(file, assetBasePath) {
        const items = Array.isArray(file) ? file : (file.items ?? []);
        return items.map(item => ({
            ...item,
            _asset_base_path: assetBasePath,
            icon: this.resolveImageAsset(assetBasePath, item?.icon_ref, item?.icon),
            image: this.resolveImageAsset(assetBasePath, item?.image_ref, item?.image)
        }));
    }

    resolveItemSourceFileRefs(file) {
        const sources = Array.isArray(file) ? file : (file.sources ?? []);
        return sources
            .filter(source => source && typeof source === 'object' && source.id)
            .map(source => ({
                ...source,
                source_refs: this.normalizeSourceRefList(source?.source_refs)
            }));
    }

    resolveItemSources(item) {
        if (!item || typeof item !== 'object') return item;

        const sourceRefs = Array.isArray(item.source_refs) ? item.source_refs : [];
        const sources = sourceRefs
            .map(ref => this.resolveItemSourceEntry(ref))
            .filter(Boolean);

        return {
            ...item,
            source_refs: sourceRefs,
            sources
        };
    }

    itemSourceDisplayEntries(src) {
        const resolvedSources = Array.isArray(src?.sources) ? src.sources.filter(Boolean) : [];
        if (!resolvedSources.length) return [];

        const ordered = [];

        for (const source of resolvedSources) {
            if (this.isCollapsibleZoneSource(source)) {
                const bucketKey = this.zoneBucketKey(source);
                const previous = ordered[ordered.length - 1] ?? null;
                if (!previous || previous.kind !== 'zone-group' || previous.key !== bucketKey) {
                    const bucket = { kind: 'zone-group', key: bucketKey, sources: [source] };
                    ordered.push(bucket);
                } else {
                    previous.sources.push(source);
                }
                continue;
            }

            ordered.push({
                kind: 'source',
                key: source.key ?? source.id,
                label: this.itemSourceLabel(source)
            });
        }

        return ordered
            .map(entry => entry.kind === 'zone-group'
                ? {
                    kind: 'zone-group',
                    key: entry.key,
                    label: this.formatZoneSourceGroup(entry.sources)
                }
                : entry
            )
            .filter(entry => entry.label);
    }

    isCollapsibleZoneSource(source) {
        return source?.type === 'zone'
            && !(source?.during_sources?.length)
            && Number.isFinite(Number(source?.act))
            && Number.isFinite(Number(source?.zone));
    }

    zoneBucketKey(source) {
        return [
            source?.group ?? '',
            source?.type ?? '',
            Number(source?.act),
            source?.zone_label ?? 'Zone',
            source?.act_label ?? 'Act'
        ].join(':');
    }

    itemSourceLabel(source) {
        if (!source) return '';
        const duringLabel = this.itemSourceDuringLabel(source);
        const modeLabel = this.itemSourceModeLabel(source);
        const baseLabel = this.itemSourceBaseLabel(source);
        const withDuring = duringLabel ? `${baseLabel} during ${duringLabel}` : baseLabel;
        return modeLabel ? `${withDuring} ${modeLabel}` : withDuring;
    }

    itemSourceBaseLabel(source) {
        if (!source) return '';
        if (this.isSourceGroup(source)) {
            const explicitLabel = String(source.name ?? source.label ?? '').trim();
            return explicitLabel || this.formatSourceGroupLabel(source);
        }
        if (this.isCollapsibleZoneSource(source)) {
            return this.formatSingleZoneSource(source);
        }
        return String(source.name ?? source.label ?? source.id ?? '').trim();
    }

    formatZoneSourceGroup(sources) {
        if (!Array.isArray(sources) || !sources.length) return '';

        const [first] = sources;
        const actLabel = first?.act_label ?? 'Act';
        const zoneLabel = first?.zone_label ?? 'Zone';
        const zoneEntries = [...new Map(
            sources
                .map(source => [Number(source?.zone), source])
                .filter(([zone]) => Number.isFinite(zone))
        ).entries()].sort((left, right) => left[0] - right[0]);
        const zones = zoneEntries.map(([zone]) => zone);

        if (!zones.length) return '';

        if (zones.length === 1) {
            return this.formatSingleZoneSource(zoneEntries[0][1]);
        }

        const ranges = [];
        let rangeStart = zones[0];
        let previous = zones[0];

        for (let index = 1; index < zones.length; index += 1) {
            const zone = zones[index];
            if (zone === previous + 1) {
                previous = zone;
                continue;
            }

            ranges.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}-${previous}`);
            rangeStart = zone;
            previous = zone;
        }

        ranges.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}-${previous}`);

        const pluralLabel = zoneLabel.endsWith('s') ? zoneLabel : `${zoneLabel}s`;
        const nameSummary = this.formatZoneNameSummary(zoneEntries.map(([, source]) => source));
        return `${actLabel} ${Number(first.act)} ${pluralLabel} ${ranges.join(', ')}${nameSummary ? ` (${nameSummary})` : ''}`;
    }

    formatSingleZoneSource(source) {
        const actLabel = source?.act_label ?? 'Act';
        const zoneLabel = source?.zone_label ?? 'Zone';
        const zoneName = this.zoneSourceName(source);
        const suffix = zoneName ? ` (${zoneName})` : '';
        return `${actLabel} ${Number(source.act)} ${zoneLabel} ${Number(source.zone)}${suffix}`;
    }

    isSourceGroup(source) {
        return source?.type === 'source_group';
    }

    formatSourceGroupLabel(source) {
        const groupSources = Array.isArray(source?.group_sources) ? source.group_sources : [];
        const labels = groupSources
            .map(groupSource => this.itemSourceBaseLabel(groupSource))
            .filter(Boolean);
        return labels.join(', ');
    }

    zoneSourceName(source) {
        return String(
            source?.zone_name
            ?? source?.mob_name
            ?? ''
        ).trim();
    }

    formatZoneNameSummary(sources) {
        const names = sources
            .map(source => this.zoneSourceName(source))
            .filter(Boolean);

        if (!names.length) return '';
        if (names.length === 1) return names[0];

        const uniqueNames = [...new Set(names)];
        if (uniqueNames.length === 1) return uniqueNames[0];

        return `${uniqueNames[0]} - ${uniqueNames[uniqueNames.length - 1]}`;
    }

    resolveItemSourceEntry(entry) {
        const sourceMap = this.app.data?.item_sources ?? new Map();

        if (typeof entry === 'string') {
            const source = sourceMap.get(entry.trim()) ?? null;
            return source ? this.buildResolvedItemSource(source) : null;
        }

        if (!entry || typeof entry !== 'object' || typeof entry.ref !== 'string') return null;

        const source = sourceMap.get(entry.ref.trim()) ?? null;
        if (!source) return null;

        const duringSources = Array.isArray(entry.during_refs)
            ? entry.during_refs
                .filter(ref => typeof ref === 'string' && ref.trim())
                .map(ref => sourceMap.get(ref.trim()) ?? null)
                .filter(Boolean)
            : [];
        const modes = Array.isArray(entry.modes)
            ? entry.modes
                .filter(mode => typeof mode === 'string' && mode.trim())
                .map(mode => mode.trim().toLowerCase())
            : [];

        return this.buildResolvedItemSource(source, {
            duringSources,
            modes,
            key: [
                source.id,
                duringSources.length ? `during:${duringSources.map(item => item.id).join(',')}` : '',
                modes.length ? `modes:${modes.join(',')}` : ''
            ].filter(Boolean).join('|')
        });
    }

    buildResolvedItemSource(source, options = {}, ancestry = new Set()) {
        const duringSources = Array.isArray(options.duringSources) ? options.duringSources : [];
        const modes = Array.isArray(options.modes) ? options.modes : [];
        const nextAncestry = new Set(ancestry);
        if (source?.id) nextAncestry.add(source.id);

        return {
            ...source,
            key: options.key ?? source.id,
            source_refs: this.normalizeSourceRefList(source?.source_refs),
            group_sources: this.resolveSourceGroupEntries(source, nextAncestry),
            during_sources: duringSources,
            modes
        };
    }

    normalizeSourceRefList(sourceRefs) {
        if (!Array.isArray(sourceRefs)) return [];
        return [...new Set(
            sourceRefs
                .filter(ref => typeof ref === 'string' && ref.trim())
                .map(ref => ref.trim())
        )];
    }

    resolveSourceGroupEntries(source, ancestry = new Set()) {
        if (!this.isSourceGroup(source)) return [];

        const sourceMap = this.app.data?.item_sources ?? new Map();
        const sourceRefs = this.normalizeSourceRefList(source?.source_refs);
        const resolved = [];

        for (const ref of sourceRefs) {
            const childSource = sourceMap.get(ref) ?? null;
            if (!childSource || ancestry.has(childSource.id)) continue;
            resolved.push(this.buildResolvedItemSource(childSource, {}, ancestry));
        }

        return resolved;
    }

    itemSourceDuringLabel(source) {
        const duringSources = Array.isArray(source?.during_sources) ? source.during_sources : [];
        if (!duringSources.length) return '';
        return duringSources
            .map(item => String(item?.name ?? item?.label ?? item?.id ?? '').trim())
            .filter(Boolean)
            .join(', ');
    }

    itemSourceModeLabel(source) {
        const modes = Array.isArray(source?.modes) ? source.modes : [];
        if (!modes.length) return '';

        const normalized = [...new Set(
            modes
                .map(mode => String(mode ?? '').trim().toLowerCase())
                .filter(Boolean)
        )];
        if (!normalized.length) return '';
        if (normalized.length >= 2 && normalized.includes('normal') && normalized.includes('hard')) return '';

        const labels = normalized.map(mode => {
            if (mode === 'normal') return 'Normal';
            if (mode === 'hard') return 'Hard';
            return mode.charAt(0).toUpperCase() + mode.slice(1);
        });

        return `[${labels.join(', ')}]`;
    }

    resolveItemRef(ref) {
        if (typeof ref !== 'string') return null;
        const trimmed = ref.trim();
        if (!trimmed.startsWith('item:')) return null;
        const itemId = trimmed.slice(5).trim();
        return itemId ? (this.app.data?.items?.get(itemId) ?? null) : null;
    }

    resolveSourceItemRef(src) {
        if (!src || typeof src !== 'object' || typeof src.$ref !== 'string') return src;
        const item = this.resolveItemRef(src.$ref);
        if (!item) return src;

        const { $ref, image, ...overrides } = src;
        const resolved = {
            ...item,
            item_id: item.id,
            ...overrides
        };
        if (resolved.image == null && image != null) resolved.image = this.resolveRelativeAssetPath(this.app.bonusesBaseUrl, image);
        if (resolved.image == null && item.icon != null) resolved.image = item.icon;
        return resolved;
    }

    resolveBonusEntryAssetRefs(assetBasePath, bonusEntry) {
        if (!bonusEntry || typeof bonusEntry !== 'object') return bonusEntry;
        return {
            ...bonusEntry,
            icon: this.resolveImageAsset(assetBasePath, bonusEntry?.icon_ref, bonusEntry?.icon),
            image: this.resolveImageAsset(assetBasePath, bonusEntry?.image_ref, bonusEntry?.image)
        };
    }

    bonusEntriesForBonusView(src, bonusIds) {
        return this.expandDerivedBonuses(src.bonuses ?? []).filter(b =>
            bonusIds.includes(b.bonus) && this.app._bonusMatchesClass(b, src)
        );
    }

    expandDerivedBonuses(bonuses) {
        const derivedMaps = this.app.data?.derived_bonus_maps ?? {};
        const expanded = [];

        for (const bonus of bonuses) {
            if (!bonus) continue;
            expanded.push(bonus);

            const mapIds = new Set([bonus.bonus]);
            const explicitMapIds = Array.isArray(bonus.derived_bonus_maps)
                ? bonus.derived_bonus_maps
                : (bonus.derived_bonus_map ? [bonus.derived_bonus_map] : []);
            explicitMapIds.filter(Boolean).forEach(id => mapIds.add(id));

            for (const mapId of mapIds) {
                const derivedEntries = derivedMaps[mapId] ?? [];
                for (const [derivedIndex, derived] of derivedEntries.entries()) {
                    expanded.push(this.buildDerivedBonusEntry(bonus, derived, { mapId, derivedIndex }));
                }
            }
        }

        return expanded;
    }

    buildDerivedBonusEntry(baseBonus, derivedDef, options = {}) {
        const multiplier = Number(derivedDef.multiplier ?? 1);
        const derivedBonus = {
            ...baseBonus,
            ...derivedDef,
            bonus: derivedDef.bonus,
            unit_type: derivedDef.unit_type ?? baseBonus.unit_type,
            derived_from: baseBonus.bonus,
            _expanded_bonus_key: [
                'derived',
                baseBonus?._maxPanelBonusIndex ?? '',
                baseBonus?.bonus ?? '',
                options.mapId ?? '',
                options.derivedIndex ?? '',
                derivedDef?.bonus ?? '',
                derivedDef?.unit_type ?? baseBonus?.unit_type ?? 'flat'
            ].join(':')
        };

        if (baseBonus.value !== undefined && derivedDef.value === undefined) {
            derivedBonus.value = this.scaleDerivedValue(baseBonus.value, multiplier);
        }

        if (baseBonus.tiers_formula && derivedDef.tiers_formula === undefined) {
            derivedBonus.tiers_formula = this.scaleDerivedFormula(baseBonus.tiers_formula, multiplier);
        }

        return derivedBonus;
    }

    scaleDerivedValue(value, multiplier) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric * multiplier : value;
    }

    scaleDerivedFormula(formula, multiplier) {
        if (!formula || typeof formula !== 'object') return formula;

        const scaled = { ...formula };
        const scaleField = field => {
            if (typeof scaled[field] === 'number') scaled[field] *= multiplier;
        };

        scaleField('init');
        if (scaled.type !== 'base_percent') {
            scaleField('coeff');
        }

        return scaled;
    }

    tierPopoverNotice(entry) {
        if (!entry?.src || !Array.isArray(entry?.bonuses)) return null;

        for (const bonus of entry.bonuses) {
            const formula = this.app._resolveFormula(entry.src, bonus);
            if (!formula?.infinite) continue;

            const effectiveMaxTier = this.app._enhancementPositiveInt(formula.max_tier);
            if (effectiveMaxTier == null) return 'Max tier is not specified.';
            return `Max tier is not specified. Values shown up to tier ${effectiveMaxTier.toLocaleString()}.`;
        }

        return null;
    }
}
