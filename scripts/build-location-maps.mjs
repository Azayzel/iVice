import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const code = ts.transpileModule(readFileSync(join(root, 'src/locations.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', code)(name => { assert.equal(name, './recommendations'); return {} }, mod, mod.exports);
const maps = mod.exports.LOCATION_MAPS;
const check = process.argv.includes('--check');
const directory = join(root, 'data/location-maps');
if (!check) mkdirSync(directory, { recursive: true });
assert.equal(new Set(maps.map(map => map.id)).size, maps.length);
const records = [];
for (const map of maps) {
    assert.match(map.id, /^[a-z0-9-]+$/);
    assert.match(map.image, /^[a-z0-9]+\/image-\d+\.jpg$/);
    const input = readFileSync(join(root, 'data/community-media', map.image));
    const dimensions = await sharp(input).metadata();
    const crop = map.crop;
    assert.ok(crop.left >= 0 && crop.top >= 0 && crop.width > 0 && crop.height > 0);
    assert.ok(crop.left + crop.width <= 1.000001 && crop.top + crop.height <= 1.000001);
    const left = Math.floor(dimensions.width * crop.left);
    const top = Math.floor(dimensions.height * crop.top);
    const width = Math.min(dimensions.width - left, Math.floor(dimensions.width * crop.width));
    const height = Math.min(dimensions.height - top, Math.floor(dimensions.height * crop.height));
    const hash = createHash('sha256').update(input).update(JSON.stringify(crop)).update('map-jpeg-v1').digest('hex').slice(0, 20);
    const image = `${hash}.jpg`;
    const thumb = `${hash}-thumb.jpg`;
    if (!check) {
        await sharp(input).extract({ left, top, width, height }).jpeg({ quality: 92 }).toFile(join(directory, image));
        await sharp(input).extract({ left, top, width, height }).resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(join(directory, thumb));
    }
    for (const name of [image, thumb]) assert.ok(existsSync(join(directory, name)), `Missing ${name}; run npm run maps`);
    const actual = await sharp(join(directory, image)).metadata();
    assert.equal(actual.width, width);
    assert.equal(actual.height, height);
    const thumbnail = await sharp(join(directory, thumb)).metadata();
    assert.ok(thumbnail.width <= 320 && thumbnail.height <= 320);
    records.push(`    ${JSON.stringify(map.id)}: { source: require('../data/location-maps/${image}'), thumbnail: require('../data/location-maps/${thumb}'), label: ${JSON.stringify(map.title)}, original: ${JSON.stringify(map.image)}, aspectRatio: ${width / height} }`);
}
const output = `import type { LibraryPhoto } from './library-media.generated';\n\nexport const LOCATION_MAP_IMAGES: Record<string, LibraryPhoto & { aspectRatio: number }> = {\n${records.join(',\n')}\n};\n`;
const registry = join(root, 'src/location-maps.generated.ts');
if (check) assert.equal(readFileSync(registry, 'utf8'), output, 'Map registry is stale; run npm run maps');
else writeFileSync(registry, output);
console.log(`${check ? 'Verified' : 'Built'} ${maps.length} source map crops and thumbnails.`);