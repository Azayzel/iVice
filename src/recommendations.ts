import type {Chapter, GuideEntry, PlaySession} from './types';

export const REGIONS = ['Vice City','Leonida Keys','Grassrivers','Port Gellhorn','Ambrosia','Mount Kalaga'] as const;
export const DEFAULT_SESSION:PlaySession={chapter:0,region:'',lastGuideId:null};
export function chapterLabel(chapter:Chapter){return chapter===0?'Not set':`Chapter ${chapter}`}
export function isFuture(e:GuideEntry,chapter:Chapter){
 return e.minChapter!==undefined&&(chapter===0||e.minChapter>chapter);
}
/** Fail closed for explicitly later chapters and spoiler-tagged records. The catalog editor
 * must classify titles, summaries, steps and bodies, not only the title. */
export function canRead(e:GuideEntry,session:PlaySession,showSpoilers:boolean){
 return showSpoilers||(!e.spoiler&&!isFuture(e,session.chapter));
}
export function accessLabel(e:GuideEntry,session:PlaySession){
 if(e.minChapter!==undefined&&isFuture(e,session.chapter))return session.chapter===0?'Set chapter to check access':`Later · Chapter ${e.minChapter}+`;
 if(e.access==='chapter'&&e.minChapter!==undefined)return 'Chapter reached · check mission unlock';
 if(e.access==='unknown'||e.category==='Vehicles')return 'Check access in game';
 return 'General reference';
}
const unfinished=(e:GuideEntry,progress:ReadonlySet<string>)=>!e.steps.length||e.steps.some(s=>!progress.has(`${e.id}:${s.id}`));
export function recommend(entries:GuideEntry[],session:PlaySession,progress:ReadonlySet<string>,showSpoilers:boolean){
 // Spoiler override opens the library, but never changes what counts as chapter-eligible.
 const pool=entries.filter(e=>canRead(e,session,showSpoilers)&&!isFuture(e,session.chapter)&&unfinished(e,progress));
 const rank=(a:GuideEntry,b:GuideEntry)=>(b.priority??0)-(a.priority??0)||(a.title<b.title?-1:a.title>b.title?1:0);
 const pick=(category:GuideEntry['category'],predicate:(e:GuideEntry)=>boolean=()=>true)=>pool.filter(e=>e.category===category&&predicate(e)).sort(rank);
 const money=pick('Money',e=>e.access!=='unknown').slice(0,2);
 const story=pick('Story',e=>e.id!=='story-side-quests').slice(0,1);
 const optional=pick('Story',e=>e.id==='story-side-quests'||e.tags.includes('optional')).slice(0,1);
 const vehicles=pick('Vehicles');
 const rides=['Car','Aircraft','Boat'].flatMap(kind=>vehicles.filter(e=>e.vehicleClass===kind).slice(0,1));
 const nearby=session.region?pool.filter(e=>e.region===session.region&&['Places','Collections'].includes(e.category)).sort((a,b)=>Number(b.category==='Collections')-Number(a.category==='Collections')||rank(a,b)).slice(0,3):[];
 const resume=entries.find(e=>e.id===session.lastGuideId&&canRead(e,session,showSpoilers))??null;
 return {money,story,optional,rides,nearby,resume};
}
