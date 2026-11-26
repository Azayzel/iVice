import type { Chapter } from './types';

const overviewUrl = 'https://www.powerpyx.com/gta-6-full-walkthrough-all-missions/';
type ChapterRoute = {
    requirement: string;
    trigger: string;
    milestones: string[];
    optional: string;
    warning: string;
    sourceUrl: string;
};

const routes: Record<Exclude<Chapter, 0>, ChapterRoute> = {
    1: {
        requirement: 'Follow the main-story missions through the chapter-ending sequence. Optional errands are not chapter requirements.',
        trigger: 'Finish Discharge Time. What\'s in the Bag? then starts automatically in Chapter 2.',
        milestones: ['Home Sweet Home leads directly into Discharge Time.', 'Complete Discharge Time to enter Chapter 2.'],
        optional: 'Shirley\'s rum and scooter jobs are listed as optional and Chapter 1-exclusive. Groceries, flowers and the necklace are also listed as optional.',
        warning: 'Some optional tasks expire. Keep a separate manual save before the closing story sequence; there is no mission replay according to the walkthrough.',
        sourceUrl: 'https://www.powerpyx.com/gta-6-discharge-time-walkthrough/'
    },
    2: {
        requirement: 'Complete the other Chapter 2 main missions and have at least $15,000. Side-quest chains are not listed as chapter requirements.',
        trigger: 'Checking Out (Move to Vice City) is the transition mission. It leads into Welcome to Vice City in Chapter 3.',
        milestones: ['Finish the available Chapter 2 main quests, including Coffee Break.', 'Meet the $15,000 requirement for Prepare for Vice City.', 'After the partner call, return to the motel to start Checking Out.'],
        optional: 'Kyle\'s farm and chemical jobs, Billy\'s mud-club jobs, and Bret\'s introduction are listed as optional. They are not extra prerequisites for Checking Out.',
        warning: 'Starting the transition changes your home access. Save before committing if you want to revisit this part of the story.',
        sourceUrl: 'https://www.powerpyx.com/gta-6-checking-out-move-to-vice-city-walkthrough/'
    },
    3: {
        requirement: 'Complete all other Chapter 3 main missions and the required heist preparation. Wait for the story contact; optional racing and side jobs are separate.',
        trigger: 'Finish The Cartel Heist, then proceed to Ocean Beach to begin Chapter 4.',
        milestones: ['Complete Hidden Charges and all other Chapter 3 main missions.', 'Wait for Raul to contact you, then meet at the planning room.', 'Finish The Cartel Heist; Ocean Beach is the next chapter\'s opening mission.'],
        optional: 'Yago\'s racing missions and Billy\'s Mall Rats are listed as optional. Race Against Yago is specifically marked time-sensitive and missable.',
        warning: 'Do not treat every job from a recurring contact as optional: required story jobs and side jobs can share characters.',
        sourceUrl: 'https://www.powerpyx.com/gta-6-the-cartel-heist-walkthrough/'
    },
    4: {
        requirement: 'Follow the main-story route through the final consecutive missions. The closing mission has a direct story prerequisite, not a completion-percentage requirement.',
        trigger: 'Finish Starting From Zero. Bird in the Hand then starts automatically in Chapter 5.',
        milestones: ['Complete Sunset; Starting From Zero begins immediately afterwards.', 'Complete Starting From Zero to enter Chapter 5.'],
        optional: 'The date, Eddie Acosta\'s party and picking up Shayna are listed as optional. Shayna\'s task is marked time-sensitive and missable.',
        warning: 'The final missions run together. Make a separate manual save before starting the closing sequence.',
        sourceUrl: 'https://www.powerpyx.com/gta-6-starting-from-zero-walkthrough/'
    },
    5: {
        requirement: 'This is the final chapter in the published five-chapter route. Continue the main-story missions; there is no Chapter 6 in that route.',
        trigger: 'The mission index ends with The End of the Road and the endings. It does not list another chapter.',
        milestones: [],
        optional: 'Optional activities and completion goals are separate from finishing the main story.',
        warning: 'Ending prerequisites have not been reviewed here. No ending choice or outcome is inferred from the mission list.',
        sourceUrl: overviewUrl
    }
};

export type StoryCharacter = 'Jason' | 'Lucia' | 'Both' | 'Unknown';
export type StoryJob = {
    id: string;
    chapter: Exclude<Chapter, 0>;
    title: string;
    kind: 'Required' | 'Optional' | 'Transition';
    location: string | null;
    character: StoryCharacter;
    requires: string[];
    conditions?: string;
    sourceUrl?: string;
};

const jobs: StoryJob[] = [
    { id: 'tourist-trap', chapter: 1, title: 'Tourist Trap', kind: 'Required', location: null, character: 'Unknown', requires: [], sourceUrl: 'https://www.powerpyx.com/gta-6-home-sweet-home-walkthrough/' },
    { id: 'home-sweet-home', chapter: 1, title: 'Home Sweet Home', kind: 'Required', location: "Key Lento / Jason's house", character: 'Lucia', requires: ['tourist-trap'], sourceUrl: 'https://www.powerpyx.com/gta-6-home-sweet-home-walkthrough/' },
    { id: 'discharge-time', chapter: 1, title: 'Discharge Time', kind: 'Transition', location: 'Vice City Hospital', character: 'Both', requires: ['home-sweet-home'], conditions: 'Starts as Lucia; switches to Jason during the escape.' },
    { id: 'shirley', chapter: 1, title: "Shirley's rum and scooter jobs", kind: 'Optional', location: null, character: 'Unknown', requires: [], conditions: 'Reported Chapter 1-exclusive.' },
    { id: 'whats-in-the-bag', chapter: 2, title: "What's in the Bag?", kind: 'Required', location: null, character: 'Unknown', requires: ['discharge-time'] },
    { id: 'breakfast-run', chapter: 2, title: 'Breakfast Run', kind: 'Required', location: null, character: 'Unknown', requires: [], sourceUrl: 'https://www.powerpyx.com/gta-6-coffee-break-walkthrough/' },
    { id: 'coffee-break', chapter: 2, title: 'Coffee Break', kind: 'Required', location: 'Kelly County / Starlet Motel', character: 'Both', requires: ['breakfast-run'], sourceUrl: 'https://www.powerpyx.com/gta-6-coffee-break-walkthrough/' },
    { id: 'prepare-vice-city', chapter: 2, title: 'Prepare for Vice City', kind: 'Required', location: null, character: 'Unknown', requires: [], conditions: 'At least $15,000. Money is one condition for the chapter transition, not the only requirement.' },
    { id: 'checking-out', chapter: 2, title: 'Checking Out', kind: 'Transition', location: 'Kelly County / motel', character: 'Both', requires: ['coffee-break', 'prepare-vice-city'], conditions: 'All other Chapter 2 main missions must also be finished. Return after the partner call. The source uses both Scarlet and Starlet for the motel name.' },
    { id: 'kyle', chapter: 2, title: "Kyle's farm and chemical jobs", kind: 'Optional', location: null, character: 'Unknown', requires: [] },
    { id: 'billy', chapter: 2, title: "Billy's mud-club jobs", kind: 'Optional', location: null, character: 'Unknown', requires: [] },
    { id: 'welcome-vice-city', chapter: 3, title: 'Welcome to Vice City', kind: 'Required', location: 'Vice City; exact start unverified', character: 'Unknown', requires: ['checking-out'] },
    { id: 'hidden-charges', chapter: 3, title: 'Hidden Charges', kind: 'Required', location: null, character: 'Unknown', requires: [] },
    { id: 'cartel-heist', chapter: 3, title: 'The Cartel Heist', kind: 'Transition', location: 'Vice City / Stockyard / planning room', character: 'Both', requires: ['hidden-charges'], conditions: 'All other Chapter 3 main missions, required heist preparation and a call from Raul. Only the named prerequisite is shown.' },
    { id: 'yago', chapter: 3, title: 'Race Against Yago', kind: 'Optional', location: null, character: 'Unknown', requires: [], conditions: 'Reported time-sensitive and missable.' },
    { id: 'mall-rats', chapter: 3, title: 'Mall Rats', kind: 'Optional', location: null, character: 'Unknown', requires: [] },
    { id: 'ocean-beach', chapter: 4, title: 'Ocean Beach', kind: 'Required', location: null, character: 'Unknown', requires: ['cartel-heist'], conditions: 'Chapter opening mission. Its title is not a verified start location.' },
    { id: 'sunset', chapter: 4, title: 'Sunset', kind: 'Required', location: null, character: 'Unknown', requires: [] },
    { id: 'starting-zero', chapter: 4, title: 'Starting From Zero', kind: 'Transition', location: 'Vice City / Southside', character: 'Both', requires: ['sunset'], conditions: 'Starts immediately after Sunset.' },
    { id: 'shayna', chapter: 4, title: 'Pick up Shayna', kind: 'Optional', location: null, character: 'Unknown', requires: [], conditions: 'Reported time-sensitive and missable.' },
    { id: 'bird-hand', chapter: 5, title: 'Bird in the Hand', kind: 'Required', location: null, character: 'Unknown', requires: ['starting-zero'], conditions: 'Starts automatically after the Chapter 4 finale.' },
    { id: 'end-road', chapter: 5, title: 'The End of the Road', kind: 'Required', location: null, character: 'Unknown', requires: [], conditions: 'Ending prerequisites have not been reviewed.' }
];

export function getStoryJobs(chapter: Chapter, reveal = false) {
    return reveal ? jobs.filter(job => job.chapter === chapter) : [];
}

export function getStoryJob(id: string | null, reveal = false) {
    return reveal ? jobs.find(job => job.id === id) ?? null : null;
}

export function getStoryLinks(id: string, reveal = false) {
    const job = getStoryJob(id, reveal);
    return {
        prerequisites: job ? jobs.filter(candidate => job.requires.includes(candidate.id)) : [],
        dependents: job ? jobs.filter(candidate => candidate.requires.includes(job.id)) : []
    };
}

export function getChapterRoadmap(chapter: Chapter, revealMissionNames = false) {
    if (chapter === 0) return null;
    const route = routes[chapter];
    return {
        chapter,
        nextChapter: chapter < 5 ? chapter + 1 : null,
        requirement: route.requirement,
        warning: route.warning,
        confidence: 'reported' as const,
        reviewedOn: '2026-11-25',
        sourceLabel: 'PowerPyx walkthrough',
        overviewUrl,
        details: revealMissionNames ? {
            trigger: route.trigger,
            milestones: route.milestones,
            optional: route.optional,
            sourceUrl: route.sourceUrl
        } : null
    };
}