import type { LibraryPhoto } from './library-media.generated';
import { PLAYBOOK_MEDIA } from './playbook-media.generated';

export type CommunityMedia = { photos: LibraryPhoto[]; credit: string; aspectRatio: number; video?: number };
const chapterOne = [
    require('../data/community-media/playbook-story/d6l0z0d4mq3i1.png'),
    require('../data/community-media/playbook-story/5nxhb345mq3i1.png'),
    require('../data/community-media/playbook-story/rouc3h16mq3i1.png'),
];
const chapterTwo = [
    require('../data/community-media/playbook-story/yeikybv6mq3i1.png'),
    require('../data/community-media/playbook-story/pjwj0zo7mq3i1.png'),
];
const poster = require('../data/community-media/cargo-van/thumbnail.jpg');
const photos = (sources: number[], chapter: number): LibraryPhoto[] => sources.map((source, index) => ({
    source, thumbnail: source, label: `Chapter ${chapter}, slide ${index + 1}`,
    original: 'u/Colty_00 / Eric Smash',
}));

export const COMMUNITY_MEDIA: Record<string, CommunityMedia> = {
    ...PLAYBOOK_MEDIA,
    'reddit-playbook-brian-meetings': {
        photos: photos(chapterOne, 1), credit: 'Eric Smash / u/Colty_00', aspectRatio: 4 / 5,
    },
    'reddit-playbook-vehicle-ownership': {
        photos: photos(chapterTwo, 2), credit: 'Eric Smash / u/Colty_00', aspectRatio: 4 / 5,
    },
    'reddit-playbook-cargo-van': {
        photos: [{ source: poster, thumbnail: poster, label: 'Cargo-van video preview', original: 'Cyber_Cycosis / u/Daddy_Shr00mz' }],
        video: require('../data/community-media/cargo-van/video.mp4'),
        credit: 'Cyber_Cycosis / u/Daddy_Shr00mz', aspectRatio: 640 / 358,
    },
};