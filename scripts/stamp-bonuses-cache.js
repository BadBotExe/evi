#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadCacheStampBuildConfig } = require('./lib/build-config.js');

const textExtensions = new Set(['.html', '.js', '.json', '.css']);
const assetExtensions = new Set([
  '.html', '.js', '.json', '.css',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.otf',
]);
const QUOTED_ASSET_URL_REGEX = /(['"])((?:\/|(?:\.\.?\/))?[^"'`\s\r\n]*?\.[a-zA-Z0-9]+(?:\?[^"'`\s\r\n]*)?)(\1)/g;
const CSS_ASSET_URL_REGEX = /url\((['"]?)([^)'"\s\r\n]+(?:\?[^)'"\s\r\n]*)?)\1\)/g;
const CACHE_STAMP_IGNORE_MARKER = 'cache-stamp-ignore';
const JS_NON_ASSET_PATH_CONTEXT_REGEX = /(?:^|[\s{(,;])(?:[_$a-zA-Z][\w$]*BasePath|[_$a-zA-Z][\w$]*BaseUrl|[_$A-Z][A-Z0-9_]*BASE_PATH|[_$A-Z][A-Z0-9_]*BASE_URL|assetBasePath|_asset_base_path)\s*(?::|=)\s*$|===?\s*$|!==?\s*$|\.assign\s*\(\s*$|\.replace\s*\(\s*$|location\.href\s*=\s*$/;

let _buildConfig = null;
function getBuildConfig() {
  if (!_buildConfig) _buildConfig = loadCacheStampBuildConfig(process.cwd());
  return _buildConfig;
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function shouldManageTextFile(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (!textExtensions.has(ext)) return false;
  const { excludedFiles, excludedSuffixes, repoRoot } = getBuildConfig();
  const normalized = toPosix(path.relative(repoRoot, absPath));
  if (excludedFiles.has(normalized)) return false;
  if (excludedSuffixes.some(s => normalized.endsWith(s))) return false;
  return true;
}

function shouldSkipUrl(rawUrl) {
  return (
      !rawUrl ||
      rawUrl.startsWith('http://') ||
      rawUrl.startsWith('https://') ||
      rawUrl.startsWith('//') ||
      rawUrl.startsWith('data:') ||
      rawUrl.startsWith('mailto:') ||
      rawUrl.startsWith('javascript:') ||
      rawUrl.startsWith('#')
  );
}

function lineBoundsForIndex(content, index) {
  const start = content.lastIndexOf('\n', index - 1) + 1;
  const nextLineBreak = content.indexOf('\n', index);
  const end = nextLineBreak === -1 ? content.length : nextLineBreak;
  return { start, end };
}

function shouldIgnoreStampedMatch(content, index) {
  const { start, end } = lineBoundsForIndex(content, index);
  return content.slice(start, end).includes(CACHE_STAMP_IGNORE_MARKER);
}

function isJavaScriptLikeFile(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  return ext === '.js' || ext === '.mjs';
}

function shouldSkipJsLogicalPath(content, index, absPath) {
  if (!isJavaScriptLikeFile(absPath)) return false;
  const prefix = content.slice(Math.max(0, index - 160), index);
  return JS_NON_ASSET_PATH_CONTEXT_REGEX.test(prefix);
}

function resolvePathnameToAbsolute(pathname, fromFile) {
  const { repoRoot, managedRoots } = getBuildConfig();

  if (pathname.startsWith('/')) {
    return [path.resolve(repoRoot, '.' + pathname)];
  }

  const candidates = [path.resolve(path.dirname(fromFile), pathname)];
  for (const root of managedRoots) {
    if (fromFile === root || fromFile.startsWith(root + path.sep)) {
      candidates.push(path.resolve(root, pathname));
    }
  }
  return candidates;
}

function extractUrlsFromContent(content, absPath) {
  const urls = [];

  for (const match of content.matchAll(QUOTED_ASSET_URL_REGEX)) {
    const rawUrl = match[2];
    const offset = match.index;
    if (shouldSkipUrl(rawUrl)) continue;
    if (shouldIgnoreStampedMatch(content, offset)) continue;
    if (shouldSkipJsLogicalPath(content, offset, absPath)) continue;
    urls.push({ rawUrl, offset });
  }

  if (path.extname(absPath).toLowerCase() === '.css') {
    for (const match of content.matchAll(CSS_ASSET_URL_REGEX)) {
      const rawUrl = match[2];
      if (shouldSkipUrl(rawUrl)) continue;
      urls.push({ rawUrl, offset: undefined });
    }
  }

  return urls;
}

function pathnameFromRawUrl(rawUrl) {
  const [withoutHash] = rawUrl.split('#', 2);
  const [pathname] = withoutHash.split('?', 2);
  if (!pathname || !pathname.includes('.')) return null;
  const ext = path.extname(pathname).toLowerCase();
  if (!assetExtensions.has(ext)) return null;
  return pathname;
}

function collectManagedDeps(absPath, managedSet) {
  const ext = path.extname(absPath).toLowerCase();
  if (!textExtensions.has(ext)) return [];

  const content = fs.readFileSync(absPath, 'utf8');
  const deps = new Set();

  for (const { rawUrl } of extractUrlsFromContent(content, absPath)) {
    const pathname = pathnameFromRawUrl(rawUrl);
    if (!pathname) continue;
    const candidates = resolvePathnameToAbsolute(pathname, absPath);
    for (const candidate of candidates) {
      if (managedSet.has(candidate)) {
        deps.add(candidate);
        break;
      }
    }
  }

  return [...deps];
}

function findSCCs(nodes, adjList) {
  const visited = new Set();
  const order = [];

  function dfs1(node) {
    if (visited.has(node)) return;
    visited.add(node);
    for (const neighbor of (adjList.get(node) || [])) {
      dfs1(neighbor);
    }
    order.push(node);
  }

  for (const f of nodes) dfs1(f);

  const reverseAdj = new Map();
  for (const f of nodes) reverseAdj.set(f, []);
  for (const [from, tos] of adjList) {
    for (const to of tos) {
      if (!reverseAdj.has(to)) reverseAdj.set(to, []);
      reverseAdj.get(to).push(from);
    }
  }

  const visited2 = new Set();
  const sccs = [];

  function dfs2(node, scc) {
    if (visited2.has(node)) return;
    visited2.add(node);
    scc.push(node);
    for (const neighbor of (reverseAdj.get(node) || [])) {
      dfs2(neighbor, scc);
    }
  }

  for (let i = order.length - 1; i >= 0; i--) {
    const node = order[i];
    if (!visited2.has(node)) {
      const scc = [];
      dfs2(node, scc);
      sccs.push(scc);
    }
  }

  return sccs;
}

function topoSortSCCs(sccs, adjList) {
  const nodeToScc = new Map();
  sccs.forEach((scc, i) => scc.forEach(f => nodeToScc.set(f, i)));

  const sccAdj = new Map();
  sccs.forEach((_, i) => sccAdj.set(i, new Set()));

  for (const [from, tos] of adjList) {
    const fromScc = nodeToScc.get(from);
    for (const to of tos) {
      const toScc = nodeToScc.get(to);
      if (fromScc !== undefined && toScc !== undefined && fromScc !== toScc) {
        sccAdj.get(fromScc).add(toScc);
      }
    }
  }

  const inDegree = new Map();
  sccs.forEach((_, i) => inDegree.set(i, 0));
  for (const [, neighbors] of sccAdj) {
    for (const n of neighbors) {
      inDegree.set(n, (inDegree.get(n) || 0) + 1);
    }
  }

  const queue = [];
  for (const [i, deg] of inDegree) {
    if (deg === 0) queue.push(i);
  }

  const sorted = [];
  while (queue.length) {
    const cur = queue.shift();
    sorted.push(cur);
    for (const neighbor of sccAdj.get(cur)) {
      const newDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return sorted.map(i => sccs[i]);
}

function hashFile(absPath) {
  const data = fs.readFileSync(absPath);
  return crypto.createHash('sha1').update(data).digest('hex').slice(0, 10);
}

function updateUrlInContent(rawUrl, fromFile, hashCache, sccSet) {
  if (shouldSkipUrl(rawUrl)) return rawUrl;

  const [withoutHash, hashFragment = ''] = rawUrl.split('#', 2);
  const [pathname, query = ''] = withoutHash.split('?', 2);
  if (!pathname || !pathname.includes('.')) return rawUrl;

  const ext = path.extname(pathname).toLowerCase();
  if (!assetExtensions.has(ext)) return rawUrl;

  const candidates = resolvePathnameToAbsolute(pathname, fromFile);
  const target = candidates.find(c => fs.existsSync(c) && fs.statSync(c).isFile());
  if (!target) return rawUrl;

  if (sccSet && sccSet.has(target)) return rawUrl;

  const hash = hashCache.get(target) ?? hashFile(target);
  hashCache.set(target, hash);

  const params = new URLSearchParams(query);
  params.set('v', hash);
  return `${pathname}?${params.toString()}${hashFragment ? '#' + hashFragment : ''}`;
}

function rewriteFile(absPath, hashCache, sccSet = null) {
  const original = fs.readFileSync(absPath, 'utf8');

  let updated = original.replace(QUOTED_ASSET_URL_REGEX, (full, quote, rawUrl, _closing, offset) => {
    if (shouldIgnoreStampedMatch(original, offset)) return full;
    if (shouldSkipJsLogicalPath(original, offset, absPath)) return full;
    const next = updateUrlInContent(rawUrl, absPath, hashCache, sccSet);
    return `${quote}${next}${quote}`;
  });

  if (path.extname(absPath).toLowerCase() === '.css') {
    updated = updated.replace(CSS_ASSET_URL_REGEX, (full, quote, rawUrl) => {
      const next = updateUrlInContent(rawUrl.trim(), absPath, hashCache, sccSet);
      return `url(${quote}${next}${quote})`;
    });
  }

  if (updated !== original) {
    fs.writeFileSync(absPath, updated, 'utf8');
    return true;
  }

  return false;
}

function collectUnresolvedReferences(absPaths) {
  const { repoRoot } = getBuildConfig();
  const unresolved = new Map();

  for (const absPath of absPaths) {
    const content = fs.readFileSync(absPath, 'utf8');

    for (const { rawUrl } of extractUrlsFromContent(content, absPath)) {
      const pathname = pathnameFromRawUrl(rawUrl);
      if (!pathname) continue;
      const candidates = resolvePathnameToAbsolute(pathname, absPath);
      const resolved = candidates.some(c => fs.existsSync(c) && fs.statSync(c).isFile());
      if (resolved) continue;
      const key = toPosix(absPath) + ' -> ' + rawUrl;
      unresolved.set(key, { absPath, rawUrl });
    }
  }

  return [...unresolved.values()].sort((a, b) =>
      a.absPath.localeCompare(b.absPath) || a.rawUrl.localeCompare(b.rawUrl)
  );
}

function main() {
  const { repoRoot, managedRoots, managedFiles } = getBuildConfig();

  if (managedRoots.some(r => !fs.existsSync(r)) || managedFiles.some(f => !fs.existsSync(f))) {
    console.error('Missing one or more managed app paths.');
    process.exit(1);
  }

  const allFiles = [
    ...managedFiles,
    ...managedRoots.flatMap(root => walk(root)),
  ];

  const managedAbsPaths = allFiles
      .map(f => path.resolve(f))
      .filter(shouldManageTextFile)
      .sort();

  const managedSet = new Set(managedAbsPaths);

  const adjList = new Map();
  for (const f of managedAbsPaths) {
    adjList.set(f, collectManagedDeps(f, managedSet));
  }

  const sccs = findSCCs(managedAbsPaths, adjList);
  const sortedSCCs = topoSortSCCs(sccs, adjList);

  const cycles = sortedSCCs.filter(scc => scc.length > 1);
  if (cycles.length > 0) {
    console.warn('Cyclic dependencies detected (will be resolved iteratively):');
    for (const scc of cycles) {
      const names = scc.map(f => toPosix(path.relative(repoRoot, f))).join(', ');
      console.warn(`  cycle: [${names}]`);
    }
  }

  const hashCache = new Map();
  let totalChangedFiles = 0;

  for (const scc of sortedSCCs) {
    if (scc.length === 1) {
      const [f] = scc;
      hashCache.delete(f);
      if (rewriteFile(f, hashCache)) totalChangedFiles++;
      hashCache.set(f, hashFile(f));
    } else {
      const sccSet = new Set(scc);
      for (const f of scc) hashCache.delete(f);
      for (const f of scc) {
        if (rewriteFile(f, hashCache, sccSet)) totalChangedFiles++;
      }
      for (const f of scc) {
        hashCache.set(f, hashFile(f));
      }
    }
  }

  console.log(`app cache stamping complete. Total changed files: ${totalChangedFiles}.`);

  const unresolved = collectUnresolvedReferences(managedAbsPaths);
  if (unresolved.length > 0) {
    console.warn('Unresolved asset references:');
    for (const { absPath, rawUrl } of unresolved) {
      console.warn(`  ${toPosix(path.relative(repoRoot, absPath))}: ${rawUrl}`);
    }
  }
}

module.exports = { main };

if (require.main === module) {
  main();
}