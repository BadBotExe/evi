export function atlasEntryToImageAsset(manifest, refKey, resolvePath) {
    if (!refKey || typeof refKey !== 'string') return null;
    const entry = manifest?.entries?.[refKey];
    if (!entry) return null;
    const atlas = manifest?.atlases?.[entry.atlas];
    if (!atlas) return null;

    return {
        kind: 'atlas',
        ref: refKey,
        url: typeof resolvePath === 'function' ? resolvePath(atlas.path) : atlas.path,
        x: Number(entry.x ?? 0),
        y: Number(entry.y ?? 0),
        width: Number(entry.width ?? 0),
        height: Number(entry.height ?? 0),
        sheetWidth: Number(atlas.width ?? 0),
        sheetHeight: Number(atlas.height ?? 0)
    };
}

export function normalizeAtlasSourcePath(value) {
    if (typeof value !== 'string') return '';
    return value
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/[?#].*$/, '');
}

export function atlasSourcePathToImageAsset(manifest, sourcePath, resolvePath) {
    const normalizedSourcePath = normalizeAtlasSourcePath(sourcePath);
    if (!normalizedSourcePath) return null;

    for (const [refKey, entry] of Object.entries(manifest?.entries ?? {})) {
        const source = normalizeAtlasSourcePath([
            entry?.source?.root,
            entry?.source?.dir,
            entry?.source?.extension
                ? `${entry?.source?.name}.${entry?.source?.extension}`
                : entry?.source?.name
        ].filter(Boolean).join('/'));
        if (source !== normalizedSourcePath) continue;
        return atlasEntryToImageAsset(manifest, refKey, resolvePath);
    }

    return null;
}

export function isAtlasImageAsset(value) {
    return !!value && typeof value === 'object' && value.kind === 'atlas';
}

export function resolveImageAssetCandidate(asset, fallbackUrl = null) {
    if (isAtlasImageAsset(asset)) return asset;
    if (typeof asset === 'string' && asset.trim()) return asset;
    if (typeof fallbackUrl === 'string' && fallbackUrl.trim()) return fallbackUrl;
    return null;
}
