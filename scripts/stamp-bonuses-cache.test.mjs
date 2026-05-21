import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { main } = require('./stamp-bonuses-cache.js');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evi-stamp-cache-'));

function writeUtf8(relativePath, content) {
    const absolutePath = path.join(tempRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
}

try {
    writeUtf8('scripts/build-config.json', `${JSON.stringify({
        cacheStamp: {
            roots: ['bonuses', 'cards', 'generated', 'items', 'shell'],
            files: ['index.html'],
            excludeFiles: [],
            excludeSuffixes: ['.test.js', '.test.mjs']
        },
        imageAtlases: {
            manifestPath: 'generated/image-atlas-manifest.json',
            targets: [
                { id: 'bonuses', imagesDir: 'bonuses/images' },
                { id: 'items', imagesDir: 'items/images' },
                { id: 'cards', imagesDir: 'cards/images' }
            ]
        }
    }, null, 2)}\n`);

    writeUtf8('index.html', [
        '<!DOCTYPE html>',
        '<link rel="stylesheet" href="/shell/style.css?v=old">',
        '<script type="module" src="/shell/app.js?v=old"></script>',
        '',
    ].join('\n'));

    writeUtf8('shell/style.css', [
        '@import url(\'/shell/app-theme.css?v=old\');',
        '@import url(\'/cards/style.css?v=old\');',
        '@import url("/bonuses/style.css?v=old");',
        '',
    ].join('\n'));

    writeUtf8('shell/app-theme.css', [
        ':root { --app-page-background-image: url("/images/background.png?v=old"); }',
        '',
    ].join('\n'));

    writeUtf8('shell/app.js', [
        'import "/cards/module.js?v=old";',
        'import "./nested/local.js?v=old";',
        '',
    ].join('\n'));
    writeUtf8('bonuses/logical-path.js', [
        'export const logicalBasePath = "../items/items.json";',
        'export const assetBasePath = "../items/items.json";',
        'export const itemsBaseUrl = "../items/items.json";',
        'export const stampedAssetPath = "./images/pointer.png?v=old";',
        '',
    ].join('\n'));

    writeUtf8('shell/nested/local.js', 'export const marker = "nested";\n');
    writeUtf8('cards/style.css', 'body { color: #123456; }\n');
    writeUtf8('cards/module.js', 'export const section = "cards";\n');
    writeUtf8('bonuses/style.css', 'body { background: #abcdef; }\n');
    writeUtf8('bonuses/app.js', 'export const section = "bonuses";\n');
    writeUtf8('generated/image-atlas-manifest.json', JSON.stringify({
        atlases: {
            items: {
                path: '../items/images/__atlas.png'
            }
        },
        entries: {}
    }, null, 2) + '\n');
    writeUtf8('items/items.json', '[{ "id": "gold", "icon": "images/gold.png?v=old" }]\n');
    writeUtf8('bonuses/images/pointer.png', 'pointer-image');
    writeUtf8('images/background.png', 'shared-background');
    writeUtf8('items/images/gold.png', 'gold-image');
    writeUtf8('items/images/__atlas.png', 'atlas-image');

    const previousCwd = process.cwd();
    process.chdir(tempRoot);
    try {
        main();
    } finally {
        process.chdir(previousCwd);
    }

    const stampedIndex = fs.readFileSync(path.join(tempRoot, 'index.html'), 'utf8');
    const stampedShellStyle = fs.readFileSync(path.join(tempRoot, 'shell', 'style.css'), 'utf8');
    const stampedAppTheme = fs.readFileSync(path.join(tempRoot, 'shell', 'app-theme.css'), 'utf8');
    const stampedShellApp = fs.readFileSync(path.join(tempRoot, 'shell', 'app.js'), 'utf8');
    const stampedItems = fs.readFileSync(path.join(tempRoot, 'items', 'items.json'), 'utf8');
    const stampedLogicalPath = fs.readFileSync(path.join(tempRoot, 'bonuses', 'logical-path.js'), 'utf8');
    const stampedAtlasManifest = fs.readFileSync(path.join(tempRoot, 'generated', 'image-atlas-manifest.json'), 'utf8');

    assert.match(stampedIndex, /href="\/shell\/style\.css\?v=[0-9a-f]{10}"/);
    assert.match(stampedIndex, /src="\/shell\/app\.js\?v=[0-9a-f]{10}"/);
    assert.match(stampedShellStyle, /url\('\/shell\/app-theme\.css\?v=[0-9a-f]{10}'\)/);
    assert.match(stampedShellStyle, /url\('\/cards\/style\.css\?v=[0-9a-f]{10}'\)/);
    assert.match(stampedShellStyle, /url\("\/bonuses\/style\.css\?v=[0-9a-f]{10}"\)/);
    assert.match(stampedAppTheme, /url\("\/images\/background\.png\?v=[0-9a-f]{10}"\)/);
    assert.match(stampedShellApp, /import "\/cards\/module\.js\?v=[0-9a-f]{10}";/);
    assert.match(stampedShellApp, /import "\.\/nested\/local\.js\?v=[0-9a-f]{10}";/);
    assert.match(stampedItems, /"icon": "images\/gold\.png\?v=[0-9a-f]{10}"/);
    assert.match(stampedLogicalPath, /logicalBasePath = "\.\.\/items\/items\.json";/);
    assert.match(stampedLogicalPath, /assetBasePath = "\.\.\/items\/items\.json";/);
    assert.match(stampedLogicalPath, /itemsBaseUrl = "\.\.\/items\/items\.json";/);
    assert.match(stampedLogicalPath, /stampedAssetPath = "\.\/images\/pointer\.png\?v=[0-9a-f]{10}";/);
    assert.match(stampedAtlasManifest, /"\.\.\/items\/images\/__atlas\.png\?v=[0-9a-f]{10}"/);
} finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
}
