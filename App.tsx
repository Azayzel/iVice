import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ActivityIndicator, Image, Linking, Modal, ScrollView, StatusBar, StyleSheet, Switch, Text as NativeText, TextInput, View, type TextProps } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { Category, GuideEntry, Profile, Tab, Chapter, PlaySession, ThemeName } from './src/types';
import { addProfile, migrate, readFavorites, readGuides, readProfiles, readSetting, removeProfile, setFavorite, writeSetting, readSession, writeSession } from './src/db';
import { syncCatalog } from './src/sync';

import { REGIONS, DEFAULT_SESSION, canRead, chapterLabel, accessLabel, recommend } from './src/recommendations';
import { THEMES, parseTheme, type Palette } from './src/themes';
import { getChapterRoadmap, getStoryJob, getStoryJobs, getStoryLinks, type StoryCharacter, type StoryJob } from './src/chapters';
import { readStoryPosition, writeStoryPosition } from './src/db';
import { getSubject, libraryTitle, searchLibrary, relatedLibraryEntries, LOCAL_MEDIA_GUIDES, HOME_LANDSCAPES, type LibraryMode } from './src/library';
import { LIBRARY_MEDIA } from './src/library-media.generated';
import { COMMUNITY_MEDIA } from './src/community-media';
import { LibraryGallery } from './src/LibraryGallery';
import { DEFAULT_LOCATION_FILTERS, LOCATION_TYPES, filterLocationMaps, type LocationFilters } from './src/locations';
import { LOCATION_MAP_IMAGES } from './src/location-maps.generated';
import { MotionProvider, MotionPressable as Pressable, ScreenTransition, useReducedMotion } from './src/motion';
const Appearance = createContext(THEMES.jason);
const FontReady = createContext(false);
const useAppearance = () => { const C = useContext(Appearance), fontsReady = useContext(FontReady); return { C, s: useMemo(() => createStyles(C, fontsReady), [C, fontsReady]) } };
function Text({ style, ...props }: TextProps) {
    const fontsReady = useContext(FontReady);
    return <NativeText {...props} style={[{ fontFamily: fontsReady ? 'Outfit_400Regular' : undefined, letterSpacing: 0 }, style]} />;
}
const TABS: Tab[] = ['Home', 'Library', 'Story', 'Settings'];
const ICONS: Record<Tab, React.ComponentProps<typeof Ionicons>['name']> = { Home: 'home-outline', Library: 'book-outline', Story: 'git-merge-outline', Settings: 'options-outline' };
const CATEGORY_ICONS: Record<Category, React.ComponentProps<typeof Ionicons>['name']> = { Places: 'map-outline', People: 'people-outline', 'Play Guides': 'compass-outline', Collections: 'albums-outline', Money: 'cash-outline', Story: 'git-merge-outline', Vehicles: 'car-sport-outline', Weapons: 'locate-outline' };
const CATEGORIES: Category[] = ['Money', 'Story', 'Vehicles', 'Places', 'People', 'Play Guides', 'Collections', 'Weapons'];
const SUBJECT_CATEGORIES: Category[] = ['People', 'Places', 'Vehicles', 'Weapons', 'Collections'];
const CATEGORY_COLORS: Record<Category, string> = { Money: '#89D6A7', Story: '#F4A38F', Vehicles: '#8EBDEB', Places: '#8FD3D3', People: '#D5B5DF', 'Play Guides': '#D4D98E', Collections: '#EDB777', Weapons: '#DB9E96' };
const REFERENCE_PROGRESS: ReadonlySet<string> = new Set();

function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: React.ComponentProps<typeof Ionicons>['name'] }) {
    const { C, s } = useAppearance();
    return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.chipActive]}>{icon ? <Ionicons name={icon} color={selected ? C.bg : C.aqua} size={15} /> : null}<Text style={[s.chipText, selected && s.chipTextActive]}>{label}</Text></Pressable>;
}
function SectionHeading({ title, right }: { title: string; right?: React.ReactNode }) { const { s } = useAppearance(); return <View style={s.sectionHeader}><Text style={s.sectionTitle}>{title}</Text>{right}</View> }
function Separator() { const { s } = useAppearance(); return <View style={s.separator} /> }
function EntryCard({ item, onOpen, bookmarked, session }: { item: GuideEntry; onOpen: () => void; bookmarked: boolean; session: PlaySession }) {
    const { C, s } = useAppearance();
    const subject = getSubject(item);
    const thumbnail = COMMUNITY_MEDIA[item.id]?.photos[0]?.thumbnail ?? LIBRARY_MEDIA[item.id]?.[0]?.thumbnail;
    const [imageFailed, setImageFailed] = useState(false);
    return <Pressable onPress={onOpen} style={s.entryCard} accessibilityRole="button" accessibilityLabel={`Open ${libraryTitle(item)}`}>
        {thumbnail && !imageFailed ? <Image source={thumbnail} style={s.entryImage} resizeMode="contain" accessibilityLabel={libraryTitle(item)} onError={() => setImageFailed(true)} /> : <View style={s.entryAvatar}>
            <Ionicons name={item.category === 'Vehicles' && item.vehicleClass === 'Aircraft' ? 'airplane-outline' : item.category === 'Vehicles' && item.vehicleClass === 'Boat' ? 'boat-outline' : CATEGORY_ICONS[item.category]} size={23} color={CATEGORY_COLORS[item.category]} />
        </View>}
        <View style={{ flex: 1, gap: 5 }}><View style={s.inline}><Text numberOfLines={2} style={s.entryTitle}>{libraryTitle(item)}</Text>{bookmarked ? <Ionicons name="bookmark" size={14} color={C.yellow} /> : null}</View><Text style={s.entryMeta}>{subject?.kind || item.vehicleClass || item.category} · {item.id.startsWith('media-') ? 'Image reference' : item.confidence === 'reported' ? 'Source-linked' : item.sourceType === 'official' ? 'Official' : 'Curated'}</Text><Text numberOfLines={2} style={s.entrySummary}>{item.summary}</Text>{item.access || item.minChapter ? <Text style={[s.entryMeta, { color: C.yellow }]}>{accessLabel(item, session)}</Text> : null}</View>
        <Ionicons name="chevron-forward" color={C.muted} size={17} />
    </Pressable>;
}

function Scroll({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
    const { s } = useAppearance();
    return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.scrollContent, compact && { gap: 10 }]} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

function HomeLandscapes({ entries, onOpen }: { entries: GuideEntry[]; onOpen: (entry: GuideEntry) => void }) {
    const { s, C } = useAppearance();
    const [width, setWidth] = useState(0);
    const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
    const tileWidth = Math.max(1, width - 28);
    return <View style={{ width: '100%' }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={tileWidth + 12} disableIntervalMomentum contentContainerStyle={{ gap: 12, paddingRight: 28 }}>
            {HOME_LANDSCAPES.map(({ id, photoIndex }) => {
                const entry = entries.find(entry => entry.id === id);
                const photo = LIBRARY_MEDIA[id]?.[photoIndex];
                if (!entry || !photo) return null;
                return <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Explore ${libraryTitle(entry)}`} onPress={() => onOpen(entry)} style={{ width: tileWidth, gap: 10 }}>
                    <View style={s.landscapeFrame}>{failed.has(id) ? <View style={[s.center, { padding: 0 }]}><Ionicons name="image-outline" size={28} color={C.muted} /></View> : <Image source={photo.source} resizeMode="contain" style={s.landscapeImage} onError={() => setFailed(previous => new Set([...previous, id]))} />}</View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }}><Text style={[s.landscapeLabel, { flex: 1 }]} numberOfLines={2}>{libraryTitle(entry)}</Text><Ionicons name="arrow-forward" size={18} color={C.aqua} /></View>
                </Pressable>;
            })}
        </ScrollView> : null}
    </View>;
}

function StoryPortrait({ character, hidden = false }: { character: StoryCharacter; hidden?: boolean }) {
    const { C, s } = useAppearance();
    const [failed, setFailed] = useState(false);
    const people = character === 'Both' ? ['Jason', 'Lucia'] : character === 'Unknown' ? [] : [character];
    return <View accessible accessibilityLabel={hidden ? 'Hidden character' : character === 'Unknown' ? 'Playable character unverified' : character === 'Both' ? 'Jason and Lucia' : character} style={[s.storyPortraits, { width: people.length === 2 && !hidden ? 76 : 44 }]}>
        {!hidden && people.length && !failed ? people.map((person, index) => <View key={person} style={[s.storyPortrait, { left: index * 32, borderColor: person === 'Jason' ? C.aqua : C.pink, overflow: 'hidden' }]}><Image source={LIBRARY_MEDIA[person === 'Jason' ? 'jason-duval' : 'lucia-caminos'][0].source} resizeMode="cover" onError={() => setFailed(true)} style={person === 'Jason' ? { position: 'absolute', width: 198, height: 112, left: -110, top: 0 } : { position: 'absolute', width: 132, height: 75, left: -66, top: -7 }} /></View>) : <View style={[s.storyPortrait, { justifyContent: 'center', alignItems: 'center' }]}><Ionicons name={hidden ? 'lock-closed-outline' : 'person-outline'} size={21} color={C.muted} /></View>}
    </View>;
}

function StoryJobRow({ job, current, onPress }: { job: StoryJob; current: boolean; onPress: () => void }) {
    const { C, s } = useAppearance();
    return <Pressable accessibilityRole="button" accessibilityLabel={`${job.title}, Chapter ${job.chapter}${current ? ', current job' : ''}`} onPress={onPress} style={s.storyJobRow}>
        <StoryPortrait character={job.character} />
        <View style={{ flex: 1, gap: 4 }}><Text style={s.entryTitle}>{job.title}</Text><Text style={s.entryMeta}>{current ? 'Current job' : `Chapter ${job.chapter} / ${job.kind}`}</Text></View>
        <Ionicons name={current ? 'locate' : 'chevron-forward'} size={18} color={current ? C.pink : C.muted} />
    </Pressable>;
}

function ChapterRoadmap({ chapter, region, currentId, onSelectChapter, onCurrentJob, onOpenSource, busy }: { chapter: Chapter; region: string; currentId: string | null; onSelectChapter: (chapter: Chapter) => void; onCurrentJob: (job: StoryJob | null) => void; onOpenSource: (url: string) => void; busy: boolean }) {
    const { C, s } = useAppearance();
    const [reveal, setReveal] = useState(false);
    const [viewChapter, setViewChapter] = useState<Chapter>(chapter || 1);
    const [mode, setMode] = useState<'Route' | 'Chapter'>('Route');
    const [selectedId, setSelectedId] = useState<string | null>(currentId);
    const [history, setHistory] = useState<string[]>([]);
    const [notesOpen, setNotesOpen] = useState(false);
    const roadmap = getChapterRoadmap(viewChapter, reveal)!;
    const jobs = getStoryJobs(viewChapter, reveal);
    const current = getStoryJob(currentId, reveal);
    const active = jobs.find(job => job.id === selectedId) ?? jobs.find(job => job.id === currentId) ?? jobs.find(job => job.kind === 'Transition') ?? jobs[0];
    const links = getStoryLinks(active?.id ?? '', reveal);
    function inspect(job: StoryJob) {
        if (active && active.id !== job.id) setHistory(previous => [...previous, active.id]);
        setViewChapter(job.chapter); setSelectedId(job.id); setMode('Route');
    }
    function browseChapter(value: Chapter) { setViewChapter(value); setSelectedId(null); setHistory([]) }
    return <Scroll compact>
        <View style={s.inline}><Text style={[s.screenTitle, { flex: 1 }]}>Story</Text><Text style={s.landscapeLabel}>Chapter {viewChapter}</Text><LocationTool label={viewChapter === chapter ? 'Clear current chapter' : 'Set as current chapter'} icon={viewChapter === chapter ? 'close-outline' : 'locate-outline'} onPress={() => { if (!busy) onSelectChapter(viewChapter === chapter ? 0 : viewChapter) }} /></View>
        <View style={s.storyChapterRail}><View pointerEvents="none" style={s.storyChapterLine} />{([1, 2, 3, 4, 5] as Chapter[]).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={`Browse Chapter ${value}${chapter === value ? ', your current chapter' : ''}`} accessibilityState={{ selected: viewChapter === value }} onPress={() => browseChapter(value)} style={s.storyChapterStop}><View style={[s.storyChapterDot, viewChapter === value && { borderColor: C.pink, backgroundColor: C.panel2 }]}><Text style={[s.storyChapterNumber, viewChapter === value && { color: C.pink }]}>{value}</Text></View><Text style={[s.entryMeta, { minHeight: 18 }]}>{chapter === value ? 'Current' : ' '}</Text></Pressable>)}</View>
        {currentId ? <View style={s.storyPosition}><Ionicons name="locate-outline" size={20} color={C.pink} /><View style={{ flex: 1, gap: 3 }}><Text style={s.smallLabel}>Your current job</Text><Text style={s.secondary}>{current?.title ?? 'Current job hidden'}</Text></View>{current ? <LocationTool label="Go to current job" icon="return-up-back-outline" onPress={() => inspect(current)} /> : null}</View> : <Text style={s.entryMeta}>{chapter ? 'Current job not set' : 'Progress not set'}{region ? ` / ${region}` : ''}</Text>}
        <View style={s.mapSummary}><View accessibilityRole="tablist" style={{ flex: 1, flexDirection: 'row', gap: 24 }}>{(['Route', 'Chapter'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: mode === value }} onPress={() => setMode(value)} style={[s.mapCategory, mode === value && { borderBottomColor: C.pink }]}><Text style={[s.mapCategoryText, mode === value && { color: C.text }]}>{value}</Text></Pressable>)}</View><Text style={s.smallLabel}>Spoilers</Text><Switch accessibilityLabel="Reveal story jobs, characters and locations" value={reveal} onValueChange={setReveal} trackColor={{ true: C.pink, false: C.border }} thumbColor={C.text} /></View>
        {!reveal ? <View style={s.storyHidden}>{['Prerequisites', 'Mission hidden', 'Follow-on jobs'].map((label, index) => <View key={label}><View style={s.storyJobRow}><StoryPortrait character="Unknown" hidden /><View style={{ gap: 5, flex: 1 }}><Text style={s.landscapeLabel}>{label}</Text><Text style={s.entryMeta}>Spoiler protected</Text></View></View>{index < 2 ? <View style={s.storyConnector}><Ionicons name="arrow-down" size={18} color={C.border} /></View> : null}</View>)}</View> : mode === 'Chapter' ? <>
            <Text style={s.entryMeta}>Reported jobs / partial chapter coverage</Text>
            <View>{jobs.filter(job => job.kind !== 'Optional').map(job => <StoryJobRow key={job.id} job={job} current={job.id === currentId} onPress={() => inspect(job)} />)}</View>
            {jobs.some(job => job.kind === 'Optional') ? <View style={s.storyOptional}><View style={s.inline}><Ionicons name="git-branch-outline" size={19} color={C.yellow} /><Text style={s.landscapeLabel}>Optional / not chapter gates</Text></View>{jobs.filter(job => job.kind === 'Optional').map(job => <StoryJobRow key={job.id} job={job} current={job.id === currentId} onPress={() => inspect(job)} />)}</View> : null}
        </> : active ? <View style={{ gap: 8 }}>
            <View style={s.mapSummary}><Text style={[s.smallLabel, { flex: 1 }]}>Reported prerequisites</Text>{history.length ? <LocationTool label="Previous inspected job" icon="arrow-back" onPress={() => { const previous = getStoryJob(history.at(-1) ?? null, reveal); if (previous) { setSelectedId(previous.id); setViewChapter(previous.chapter) } setHistory(items => items.slice(0, -1)) }} /> : null}</View>
            {links.prerequisites.length ? <View>{links.prerequisites.map(job => <StoryJobRow key={job.id} job={job} current={job.id === currentId} onPress={() => inspect(job)} />)}<View style={s.storyConnector}><Ionicons name="arrow-down" size={21} color={C.aqua} /></View></View> : <Text style={s.entryMeta}>No prerequisites documented here</Text>}
            <View style={[s.storyFocus, active.id === currentId && { borderLeftColor: C.pink }]}>
                <View style={s.inline}><StoryPortrait character={active.character} /><View style={{ flex: 1, gap: 4 }}><Text style={[s.smallLabel, { color: active.id === currentId ? C.pink : C.aqua }]}>{active.id === currentId ? 'Current job' : active.kind}</Text><Text style={s.storyFocusTitle}>{active.title}</Text></View></View>
                <View style={s.inline}><Ionicons name="location-outline" size={18} color={C.aqua} /><Text style={[s.secondary, { flex: 1 }]}>{active.location || 'Start location unverified'}</Text></View>
                <Text style={s.entryMeta}>{active.character === 'Unknown' ? 'Playable character unverified' : `Playable / ${active.character === 'Both' ? 'Jason + Lucia' : active.character} / reported`}</Text>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => onCurrentJob(active.id === currentId ? null : active)} style={s.storyCommand}><Ionicons name={active.id === currentId ? 'close-circle-outline' : 'locate-outline'} size={20} color={C.pink} /><Text style={{ color: C.pink, fontSize: 15 }}>{active.id === currentId ? 'Clear current job' : 'Set as current job'}</Text></Pressable>
            </View>
            {links.dependents.length ? <View><View style={s.storyConnector}><Ionicons name="arrow-down" size={21} color={C.aqua} /></View><Text style={s.smallLabel}>Leads to</Text>{links.dependents.map(job => <StoryJobRow key={job.id} job={job} current={job.id === currentId} onPress={() => inspect(job)} />)}</View> : <Text style={s.entryMeta}>{active.kind === 'Optional' ? 'Not a reported chapter prerequisite' : 'Follow-on jobs not documented here'}</Text>}
            {active.conditions ? <View style={{ gap: 6, paddingTop: 12 }}><Text style={s.smallLabel}>Conditions & notes</Text><Text style={s.secondary}>{active.conditions}</Text></View> : null}
        </View> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: notesOpen }} onPress={() => setNotesOpen(value => !value)} style={s.sourceRow}><Ionicons name="information-circle-outline" size={20} color={C.muted} /><Text style={[s.secondary, { flex: 1 }]}>Chapter notes</Text><Ionicons name={notesOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} /></Pressable>
        {notesOpen ? <View style={{ gap: 12 }}><Text style={s.smallLabel}>Required for progression</Text><Text style={s.secondary}>{roadmap.requirement}</Text>{roadmap.details ? <><Text style={s.smallLabel}>Chapter transition</Text><Text style={s.secondary}>{roadmap.details.trigger}</Text><Text style={s.smallLabel}>Optional / separate from progression</Text><Text style={s.secondary}>{roadmap.details.optional}</Text></> : null}<Text style={s.smallLabel}>Before moving on</Text><Text style={s.secondary}>{roadmap.warning}</Text></View> : null}
        <Text style={s.entryMeta}>Partial, source-reported route. Position is manually set, not synced with your game. Links are not a complete unlock checklist.</Text>
        <Pressable accessibilityRole="link" onPress={() => onOpenSource((mode === 'Route' ? active?.sourceUrl : null) ?? roadmap.details?.sourceUrl ?? roadmap.overviewUrl)} style={s.sourceRow}><Ionicons name="open-outline" size={17} color={C.aqua} /><Text style={{ color: C.aqua, flex: 1 }}>PowerPyx source</Text><Text style={s.entryMeta}>{roadmap.reviewedOn}</Text></Pressable>
    </Scroll>;
}

function LocationTool({ label, icon, active = false, onPress }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; active?: boolean; onPress: () => void }) {
    const { C, s } = useAppearance();
    const [hint, setHint] = useState(false);
    return <View style={{ zIndex: hint ? 10 : 1 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} onHoverIn={() => setHint(true)} onHoverOut={() => setHint(false)} onLongPress={() => setHint(true)} onPressOut={() => setHint(false)} style={s.mapTool}><View style={[s.mapToolFace, active && { backgroundColor: C.panel2 }]}><Ionicons name={icon} size={20} color={active ? C.text : C.muted} /></View></Pressable>
        {hint ? <View pointerEvents="none" style={[s.mapTooltip, icon === 'arrow-back' && { left: 0, right: undefined }]}><Text style={{ color: C.text, fontSize: 12 }}>{label}</Text></View> : null}
    </View>;
}

function LocationBrowser({ entries, session, spoilers, favorites, busy, onSpoilers, onSave, onOpen, onBack }: {
    entries: GuideEntry[]; session: PlaySession; spoilers: boolean; favorites: ReadonlySet<string>; busy: boolean;
    onSpoilers: (value: boolean) => void; onSave: (entry: GuideEntry) => void; onOpen: (entry: GuideEntry) => void; onBack: () => void;
}) {
    const { C, s } = useAppearance();
    const [mode, setMode] = useState<'Map' | 'List'>('Map');
    const [filters, setFilters] = useState<LocationFilters>(DEFAULT_LOCATION_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selectedMap, setSelectedMap] = useState<string | null>(null);
    const maps = filterLocationMaps(entries, session, spoilers, favorites, filters);
    const active = maps.find(map => map.id === selectedMap) ?? maps[0];
    const activeIndex = active ? maps.indexOf(active) : -1;
    const image = active ? LOCATION_MAP_IMAGES[active.id] : null;
    function changeFilters(patch: Partial<LocationFilters>) { setFilters(previous => ({ ...previous, ...patch })); setSelectedMap(null) }
    return <Scroll compact>
        <View style={[s.inline, { zIndex: 3 }]}>
            <LocationTool label="Back to library" icon="arrow-back" onPress={onBack} />
            <Text style={[s.sectionTitle, { flex: 1, fontSize: 22 }]}>Locations</Text>
            <View style={s.mapViewTools}><LocationTool label="Map view" icon="map-outline" active={mode === 'Map'} onPress={() => setMode('Map')} /><LocationTool label="List view" icon="list-outline" active={mode === 'List'} onPress={() => setMode('List')} /></View>
        </View>
        <View style={s.mapSearch}><Ionicons name="search-outline" size={18} color={C.muted} /><TextInput accessibilityLabel="Search map references" value={filters.query} onChangeText={query => changeFilters({ query })} autoCapitalize="none" autoCorrect={false} placeholder="Search locations" placeholderTextColor={C.muted} style={s.mapSearchInput} />{filters.query ? <LocationTool label="Clear search" icon="close" onPress={() => changeFilters({ query: '' })} /> : null}<LocationTool label={filtersOpen ? 'Hide filters' : 'Location filters'} icon="options-outline" active={filtersOpen || Boolean(filters.region) || filters.chapter !== 'All' || filters.savedOnly} onPress={() => setFiltersOpen(value => !value)} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mapCategoryRail} contentContainerStyle={{ gap: 22 }} accessibilityRole="tablist">{(['All', ...LOCATION_TYPES] as const).map(type => <Pressable key={type} accessibilityRole="tab" accessibilityState={{ selected: filters.type === type }} accessibilityLabel={type === 'All' ? 'All map types' : type} onPress={() => changeFilters({ type })} style={[s.mapCategory, filters.type === type && { borderBottomColor: C.pink }]}><Text style={[s.mapCategoryText, filters.type === type && { color: C.text }]}>{type}</Text></Pressable>)}</ScrollView>
        <View style={s.mapSummary}>
            <Text style={[s.entryMeta, { flex: 1 }]}>{filters.region === 'Unknown' ? 'Unspecified region' : filters.region || 'All regions'}{filters.chapter !== 'All' ? ` / ${filters.chapter === 'Unknown' ? 'Unknown access' : `By Chapter ${filters.chapter}`}` : ''}</Text>
            <Text style={s.entryMeta} accessibilityLiveRegion="polite">{maps.length} maps{filters.savedOnly ? ' / saved' : ''}</Text>
        </View>
        {filtersOpen ? <View style={s.mapFilterPanel}>
            <Text style={s.smallLabel}>Region</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>{['', ...REGIONS, 'Unknown'].map(region => <Pressable key={region || 'all'} accessibilityRole="radio" accessibilityState={{ checked: filters.region === region }} onPress={() => changeFilters({ region })} style={s.mapFilterOption}><Ionicons name={filters.region === region ? 'radio-button-on' : 'radio-button-off'} color={filters.region === region ? C.aqua : C.muted} size={16} /><Text style={s.mapCategoryText}>{region === 'Unknown' ? 'Unspecified' : region || 'All regions'}</Text></Pressable>)}</ScrollView>
            <Text style={s.smallLabel}>Reported chapter access</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>{(['All', 1, 2, 3, 4, 5, 'Unknown'] as const).map(chapter => <Pressable key={chapter} accessibilityRole="radio" accessibilityState={{ checked: filters.chapter === chapter }} onPress={() => changeFilters({ chapter })} style={s.mapFilterOption}><Ionicons name={filters.chapter === chapter ? 'radio-button-on' : 'radio-button-off'} color={filters.chapter === chapter ? C.aqua : C.muted} size={16} /><Text style={s.mapCategoryText}>{chapter === 'All' ? 'Any' : chapter === 'Unknown' ? 'Unknown' : `By ${chapter}`}</Text></Pressable>)}</ScrollView>
            <View style={s.mapSummary}><Text style={[s.secondary, { flex: 1 }]}>Saved guides only</Text><Switch accessibilityLabel="Filter maps to saved guides" value={filters.savedOnly} onValueChange={savedOnly => changeFilters({ savedOnly })} trackColor={{ true: C.aqua, false: C.border }} thumbColor={C.text} /></View>
            <View style={s.mapSummary}><Text style={[s.secondary, { flex: 1 }]}>Spoilers</Text><Switch accessibilityLabel="Show map spoilers and future guides" disabled={busy} value={spoilers} onValueChange={onSpoilers} trackColor={{ true: C.pink, false: C.border }} thumbColor={C.text} /><LocationTool label="Reset filters" icon="refresh-outline" onPress={() => { setFilters(DEFAULT_LOCATION_FILTERS); setSelectedMap(null) }} /></View>
        </View> : null}
        {maps.length === 0 ? <View style={s.center}><Ionicons name="map-outline" size={36} color={C.muted} /><Text style={s.sectionTitle}>No visible maps</Text><Text style={[s.secondary, { textAlign: 'center' }]}>{spoilers ? 'No map references match these filters.' : 'The available source maps contain spoilers.'}</Text>{!spoilers ? <View style={s.inline}><Text style={s.secondary}>Spoilers</Text><Switch accessibilityLabel="Reveal spoiler-protected maps" disabled={busy} value={spoilers} onValueChange={onSpoilers} trackColor={{ true: C.pink, false: C.border }} thumbColor={C.text} /></View> : <LocationTool label="Reset filters" icon="refresh-outline" onPress={() => setFilters(DEFAULT_LOCATION_FILTERS)} />}</View> : mode === 'Map' && active && image ? <>
            <View style={s.inline}><Text style={[s.landscapeLabel, { flex: 1 }]}>{active.title}</Text><Pressable accessibilityRole="button" accessibilityLabel={favorites.has(active.entryId) ? 'Unsave map guide' : 'Save map guide'} disabled={busy} style={s.detailIcon} onPress={() => onSave(active.entry)}><Ionicons name={favorites.has(active.entryId) ? 'bookmark' : 'bookmark-outline'} size={23} color={C.yellow} /></Pressable></View>
            <LibraryGallery key={active.id} entryId={active.entryId} title={active.title} palette={C} spoilers={spoilers} photosOverride={[image]} aspectRatio={Math.max(image.aspectRatio, 1.2)} />
            <View style={s.resultRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Previous map" disabled={activeIndex <= 0} style={[s.detailIcon, { opacity: activeIndex <= 0 ? 0.3 : 1 }]} onPress={() => setSelectedMap(maps[activeIndex - 1].id)}><Ionicons name="arrow-back" size={22} color={C.text} /></Pressable>
                <Text style={s.smallLabel}>{activeIndex + 1} / {maps.length}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Next map" disabled={activeIndex >= maps.length - 1} style={[s.detailIcon, { opacity: activeIndex >= maps.length - 1 ? 0.3 : 1 }]} onPress={() => setSelectedMap(maps[activeIndex + 1].id)}><Ionicons name="arrow-forward" size={22} color={C.text} /></Pressable>
            </View>
            <Text style={s.entryMeta}>{active.region || 'Region not documented'} / {active.type} / {active.entry.minChapter ? `Reported Chapter ${active.entry.minChapter}+` : 'Access unverified'}</Text>
            <Pressable accessibilityRole="button" style={s.sourceRow} onPress={() => onOpen(active.entry)}><Ionicons name="book-outline" size={20} color={C.aqua} /><Text style={[s.secondary, { color: C.aqua, flex: 1 }]}>Source guide</Text><Ionicons name="chevron-forward" size={18} color={C.muted} /></Pressable>
        </> : <View>{maps.map(map => <View key={map.id} style={s.entryCard}>
            <Pressable accessibilityRole="button" accessibilityLabel={`View map: ${map.title}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={() => { setSelectedMap(map.id); setMode('Map') }}><Image source={LOCATION_MAP_IMAGES[map.id].thumbnail} resizeMode="contain" style={s.entryImage} /><View style={{ flex: 1, gap: 5 }}><Text style={s.entryTitle}>{map.title}</Text><Text style={s.entryMeta}>{map.region || 'Region not documented'} / {map.type}</Text><Text style={s.entryMeta}>{map.entry.minChapter ? `Reported Chapter ${map.entry.minChapter}+` : 'Access unverified'}</Text></View></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${favorites.has(map.entryId) ? 'Unsave' : 'Save'} guide for ${map.title}`} disabled={busy} style={s.detailIcon} onPress={() => onSave(map.entry)}><Ionicons name={favorites.has(map.entryId) ? 'bookmark' : 'bookmark-outline'} size={22} color={C.yellow} /></Pressable>
        </View>)}</View>}
    </Scroll>;
}

function IViceApp() {
    const reducedMotion = useReducedMotion();
    const fontsReady = useContext(FontReady);
    const [theme, setTheme] = useState<ThemeName>('jason'), [session, setSession] = useState<PlaySession>(DEFAULT_SESSION); const C = THEMES[theme], s = useMemo(() => createStyles(C, fontsReady), [C, fontsReady]);
    const [db, setDb] = useState<SQLiteDatabase | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
    const [tab, setTab] = useState<Tab>('Home'), [guides, setGuides] = useState<GuideEntry[]>([]), [profiles, setProfiles] = useState<Profile[]>([]), [activeProfile, setActiveProfile] = useState('my-first-playthrough');
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [storyPosition, setStoryPosition] = useState<string | null>(null);
    const [spoilers, setSpoilers] = useState(false), [query, setQuery] = useState(''), [category, setCategory] = useState<Category | 'All'>('All');
    const [selected, setSelected] = useState<GuideEntry | null>(null);
    const [detailHistory, setDetailHistory] = useState<GuideEntry[]>([]);
    const [libraryMode, setLibraryMode] = useState<LibraryMode>('Subjects');
    const [focusSearch, setFocusSearch] = useState(false);
    const [sessionEditor, setSessionEditor] = useState(false), [vehicleFilter, setVehicleFilter] = useState('All');
    const [savedOnly, setSavedOnly] = useState(false), [busy, setBusy] = useState(false); const lock = useRef(false); const [pageSize, setPageSize] = useState(30);
    const [profileName, setProfileName] = useState(''), [syncing, setSyncing] = useState(false), [syncStatus, setSyncStatus] = useState('Offline catalog ready');
    const exclusive = async (action: () => Promise<void>) => { if (lock.current) return; lock.current = true; setBusy(true); try { await action() } catch { Alert.alert('Could not complete that action', 'Your saved data is retained. Please retry.') } finally { lock.current = false; setBusy(false) } };
    const refresh = useCallback(async (database: SQLiteDatabase, profileId: string) => {
        const [all, prof, favs, play, position] = await Promise.all([readGuides(database), readProfiles(database), readFavorites(database, profileId), readSession(database, profileId), readStoryPosition(database, profileId)]);
        setGuides([...all.filter(entry => entry.sourceType !== 'template'), ...LOCAL_MEDIA_GUIDES]); setProfiles(prof); setFavorites(favs); setSession(play); setStoryPosition(getStoryJob(position, true)?.chapter === play.chapter ? position : null);
    }, []);
    useEffect(() => {
        let active = true; let database: SQLiteDatabase | null = null; (async () => {
            try { database = await openDatabaseAsync('ivice-guide.db'); await migrate(database); const requested = await readSetting(database, 'activeProfile', 'my-first-playthrough'); const pid = (await readProfiles(database)).some(p => p.id === requested) ? requested : 'my-first-playthrough'; if (pid !== requested) await writeSetting(database, 'activeProfile', pid); const flag = await readSetting(database, 'showSpoilers', 'false'); const appearance = parseTheme(await readSetting(database, 'appearance', 'jason')); if (!active) return; setTheme(appearance); setDb(database); setActiveProfile(pid); setSpoilers(flag === 'true'); await refresh(database, pid); } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Could not open offline database'); } finally { if (active) setLoading(false); }
        })(); return () => { active = false; /* keep db for app lifetime; native teardown owns closure */ };
    }, [refresh]);
    const filtered = useMemo(() => searchLibrary(guides, { session, spoilers, query, mode: libraryMode, category, vehicleClass: vehicleFilter, savedOnly, favorites }), [guides, session, spoilers, query, libraryMode, category, vehicleFilter, savedOnly, favorites]);
    useEffect(() => { setPageSize(30) }, [query, category, libraryMode, vehicleFilter, savedOnly, spoilers, activeProfile]);
    const activeName = profiles.find(x => x.id === activeProfile)?.name ?? 'My playthrough';
    const picks = useMemo(() => recommend(guides, session, REFERENCE_PROGRESS, spoilers), [guides, session, spoilers]);
    async function updateSession(next: PlaySession) { if (!db) return; await exclusive(async () => { if (next.chapter !== session.chapter) { await writeStoryPosition(db, activeProfile, null, next); setStoryPosition(null) } else await writeSession(db, activeProfile, next); setSession(next); if (selected && !canRead(selected, next, spoilers)) setSelected(null) }) }
    async function updateStoryPosition(job: StoryJob | null) { if (!db) return; await exclusive(async () => { const next = { ...session, chapter: job?.chapter ?? session.chapter }; await writeStoryPosition(db, activeProfile, job?.id ?? null, next); setSession(next); setStoryPosition(job?.id ?? null); if (selected && !canRead(selected, next, spoilers)) setSelected(null) }) }
    async function changeTheme(next: ThemeName) { if (!db) return; await exclusive(async () => { await writeSetting(db, 'appearance', next); setTheme(next) }) }
    function openItem(item: GuideEntry, related = false) { if (!db || lock.current || !canRead(item, session, spoilers)) return; setDetailHistory(history => related && selected ? [...history, selected] : []); setSelected(item); void updateSession({ ...session, lastGuideId: item.id }) }
    function closeDetail() { setSelected(null); setDetailHistory([]) }
    function backDetail() {
        if (lock.current) return;
        const history = detailHistory.filter(item => canRead(item, session, spoilers));
        const previous = history.at(-1);
        if (!previous) { closeDetail(); return }
        setDetailHistory(history.slice(0, -1)); setSelected(previous);
        void updateSession({ ...session, lastGuideId: previous.id });
    }
    function browse(cat: Category | 'All', saved = false, search = false) { setTab('Library'); setCategory(cat); setQuery(''); setSavedOnly(saved); setVehicleFilter('All'); setFocusSearch(search); setLibraryMode(saved || search ? 'All' : cat === 'All' || SUBJECT_CATEGORIES.includes(cat) ? 'Subjects' : 'Guides') }

    async function toggleFavorite(guide: GuideEntry) { if (!db) return; await exclusive(async () => { const next = !favorites.has(guide.id); await setFavorite(db, activeProfile, guide.id, next); setFavorites(prev => { const a = new Set(prev); next ? a.add(guide.id) : a.delete(guide.id); return a }) }) }
    async function toggleSpoiler(next: boolean) { if (!db) return; await exclusive(async () => { await writeSetting(db, 'showSpoilers', String(next)); setSpoilers(next); if (selected && !canRead(selected, session, next)) setSelected(null) }) }
    async function activateProfile(id: string) { if (!db || id === activeProfile) return; await writeSetting(db, 'activeProfile', id); await refresh(db, id); setActiveProfile(id); setSelected(null) }
    async function switchProfile(id: string) { await exclusive(() => activateProfile(id)) }
    async function createProfile() { if (!db || !profileName.trim()) return; await exclusive(async () => { const id = await addProfile(db, profileName); await activateProfile(id); setProfileName('') }) }
    async function doSync() { if (!db || syncing) return; await exclusive(async () => { setSyncing(true); try { const result = await syncCatalog(db); await refresh(db, activeProfile); setSelected(null); setSyncStatus(result.status === 'offline-only' ? 'Offline mode — API not configured' : `Synced ${result.count} curated entries`) } catch (e) { setSyncStatus(e instanceof Error ? `Sync failed: ${e.message}` : 'Sync failed') } finally { setSyncing(false) } }) }
    async function openUrl(url: string) { try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) { Alert.alert('Unsupported link'); return } const launch = async () => { try { await Linking.openURL(parsed.href) } catch { Alert.alert('Unable to open the source link') } }; if (!spoilers) { Alert.alert('External source', 'The website may contain story spoilers. Open it?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Open source', onPress: () => { void launch() } }]); return } await launch() } catch { Alert.alert('Unsupported link') } }
    const cards = (items: GuideEntry[]) => <View style={s.entryList}>{items.map(g => <EntryCard key={g.id} item={g} onOpen={() => openItem(g)} bookmarked={favorites.has(g.id)} session={session} />)}</View>;
    const selectedSubject = selected ? getSubject(selected) : null;
    const relatedEntries = selected ? relatedLibraryEntries(selected, guides, session, spoilers) : [];
    return <Appearance.Provider value={C}><SafeAreaProvider><SafeAreaView style={s.safe} edges={['top', 'left', 'right']}><StatusBar barStyle="light-content" />
        {tab === 'Home' ? <LinearGradient pointerEvents="none" colors={[C.panel2, C.bg, C.bg]} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} /> : null}
        <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Go to Home" disabled={busy} hitSlop={4} onPress={() => { closeDetail(); setTab('Home') }} style={s.brandRow}><Image source={require('./src/ivice-web.png')} style={{ width: 40, height: 40 }} resizeMode="contain" /><Text style={s.brand}>iVice</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Settings for ${activeName}`} disabled={busy} onPress={() => setTab('Settings')} style={s.headerProfile}><Ionicons name="person-outline" color={C.text} size={20} /></Pressable></View>
        <ScreenTransition navigationKey={tab}>
            {loading ? <View style={s.center}><ActivityIndicator size="large" color={C.pink} /><Text style={s.secondary}>Opening offline guide…</Text></View> : error ? <View style={s.center}><Ionicons name="alert-circle-outline" size={32} color={C.pink} /><Text style={s.sectionTitle}>Unable to open iVice</Text><Text style={s.secondary}>{error}</Text></View> : <>
                {tab === 'Home' && <Scroll>
                    <HomeLandscapes entries={guides} onOpen={entry => openItem(entry)} />
                    <Pressable accessibilityRole="button" accessibilityLabel="Open chapter progression" onPress={() => setTab('Story')} style={[s.sessionCard, { flexDirection: 'row', alignItems: 'center' }]}>
                        <Ionicons name="git-merge" size={28} color={C.pink} />
                        <View style={{ flex: 1, gap: 4 }}><Text style={s.sectionTitle}>{session.chapter === 0 ? 'Your story' : chapterLabel(session.chapter)}</Text><Text style={s.secondary}>{session.chapter === 0 ? 'Chapter not set' : session.chapter === 5 ? 'The final chapter' : `Up next / Chapter ${session.chapter + 1}`}</Text></View>
                        <Ionicons name="arrow-forward" size={22} color={C.text} />
                    </Pressable>
                    <View style={s.launchGrid}>{CATEGORIES.filter(cat => cat !== 'Collections').map(cat => <Pressable key={cat} accessibilityRole="button" accessibilityLabel={cat === 'Story' ? 'Open chapter progression' : `Open ${cat}`} style={s.launchTile} onPress={() => cat === 'Story' ? setTab('Story') : browse(cat)}><View style={[s.launchIcon, { backgroundColor: CATEGORY_COLORS[cat] }]}><Ionicons name={CATEGORY_ICONS[cat]} size={27} color="#141619" /></View><Text style={s.launchLabel}>{cat === 'Play Guides' ? 'Guides' : cat === 'Places' ? 'Locations' : cat}</Text></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel="Open saved guides" style={s.launchTile} onPress={() => browse('All', true)}><View style={[s.launchIcon, { backgroundColor: '#E7C36B' }]}><Ionicons name="bookmark" size={25} color="#141619" /></View><Text style={s.launchLabel}>Saved</Text></Pressable></View>
                    <Pressable accessibilityRole="button" accessibilityLabel="Search people, vehicles, places and guides" style={[s.searchWrap, { minHeight: 48, gap: 10 }]} onPress={() => browse('All', false, true)}><Ionicons name="search-outline" size={20} color={C.muted} /><Text style={[s.secondary, { flex: 1 }]}>Search people, places, things...</Text></Pressable>
                    <View style={s.inline}>
                        <Pressable accessibilityRole="button" accessibilityLabel="Edit play session" disabled={busy} onPress={() => setSessionEditor(value => !value)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}><Ionicons name="location-outline" size={16} color={C.muted} /><Text style={[s.secondary, { flexShrink: 1 }]}>{session.region || 'All Leonida'}</Text><Ionicons name={sessionEditor ? 'chevron-up' : 'chevron-down'} size={14} color={C.muted} /></Pressable>
                        <Text style={s.secondary}>Spoilers</Text>
                        <Switch accessibilityLabel="Show all spoilers and future guides" disabled={busy} value={spoilers} onValueChange={toggleSpoiler} trackColor={{ true: C.pink, false: C.border }} thumbColor={C.text} />
                    </View>
                    {sessionEditor ? <>
                        <Text style={s.smallLabel}>Chapter</Text><View style={s.wrapRow}>{([0, 1, 2, 3, 4, 5] as Chapter[]).map(value => <Chip key={value} label={value === 0 ? 'Not set' : String(value)} selected={session.chapter === value} onPress={() => void updateSession({ ...session, chapter: value })} />)}</View>
                        <Text style={s.smallLabel}>Region</Text><View style={s.wrapRow}>{['', ...REGIONS].map(region => <Chip key={region || 'any'} label={region || 'All Leonida'} selected={session.region === region} onPress={() => void updateSession({ ...session, region })} />)}</View>
                    </> : null}
                    {picks.resume ? <><SectionHeading title="Continue reading" />{cards([picks.resume])}</> : null}
                    <SectionHeading title="On the road" right={<Pressable accessibilityRole="button" accessibilityLabel="Browse all vehicles" onPress={() => browse('Vehicles')} style={s.detailIcon}><Ionicons name="arrow-forward" size={20} color={C.aqua} /></Pressable>} />{cards(picks.rides)}
                    {session.region && picks.nearby.length ? <><SectionHeading title={session.region} />{cards(picks.nearby)}</> : null}
                </Scroll>}
                {tab === 'Library' && category === 'Places' ? <LocationBrowser key={activeProfile} entries={guides} session={session} spoilers={spoilers} favorites={favorites} busy={busy} onSpoilers={value => void toggleSpoiler(value)} onSave={entry => void toggleFavorite(entry)} onOpen={entry => openItem(entry)} onBack={() => browse('All')} /> : null}
                {tab === 'Library' && category !== 'Places' && <Scroll>
                    <Text style={s.screenTitle}>{savedOnly ? 'Saved' : category === 'All' ? 'Library' : category}</Text>
                    <View style={s.searchWrap}>
                        <Ionicons name="search-outline" color={C.muted} size={19} />
                        <TextInput value={query} onChangeText={setQuery} style={s.searchField} placeholder="Name, place or keyword" placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} autoFocus={focusSearch} returnKeyType="search" accessibilityLabel="Search the library" />
                        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" style={s.detailIcon} onPress={() => setQuery('')}><Ionicons name="close-circle" color={C.muted} size={20} /></Pressable> : null}
                    </View>
                    <View style={s.segmented} accessibilityRole="tablist">
                        {(['Subjects', 'Guides', 'All'] as LibraryMode[]).map(mode => <Pressable key={mode} accessibilityRole="tab" accessibilityState={{ selected: libraryMode === mode }} onPress={() => { setLibraryMode(mode); setCategory('All'); setVehicleFilter('All') }} style={[s.segment, libraryMode === mode && s.segmentActive]}><Text style={[s.segmentText, libraryMode === mode && { color: C.text }]}>{mode === 'Subjects' ? 'Encyclopedia' : mode}</Text></Pressable>)}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={{ gap: 8, paddingRight: 10 }}>
                        <Chip label="Saved" selected={savedOnly} icon="bookmark-outline" onPress={() => setSavedOnly(value => !value)} />
                        <Chip label="All" selected={category === 'All'} onPress={() => { setCategory('All'); setVehicleFilter('All') }} />
                        {(libraryMode === 'Subjects' ? SUBJECT_CATEGORIES : CATEGORIES).map(value => <Chip key={value} label={value === 'Places' ? 'Locations' : value} selected={category === value} onPress={() => { setCategory(value); setVehicleFilter('All') }} />)}
                    </ScrollView>
                    <View style={s.resultRow}>
                        <Text style={s.smallLabel}>{filtered.length} {query.trim() ? 'results' : 'entries · A–Z'}</Text>
                        <View style={s.inline}><Text style={s.smallLabel}>Spoilers</Text><Switch accessibilityLabel="Show all spoilers and future guides" disabled={busy} value={spoilers} onValueChange={toggleSpoiler} trackColor={{ true: C.pink, false: C.border }} thumbColor={C.text} /></View>
                    </View>
                    {category === 'Vehicles' ? <View style={s.wrapRow}>{['All', 'Car', 'Aircraft', 'Boat', 'Off-road'].map(value => <Chip key={value} label={value} selected={vehicleFilter === value} onPress={() => { setVehicleFilter(value); setPageSize(30) }} />)}</View> : null}
                    {cards(filtered.slice(0, pageSize))}
                    {filtered.length > pageSize ? <Pressable accessibilityRole="button" style={s.outlineButton} onPress={() => setPageSize(value => value + 30)}><Ionicons name="add" color={C.aqua} size={20} /><Text style={[s.outlineButtonText, { flexShrink: 1 }]}>Show more ({filtered.length - pageSize} remaining)</Text></Pressable> : null}
                    {!filtered.length ? <View style={{ gap: 12 }}><Text style={s.empty}>{savedOnly ? 'No saved entries match.' : libraryMode === 'Subjects' ? 'No cataloged subjects match these filters.' : 'No entries match.'}</Text>{libraryMode !== 'All' || category !== 'All' || savedOnly ? <Pressable accessibilityRole="button" style={s.outlineButton} onPress={() => { setLibraryMode('All'); setCategory('All'); setSavedOnly(false); setVehicleFilter('All') }}><Ionicons name="search-outline" size={20} color={C.aqua} /><Text style={s.outlineButtonText}>Search all entries</Text></Pressable> : null}</View> : null}
                </Scroll>}
                {tab === 'Settings' && <Scroll>
                    <Text style={s.screenTitle}>Settings</Text>
                    <SectionHeading title="Spoiler protection" />
                    <View style={s.settingRow}><View style={{ flex: 1 }}><Text style={s.settingTitle}>Show all spoilers and future chapters</Text></View><Switch disabled={busy} value={spoilers} onValueChange={toggleSpoiler} trackColor={{ true: C.pink, false: C.border }} thumbColor={C.text} /></View>
                    <SectionHeading title="Appearance" />
                    <View style={s.wrapRow}>{(['jason', 'lucia', 'classic'] as ThemeName[]).map(t => <Chip key={t} label={t === 'jason' ? 'Jason mode' : t === 'lucia' ? 'Lucia mode' : 'Classic Vice'} selected={theme === t} onPress={() => void changeTheme(t)} />)}</View>
                    <SectionHeading title="Playthroughs" />
                    <Text style={s.secondary}>Current: {activeName}</Text>
                    {profiles.map(profile => <View key={profile.id} style={s.profileRow}>
                        <Pressable disabled={busy} onPress={() => switchProfile(profile.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityRole="radio" accessibilityState={{ checked: profile.id === activeProfile, disabled: busy }}>
                            <Ionicons name={profile.id === activeProfile ? 'radio-button-on' : 'radio-button-off'} color={profile.id === activeProfile ? C.aqua : C.muted} size={22} /><Text style={s.profileLabel}>{profile.name}</Text>
                        </Pressable>
                        {profile.id !== 'my-first-playthrough' ? <Pressable disabled={busy} accessibilityLabel={`Delete ${profile.name}`} style={s.detailIcon} onPress={() => Alert.alert('Delete playthrough?', `Delete ${profile.name} and all its saved data permanently?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { if (db) void exclusive(async () => { if (profile.id === activeProfile) await activateProfile('my-first-playthrough'); await removeProfile(db, profile.id); setProfiles(await readProfiles(db)) }) } }])}><Ionicons name="trash-outline" size={18} color={C.muted} /></Pressable> : null}
                    </View>)}
                    <View style={s.addProfile}><TextInput value={profileName} onChangeText={setProfileName} maxLength={50} style={[s.textInput, { flex: 1 }]} placeholder="New playthrough name" placeholderTextColor={C.muted} /><Pressable disabled={busy} onPress={createProfile} accessibilityLabel="Add playthrough" style={s.smallButton}><Ionicons name="add" color={C.bg} size={22} /></Pressable></View>
                    <SectionHeading title="Guide updates" />
                    <Text style={s.secondary}>{syncStatus}</Text>
                    <Pressable onPress={doSync} disabled={busy || syncing} style={s.outlineButton}>{syncing ? <ActivityIndicator color={C.aqua} /> : <Ionicons name="cloud-download-outline" color={C.aqua} size={17} />}<Text style={s.outlineButtonText}>Sync curated guides</Text></Pressable>
                    <Text style={s.disclaimer}>iVice v0.1 · Local-first{'\n'}Unofficial. Not affiliated with Rockstar Games or Take-Two Interactive.</Text>
                </Scroll>}
                {tab === 'Story' && <ChapterRoadmap key={activeProfile} chapter={session.chapter} region={session.region} currentId={storyPosition} busy={busy} onSelectChapter={chapter => void updateSession({ ...session, chapter })} onCurrentJob={job => void updateStoryPosition(job)} onOpenSource={url => void openUrl(url)} />}
            </>}
        </ScreenTransition>
        {busy ? <Text accessibilityLiveRegion="polite" style={{ color: C.aqua, textAlign: 'center', fontSize: 12, padding: 4 }}>Saving or updating guide…</Text> : null}<SafeAreaView edges={['bottom']} style={{ backgroundColor: C.panel }}><View style={s.nav}>{TABS.map(t => <Pressable key={t} disabled={busy} onPress={() => { if (t === 'Library') { browse('All') } else { setTab(t) } closeDetail() }} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} style={s.navItem}><Ionicons name={ICONS[t]} color={tab === t ? C.pink : C.muted} size={22} /><Text style={[s.navLabel, tab === t && { color: C.pink }]}>{t}</Text><View style={[s.navDot, { opacity: tab === t ? 1 : 0 }]} /></Pressable>)}</View></SafeAreaView>
        <Modal visible={Boolean(selected) && Boolean(selected && canRead(selected, session, spoilers))} animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={backDetail}>
            <SafeAreaProvider style={s.safe}>
                <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
                    <View style={s.detailHeader}>
                        <Pressable accessibilityRole="button" accessibilityLabel={detailHistory.length ? 'Back to previous entry' : 'Close guide'} onPress={backDetail} disabled={busy} style={s.detailIcon}><Ionicons name="arrow-back" color={C.text} size={23} /></Pressable>
                        <Text style={s.detailHeaderTitle}>{selectedSubject ? 'Encyclopedia' : 'Field guide'}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={selected && favorites.has(selected.id) ? 'Remove bookmark' : 'Bookmark guide'} disabled={busy} onPress={() => selected && toggleFavorite(selected)} style={s.detailIcon}><Ionicons name={selected && favorites.has(selected.id) ? 'bookmark' : 'bookmark-outline'} size={23} color={C.yellow} /></Pressable>
                        {detailHistory.length ? <Pressable accessibilityRole="button" accessibilityLabel="Close all entries" onPress={closeDetail} style={s.detailIcon}><Ionicons name="close" color={C.text} size={23} /></Pressable> : null}
                    </View>
                    {selected ? <ScrollView key={selected.id} contentContainerStyle={s.detailBody}>
                        <Text style={s.eyebrow}>{selectedSubject?.kind || selected.category}{selected.region ? ` / ${selected.region}` : ''}</Text>
                        <Text style={s.detailTitle}>{libraryTitle(selected)}</Text>
                        <LibraryGallery key={selected.id} entryId={selected.id} title={libraryTitle(selected)} palette={C} spoilers={spoilers} />
                        <Text style={s.detailLead}>{selected.summary}</Text>
                        <View style={s.badgeRow}>
                            <Text style={s.badge}>{selected.sourceType === 'official' ? 'OFFICIAL SOURCE' : 'COMMUNITY / UNVERIFIED'}</Text>
                            {selected.vehicleClass ? <Text style={s.badge}>{selected.vehicleClass.toUpperCase()}</Text> : null}
                            {selected.stage ? <Text style={s.badge}>{selected.stage.toUpperCase()}</Text> : null}
                            {selected.spoiler ? <Text style={[s.badge, { color: C.pink }]}>SPOILERS</Text> : null}
                        </View>
                        <Separator />
                        {selectedSubject ? <SectionHeading title="About" /> : null}
                        <Text style={s.detailText}>{selected.body}</Text>
                        {selectedSubject ? <>
                            <SectionHeading title={selectedSubject.kind === 'Person' ? 'Where to meet' : 'Where to find'} />
                            <View style={s.directoryRow}><Ionicons name="location-outline" size={21} color={C.aqua} /><Text style={[s.detailText, { flex: 1 }]}>{selectedSubject.location || selected.region || 'Region not documented'}</Text></View>
                            <Text style={s.secondary}>{selectedSubject.kind === 'Person' ? 'Exact meeting point and availability are not documented in this catalog.' : selectedSubject.kind === 'Location' ? 'Routes and entry requirements are not documented in this catalog.' : 'Exact spawn or pickup location is not documented in this catalog.'}</Text>
                            {['Vehicle', 'Weapon', 'Collectible'].includes(selectedSubject.kind) ? <><SectionHeading title="How to get it" /><Text style={s.detailText}>{selectedSubject.acquisition || 'Acquisition method and requirements are not documented yet.'}</Text>{selected.minChapter ? <Text style={s.secondary}>Source-reported access: {chapterLabel(selected.minChapter)} onward. Confirm in your save.</Text> : null}</> : null}
                            {selectedSubject.aliases.length ? <><SectionHeading title="Also indexed as" /><Text style={s.secondary}>{selectedSubject.aliases.join(' · ')}</Text></> : null}
                            {relatedEntries.length ? <><SectionHeading title="Related entries" /><View>{relatedEntries.map(entry => <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`Open ${libraryTitle(entry)}`} style={s.directoryRow} onPress={() => openItem(entry, true)}><Ionicons name={CATEGORY_ICONS[entry.category]} color={CATEGORY_COLORS[entry.category]} size={22} /><Text style={[s.detailText, { flex: 1 }]}>{libraryTitle(entry)}</Text><Ionicons name="chevron-forward" color={C.muted} size={18} /></Pressable>)}</View></> : null}
                        </> : null}
                        {(selected.sources?.length || selected.sourceUrl) ? <>
                            <SectionHeading title="Sources" />
                            {(selected.sources?.length ? selected.sources : [{ label: selected.sourceLabel || 'Original source', url: selected.sourceUrl! }]).map(src => <Pressable key={src.url} onPress={() => openUrl(src.url)} style={s.sourceRow}><Ionicons name="link-outline" size={19} color={C.aqua} /><Text style={{ color: C.aqua, flex: 1, fontSize: 14 }}>{src.label}</Text><Ionicons name="open-outline" size={16} color={C.muted} /></Pressable>)}
                        </> : null}
                    </ScrollView> : null}
                </SafeAreaView>
            </SafeAreaProvider>
        </Modal>
    </SafeAreaView></SafeAreaProvider></Appearance.Provider>;
}
export default function App() {
    const [fontsReady] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold });
    return <FontReady.Provider value={fontsReady}><MotionProvider><IViceApp /></MotionProvider></FontReady.Provider>;
}
const createStyles = (C: Palette, fontsReady: boolean) => {
    const regular = fontsReady ? 'Outfit_400Regular' : undefined;
    const medium = fontsReady ? 'Outfit_500Medium' : undefined;
    const semibold = fontsReady ? 'Outfit_600SemiBold' : undefined;
    return StyleSheet.create({
        sessionCard: {
            borderRadius: 8,
            padding: 18,
            gap: 16,
            backgroundColor: C.panel,
            borderLeftWidth: 3,
            borderLeftColor: C.pink,
        },
        wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
        launchGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: 24,
            paddingVertical: 16,
        },
        launchTile: {
            width: '23%',
            alignItems: 'center',
            gap: 10,
            minHeight: 88,
        },
        launchIcon: {
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: C.panel2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        launchLabel: {
            fontSize: 12,
            color: C.text,
            fontFamily: medium,
            textAlign: 'center',
        },
        safe: { flex: 1, backgroundColor: C.bg },
        center: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            gap: 15,
        },
        secondary: { color: C.muted, fontSize: 14, lineHeight: 21 },
        header: {
            minHeight: 76,
            paddingHorizontal: 24,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 44 },
        landscapeFrame: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', borderRadius: 8, backgroundColor: C.panel },
        landscapeImage: { width: '100%', height: '100%' },
        landscapeLabel: { fontSize: 16, fontFamily: medium, color: C.text },
        brandIcon: {
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: C.aqua,
            borderRadius: 11,
        },
        brand: {
            fontSize: 28,
            fontFamily: semibold,
            color: C.text,
            letterSpacing: 0,
        },
        brandCaption: {
            fontSize: 9,
            letterSpacing: 1.9,
            color: C.muted,
            fontWeight: '700',
        },
        headerProfile: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: C.panel,
            alignItems: 'center',
            justifyContent: 'center',
        },
        scrollContent: {
            paddingHorizontal: 24,
            paddingBottom: 32,
            paddingTop: 12,
            gap: 16,
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
        },
        hero: {
            padding: 23,
            borderRadius: 22,
            marginBottom: 3,
            overflow: 'hidden',
            minHeight: 240,
            justifyContent: 'center',
        },
        eyebrow: {
            fontSize: 12,
            color: C.aqua,
            letterSpacing: 0,
            fontFamily: medium,
        },
        heroTitle: {
            fontSize: 33,
            lineHeight: 38,
            fontWeight: '900',
            color: C.text,
            letterSpacing: -1.1,
            marginTop: 12,
        },
        heroSubtitle: {
            color: '#D6CEE1',
            fontSize: 13,
            lineHeight: 19,
            maxWidth: 300,
            marginTop: 8,
        },
        heroButton: {
            alignSelf: 'flex-start',
            backgroundColor: C.aqua,
            borderRadius: 12,
            paddingHorizontal: 17,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            marginTop: 20,
        },
        heroButtonText: {
            fontWeight: '900',
            fontSize: 11,
            color: C.bg,
            letterSpacing: 1.2,
        },
        statRow: { flexDirection: 'row', gap: 9 },
        statTile: {
            flex: 1,
            backgroundColor: C.panel,
            borderRadius: 13,
            padding: 13,
            borderColor: C.border,
            borderWidth: 1,
        },
        statNumber: { color: C.pink, fontWeight: '900', fontSize: 25 },
        statLabel: {
            color: C.muted,
            fontSize: 9,
            letterSpacing: 1,
            fontWeight: '800',
            marginTop: 4,
        },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 8,
        },
        sectionTitle: {
            fontSize: 20,
            color: C.text,
            fontFamily: medium,
            letterSpacing: 0,
            flexShrink: 1,
        },
        actionLink: {
            color: C.aqua,
            fontWeight: '800',
            fontSize: 10,
            letterSpacing: 1,
        },
        categoryGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 9,
        },
        categoryTile: {
            width: '48.6%',
            minHeight: 112,
            backgroundColor: C.panel,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: C.border,
            padding: 15,
            gap: 7,
        },
        categoryLabel: { color: C.text, fontWeight: '800', fontSize: 15 },
        categoryCount: { color: C.muted, fontSize: 12 },
        entryList: { gap: 0 },
        entryCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 18,
            borderColor: C.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
        },
        entryAvatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: C.panel,
            alignItems: 'center',
            justifyContent: 'center',
        },
        inline: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
        },
        entryTitle: {
            color: C.text,
            fontFamily: medium,
            fontSize: 16,
            flexShrink: 1,
        },
        entryMeta: {
            color: C.muted,
            fontSize: 11,
            fontFamily: regular,
            letterSpacing: 0,
        },
        entrySummary: { fontSize: 13, color: C.muted, lineHeight: 19 },
        progressTrack: {
            height: 5,
            backgroundColor: '#3A3850',
            borderRadius: 5,
            overflow: 'hidden',
            marginTop: 7,
        },
        progressFill: {
            height: '100%',
            backgroundColor: C.aqua,
            borderRadius: 5,
        },
        disclaimer: {
            color: C.muted,
            fontSize: 11,
            lineHeight: 17,
            marginTop: 8,
        },
        screenTitle: {
            color: C.text,
            fontSize: 28,
            fontFamily: semibold,
            letterSpacing: 0,
        },
        searchWrap: {
            backgroundColor: C.panel,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
        },
        searchField: { color: C.text, flex: 1, paddingVertical: 14, paddingHorizontal: 10, fontSize: 15, fontFamily: regular },
        entryImage: { width: 88, height: 66, borderRadius: 6, backgroundColor: C.panel, alignSelf: 'flex-start' },
        segmented: { flexDirection: 'row', backgroundColor: C.panel, borderRadius: 8, padding: 4 },
        mapTool: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
        storyPortraits: { height: 44, flexShrink: 0 },
        storyPortrait: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.border, backgroundColor: C.panel2 },
        storyChapterRail: { flexDirection: 'row', position: 'relative', paddingVertical: 8 },
        storyChapterLine: { position: 'absolute', height: 1, backgroundColor: C.border, top: 26, left: '10%', right: '10%' },
        storyChapterStop: { flex: 1, alignItems: 'center', gap: 5, minHeight: 60 },
        storyChapterDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
        storyChapterNumber: { color: C.muted, fontSize: 16, fontFamily: medium },
        storyPosition: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
        storyJobRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.border },
        storyHidden: { paddingVertical: 10 },
        storyConnector: { minHeight: 28, marginLeft: 12, width: 20, alignItems: 'center', justifyContent: 'center' },
        storyFocus: { borderLeftWidth: 3, borderLeftColor: C.aqua, paddingLeft: 14, paddingVertical: 12, gap: 12 },
        storyFocusTitle: { fontFamily: medium, fontSize: 20, color: C.text },
        storyCommand: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
        storyOptional: { borderLeftWidth: 1, borderStyle: 'dashed', borderColor: C.yellow, paddingLeft: 14, gap: 8, marginTop: 12 },
        mapToolFace: { width: 34, height: 34, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
        mapTooltip: { position: 'absolute', right: 0, top: 43, width: 132, padding: 8, borderRadius: 4, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border },
        mapViewTools: { flexDirection: 'row', alignItems: 'center' },
        mapSearch: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderBottomWidth: 1, borderColor: C.border, zIndex: 2 },
        mapSearchInput: { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 8, fontSize: 15, fontFamily: regular, color: C.text },
        mapCategoryRail: { borderBottomWidth: 1, borderColor: C.border },
        mapCategory: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', paddingHorizontal: 2 },
        mapCategoryText: { fontSize: 14, fontFamily: medium, color: C.muted },
        mapSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
        mapFilterPanel: { gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.border },
        mapFilterOption: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44 },
        segment: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 5 },
        segmentActive: { backgroundColor: C.panel2 },
        segmentText: { fontFamily: medium, fontSize: 13, color: C.muted, textAlign: 'center' },
        directoryRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.border },
        chipRow: { flexGrow: 0, marginTop: 4 },
        chip: {
            borderWidth: 1,
            borderColor: C.border,
            backgroundColor: C.panel,
            paddingHorizontal: 13,
            paddingVertical: 10,
            minHeight: 44,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        chipActive: { backgroundColor: C.aqua, borderColor: C.aqua },
        chipText: { color: C.text, fontFamily: medium, fontSize: 13 },
        chipTextActive: { color: C.bg },
        resultRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' },
        smallLabel: {
            color: C.muted,
            fontSize: 12,
            fontFamily: medium,
            letterSpacing: 0,
        },
        empty: {
            textAlign: 'center',
            color: C.muted,
            fontSize: 14,
            padding: 30,
        },
        trackHero: {
            backgroundColor: '#2A213D',
            borderRadius: 19,
            padding: 20,
            gap: 10,
            borderWidth: 1,
            borderColor: '#63416A',
        },
        trackSmall: {
            color: C.aqua,
            fontWeight: '800',
            fontSize: 10,
            letterSpacing: 1.2,
        },
        trackNumber: { color: C.text, fontSize: 43, fontWeight: '900' },
        trackerGroup: {
            backgroundColor: C.panel,
            borderColor: C.border,
            borderWidth: 1,
            borderRadius: 15,
            padding: 15,
            gap: 5,
        },
        trackerHead: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 5,
        },
        trackerTitle: {
            color: C.text,
            fontWeight: '800',
            fontSize: 15,
            flex: 1,
        },
        trackerMeta: { color: C.aqua, fontWeight: '800' },
        stepRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 8,
        },
        stepText: { color: C.text, fontSize: 13, lineHeight: 20, flex: 1 },
        stepDone: { color: C.muted, textDecorationLine: 'line-through' },
        formCard: {
            backgroundColor: C.panel,
            borderColor: C.border,
            borderWidth: 1,
            borderRadius: 16,
            padding: 16,
            gap: 12,
        },
        inputLabel: {
            color: C.aqua,
            letterSpacing: 1.4,
            fontSize: 11,
            fontWeight: '900',
        },
        textInput: {
            color: C.text,
            borderColor: C.border,
            borderWidth: 1,
            borderRadius: 8,
            backgroundColor: C.bg,
            paddingHorizontal: 13,
            paddingVertical: 12,
            fontSize: 14,
            fontFamily: regular,
        },
        primaryButton: {
            backgroundColor: C.pink,
            padding: 14,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 11,
            flexDirection: 'row',
            gap: 7,
        },
        primaryButtonText: {
            color: C.bg,
            fontWeight: '900',
            letterSpacing: 1,
            fontSize: 12,
        },
        noteCard: {
            backgroundColor: C.panel,
            borderColor: C.border,
            borderWidth: 1,
            borderRadius: 14,
            padding: 15,
            gap: 10,
        },
        noteTitle: { color: C.text, fontWeight: '800', fontSize: 15, flex: 1 },
        noteBody: { color: C.muted, fontSize: 14, lineHeight: 20 },
        noteDate: { color: '#8A869E', fontSize: 11 },
        settingRow: {
            borderColor: C.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 15,
        },
        settingTitle: {
            fontSize: 15,
            color: C.text,
            fontFamily: medium,
            marginBottom: 4,
        },
        profileRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 14,
            minHeight: 56,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderColor: C.border,
        },
        profileLabel: { color: C.text, fontSize: 14, flex: 1 },
        addProfile: { flexDirection: 'row', gap: 8, alignItems: 'center' },
        smallButton: {
            width: 45,
            height: 45,
            backgroundColor: C.aqua,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
        },
        outlineButton: {
            padding: 13,
            borderWidth: 1,
            borderColor: C.aqua,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            justifyContent: 'center',
        },
        outlineButtonText: {
            fontFamily: medium,
            color: C.aqua,
            fontSize: 14,
            letterSpacing: 0,
        },
        nav: {
            minHeight: 68,
            borderTopColor: C.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            backgroundColor: C.panel,
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingTop: 9,
        },
        navItem: {
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            flex: 1,
        },
        navLabel: { color: C.muted, fontSize: 11, fontFamily: medium, textAlign: 'center' },
        navDot: {
            height: 3,
            width: 18,
            backgroundColor: C.pink,
            borderRadius: 3,
        },
        detailHeader: {
            minHeight: 60,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 15,
            borderBottomWidth: 1,
            borderColor: C.border,
        },
        detailIcon: {
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
        },
        detailHeaderTitle: {
            color: C.muted,
            fontFamily: medium,
            fontSize: 14,
            letterSpacing: 0,
            flexShrink: 1,
        },
        detailBody: { padding: 24, paddingBottom: 48, gap: 20, width: '100%', maxWidth: 720, alignSelf: 'center' },
        detailBanner: {
            height: 78,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
        },
        detailBannerText: {
            fontSize: 11,
            color: C.aqua,
            letterSpacing: 2,
            fontWeight: '800',
        },
        detailTitle: {
            fontFamily: semibold,
            fontSize: 28,
            color: C.text,
            letterSpacing: 0,
        },
        detailLead: { fontSize: 17, color: C.muted, lineHeight: 25 },
        badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
        badge: {
            color: C.aqua,
            fontSize: 10,
            letterSpacing: 0,
            fontFamily: medium,
            paddingVertical: 4,
            paddingRight: 8,
        },
        separator: { height: 1, backgroundColor: C.border, marginVertical: 5 },
        detailText: { color: C.text, fontSize: 15, lineHeight: 24 },
        sourceRow: {
            paddingVertical: 16,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderColor: C.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
    });
};
