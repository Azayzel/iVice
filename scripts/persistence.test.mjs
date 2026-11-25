import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

// Compile the real application modules, substituting only Expo's database adapter.
// This validates SQL behavior on SQLite, not Expo's native bridge or RN rendering.
const catalog = JSON.parse(readFileSync(new URL('../data/guide-catalog.json', import.meta.url), 'utf8'));
function load(path, modules) {
    const raw = readFileSync(new URL(path, import.meta.url), 'utf8');
    const code = ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', code)(name => { if (!(name in modules)) throw Error('Unexpected import ' + name); return modules[name] }, mod, mod.exports);
    return mod.exports;
}
const rec = load('../src/recommendations.ts', {});
const mediaManifest = JSON.parse(readFileSync(new URL('../data/library-media.json', import.meta.url), 'utf8'));
const library = load('../src/library.ts', { './recommendations': rec, '../data/library-media.json': mediaManifest });
const locations = load('../src/locations.ts', { './recommendations': rec });
const chapters = load('../src/chapters.ts', {});
const api = load('../src/db.ts', { '../data/guide-catalog.json': catalog, './recommendations': rec });
const sync = load('../src/sync.ts', { './db': api });
function adapter(path = ':memory:') {
    const conn = new DatabaseSync(path);
    const db = {
        execAsync: async sql => conn.exec(sql),
        runAsync: async (sql, ...args) => conn.prepare(sql).run(...args),
        getAllAsync: async (sql, ...args) => conn.prepare(sql).all(...args),
        getFirstAsync: async (sql, ...args) => conn.prepare(sql).get(...args),
        withExclusiveTransactionAsync: async fn => { conn.exec('BEGIN IMMEDIATE'); try { await fn(db); conn.exec('COMMIT') } catch (e) { conn.exec('ROLLBACK'); throw e } },
        close: () => conn.close()
    };
    return db;
}
const original = 'my-first-playthrough';
test('location maps filter references without bypassing spoilers or inventing access', () => {
    const session = { chapter: 1, region: '', lastGuideId: null };
    const filters = locations.DEFAULT_LOCATION_FILTERS;
    const select = (overrides = {}, spoilers = true, entries = catalog, favorites = new Set()) => locations.filterLocationMaps(entries, session, spoilers, favorites, { ...filters, ...overrides });
    assert.equal(select({}, false).length, 0);
    assert.equal(select().length, locations.LOCATION_MAPS.length);
    assert.deepEqual(select({ region: 'Leonida Keys', type: 'Money' }).map(map => map.id), ['key-lento-money', 'key-lento-atms']);
    assert.ok(select({ region: 'Unknown' }).every(map => !map.region));
    assert.equal(select({ chapter: 1 }).length, 0);
    assert.equal(select({ chapter: 'Unknown' }).length, locations.LOCATION_MAPS.length);
    assert.equal(select({ savedOnly: true }).length, 0);
    assert.ok(select({ savedOnly: true }, true, catalog, new Set(['reddit-playbook-1y2v2yb'])).every(map => map.entryId === 'reddit-playbook-1y2v2yb'));
    assert.deepEqual(select({ query: 'pfister comet' }).map(map => map.id), ['pfister-88-comet']);
    const future = catalog.map(entry => entry.id === 'reddit-playbook-1y3ckve' ? { ...entry, minChapter: 3 } : entry);
    assert.equal(select({ chapter: 2 }, true, future).length, 0);
    assert.equal(select({ chapter: 3 }, true, future).length, 1);
});
test('Home landscapes use safe location entries and existing bundled photographs', () => {
    const assets = Object.fromEntries(readdirSync(new URL('../data/library-images/', import.meta.url)).map(name => [`../data/library-images/${name}`, name]));
    const photos = load('../src/library-media.generated.ts', assets).LIBRARY_MEDIA;
    assert.equal(new Set(library.HOME_LANDSCAPES.map(item => item.id)).size, library.HOME_LANDSCAPES.length);
    assert.ok(library.HOME_LANDSCAPES.length >= 3);
    for (const item of library.HOME_LANDSCAPES) {
        const entry = catalog.find(entry => entry.id === item.id);
        assert.equal(library.getSubject(entry).kind, 'Location');
        assert.ok(rec.canRead(entry, rec.DEFAULT_SESSION, false));
        assert.ok(photos[item.id][item.photoIndex].source);
    }
});
test('downloaded media is bundled against real guides and preserves spoiler filtering', () => {
    const root = new URL('../data/community-media/', import.meta.url);
    const assets = Object.fromEntries(readdirSync(root, { recursive: true }).filter(name => /\.(png|jpg|mp4)$/.test(name)).map(name => {
        assert.ok(readFileSync(new URL(name, root)).length > 0);
        return [`../data/community-media/${name}`, name];
    }));
    const batch = load('../src/playbook-media.generated.ts', assets);
    const media = load('../src/community-media.ts', { ...assets, './playbook-media.generated': batch }).COMMUNITY_MEDIA;
    assert.equal(media['reddit-playbook-brian-meetings'].photos.length, 3);
    assert.equal(media['reddit-playbook-vehicle-ownership'].photos.length, 2);
    assert.equal(media['reddit-playbook-cargo-van'].video, 'cargo-van/video.mp4');
    assert.equal(media['reddit-playbook-cargo-van'].photos[0].thumbnail, 'cargo-van/thumbnail.jpg');
    const session = { chapter: 1, region: '', lastGuideId: null };
    for (const [id, item] of Object.entries(media)) {
        const entry = catalog.find(guide => guide.id === id);
        assert.ok(entry, `Orphaned media: ${id}`);
        assert.ok(item.credit.length > 0);
        assert.equal(rec.canRead(entry, session, false), id === 'reddit-playbook-cargo-van');
        assert.ok(rec.canRead(entry, session, true));
    }
    assert.equal(library.searchLibrary(catalog, { session, spoilers: false, query: 'cargo van', mode: 'All' })[0].id, 'reddit-playbook-cargo-van');
});
test('library indexes named subjects, ranks names first and keeps guides separate', () => {
    const options = { session: { chapter: 1, region: '', lastGuideId: null }, spoilers: false };
    const subjects = library.searchLibrary(catalog, { ...options, mode: 'Subjects' });
    assert.equal(subjects.length, 14);
    assert.ok(subjects.every(entry => library.getSubject(entry)));
    assert.ok(!subjects.some(entry => entry.id === 'cars-practical-getaway'));
    assert.equal(library.searchLibrary(catalog, { ...options, query: 'Brian' })[0].id, 'brian-heder');
    assert.equal(library.searchLibrary(catalog, { ...options, query: '  BRÍAN heder  ' })[0].id, 'brian-heder');
    assert.equal(library.searchLibrary(catalog, { ...options, query: 'dre quan' })[0].id, 'dre-quan-priest');
    assert.equal(library.searchLibrary(catalog, { ...options, query: 'Mt. Kalaga' })[0].id, 'mount-kalaga');
    assert.equal(library.searchLibrary(catalog, { ...options, mode: 'Guides' }).some(entry => entry.id === 'brian-heder'), false);
    assert.deepEqual(library.searchLibrary(catalog, { ...options, savedOnly: true, favorites: new Set(['brian-heder']) }).map(entry => entry.id), ['brian-heder']);
    const hidden = { ...catalog.find(entry => entry.id === 'brian-heder'), spoiler: true };
    assert.deepEqual(library.searchLibrary([hidden], { ...options, query: 'Brian' }), []);
    assert.equal(library.searchLibrary([hidden], { ...options, spoilers: true, query: 'Brian' }).length, 1);
    const future = { ...hidden, spoiler: false, minChapter: 5, access: 'chapter' };
    assert.deepEqual(library.searchLibrary([future], { ...options, query: 'Brian' }), []);
    assert.deepEqual(library.relatedLibraryEntries(catalog.find(entry => entry.id === 'jason-duval'), [hidden], options.session, false), []);
    const combined = [...catalog, ...library.LOCAL_MEDIA_GUIDES];
    assert.equal(library.searchLibrary(combined, { ...options, mode: 'Subjects' }).length, 20);
    assert.equal(library.searchLibrary(combined, { ...options, query: 'Cheetah' })[0].id, 'media-grotti-cheetah');
    assert.equal(library.searchLibrary(combined, { ...options, category: 'Weapons' })[0].id, 'media-morgan-revolvers');
    assert.deepEqual(library.searchLibrary(combined, { ...options, category: 'Vehicles', vehicleClass: 'Boat', mode: 'Subjects' }).map(entry => entry.id), ['media-squalo']);
    assert.equal(library.searchLibrary(combined, { ...options, query: 'Futo' }).length, 0);
    assert.equal(library.libraryTitle(library.searchLibrary(combined, { ...options, spoilers: true, query: 'Futo' })[0]), 'Karin Futo');
    for (const subject of mediaManifest) assert.ok(combined.some(entry => entry.id === subject.id), `Orphaned media: ${subject.id}`);
    assert.equal(new Set(combined.map(entry => entry.id)).size, combined.length);
});
test('chapter roadmap separates requirements from optional tasks and hides mission spoilers', () => {
    assert.equal(chapters.getChapterRoadmap(0), null);
    for (const chapter of [1, 2, 3, 4, 5]) {
        const hidden = chapters.getChapterRoadmap(chapter);
        assert.equal(hidden.details, null);
        assert.equal(hidden.nextChapter, chapter === 5 ? null : chapter + 1);
        assert.equal(hidden.confidence, 'reported');
        const revealed = chapters.getChapterRoadmap(chapter, true);
        assert.match(revealed.details.sourceUrl, /^https:\/\/www\.powerpyx\.com\//);
        assert.ok(revealed.details.trigger.length > 0);
        assert.ok(revealed.details.optional.length > 0);
    }
    const chapterTwo = chapters.getChapterRoadmap(2, true);
    assert.match(chapterTwo.requirement, /\$15,000/);
    assert.match(chapterTwo.details.trigger, /Checking Out/);
    assert.ok(!chapterTwo.details.milestones.some(text => /Kyle|Billy|Bret/.test(text)));
    assert.ok(!JSON.stringify(chapters.getChapterRoadmap(1)).includes('Discharge Time'));
    assert.match(chapters.getChapterRoadmap(3, true).details.milestones[0], /Hidden Charges/);
    assert.deepEqual(chapters.getChapterRoadmap(5, true).details.milestones, []);
});
const entry = { id: 'vf-test-guide', title: 'Test guide', category: 'Money', summary: 'Summary', body: 'Body', region: 'General', sourceType: 'community', sourceUrl: 'https://example.com/source', sourceLabel: 'Source', spoiler: false, tags: ['money'], steps: [{ id: 'first', label: 'First step' }], confidence: 'reported' };
test('image-backed subjects retain bookmarks and resume across database restarts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ivice-media-'));
    const path = join(dir, 'guide.db');
    let db = adapter(path);
    try {
        await api.migrate(db);
        const subjectId = 'media-grotti-cheetah';
        await api.setFavorite(db, original, subjectId, true);
        await api.writeSession(db, original, { chapter: 1, region: '', lastGuideId: subjectId });
        db.close();
        db = adapter(path);
        await api.migrate(db);
        const entries = [...await api.readGuides(db), ...library.LOCAL_MEDIA_GUIDES];
        const session = await api.readSession(db, original);
        const favorites = await api.readFavorites(db, original);
        assert.equal(session.lastGuideId, subjectId);
        assert.deepEqual(library.searchLibrary(entries, { session, spoilers: false, savedOnly: true, favorites }).map(entry => entry.id), [subjectId]);
        assert.equal(rec.recommend(entries, session, new Set(), false).resume.id, subjectId);
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }) }
});
test('fresh launch, per-profile storage, restart, deletion and repeated migrations', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ivice-sql-')); const path = join(dir, 'guide.db'); let db = adapter(path);
    try {
        await api.migrate(db); await api.migrate(db);
        assert.equal((await api.readGuides(db)).length, catalog.length);
        const other = await api.addProfile(db, 'Second save');
        await api.setProgress(db, other, 'guide-first-hour', 'first', true);
        await api.setFavorite(db, other, 'brian-heder', true);
        await api.addNote(db, other, "Quote's note", "Some text");
        await api.writeSetting(db, 'activeProfile', other);
        assert.equal((await api.readProgress(db, original)).size, 0);
        assert.equal((await api.readFavorites(db, original)).size, 0);
        assert.equal((await api.readNotes(db, original)).length, 0);
        db.close(); db = adapter(path); await api.migrate(db);
        assert.equal(await api.readSetting(db, 'activeProfile', ''), other);
        assert.ok((await api.readProgress(db, other)).has('guide-first-hour:first'));
        assert.ok((await api.readFavorites(db, other)).has('brian-heder'));
        assert.equal((await api.readNotes(db, other))[0].title, "Quote's note");
        await api.setProgress(db, other, 'guide-first-hour', 'first', false);
        await api.setFavorite(db, other, 'brian-heder', false);
        assert.equal((await api.readProgress(db, other)).size, 0);
        assert.equal((await api.readFavorites(db, other)).size, 0);
        const note = (await api.readNotes(db, other))[0];
        await api.removeNote(db, original, note.id);
        assert.equal((await api.readNotes(db, other)).length, 1);
        await api.removeProfile(db, other);
        assert.equal((await api.readNotes(db, other)).length, 0);
        await assert.rejects(() => api.removeProfile(db, original));
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }) }
});
test('remote replacement leaves local notes, progress and bundled catalog intact', async () => {
    const db = adapter();
    try {
        await api.migrate(db); await api.setProgress(db, original, 'guide-first-hour', 'first', true); await api.addNote(db, original, 'Mine', 'Private');
        await api.replaceRemoteGuides(db, [entry]); assert.equal((await api.readGuides(db)).length, catalog.length + 1);
        await api.replaceRemoteGuides(db, []); assert.equal((await api.readGuides(db)).length, catalog.length);
        assert.equal((await api.readProgress(db, original)).size, 1); assert.equal((await api.readNotes(db, original)).length, 1);
        await assert.rejects(() => api.replaceRemoteGuides(db, [{ ...entry, id: 'brian-heder' }]));
        assert.equal((await api.readGuides(db)).length, catalog.length);
    } finally { db.close() }
});
test('remote validation rejects malformed, unsourced and duplicate-step records without throwing', () => {
    assert.equal(sync.isGuide(entry), true);
    for (const item of [null, [], { ...entry, region: [] }, { ...entry, steps: [null] }, { ...entry, sources: [null] }, { ...entry, sourceUrl: null, sources: [] }, { ...entry, sourceUrl: 'javascript:alert(1)' }, { ...entry, sourceUrl: 'https://user:pass@example.com/' }, { ...entry, steps: [entry.steps[0], entry.steps[0]] }, { ...entry, confidence: false }, { ...entry, id: 'brian-heder' }]) assert.equal(sync.isGuide(item), false, JSON.stringify(item));
});

test('chapter, region and resume persist per playthrough and cascade on deletion', async () => {
    const db = adapter(); try {
        await api.migrate(db); const other = await api.addProfile(db, 'Other save');
        assert.deepEqual(await api.readSession(db, original), rec.DEFAULT_SESSION);
        await api.writeSession(db, other, { chapter: 3, region: 'Port Gellhorn', lastGuideId: 'money-chapter-three' });
        assert.deepEqual(await api.readSession(db, other), { chapter: 3, region: 'Port Gellhorn', lastGuideId: 'money-chapter-three' });
        assert.deepEqual(await api.readSession(db, original), rec.DEFAULT_SESSION);
        await api.migrate(db); assert.equal((await api.readSession(db, other)).chapter, 3);
        await assert.rejects(() => api.writeSession(db, other, { chapter: 6, region: '', lastGuideId: null }));
        await api.removeProfile(db, other); assert.deepEqual(await api.readSession(db, other), rec.DEFAULT_SESSION);
    } finally { db.close() }
});
test('chapter filtering, spoiler opt-in, regional results, completion and resume', () => {
    const session = { chapter: 2, region: 'Port Gellhorn', lastGuideId: 'money-chapter-three' };
    const future = catalog.find(e => e.id === 'money-chapter-three'), spoiler = catalog.find(e => e.id === 'money-vault-jobs');
    assert.equal(rec.canRead(future, session, false), false); assert.equal(rec.canRead(future, session, true), true);
    assert.equal(rec.canRead(spoiler, session, false), false); assert.equal(rec.canRead(spoiler, session, true), true);
    const picks = rec.recommend(catalog, session, new Set(), false);
    assert.equal(picks.money[0].id, 'money-stolen-cars'); assert.equal(picks.resume, null);
    assert.ok(picks.nearby.some(e => e.id === 'port-gellhorn')); assert.equal(picks.rides.length, 3);
    assert.ok(picks.rides.every(e => rec.accessLabel(e, session) === 'Check access in game'));
    const full = rec.recommend(catalog, session, new Set(), true);
    assert.ok(!full.money.some(e => e.id === future.id || e.id === spoiler.id)); assert.equal(full.resume.id, future.id);
    const later = rec.recommend(catalog, { ...session, chapter: 3 }, new Set(), false); assert.equal(later.money[0].id, future.id);
    const done = new Set(future.steps.map(s => future.id + ':' + s.id)); assert.ok(!rec.recommend(catalog, { ...session, chapter: 3 }, done, false).money.some(e => e.id === future.id));
    const unset = rec.recommend(catalog, rec.DEFAULT_SESSION, new Set(), false); assert.ok(unset.money.every(e => !e.minChapter));
});
test('remote chapter and ranking metadata must be valid', () => {
    assert.equal(sync.isGuide({ ...entry, minChapter: 2, access: 'chapter', priority: 80 }), true);
    for (const extra of [{ minChapter: 0 }, { minChapter: 6 }, { access: 'chapter' }, { access: 'guaranteed' }, { priority: 101 }, { priority: 1.5 }]) assert.equal(sync.isGuide({ ...entry, ...extra }), false);
});
test('unclassified remote guides require explicit spoiler opt-in and are not recommended', () => { const g = { ...entry }; assert.equal(rec.canRead(g, rec.DEFAULT_SESSION, false), false); assert.equal(rec.canRead(g, rec.DEFAULT_SESSION, true), true); assert.equal(rec.recommend([g], rec.DEFAULT_SESSION, new Set(), true).money.length, 0) });

test('time-sensitive earlier chapter tips remain readable but stop being recommended', () => { const e = catalog.find(e => e.id === 'reddit-chapter-one-cutoff'); const early = { chapter: 1, region: 'Leonida Keys', lastGuideId: null }; const late = { ...early, chapter: 3 }; assert.ok(rec.recommend(catalog, early, new Set(), false).optional.some(x => x.id === e.id)); assert.ok(!rec.recommend(catalog, late, new Set(), true).optional.some(x => x.id === e.id)); assert.equal(rec.canRead(e, late, false), true); assert.match(rec.accessLabel(e, late), /Earlier chapter/); assert.equal(sync.isGuide({ ...entry, minChapter: 2, maxChapter: 1 }), false); assert.equal(sync.isGuide({ ...entry, minChapter: 1, maxChapter: 1 }), true) });
