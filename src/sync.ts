import type {SQLiteDatabase} from 'expo-sqlite';
import type {GuideEntry} from './types';
import {replaceRemoteGuides} from './db';

const CATEGORIES=['Places','People','Play Guides','Collections','Money','Story','Vehicles'];
const TYPES=['official','community','template'];
const isHttpsSource=(url:unknown)=>url===null||(typeof url==='string' && /^https:\/\//i.test(url) && url.length<=1000);
function isGuide(value:unknown):value is GuideEntry {
  if(!value || typeof value!=='object')return false;
  const e=value as Partial<GuideEntry>;
  return typeof e.id==='string' && /^vf-[a-z0-9-]{2,96}$/.test(e.id) && e.sourceType==='community' &&
    typeof e.title==='string' && e.title.length>0 && e.title.length<=140 && typeof e.summary==='string' && e.summary.length<=500 &&
    typeof e.body==='string' && e.body.length<=8000 && CATEGORIES.includes(e.category??'') &&
    TYPES.includes(e.sourceType??'') && isHttpsSource(e.sourceUrl) && typeof e.spoiler==='boolean' &&
    Array.isArray(e.tags) && e.tags.length<=20 && e.tags.every(t=>typeof t==='string' && t.length<=50) &&
    (!e.sources || (Array.isArray(e.sources) && e.sources.length<=6 && e.sources.every(s=>typeof s.label==='string' && s.label.length<=100 && isHttpsSource(s.url) && s.url!==null))) &&
    (!e.stage || (typeof e.stage==='string' && e.stage.length<=100)) &&
    (!e.vehicleClass || (typeof e.vehicleClass==='string' && e.vehicleClass.length<=50)) &&
    (!e.recommendation || (typeof e.recommendation==='string' && e.recommendation.length<=80)) &&
    (!e.confidence || ['reported','confirmed','template'].includes(e.confidence)) &&
    Array.isArray(e.steps) && e.steps.length<=100 && e.steps.every(s=>typeof s.id==='string' && /^[a-z0-9-]{1,80}$/.test(s.id) && typeof s.label==='string' && s.label.length<=200);
}
export async function syncCatalog(db:SQLiteDatabase) {
  const base=process.env.EXPO_PUBLIC_API_URL?.trim();
  if(!base)return {status:'offline-only' as const,count:0};
  if(!/^https:\/\//.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(base))
    throw new Error('Set a secure HTTPS API URL (HTTP is local emulator only).');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try {
    const response=await fetch(`${base.replace(/\/$/,'')}/api/guides`,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`Guide sync returned HTTP ${response.status}`);
    const raw=await response.text();
    if(raw.length>2_000_000)throw new Error('Guide response too large');
    const body:unknown=JSON.parse(raw);
    if(!body || typeof body!=='object' || !('entries' in body) || !Array.isArray(body.entries))throw new Error('Invalid guide response');
    if(body.entries.length>5000 || new Set(body.entries.map((e: unknown)=>typeof e==='object' && e!==null && 'id' in e ? e.id : null)).size!==body.entries.length || !body.entries.every(isGuide))throw new Error('Unexpected guide content');
    await replaceRemoteGuides(db,body.entries);
    return {status:'synced' as const,count:body.entries.length};
  } finally {clearTimeout(timeout);}
}
