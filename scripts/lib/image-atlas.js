const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const IMAGE_EXTENSIONS = new Set(['.png']);
const ATLAS_BASENAME = '__atlas';
const NO_ATLAS_MARKER_FILES = new Set(['.noatlas']);
const DEFAULT_ATLAS_PADDING = 8;
const DEFAULT_ATLAS_MAX_WIDTH = 1024;

function toPosix(value) {
  return String(value).split(path.sep).join('/');
}

function stripQueryAndHash(value) {
  const [withoutHash] = String(value ?? '').split('#', 1);
  return withoutHash.split('?', 1)[0] ?? '';
}

function isImageFile(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isGeneratedAtlasFile(filePath) {
  const name = path.basename(filePath).toLowerCase();
  return name === `${ATLAS_BASENAME}.png` || name === `${ATLAS_BASENAME}.json`;
}

function hasNoAtlasMarker(dirPath) {
  for (const markerFileName of NO_ATLAS_MARKER_FILES) {
    if (fs.existsSync(path.join(dirPath, markerFileName))) return true;
  }
  return false;
}

function listLeafImageDirectories(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const result = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    const childDirs = [];
    let imageCount = 0;

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        childDirs.push(fullPath);
        continue;
      }
      if (isGeneratedAtlasFile(fullPath)) continue;
      if (isImageFile(fullPath)) imageCount += 1;
    }

    for (const childDir of childDirs) walk(childDir);
    if (imageCount > 0 && !hasNoAtlasMarker(currentDir)) result.push(currentDir);
  }

  walk(rootDir);
  return result.sort((left, right) => left.localeCompare(right));
}

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 24) {
    throw new Error(`PNG file is too small: ${filePath}`);
  }

  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature) {
    throw new Error(`Unsupported PNG signature: ${filePath}`);
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  if (!width || !height) {
    throw new Error(`Invalid PNG dimensions for ${filePath}`);
  }

  return { width, height };
}

function readImageSize(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') return readPngSize(filePath);
  throw new Error(`Unsupported image type "${extension}" for ${filePath}`);
}

function buildAtlasEntryKey(rootId, relativeDir, fileName) {
  const dirKey = toPosix(relativeDir || '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\//g, ':');
  const fileKey = path.parse(fileName).name;
  return [rootId, dirKey, fileKey].filter(Boolean).join(':');
}

function buildAtlasId(rootId, relativeDir) {
  return [rootId, toPosix(relativeDir).replace(/^\/+|\/+$/g, '').replace(/\//g, ':')].filter(Boolean).join(':');
}

function collectAtlasSourceEntries(rootId, rootDir) {
  const leafDirs = listLeafImageDirectories(rootDir);
  const atlases = [];

  for (const leafDir of leafDirs) {
    const relativeDir = path.relative(rootDir, leafDir);
    const sourceFiles = fs.readdirSync(leafDir, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => path.join(leafDir, entry.name))
      .filter(filePath => isImageFile(filePath) && !isGeneratedAtlasFile(filePath))
      .sort((left, right) => left.localeCompare(right));

    const entries = sourceFiles.map(filePath => {
      const fileName = path.basename(filePath);
      const size = readImageSize(filePath);
      return {
        key: buildAtlasEntryKey(rootId, relativeDir, fileName),
        filePath,
        fileName,
        relativeDir: toPosix(relativeDir),
        sourcePath: toPosix(path.join(rootId, 'images', relativeDir, fileName)),
        width: size.width,
        height: size.height,
      };
    });

    atlases.push({
      atlasId: buildAtlasId(rootId, relativeDir),
      rootId,
      rootDir,
      leafDir,
      relativeDir: toPosix(relativeDir),
      entries,
    });
  }

  return atlases;
}

function estimateAtlasRowWidth(entries, maxWidth) {
  const totalArea = entries.reduce((sum, entry) => sum + (entry.width * entry.height), 0);
  const squareLikeWidth = Math.ceil(Math.sqrt(totalArea));
  return Math.min(maxWidth, Math.max(64, squareLikeWidth));
}

function buildAtlasLayout(entries, options = {}) {
  const padding = Math.max(0, Number(options.padding ?? DEFAULT_ATLAS_PADDING));
  const maxWidth = Math.max(64, Number(options.maxWidth ?? DEFAULT_ATLAS_MAX_WIDTH));
  const ordered = [...entries].sort((left, right) =>
    right.height - left.height
    || right.width - left.width
    || left.fileName.localeCompare(right.fileName)
  );

  if (!ordered.length) {
    return {
      width: 0,
      height: 0,
      padding,
      entries: [],
    };
  }

  const rowWidthLimit = estimateAtlasRowWidth(ordered, maxWidth);
  let cursorX = padding;
  let cursorY = padding;
  let rowHeight = 0;
  let usedWidth = 0;

  const laidOutEntries = ordered.map(entry => {
    if (cursorX !== padding && cursorX + entry.width + padding > rowWidthLimit) {
      cursorX = padding;
      cursorY += rowHeight + padding;
      rowHeight = 0;
    }

    const positioned = {
      ...entry,
      x: cursorX,
      y: cursorY,
    };

    cursorX += entry.width + padding;
    rowHeight = Math.max(rowHeight, entry.height);
    usedWidth = Math.max(usedWidth, positioned.x + positioned.width + padding);
    return positioned;
  });

  return {
    width: usedWidth,
    height: cursorY + rowHeight + padding,
    padding,
    entries: laidOutEntries.sort((left, right) => left.key.localeCompare(right.key)),
  };
}

function sourceDescriptorFromRepoPath(repoRelativePath) {
  const normalized = toPosix(repoRelativePath);
  const parts = normalized.split('/');
  const fileName = parts.pop() ?? '';
  const parsed = path.posix.parse(fileName);
  return {
    root: parts.shift() ?? '',
    dir: parts.join('/'),
    name: parsed.name,
    extension: parsed.ext.replace(/^\./, ''),
  };
}

function repoPathFromSourceDescriptor(source) {
  if (!source || typeof source !== 'object') return '';
  const fileName = source.extension ? `${source.name}.${source.extension}` : source.name;
  return toPosix(path.posix.join(source.root ?? '', source.dir ?? '', fileName));
}

async function buildAtlasPng(layout) {
  const composite = layout.entries.map(entry => ({
    input: entry.filePath,
    left: entry.x,
    top: entry.y,
  }));

  return sharp({
    create: {
      width: layout.width,
      height: layout.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composite)
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeIfChanged(filePath, nextContent) {
  if (fs.existsSync(filePath)) {
    const currentContent = fs.readFileSync(filePath, 'utf8');
    if (currentContent === nextContent) return false;
  }
  fs.writeFileSync(filePath, nextContent, 'utf8');
  return true;
}

function writeBufferIfChanged(filePath, nextContent) {
  if (fs.existsSync(filePath)) {
    const currentContent = fs.readFileSync(filePath);
    if (Buffer.compare(currentContent, nextContent) === 0) return false;
  }
  fs.writeFileSync(filePath, nextContent);
  return true;
}

function atlasWebPathFromManifest(manifestDir, atlasFilePath) {
  return toPosix(path.relative(manifestDir, atlasFilePath));
}

function buildGlobalManifest(atlases, manifestDir) {
  const manifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    atlases: {},
    entries: {},
  };

  for (const atlas of atlases) {
    const atlasPngPath = path.join(atlas.leafDir, `${ATLAS_BASENAME}.png`);
    manifest.atlases[atlas.atlasId] = {
      id: atlas.atlasId,
      path: atlasWebPathFromManifest(manifestDir, atlasPngPath),
      width: atlas.layout.width,
      height: atlas.layout.height,
      count: atlas.layout.entries.length,
    };

    for (const entry of atlas.layout.entries) {
      manifest.entries[entry.key] = {
        atlas: atlas.atlasId,
        x: entry.x,
        y: entry.y,
        width: entry.width,
        height: entry.height,
        source: sourceDescriptorFromRepoPath(entry.sourcePath),
      };
    }
  }

  return manifest;
}

function buildPathIndex(manifest) {
  const index = new Map();
  for (const [key, entry] of Object.entries(manifest.entries ?? {})) {
    index.set(repoPathFromSourceDescriptor(entry.source), key);
  }
  return index;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(filePath, data) {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  return writeIfChanged(filePath, content);
}

async function buildAtlasArtifacts(rootId, rootDir, manifestDir, options = {}) {
  const atlases = collectAtlasSourceEntries(rootId, rootDir)
    .filter(atlas => atlas.entries.length)
    .map(atlas => ({
      ...atlas,
      layout: buildAtlasLayout(atlas.entries, options),
    }));

  for (const atlas of atlases) {
    ensureDirectory(atlas.leafDir);

    const atlasPngPath = path.join(atlas.leafDir, `${ATLAS_BASENAME}.png`);
    const atlasJsonPath = path.join(atlas.leafDir, `${ATLAS_BASENAME}.json`);
    const legacyAtlasSvgPath = path.join(atlas.leafDir, `${ATLAS_BASENAME}.svg`);

    atlas.pngPath = atlasPngPath;
    atlas.jsonPath = atlasJsonPath;

    const atlasPng = await buildAtlasPng(atlas.layout);
    writeBufferIfChanged(atlasPngPath, atlasPng);
    if (fs.existsSync(legacyAtlasSvgPath)) fs.unlinkSync(legacyAtlasSvgPath);

    writeJsonFile(atlasJsonPath, {
      id: atlas.atlasId,
      width: atlas.layout.width,
      height: atlas.layout.height,
      entries: Object.fromEntries(atlas.layout.entries.map(entry => [
        entry.key,
        {
          x: entry.x,
          y: entry.y,
          width: entry.width,
          height: entry.height,
          source: sourceDescriptorFromRepoPath(entry.sourcePath),
        },
      ])),
    });
  }

  const manifest = buildGlobalManifest(atlases, manifestDir);
  return { atlases, manifest };
}

module.exports = {
  ATLAS_BASENAME,
  DEFAULT_ATLAS_MAX_WIDTH,
  DEFAULT_ATLAS_PADDING,
  NO_ATLAS_MARKER_FILES,
  buildAtlasArtifacts,
  buildAtlasEntryKey,
  buildAtlasLayout,
  buildGlobalManifest,
  buildPathIndex,
  collectAtlasSourceEntries,
  hasNoAtlasMarker,
  isGeneratedAtlasFile,
  listLeafImageDirectories,
  readImageSize,
  stripQueryAndHash,
  toPosix,
  repoPathFromSourceDescriptor,
  sourceDescriptorFromRepoPath,
  writeBufferIfChanged,
  writeJsonFile,
  readJsonFile,
};
