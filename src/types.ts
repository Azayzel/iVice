export type Category = 'Places' | 'People' | 'Play Guides' | 'Collections' | 'Money' | 'Story' | 'Vehicles' | 'Weapons';
export type GuideSourceType = 'official' | 'community' | 'template';
export type GuideStep = { id: string; label: string };
export type GuideSource = { label: string; url: string };
export type GuideEntry = {
  id: string; title: string; category: Category; summary: string; body: string; region: string;
  sourceType: GuideSourceType; sourceUrl: string | null; sourceLabel: string | null;
  sources?: GuideSource[]; spoiler: boolean; tags: string[]; steps: GuideStep[];
  minChapter?: 1 | 2 | 3 | 4 | 5; maxChapter?: 1 | 2 | 3 | 4 | 5; access?: 'chapter' | 'unknown' | 'general'; priority?: number; stage?: string; vehicleClass?: string; confidence?: 'reported' | 'template' | 'confirmed'; recommendation?: string;
};
export type Chapter = 0 | 1 | 2 | 3 | 4 | 5;
export type PlaySession = { chapter: Chapter; region: string; lastGuideId: string | null };
export type ThemeName = 'jason' | 'lucia' | 'classic';
export type Profile = { id: string; name: string };
export type Note = { id: string; profileId: string; title: string; body: string; createdAt: string };
export type Tab = 'Home' | 'Library' | 'Story' | 'Settings';
