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

function getRepoRoot() {
  return process.cwd();
}

let _buildConfig = null;
function getBuildConfig(repoRoot = getRepoRoot()) {
  if (!_buildConfig) _buildConfig = loadCacheStampBuildConfig(repoRoot);
  return _buildConfig;
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function shouldManageTextFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!textExtensions.has(extension)) return false;

  const { excludedFiles, excludedSuffixes, repoRoot } = getBuildConfig();
  const normalizedPath = toPosix(path.relative(repoRoot, filePath));
  if (excludedFiles.has(normalizedPath)) return false;
  if (excludedSuffixes.some(suffix => normalizedPath.endsWith(suffix))) return false;

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

function resolveCandidateTargets(fromFile, pathname) {
  const repoRoot = getRepoRoot();
  const { managedRoots } = getBuildConfig(repoRoot);
  const candidateTargets = [];

  if (pathname.startsWith('/')) {
    candidateTargets.push(path.resolve(repoRoot, `.${pathname}`));
    return candidateTargets;
  }

  candidateTargets.push(path.resolve(path.dirname(fromFile), pathname));

  for (const root of managedRoots) {
    if (fromFile === root || fromFile.startsWith(root + path.sep)) {
      candidateTargets.push(path.resolve(root, pathname));
    }
  }

  return candidateTargets;
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

function isJavaScriptLikeFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return extension === '.js' || extension === '.mjs';
}

function shouldSkipJsLogicalPath(content, index, fromFile) {
  if (!isJavaScriptLikeFile(fromFile)) return false;
  const prefix = content.slice(Math.max(0, index - 160), index);
  return JS_NON_ASSET_PATH_CONTEXT_REGEX.test(prefix);
}

// Collect all managed dependencies of a file (only those present in managedSet)
function collectManagedDeps(filePath, managedSet) {
  const ext = path.extname(filePath).toLowerCase();
  if (!textExtensions.has(ext)) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  const deps = new Set();

  const processUrl = (rawUrl, offset) => {
    if (shouldSkipUrl(rawUrl)) return;
    if (offset !== undefined && shouldIgnoreStampedMatch(content, offset)) return;
    if (offset !== undefined && shouldSkipJsLogicalPath(content, offset, filePath)) return;

    const [withoutHash] = rawUrl.split('#', 2);
    const [pathname] = withoutHash.split('?', 2);
    if (!pathname || !pathname.includes('.')) return;

    const depExt = path.extname(pathname).toLowerCase();
    if (!assetExtensions.has(depExt)) return;

    const candidates = resolveCandidateTargets(filePath, pathname);
    const target = candidates.find(c => managedSet.has(c));
    if (target) deps.add(target);
  };

  for (const match of content.matchAll(QUOTED_ASSET_URL_REGEX)) {
    processUrl(match[2], match.index);
  }

  if (ext === '.css') {
    for (const match of content.matchAll(CSS_ASSET_URL_REGEX)) {
      processUrl(match[2]);
    }
  }

  return [...deps];
}

// Kosaraju's algorithm for finding strongly connected components
function findSCCs(files, adjList) {
  const visited = new Set();
  const order = []; // finish order

  // Forward DFS
  function dfs1(node) {
    if (visited.has(node)) return;
    visited.add(node);
    for (const neighbor of (adjList.get(node) || [])) {
      dfs1(neighbor);
    }
    order.push(node);
  }

  for (const f of files) dfs1(f);

  // Build reverse graph
  const reverseAdj = new Map();
  for (const f of files) reverseAdj.set(f, []);
  for (const [from, tos] of adjList) {
    for (const to of tos) {
      if (!reverseAdj.has(to)) reverseAdj.set(to, []);
      reverseAdj.get(to).push(from);
    }
  }

  // Reverse DFS in decreasing finish order
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

// Topological sort of SCCs (leaves first)
function topoSortSCCs(sccs, adjList) {
  // Build inter-SCC graph
  const nodeToScc = new Map();
  sccs.forEach((scc, i) => scc.forEach(f => nodeToScc.set(f, i)));

  const sccAdj = new Map();
  sccs.forEach((_, i) => sccAdj.set(i, new Set()));

  for (const [from, tos] of adjList) {
    const fromScc = nodeToScc.get(from);
    for (const to of tos) {
      const toScc = nodeToScc.get(to);
      if (fromScc !== toScc) {
        sccAdj.get(fromScc).add(toScc);
      }
    }
  }

  // Topological sort of SCC graph
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

  // Return files in topological order (leaves first)
  return sorted.map(i => sccs[i]);
}

function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha1').update(data).digest('hex').slice(0, 10);
}

function isManagedAssetUrl(rawUrl, fromFile, managedSet) {
  if (shouldSkipUrl(rawUrl)) return false;

  const [withoutHash] = rawUrl.split('#', 2);
  const [pathname] = withoutHash.split('?', 2);
  if (!pathname || !pathname.includes('.')) return false;

  const ext = path.extname(pathname).toLowerCase();
  if (!assetExtensions.has(ext)) return false;

  return resolveCandidateTargets(fromFile, pathname).some(candidate =>
      fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );
}

function updateUrlVersion(rawUrl, fromFile, hashCache) {
  if (shouldSkipUrl(rawUrl)) return rawUrl;

  const [withoutHash, hashFragment = ''] = rawUrl.split('#', 2);
  const [pathname, query = ''] = withoutHash.split('?', 2);
  if (!pathname || !pathname.includes('.')) return rawUrl;

  const ext = path.extname(pathname).toLowerCase();
  if (!assetExtensions.has(ext)) return rawUrl;

  const candidateTargets = resolveCandidateTargets(fromFile, pathname);
  const absoluteTarget = candidateTargets.find(candidate =>
      fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );

  if (!absoluteTarget) return rawUrl;

  const hash = hashCache.get(absoluteTarget) ?? hashFile(absoluteTarget);
  hashCache.set(absoluteTarget, hash);

  const params = new URLSearchParams(query);
  params.set('v', hash);
  return `${pathname}?${params.toString()}${hashFragment ? `#${hashFragment}` : ''}`;
}

function rewriteQuotedUrls(content, fromFile, hashCache) {
  return content.replace(QUOTED_ASSET_URL_REGEX, (full, quote, rawUrl, _closingQuote, offset) => {
    if (shouldIgnoreStampedMatch(content, offset)) return full;
    if (shouldSkipJsLogicalPath(content, offset, fromFile)) return full;
    const nextUrl = updateUrlVersion(rawUrl, fromFile, hashCache);
    return `${quote}${nextUrl}${quote}`;
  });
}

function rewriteCssUrls(content, fromFile, hashCache) {
  return content.replace(CSS_ASSET_URL_REGEX, (full, quote, rawUrl) => {
    const nextUrl = updateUrlVersion(rawUrl.trim(), fromFile, hashCache);
    return `url(${quote}${nextUrl}${quote})`;
  });
}

function rewriteFile(filePath, hashCache) {
  const original = fs.readFileSync(filePath, 'utf8');
  let updated = rewriteQuotedUrls(original, filePath, hashCache);

  if (path.extname(filePath).toLowerCase() === '.css') {
    updated = rewriteCssUrls(updated, filePath, hashCache);
  }

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    return true;
  }

  return false;
}

function collectUnresolvedReferences(files) {
  const unresolved = new Map();
  const regex = /(['"])((?:\/|(?:\.\.?\/))?[^"'`\s\r\n]*?\.[a-zA-Z0-9]+(?:\?[^"'`\s\r\n]*)?)(\1)|url\((['"]?)([^)'"\s\r\n]+(?:\?[^)'"\s\r\n]*)?)\4\)/g;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (shouldIgnoreStampedMatch(content, match.index)) continue;
      if (shouldSkipJsLogicalPath(content, match.index, filePath)) continue;
      const rawUrl = match[2] ?? match[5];
      if (shouldSkipUrl(rawUrl)) continue;

      const [withoutHash] = rawUrl.split('#', 2);
      const [pathname] = withoutHash.split('?', 2);
      if (!pathname || !pathname.includes('.')) continue;

      const ext = path.extname(pathname).toLowerCase();
      if (!assetExtensions.has(ext)) continue;

      const candidateTargets = resolveCandidateTargets(filePath, pathname);
      const resolved = candidateTargets.some(candidate =>
          fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      );

      if (resolved) continue;

      const key = `${toPosix(filePath)} -> ${rawUrl}`;
      unresolved.set(key, { filePath, rawUrl });
    }
  }

  return [...unresolved.values()].sort((a, b) =>
      a.filePath.localeCompare(b.filePath) || a.rawUrl.localeCompare(b.rawUrl)
  );
}

function printUnresolvedReferences(files) {
  const repoRoot = getRepoRoot();
  const unresolved = collectUnresolvedReferences(files);
  if (!unresolved.length) return;

  console.warn('Unresolved asset references:');
  for (const entry of unresolved) {
    const relativeFile = toPosix(path.relative(repoRoot, entry.filePath));
    console.warn(`- ${relativeFile}: ${entry.rawUrl}`);
  }
}

function main() {
  const { repoRoot, managedRoots, managedFiles } = getBuildConfig();

  if (managedRoots.some(root => !fs.existsSync(root)) || managedFiles.some(filePath => !fs.existsSync(filePath))) {
    console.error('Missing one or more managed app paths.');
    process.exit(1);
  }

  const files = [...managedFiles, ...managedRoots.flatMap(root => walk(root))]
      .filter(shouldManageTextFile)
      .sort();

  const managedSet = new Set(files);

  // Build dependency graph (from -> [to, ...] means from depends on to)
  const adjList = new Map();
  for (const f of files) {
    adjList.set(f, collectManagedDeps(f, managedSet));
  }

  // Find SCCs and topologically sort them
  const sccs = findSCCs(files, adjList);
  const sortedSCCs = topoSortSCCs(sccs, adjList);

  // Log cycles
  const cycles = sortedSCCs.filter(scc => scc.length > 1);
  if (cycles.length > 0) {
    const { repoRoot } = getBuildConfig();
    console.warn('Cyclic dependencies detected (will be resolved iteratively):');
    for (const scc of cycles) {
      const names = scc.map(f => toPosix(path.relative(repoRoot, f))).join(', ');
      console.warn(`  cycle: [${names}]`);
    }
  }

  // Process SCCs from leaves to roots
  const hashCache = new Map();
  let totalChangedFiles = 0;

  for (const scc of sortedSCCs) {
    if (scc.length === 1) {
      // No cycle — rewrite and update hash
      hashCache.delete(scc[0]);
      if (rewriteFile(scc[0], hashCache)) {
        totalChangedFiles++;
      }
      hashCache.set(scc[0], hashFile(scc[0]));
    } else {
      // Cycle — single pass is enough; external deps are already stable,
      // and for files within the cycle we just need the hash to change, not be exact
      for (const f of scc) hashCache.delete(f);
      for (const f of scc) {
        if (rewriteFile(f, hashCache)) totalChangedFiles++;
      }
      for (const f of scc) hashCache.set(f, hashFile(f));
    }
  }

  console.log(`app cache stamping complete. Total changed files: ${totalChangedFiles}.`);
  printUnresolvedReferences(files);
}

module.exports = { main };

if (require.main === module) {
  main();
}