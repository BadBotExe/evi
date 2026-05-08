#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const repoRoot = process.cwd();
const bonusesRoot = path.join(repoRoot, 'bonuses');
const textExtensions = new Set(['.html', '.js', '.json', '.css']);
const assetExtensions = new Set([
  '.html', '.js', '.json', '.css',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.otf',
]);

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

function hashFile(filePath) {
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
    rawUrl.startsWith('#') ||
    rawUrl.startsWith('/')
  );
}

function updateUrlVersion(rawUrl, fromFile, hashCache) {
  if (shouldSkipUrl(rawUrl)) return rawUrl;

  const [withoutHash, hashFragment = ''] = rawUrl.split('#', 2);
  const [pathname, query = ''] = withoutHash.split('?', 2);
  if (!pathname || !pathname.includes('.')) return rawUrl;

  const ext = path.extname(pathname).toLowerCase();
  if (!assetExtensions.has(ext)) return rawUrl;

  const candidateTargets = [
    path.resolve(path.dirname(fromFile), pathname),
  ];

  if (fromFile.startsWith(bonusesRoot + path.sep) || fromFile === bonusesRoot) {
    candidateTargets.push(path.resolve(bonusesRoot, pathname));
  }

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
  return content.replace(/(['"])((?:\.\.?\/)?[^"'`\r\n]*?\.[a-zA-Z0-9]+(?:\?[^"'`\r\n]*)?)(\1)/g, (full, quote, rawUrl) => {
    const nextUrl = updateUrlVersion(rawUrl, fromFile, hashCache);
    return `${quote}${nextUrl}${quote}`;
  });
}

function rewriteCssUrls(content, fromFile, hashCache) {
  return content.replace(/url\((['"]?)([^)'"\r\n]+(?:\?[^)'"\r\n]*)?)\1\)/g, (full, quote, rawUrl) => {
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

function main() {
  if (!fs.existsSync(bonusesRoot)) {
    console.error('Missing bonuses directory.');
    process.exit(1);
  }

  const files = walk(bonusesRoot)
    .filter(filePath => textExtensions.has(path.extname(filePath).toLowerCase()))
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
      console.log(`bonuses cache stamping complete after ${pass} pass(es).`);
      return;
    }
  }

  console.error(`bonuses cache stamping did not converge after ${pass} passes; changed files across passes: ${totalChangedFiles}.`);
  process.exit(1);
}

main();
