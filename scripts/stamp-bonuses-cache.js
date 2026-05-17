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
const JS_NON_ASSET_PATH_CONTEXT_REGEX = /(?:^|[\s{(,;])(?:[_$a-zA-Z][\w$]*BasePath|[_$a-zA-Z][\w$]*BaseUrl|[_$A-Z][A-Z0-9_]*BASE_PATH|[_$A-Z][A-Z0-9_]*BASE_URL|assetBasePath|_asset_base_path)\s*(?::|=)\s*$/;

function getRepoRoot() {
  return process.cwd();
}

function getBuildConfig(repoRoot = getRepoRoot()) {
  return loadCacheStampBuildConfig(repoRoot);
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

function isManagedAssetUrl(rawUrl, fromFile) {
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

function stripVersionParam(rawUrl, fromFile) {
  if (!isManagedAssetUrl(rawUrl, fromFile)) return rawUrl;

  const [withoutHash, hashFragment = ''] = rawUrl.split('#', 2);
  const [pathname, query = ''] = withoutHash.split('?', 2);
  const params = new URLSearchParams(query);
  params.delete('v');
  const nextQuery = params.toString();
  return `${pathname}${nextQuery ? `?${nextQuery}` : ''}${hashFragment ? `#${hashFragment}` : ''}`;
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

function normalizeManagedAssetUrls(content, fromFile) {
  let normalized = content.replace(QUOTED_ASSET_URL_REGEX, (full, quote, rawUrl, _closingQuote, offset) => {
    if (shouldIgnoreStampedMatch(content, offset)) return full;
    if (shouldSkipJsLogicalPath(content, offset, fromFile)) return full;
    return `${quote}${stripVersionParam(rawUrl, fromFile)}${quote}`;
  });

  if (path.extname(fromFile).toLowerCase() === '.css') {
    normalized = normalized.replace(CSS_ASSET_URL_REGEX, (full, quote, rawUrl) => {
      return `url(${quote}${stripVersionParam(rawUrl.trim(), fromFile)}${quote})`;
    });
  }

  return normalized;
}

function hashFile(filePath) {
  if (textExtensions.has(path.extname(filePath).toLowerCase())) {
    const content = fs.readFileSync(filePath, 'utf8');
    const normalizedContent = normalizeManagedAssetUrls(content, filePath);
    return crypto.createHash('sha1').update(normalizedContent, 'utf8').digest('hex').slice(0, 10);
  }

  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha1').update(data).digest('hex').slice(0, 10);
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

  if (!absoluteTarget) {
    return rawUrl;
  }

  const hash = hashCache.get(absoluteTarget) ?? hashFile(absoluteTarget);
  hashCache.set(absoluteTarget, hash);

  const params = new URLSearchParams(query);
  params.set('v', hash);
  const nextQuery = params.toString();
  return `${pathname}?${nextQuery}${hashFragment ? `#${hashFragment}` : ''}`;
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

  let pass = 0;
  let totalChangedFiles = 0;

  while (pass < 10) {
    pass += 1;
    const hashCache = new Map();
    let changedThisPass = 0;

    for (const filePath of files) {
      if (rewriteFile(filePath, hashCache)) {
        changedThisPass += 1;
      }
    }

    totalChangedFiles += changedThisPass;
    if (changedThisPass === 0) {
      console.log(`app cache stamping complete after ${pass} pass(es).`);
      printUnresolvedReferences(files);
      return;
    }
  }

  console.error(`app cache stamping did not converge after ${pass} passes; changed files across passes: ${totalChangedFiles}.`);
  process.exit(1);
}

module.exports = {
  main,
};

if (require.main === module) {
  main();
}
