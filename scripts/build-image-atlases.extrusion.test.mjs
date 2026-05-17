import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import atlasLib from './lib/image-atlas.js';

const { buildAtlasArtifacts } = atlasLib;

function assertPixel(actual, expected, label) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
        throw new Error(`${label}: expected ${expectedJson}, got ${actualJson}`);
    }
}

function pixelAt(rgba, info, x, y) {
    const offset = (y * info.width + x) * info.channels;
    return Array.from(rgba.subarray(offset, offset + 4));
}

function assertTransparentOutsideExtrusion(rgba, info, entry, extrusion) {
    const minX = entry.x - extrusion;
    const minY = entry.y - extrusion;
    const maxX = entry.x + entry.width + extrusion;
    const maxY = entry.y + entry.height + extrusion;

    for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
            if (x >= minX && x < maxX && y >= minY && y < maxY) continue;
            const pixel = pixelAt(rgba, info, x, y);
            if (pixel[3] !== 0) {
                throw new Error(`unexpected non-transparent atlas pixel outside sprite extrusion at (${x}, ${y}): ${JSON.stringify(pixel)}`);
            }
        }
    }
}

async function withTempDir(run) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evi-atlas-extrusion-'));
    try {
        await run(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

async function writePatternPng(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const pixels = Buffer.from([
        255, 0, 0, 255, 0, 255, 0, 255,
        0, 0, 255, 255, 255, 255, 0, 255
    ]);
    await sharp(pixels, {
        raw: {
            width: 2,
            height: 2,
            channels: 4
        }
    }).png().toFile(filePath);
}

await withTempDir(async tempDir => {
    const imagesRoot = path.join(tempDir, 'cards', 'images');
    const manifestDir = path.join(tempDir, 'bonuses', 'generated');
    await writePatternPng(path.join(imagesRoot, 'pattern.png'));
    fs.mkdirSync(manifestDir, { recursive: true });

    const { atlases } = await buildAtlasArtifacts('cards', imagesRoot, manifestDir, {
        padding: 4,
        maxWidth: 32,
        extrusion: 2
    });

    const atlas = atlases[0];
    const entry = atlas.layout.entries[0];
    const atlasImage = sharp(atlas.pngPath);
    const { data, info } = await atlasImage.raw().toBuffer({ resolveWithObject: true });

    assertPixel(pixelAt(data, info, entry.x, entry.y), [255, 0, 0, 255], 'sprite keeps original top-left pixel');
    assertPixel(pixelAt(data, info, entry.x - 1, entry.y), [255, 0, 0, 255], 'left extrusion duplicates left edge');
    assertPixel(pixelAt(data, info, entry.x, entry.y - 1), [255, 0, 0, 255], 'top extrusion duplicates top edge');
    assertPixel(pixelAt(data, info, entry.x + entry.width, entry.y), [0, 255, 0, 255], 'right extrusion duplicates right edge');
    assertPixel(pixelAt(data, info, entry.x, entry.y + entry.height), [0, 0, 255, 255], 'bottom extrusion duplicates bottom edge');
    assertPixel(pixelAt(data, info, entry.x - 1, entry.y - 1), [255, 0, 0, 255], 'top-left corner extrusion duplicates corner pixel');
    assertPixel(pixelAt(data, info, entry.x + entry.width, entry.y + entry.height), [255, 255, 0, 255], 'bottom-right corner extrusion duplicates corner pixel');
    assertTransparentOutsideExtrusion(data, info, entry, atlas.layout.extrusion);
});

console.log('build-image-atlases extrusion tests passed');
