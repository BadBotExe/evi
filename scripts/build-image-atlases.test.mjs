import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import atlasLib from './lib/image-atlas.js';

const {
    buildAtlasArtifacts,
    buildAtlasEntryKey,
    buildAtlasLayout,
    buildPathIndex,
    listLeafImageDirectories,
    toPosix
} = atlasLib;

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}: expected "${expected}", got "${actual}"`);
    }
}

function assert(condition, label) {
    if (!condition) throw new Error(label);
}

function assertDeepEqual(actual, expected, label) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
        throw new Error(`${label}: expected ${expectedJson}, got ${actualJson}`);
    }
}

async function writeTinyPng(filePath, width, height) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const buffer = await sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
    }).png().toBuffer();
    fs.writeFileSync(filePath, buffer);
}

async function withTempDir(run) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evi-atlas-'));
    try {
        await run(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

async function run() {
    {
        const key = buildAtlasEntryKey('items', 'gear/act1', 'bronze_axe.png');
        assertEqual(key, 'items:gear:act1:bronze_axe', 'stable atlas entry key strips extension and normalizes folders');
    }

    {
        const layout = buildAtlasLayout([
            { key: 'a', fileName: 'a.png', width: 4, height: 4 },
            { key: 'b', fileName: 'b.png', width: 2, height: 6 },
        ], { padding: 2, maxWidth: 64 });
        assertEqual(layout.entries.length, 2, 'layout contains all entries');
        assert(layout.width >= 8 && layout.height >= 8, 'layout computes non-zero atlas bounds');
    }

    await withTempDir(async tempDir => {
        const imagesRoot = path.join(tempDir, 'items', 'images');
        const manifestDir = path.join(tempDir, 'bonuses', 'generated');
        await writeTinyPng(path.join(imagesRoot, 'gear', 'act1', 'axe.png'), 1, 1);
        await writeTinyPng(path.join(imagesRoot, 'gear', 'act1', 'sword.png'), 2, 1);
        await writeTinyPng(path.join(imagesRoot, 'gear', 'act2', 'staff.png'), 1, 2);

        const leafDirs = listLeafImageDirectories(imagesRoot).map(value => toPosix(path.relative(imagesRoot, value)));
        assertDeepEqual(leafDirs, ['gear/act1', 'gear/act2'], 'leaf image discovery returns final folders only');

        fs.mkdirSync(manifestDir, { recursive: true });
        const { manifest } = await buildAtlasArtifacts('items', imagesRoot, manifestDir, { padding: 1, maxWidth: 16 });
        const pathIndex = buildPathIndex(manifest);
        assert(pathIndex.has('items/images/gear/act1/axe.png'), 'path index contains original image source path');
        assertEqual(pathIndex.get('items/images/gear/act2/staff.png'), 'items:gear:act2:staff', 'path index maps source path to atlas entry');
        assert(fs.existsSync(path.join(imagesRoot, 'gear', 'act1', '__atlas.png')), 'png atlas file is generated');
    });

    await withTempDir(async tempDir => {
        const imagesRoot = path.join(tempDir, 'items', 'images');
        const manifestDir = path.join(tempDir, 'bonuses', 'generated');
        await writeTinyPng(path.join(imagesRoot, 'gear', 'act1', 'axe.png'), 1, 1);
        await writeTinyPng(path.join(imagesRoot, 'gear', 'act2', 'staff.png'), 1, 2);
        fs.writeFileSync(path.join(imagesRoot, 'gear', '.noatlas'), '');

        const leafDirs = listLeafImageDirectories(imagesRoot).map(value => toPosix(path.relative(imagesRoot, value)));
        assertDeepEqual(leafDirs, ['gear/act1', 'gear/act2'], 'parent .noatlas does not exclude nested leaf directories');

        fs.mkdirSync(manifestDir, { recursive: true });
        const { manifest } = await buildAtlasArtifacts('items', imagesRoot, manifestDir, { padding: 1, maxWidth: 16 });
        assertDeepEqual(Object.keys(manifest.atlases), ['items:gear:act1', 'items:gear:act2'], 'nested leaf directories still emit atlases when only parent has marker');
        assert(fs.existsSync(path.join(imagesRoot, 'gear', 'act1', '__atlas.png')), 'nested directories still emit atlas files when parent has marker');
    });

    await withTempDir(async tempDir => {
        const imagesRoot = path.join(tempDir, 'items', 'images');
        const manifestDir = path.join(tempDir, 'bonuses', 'generated');
        await writeTinyPng(path.join(imagesRoot, 'gear', 'act1', 'axe.png'), 1, 1);
        await writeTinyPng(path.join(imagesRoot, 'gear', 'act2', 'staff.png'), 1, 2);
        fs.writeFileSync(path.join(imagesRoot, 'gear', 'act1', '.noatlas'), '');

        const leafDirs = listLeafImageDirectories(imagesRoot).map(value => toPosix(path.relative(imagesRoot, value)));
        assertDeepEqual(leafDirs, ['gear/act2'], 'marker excludes only the directory where it is placed');

        fs.mkdirSync(manifestDir, { recursive: true });
        const { manifest } = await buildAtlasArtifacts('items', imagesRoot, manifestDir, { padding: 1, maxWidth: 16 });
        assertDeepEqual(Object.keys(manifest.atlases), ['items:gear:act2'], 'only marked leaf directory is excluded from atlas generation');
        assert(!fs.existsSync(path.join(imagesRoot, 'gear', 'act1', '__atlas.png')), 'marked leaf directory does not emit atlas files');
        assert(fs.existsSync(path.join(imagesRoot, 'gear', 'act2', '__atlas.png')), 'unmarked sibling directory still emits atlas files');
    });

    console.log('build-image-atlases tests passed');
}

await run();
