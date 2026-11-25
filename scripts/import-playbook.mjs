import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const mediaRoot = join(root, 'data/community-media');
const read = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const imports = read('data/community-media/playbook-imports.json');
const review = read('data/community-media/playbook-review.json');
const catalog = read('data/guide-catalog.json');
const downloadEnabled = process.argv.includes('--download');
assert.equal(new Set(imports.map(item => item.postId)).size, imports.length);

function download(url, path) {
    if (existsSync(path) && statSync(path).size > 0) return;
    assert.ok(downloadEnabled, `Missing asset: ${path}; run with --download`);
    const parsed = new URL(url);
    assert.ok(parsed.protocol === 'https:' && !parsed.username && !parsed.password);
    assert.ok(['i.redd.it', 'external-preview.redd.it', 'packaged-media.redd.it'].includes(parsed.hostname));
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.part`;
    try {
        execFileSync('curl', ['--fail', '--location', '--silent', '--show-error', '--max-time', '90', '--max-filesize', '150000000', url, '-o', temporary], { stdio: ['ignore', 'ignore', 'pipe'] });
        assert.ok(statSync(temporary).size > 0);
        renameSync(temporary, path);
    } finally {
        rmSync(temporary, { force: true });
    }
}

const generated = [];
let imageCount = 0;
let videoCount = 0;
for (const item of imports) {
    assert.match(item.postId, /^[a-z0-9]+$/);
    const post = review.posts.find(post => post.id === item.postId);
    assert.ok(post?.score >= review.minimumScore, `Below threshold: ${item.postId}`);
    assert.ok(item.body && item.summary && item.credit);
    const id = `reddit-playbook-${item.postId}`;
    const media = { photos: [], credit: item.credit, aspectRatio: 4 / 5 };
    const sources = (item.images ?? []).map(name => {
        assert.match(name, /^[a-z0-9]+\.(png|jpeg)$/);
        const prior = `playbook-story/${name}`;
        return { url: `https://i.redd.it/${name}`, path: existsSync(join(mediaRoot, prior)) ? prior : `${item.postId}/${name}` };
    });
    if (item.poster) sources.unshift({ url: item.poster, path: `${item.postId}/poster-original` });
    for (const [index, source] of sources.entries()) {
        const original = join(mediaRoot, source.path);
        download(source.url, original);
        const image = sharp(original);
        const dimensions = await image.metadata();
        assert.ok(dimensions.width > 0 && dimensions.height > 0);
        const display = `${item.postId}/image-${index + 1}.jpg`;
        const thumbnail = `${item.postId}/thumb-${index + 1}.jpg`;
        mkdirSync(join(mediaRoot, item.postId), { recursive: true });
        await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toFile(join(mediaRoot, display));
        await sharp(original).rotate().resize({ width: 360, height: 360, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(join(mediaRoot, thumbnail));
        media.photos.push({ source: display, thumbnail, label: `${item.title}, image ${index + 1}`, original: source.url });
        if (index === 0) media.aspectRatio = dimensions.width / dimensions.height;
        imageCount++;
    }
    assert.ok(media.photos.length, `No image or poster: ${id}`);
    if (item.video) {
        const path = `${item.postId}/video.mp4`;
        try {
            download(item.video, join(mediaRoot, path));
            assert.equal(readFileSync(join(mediaRoot, path)).toString('ascii', 4, 8), 'ftyp');
            media.video = path;
            videoCount++;
        } catch {
            console.warn(`${item.postId}: video unavailable; keeping the downloaded poster`);
        }
    }
    const entry = {
        id, title: item.title, category: item.category, summary: item.summary,
        body: item.body + (item.video && !media.video ? '\n\nOnly a still preview is available offline. Open the original source for video playback.' : ''),
        region: item.region ?? '', sourceType: 'community', sourceUrl: post.url,
        sourceLabel: `${item.credit} / GTA6_playbook`, sources: [{ label: item.credit, url: post.url }],
        spoiler: item.spoiler, tags: ['reddit', 'community', 'playbook', 'media', 'reference'], steps: [],
        access: 'unknown', stage: item.minChapter ? `Chapter ${item.minChapter}+ / source reference` : 'Community reference / access unverified',
        confidence: 'reported', ...(item.minChapter ? { minChapter: item.minChapter } : {}),
    };
    const existing = catalog.findIndex(entry => entry.id === id);
    if (existing < 0) catalog.push(entry); else catalog[existing] = entry;
    Object.assign(post, { status: 'imported', entryId: id, credit: item.credit, imageCount: media.photos.length, video: Boolean(media.video), media: media.video ? 'video-and-images' : item.poster ? 'thumbnail-only' : 'images' });
    const photoCode = media.photos.map(photo => `{ source: require(${JSON.stringify(`../data/community-media/${photo.source}`)}), thumbnail: require(${JSON.stringify(`../data/community-media/${photo.thumbnail}`)}), label: ${JSON.stringify(photo.label)}, original: ${JSON.stringify(photo.original)} }`);
    generated.push(`    ${JSON.stringify(id)}: { credit: ${JSON.stringify(media.credit)}, aspectRatio: ${media.aspectRatio}, photos: [\n        ${photoCode.join(',\n        ')}\n    ]${media.video ? `, video: require(${JSON.stringify(`../data/community-media/${media.video}`)})` : ''} }`);
    console.log(`${item.postId}: ${media.photos.length} images${media.video ? ', video' : ''}`);
}

for (const post of review.posts) {
    if (post.status === 'imported') continue;
    post.status = 'excluded';
    post.reason = post.score < review.minimumScore ? 'Below the requested displayed-score threshold' : post.id === '1y4arqz' ? 'Racing opinion thread without a concrete method' : post.id === '1y4od27' ? 'Character preference poll rather than gameplay reference' : post.id === '1xyw479' ? 'Untitled image without actionable gameplay context' : 'Meme, general discussion, news or prerelease speculation rather than a practical gameplay reference';
}
review.scanComplete = true;
review.scanBoundary = 'Top/all feed scanned through a below-50 batch; virtualized batches merged by post ID';
writeFileSync(join(root, 'src/playbook-media.generated.ts'), `import type { CommunityMedia } from './community-media';\n\nexport const PLAYBOOK_MEDIA: Record<string, CommunityMedia> = {\n${generated.join(',\n')}\n};\n`);
writeFileSync(join(root, 'data/guide-catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
writeFileSync(join(mediaRoot, 'playbook-review.json'), JSON.stringify(review, null, 2) + '\n');
const previewPath = join(root, 'docs/preview.html');
const html = readFileSync(previewPath, 'utf8');
const marker = 'const entries=';
const markerIndex = html.indexOf(marker);
const start = markerIndex + marker.length;
const end = html.indexOf('const read=', start);
assert.ok(markerIndex >= 0 && end > start);
writeFileSync(previewPath, html.slice(0, start) + JSON.stringify(catalog) + ';\n' + html.slice(end));
console.log(`Imported ${imports.length} source posts, ${imageCount} images/posters and ${videoCount} videos.`);