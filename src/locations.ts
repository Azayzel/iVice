import type { Chapter, GuideEntry, PlaySession } from './types';
import { canRead } from './recommendations';

export const LOCATION_TYPES = ['Money', 'Vehicles', 'Shops', 'Collectibles', 'Activities'] as const;
export type LocationType = typeof LOCATION_TYPES[number];
export type LocationMap = {
    id: string; entryId: string; title: string; region: string; type: LocationType;
    image: string; crop: { left: number; top: number; width: number; height: number };
};
export const LOCATION_MAPS: LocationMap[] = [
    { id: 'key-lento-money', entryId: 'reddit-playbook-1y2v2yb', title: 'Key Lento: money', region: 'Leonida Keys', type: 'Money', image: '1y2v2yb/image-2.jpg', crop: { left: 0, top: 0.195, width: 1, height: 0.805 } },
    { id: 'key-lento-cards', entryId: 'reddit-playbook-1y2v2yb', title: 'Key Lento: collectible cards', region: 'Leonida Keys', type: 'Collectibles', image: '1y2v2yb/image-3.jpg', crop: { left: 0, top: 0.215, width: 1, height: 0.785 } },
    { id: 'key-lento-vehicles', entryId: 'reddit-playbook-1y2v2yb', title: 'Key Lento: standout vehicles', region: 'Leonida Keys', type: 'Vehicles', image: '1y2v2yb/image-4.jpg', crop: { left: 0, top: 0.215, width: 1, height: 0.785 } },
    { id: 'key-lento-services', entryId: 'reddit-playbook-1y2v2yb', title: 'Key Lento: vehicle services', region: 'Leonida Keys', type: 'Vehicles', image: '1y2v2yb/image-5.jpg', crop: { left: 0, top: 0.225, width: 1, height: 0.775 } },
    { id: 'key-lento-outfits', entryId: 'reddit-playbook-1y2v2yb', title: 'Key Lento: outfits', region: 'Leonida Keys', type: 'Shops', image: '1y2v2yb/image-6.jpg', crop: { left: 0, top: 0.19, width: 1, height: 0.81 } },
    { id: 'key-lento-atms', entryId: 'reddit-playbook-1y2v2yb', title: 'Key Lento: ATMs', region: 'Leonida Keys', type: 'Money', image: '1y2v2yb/image-7.jpg', crop: { left: 0, top: 0.19, width: 1, height: 0.81 } },
    { id: 'key-lento-shops', entryId: 'reddit-playbook-1y2v2yb', title: 'Key Lento: shops', region: 'Leonida Keys', type: 'Shops', image: '1y2v2yb/image-8.jpg', crop: { left: 0, top: 0.205, width: 1, height: 0.795 } },
    { id: 'key-lento-robberies', entryId: 'reddit-playbook-1y2v2yb', title: 'Key Lento: robberies', region: 'Leonida Keys', type: 'Activities', image: '1y2v2yb/image-10.jpg', crop: { left: 0, top: 0.205, width: 1, height: 0.795 } },
    { id: 'pfister-88-comet', entryId: 'reddit-playbook-1y3ckve', title: 'Pfister 88 Comet', region: '', type: 'Vehicles', image: '1y3ckve/image-2.jpg', crop: { left: 0, top: 0.54, width: 1, height: 0.43 } },
];

export type LocationFilters = {
    region: string; type: LocationType | 'All'; chapter: Chapter | 'All' | 'Unknown';
    query: string; savedOnly: boolean;
};
export const DEFAULT_LOCATION_FILTERS: LocationFilters = { region: '', type: 'All', chapter: 'All', query: '', savedOnly: false };

export function filterLocationMaps(entries: GuideEntry[], session: PlaySession, spoilers: boolean, favorites: ReadonlySet<string>, filters: LocationFilters) {
    const terms = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return LOCATION_MAPS.flatMap(map => {
        const entry = entries.find(entry => entry.id === map.entryId);
        if (!entry || entry.sourceType === 'template' || !canRead(entry, session, spoilers)) return [];
        if (filters.region && (filters.region === 'Unknown' ? Boolean(map.region) : map.region !== filters.region)) return [];
        if (filters.type !== 'All' && map.type !== filters.type) return [];
        if (filters.savedOnly && !favorites.has(entry.id)) return [];
        if (filters.chapter === 'Unknown' && entry.minChapter !== undefined) return [];
        if (typeof filters.chapter === 'number' && (entry.minChapter === undefined || entry.minChapter > filters.chapter || (entry.maxChapter !== undefined && entry.maxChapter < filters.chapter))) return [];
        const text = [map.title, map.region, map.type, entry.title, entry.summary, ...entry.tags].join(' ').toLowerCase();
        if (!terms.every(term => text.includes(term))) return [];
        return [{ ...map, entry }];
    });
}