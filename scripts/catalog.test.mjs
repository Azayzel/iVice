import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const entries = JSON.parse(readFileSync(new URL('../data/guide-catalog.json', import.meta.url), 'utf8'));
const official = 'https://www.rockstargames.com/';
test('catalog has unique stable IDs and meaningful entries', () => {
    assert.ok(entries.length >= 35);
    assert.equal(new Set(entries.map(e => e.id)).size, entries.length);
    for (const e of entries) {
        assert.match(e.id, /^[a-z0-9-]+$/);
        assert.ok(e.title.length > 0 && e.summary.length > 0 && e.body.length > 0);
        assert.ok(['Places', 'People', 'Play Guides', 'Collections', 'Money', 'Story', 'Vehicles'].includes(e.category));
        assert.ok(['official', 'template', 'community'].includes(e.sourceType));
        assert.equal(typeof e.spoiler, 'boolean');
        assert.ok(Array.isArray(e.tags) && Array.isArray(e.steps));
        assert.equal(new Set(e.steps.map(s => s.id)).size, e.steps.length);
        for (const src of e.sources ?? []) assert.match(src.url, /^https:\/\//);
        if (e.sourceType === 'community') assert.ok(e.sources.length > 0);
        if (e.sourceType === 'official') assert.ok((e.sources ?? []).some(s => s.url.startsWith(official)));
    }
});
test('Brian Heder links Rockstar and the Fandom reference', () => {
    const brian = entries.find(e => e.id === 'brian-heder');
    assert.ok(brian);
    assert.ok(brian.sources.some(s => s.url === 'https://www.rockstargames.com/VI/only-in-leonida/brian'));
    assert.ok(brian.sources.some(s => s.url === 'https://gta.fandom.com/wiki/Brian_Heder'));
});
test('templates do not masquerade as verified discoveries', () => {
    for (const e of entries.filter(e => e.sourceType === 'template')) {
        assert.ok(e.body.length > 0);
        assert.ok(!e.sourceUrl);
    }
});

test('money, story, cars, aircraft and boats have distinct sourced pages', () => {
    for (const [category, tag] of [['Money', 'money'], ['Story', 'story'], ['Vehicles', 'cars'], ['Vehicles', 'aircraft'], ['Vehicles', 'boats']]) {
        const matches = entries.filter(e => e.category === category && e.tags.includes(tag));
        assert.ok(matches.length > 0, `${category}: ${tag}`);
        assert.ok(matches.some(e => e.sources.length >= 1));
    }
});
test('early published recommendations are not misrepresented as Rockstar-verified', () => {
    for (const e of entries.filter(e => ['Money', 'Story', 'Vehicles'].includes(e.category))) {
        assert.notEqual(e.sourceType, 'official');
        assert.ok(['reported', 'template'].includes(e.confidence));
        assert.ok(e.stage);
    }
});

test('Reddit-derived guides preserve attribution and reported confidence', () => {
    const community = entries.filter(e => e.id.startsWith('reddit-')); assert.ok(community.length >= 17);
    for (const e of community) { assert.equal(e.confidence, 'reported'); assert.equal(e.sourceType, 'community'); assert.match(e.sourceUrl, /^https:\/\/www\.reddit\.com\/r\/[^/]+\/comments\/[a-z0-9]+\//); assert.ok(e.sources.some(s => s.url === e.sourceUrl)); assert.ok(e.tags.includes('reddit')); if (e.access === 'chapter') assert.ok(e.minChapter >= 1 && e.minChapter <= 5); }
    for (const id of ['reddit-kalaga-pump', 'reddit-vice-city-nostalgia', 'reddit-chapter-one-cutoff-detail']) assert.equal(entries.find(e => e.id === id).spoiler, true);
});
test('browser and native catalogs match', () => { const preview = readFileSync(new URL('../docs/preview.html', import.meta.url), 'utf8'); const start = preview.indexOf('const entries=') + 'const entries='.length; const end = preview.indexOf('const read=', start); assert.deepEqual(JSON.parse(preview.slice(start, end).trim().replace(/;$/, '')), entries) });
test('Playbook contact research stays attributed, reported and spoiler-gated', () => {
    const contacts = entries.find(entry => entry.id === 'reddit-playbook-brian-meetings');
    assert.equal(contacts.spoiler, true);
    assert.equal(contacts.confidence, 'reported');
    assert.equal(contacts.sourceType, 'community');
    assert.match(contacts.sourceLabel, /Colty_00/);
    assert.match(contacts.sourceLabel, /Eric Smash/);
    assert.match(contacts.body, /not verified coordinates/);
    assert.equal(contacts.steps.length, 0);
    const ownership = entries.find(entry => entry.id === 'reddit-playbook-vehicle-ownership');
    assert.equal(ownership.minChapter, 2);
    assert.equal(ownership.spoiler, true);
    assert.equal(ownership.confidence, 'reported');
    assert.match(ownership.body, /does not establish which specific models qualify/);
    const van = entries.find(entry => entry.id === 'reddit-playbook-cargo-van');
    assert.equal(van.confidence, 'reported');
    assert.equal(van.minChapter, undefined);
    assert.equal(van.access, 'unknown');
    assert.match(van.sourceLabel, /Daddy_Shr00mz/);
    assert.match(van.sourceLabel, /Cyber_Cycosis/);
    assert.match(van.body, /Triangle/);
    assert.equal(van.steps.length, 0);
});

test('scored Playbook imports meet the inclusive threshold and retain provenance', () => {
    const review = JSON.parse(readFileSync(new URL('../data/community-media/playbook-review.json', import.meta.url), 'utf8'));
    const imports = JSON.parse(readFileSync(new URL('../data/community-media/playbook-imports.json', import.meta.url), 'utf8'));
    assert.equal(review.minimumScore, 50);
    assert.equal(review.scanComplete, true);
    assert.equal(new Set(review.posts.map(post => post.id)).size, review.posts.length);
    assert.equal(review.posts.filter(post => post.status === 'imported').length, imports.length);
    assert.ok(review.posts.some(post => post.score === 50 && post.status === 'imported'));
    for (const item of imports) {
        const post = review.posts.find(post => post.id === item.postId);
        assert.ok(post.score >= 50, item.postId);
        const entry = entries.find(entry => entry.id === post.entryId);
        assert.equal(entry.sourceUrl, post.url);
        assert.equal(entry.confidence, 'reported');
        assert.equal(entry.spoiler, true);
        assert.equal(entry.access, 'unknown');
        assert.equal(entry.body.startsWith(item.body), true);
        assert.ok(post.imageCount > 0);
        assert.equal(entry.steps.length, 0);
    }
    for (const post of review.posts.filter(post => post.status === 'excluded')) {
        assert.ok(post.reason);
        assert.ok(!entries.some(entry => entry.id === `reddit-playbook-${post.id}`));
    }
    assert.equal(review.posts.find(post => post.id === '1y51lth').media, 'thumbnail-only');
});
