import type { Category, GuideEntry, PlaySession } from './types';
import { canRead } from './recommendations';
import mediaManifest from '../data/library-media.json';

export type LibraryMode = 'Subjects' | 'Guides' | 'All';
export const HOME_LANDSCAPES = [
    { id: 'leonida-keys', photoIndex: 0 },
    { id: 'vice-city', photoIndex: 2 },
    { id: 'grassrivers', photoIndex: 1 },
    { id: 'mount-kalaga', photoIndex: 3 },
];
type Subject = {
    kind: 'Person' | 'Location' | 'Vehicle' | 'Weapon' | 'Collectible';
    name?: string;
    aliases: string[];
    location?: string;
    acquisition?: string;
    relatedIds?: string[];
};

const SUBJECTS: Record<string, Subject> = {
    'vice-city': { kind: 'Location', aliases: [] },
    'leonida-keys': { kind: 'Location', aliases: ['the Keys'] },
    grassrivers: { kind: 'Location', aliases: [] },
    'port-gellhorn': { kind: 'Location', aliases: [], relatedIds: ['reddit-playbook-vehicle-ownership'] },
    ambrosia: { kind: 'Location', aliases: [] },
    'mount-kalaga': { kind: 'Location', aliases: ['Mt Kalaga'] },
    'jason-duval': { kind: 'Person', aliases: ['Jason'], location: 'Leonida Keys', relatedIds: ['lucia-caminos', 'brian-heder', 'leonida-keys'] },
    'lucia-caminos': { kind: 'Person', aliases: ['Lucia'], relatedIds: ['jason-duval'] },
    'cal-hampton': { kind: 'Person', aliases: ['Cal'] },
    'boobie-ike': { kind: 'Person', aliases: ['Boobie'] },
    'dre-quan-priest': { kind: 'Person', aliases: ['Dre Quan', 'Drequan'] },
    'real-dimez': { kind: 'Person', aliases: [] },
    'raul-bautista': { kind: 'Person', aliases: ['Raul'] },
    'brian-heder': { kind: 'Person', aliases: ['Brian', 'boatyard operator'], location: 'Leonida Keys', relatedIds: ['jason-duval', 'leonida-keys', 'reddit-playbook-brian-meetings'] },
    'reddit-moses-futo': { kind: 'Vehicle', name: 'Karin Futo', aliases: ['Futo', 'Karin', 'Moses car'], acquisition: 'A community video covers finding a Karin Futo for a Moses request. Exact spawn conditions, ownership requirements and payouts are not established in this catalog.', relatedIds: ['port-gellhorn', 'reddit-playbook-vehicle-ownership'] },
};

type MediaSubject = { id: string; title: string; kind: Subject['kind']; createEntry?: boolean; vehicleClass?: string };
const mediaSubjects = mediaManifest as MediaSubject[];

export const LOCAL_MEDIA_GUIDES: GuideEntry[] = mediaSubjects.filter(subject => subject.createEntry).map((subject): GuideEntry => ({
    id: subject.id,
    title: subject.title,
    category: subject.kind === 'Weapon' ? 'Weapons' : subject.kind === 'Vehicle' ? 'Vehicles' : subject.kind === 'Person' ? 'People' : 'Places',
    summary: 'Visual reference from the supplied screenshot set.',
    body: `The supplied image set is labeled ${subject.title}. Identification is based on the supplied filenames, not independent in-game verification. Edition wording in those filenames does not establish availability, purchase requirements or ownership.`,
    region: '', sourceType: 'community', sourceUrl: null, sourceLabel: 'User-supplied screenshots',
    spoiler: false, tags: [subject.title, subject.kind, 'screenshot', ...(subject.vehicleClass ? [subject.vehicleClass] : [])],
    steps: [], access: 'general', confidence: 'reported', vehicleClass: subject.vehicleClass,
}));

export function getSubject(entry: GuideEntry): Subject | null {
    if (Object.hasOwn(SUBJECTS, entry.id)) return SUBJECTS[entry.id];
    const media = mediaSubjects.find(subject => subject.id === entry.id);
    return media ? { kind: media.kind, aliases: [] } : null;
}

export function libraryTitle(entry: GuideEntry): string {
    return getSubject(entry)?.name ?? entry.title;
}

function normalize(value: string): string {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
        .replace(/['\u2018\u2019]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

type LibraryOptions = {
    session: PlaySession;
    spoilers: boolean;
    query?: string;
    mode?: LibraryMode;
    category?: Category | 'All';
    vehicleClass?: string;
    savedOnly?: boolean;
    favorites?: ReadonlySet<string>;
};

export function searchLibrary(entries: GuideEntry[], options: LibraryOptions): GuideEntry[] {
    const query = normalize(options.query ?? '');
    const terms = query.split(' ').filter(Boolean);
    return entries.filter(entry => entry.sourceType !== 'template' && canRead(entry, options.session, options.spoilers))
        .filter(entry => !options.savedOnly || options.favorites?.has(entry.id))
        .filter(entry => !options.category || options.category === 'All' || entry.category === options.category)
        .filter(entry => options.category !== 'Vehicles' || !options.vehicleClass || options.vehicleClass === 'All' || entry.vehicleClass === options.vehicleClass)
        .filter(entry => !options.mode || options.mode === 'All' || (options.mode === 'Subjects' ? Boolean(getSubject(entry)) : !getSubject(entry)))
        .map(entry => {
            const subject = getSubject(entry);
            const title = normalize(libraryTitle(entry));
            const aliases = subject?.aliases.map(normalize) ?? [];
            const haystack = normalize([title, ...aliases, subject?.kind, subject?.location, subject?.acquisition, entry.title, entry.category, entry.summary, entry.body, entry.region, ...entry.tags, entry.vehicleClass, entry.stage].join(' '));
            const matches = terms.every(term => haystack.includes(term));
            const score = !query ? 0 : title === query ? 400 : aliases.includes(query) ? 350 : title.startsWith(query) ? 300 : title.includes(query) ? 200 : terms.every(term => title.includes(term)) ? 150 : 0;
            return { entry, matches, score };
        })
        .filter(result => result.matches)
        .sort((first, second) => second.score - first.score || libraryTitle(first.entry).localeCompare(libraryTitle(second.entry), 'en') || first.entry.id.localeCompare(second.entry.id))
        .map(result => result.entry);
}

export function relatedLibraryEntries(entry: GuideEntry, entries: GuideEntry[], session: PlaySession, spoilers: boolean): GuideEntry[] {
    const relatedIds = getSubject(entry)?.relatedIds ?? [];
    return relatedIds.flatMap(id => {
        const related = entries.find(candidate => candidate.id === id);
        return related && related.id !== entry.id && related.sourceType !== 'template' && canRead(related, session, spoilers) ? [related] : [];
    });
}