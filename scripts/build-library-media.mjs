import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = join(root, 'data/GTAVI_Screenshots');
const outputRoot = join(root, 'data/library-images');
const manifest = JSON.parse(await readFile(join(root, 'data/library-media.json'), 'utf8'));
const check = process.argv.includes('--check');
const ids = new Set();
const files = new Set();
let originalBytes = 0;
let optimizedBytes = 0;
const registry = [];
if (!check) await mkdir(outputRoot, { recursive: true });

for (const subject of manifest) {
    assert.match(subject.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(subject.id), `Duplicate subject: ${subject.id}`);
    ids.add(subject.id);
    const folder = resolve(sourceRoot, subject.folder);
    assert.ok(folder === sourceRoot || folder.startsWith(sourceRoot + sep));
    const names = (await readdir(folder)).filter(name => /\.jpe?g$/i.test(name) && (!subject.prefix || name.startsWith(subject.prefix))).sort();
    assert.ok(names.length, `No screenshots for ${subject.id}`);
    const photos = [];
    for (const name of names) {
        const sourcePath = join(folder, name);
        const buffer = await readFile(sourcePath);
        const hash = createHash('sha256').update('ivice-jpeg-1440-q80-thumb360-q75-v1').update(buffer).digest('hex').slice(0, 20);
        const photo = `${hash}.jpg`;
        const thumbnail = `${hash}-thumb.jpg`;
        if (!files.has(hash)) {
            if (!check) {
                await sharp(buffer).rotate().resize({ width: 1440, height: 1440, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(join(outputRoot, photo));
                await sharp(buffer).rotate().resize({ width: 360, height: 360, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75, mozjpeg: true }).toFile(join(outputRoot, thumbnail));
            }
            const metadata = await sharp(join(outputRoot, photo)).metadata();
            assert.ok(metadata.width > 0 && metadata.width <= 1440 && metadata.height > 0 && metadata.height <= 1440);
            assert.ok(!metadata.exif && !metadata.xmp, `Unexpected private metadata in ${photo}`);
            originalBytes += buffer.length;
            optimizedBytes += (await stat(join(outputRoot, photo))).size + (await stat(join(outputRoot, thumbnail))).size;
            files.add(hash);
        }
        photos.push(`{ source: require('../data/library-images/${photo}'), thumbnail: require('../data/library-images/${thumbnail}'), label: ${JSON.stringify(subject.title + ' / ' + name)}, original: ${JSON.stringify(relative(sourceRoot, sourcePath).split(sep).join('/'))} }`);
    }
    registry.push(`    ${JSON.stringify(subject.id)}: [\n        ${photos.join(',\n        ')}\n    ]`);
}
const generated = `export type LibraryPhoto = { source: number; thumbnail: number; label: string; original: string };\nexport const LIBRARY_MEDIA: Record<string, LibraryPhoto[]> = {\n${registry.join(',\n')}\n};\n`;
const registryPath = join(root, 'src/library-media.generated.ts');
if (check) assert.equal(await readFile(registryPath, 'utf8'), generated, 'Media registry is stale; run npm run media');
else { await mkdir(dirname(registryPath), { recursive: true }); await writeFile(registryPath, generated); }
console.log(`${check ? 'Verified' : 'Built'} ${files.size} photos for ${ids.size} subjects: ${(originalBytes / 1048576).toFixed(1)} MB originals, ${(optimizedBytes / 1048576).toFixed(1)} MB optimized + thumbnails.`);