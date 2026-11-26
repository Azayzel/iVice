import type { SQLiteDatabase } from 'expo-sqlite';
import bundled from '../data/guide-catalog.json';
import type { GuideEntry, Note, Profile, PlaySession, Chapter } from './types';

import { DEFAULT_SESSION, REGIONS } from './recommendations';
const BASE_PROFILE = 'my-first-playthrough';
const asGuide = (raw: string): GuideEntry => JSON.parse(raw) as GuideEntry;

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS play_sessions (profile_id TEXT PRIMARY KEY, chapter INTEGER NOT NULL DEFAULT 0 CHECK(chapter BETWEEN 0 AND 5), region TEXT NOT NULL DEFAULT '', last_guide_id TEXT, FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS guides (id TEXT PRIMARY KEY, payload TEXT NOT NULL, origin TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS progress (profile_id TEXT NOT NULL, guide_id TEXT NOT NULL, step_id TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(profile_id, guide_id, step_id), FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS favorites (profile_id TEXT NOT NULL, guide_id TEXT NOT NULL,
      PRIMARY KEY(profile_id, guide_id), FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE);
  `);
  await db.runAsync('INSERT OR IGNORE INTO profiles(id,name) VALUES(?,?)', BASE_PROFILE, 'My first playthrough');
  await db.runAsync('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', 'activeProfile', BASE_PROFILE);
  await db.runAsync('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', 'showSpoilers', 'false');
  for (const item of bundled) {
    await db.runAsync(`INSERT INTO guides(id,payload,origin) VALUES(?,?,'bundled')
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE guides.origin='bundled'`, item.id, JSON.stringify(item));
  }
}
export async function readGuides(db: SQLiteDatabase): Promise<GuideEntry[]> {
  const records = await db.getAllAsync<{ payload: string }>('SELECT payload FROM guides ORDER BY id');
  return records.map(x => asGuide(x.payload));
}
export async function readProfiles(db: SQLiteDatabase) { return db.getAllAsync<Profile>('SELECT id,name FROM profiles ORDER BY rowid'); }
export async function readSetting(db: SQLiteDatabase, key: string, fallback: string) {
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key=?', key))?.value ?? fallback;
}
export async function writeSetting(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value);
}
export async function addProfile(db: SQLiteDatabase, name: string) {
  const id = `save-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await db.runAsync('INSERT INTO profiles(id,name) VALUES(?,?)', id, name.trim().slice(0, 50));
  return id;
}
export async function removeProfile(db: SQLiteDatabase, id: string) {
  if (id === BASE_PROFILE) throw new Error('The original playthrough cannot be deleted');
  await db.runAsync('DELETE FROM profiles WHERE id=?', id);
}
export async function readProgress(db: SQLiteDatabase, profileId: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ guide_id: string; step_id: string }>('SELECT guide_id,step_id FROM progress WHERE profile_id=? AND done=1', profileId);
  return new Set(rows.map(x => `${x.guide_id}:${x.step_id}`));
}
export async function setProgress(db: SQLiteDatabase, profileId: string, guideId: string, stepId: string, done: boolean) {
  await db.runAsync(`INSERT INTO progress(profile_id,guide_id,step_id,done) VALUES(?,?,?,?)
    ON CONFLICT(profile_id,guide_id,step_id) DO UPDATE SET done=excluded.done`, profileId, guideId, stepId, done ? 1 : 0);
}
export async function readFavorites(db: SQLiteDatabase, profileId: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ guide_id: string }>('SELECT guide_id FROM favorites WHERE profile_id=?', profileId);
  return new Set(rows.map(x => x.guide_id));
}
export async function setFavorite(db: SQLiteDatabase, profileId: string, guideId: string, enabled: boolean) {
  if (enabled) await db.runAsync('INSERT OR IGNORE INTO favorites(profile_id,guide_id) VALUES(?,?)', profileId, guideId);
  else await db.runAsync('DELETE FROM favorites WHERE profile_id=? AND guide_id=?', profileId, guideId);
}
export async function readNotes(db: SQLiteDatabase, profileId: string): Promise<Note[]> {
  const rows = await db.getAllAsync<{ id: string; profile_id: string; title: string; body: string; created_at: string }>(
    'SELECT * FROM notes WHERE profile_id=? ORDER BY created_at DESC', profileId);
  return rows.map(x => ({ id: x.id, profileId: x.profile_id, title: x.title, body: x.body, createdAt: x.created_at }));
}
export async function addNote(db: SQLiteDatabase, profileId: string, title: string, body: string) {
  const id = `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await db.runAsync('INSERT INTO notes(id,profile_id,title,body,created_at) VALUES(?,?,?,?,?)', id, profileId, title.slice(0, 120), body.slice(0, 4000), new Date().toISOString());
}
export async function removeNote(db: SQLiteDatabase, profileId: string, id: string) {
  await db.runAsync('DELETE FROM notes WHERE id=? AND profile_id=?', id, profileId);
}

/** Remote entries are published, curator-approved guide documents only.
 *  Full-snapshot replacement removes deleted remote entries without wiping user progress or bundled reference data.
 *  Do not send profile data, notes, or progress to the API. */
export async function replaceRemoteGuides(db: SQLiteDatabase, entries: GuideEntry[]) {
  if (entries.some(item => !item.id.startsWith('vf-') || item.sourceType !== 'community'))
    throw new Error('Remote guides must be curated community entries with vf- IDs');
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("DELETE FROM guides WHERE origin='remote'");
    for (const item of entries) {
      await tx.runAsync("INSERT INTO guides(id,payload,origin) VALUES(?,?,'remote') ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE guides.origin='remote'",
        item.id, JSON.stringify(item));
    }
  });
}

export async function readSession(db: SQLiteDatabase, profileId: string): Promise<PlaySession> {
  const row = await db.getFirstAsync<{ chapter: number; region: string; last_guide_id: string | null }>('SELECT chapter,region,last_guide_id FROM play_sessions WHERE profile_id=?', profileId);
  if (!row) return { ...DEFAULT_SESSION };
  return { chapter: (Number.isInteger(row.chapter) && row.chapter >= 0 && row.chapter <= 5 ? row.chapter : 0) as Chapter, region: REGIONS.some(r => r === row.region) ? row.region : '', lastGuideId: row.last_guide_id };
}
export async function readStoryPosition(db: SQLiteDatabase, profileId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ step_id: string }>("SELECT step_id FROM progress WHERE profile_id=? AND guide_id='ivice-story-position' AND done=1", profileId);
  return row?.step_id ?? null;
}
export async function writeStoryPosition(db: SQLiteDatabase, profileId: string, jobId: string | null, session: PlaySession) {
  if (jobId !== null && !/^[a-z0-9-]{1,80}$/.test(jobId)) throw new Error('Invalid story position');
  await db.withExclusiveTransactionAsync(async tx => {
    await writeSession(tx, profileId, session);
    await tx.runAsync("DELETE FROM progress WHERE profile_id=? AND guide_id='ivice-story-position'", profileId);
    if (jobId !== null) await tx.runAsync("INSERT INTO progress(profile_id,guide_id,step_id,done) VALUES(?,'ivice-story-position',?,1)", profileId, jobId);
  });
}
export async function writeSession(db: SQLiteDatabase, profileId: string, session: PlaySession) {
  if (!Number.isInteger(session.chapter) || session.chapter < 0 || session.chapter > 5 || session.region !== '' && !REGIONS.some(r => r === session.region)) throw new Error('Invalid play session');
  await db.runAsync('INSERT INTO play_sessions(profile_id,chapter,region,last_guide_id) VALUES(?,?,?,?) ON CONFLICT(profile_id) DO UPDATE SET chapter=excluded.chapter,region=excluded.region,last_guide_id=excluded.last_guide_id', profileId, session.chapter, session.region, session.lastGuideId);
}