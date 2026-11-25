import type { ThemeName } from './types';
const classic = { bg: '#141416', panel: '#202023', panel2: '#303135', border: '#38383C', text: '#F4F4F1', muted: '#AEB0B5', pink: '#F190B0', aqua: '#8CD6D7', yellow: '#E7C36B', violet: '#C5B4D9' };
export type Palette = typeof classic;
export const THEMES: Record<ThemeName, Palette> = {
    jason: { bg: '#141716', panel: '#212624', panel2: '#303B36', border: '#39413D', text: '#F4F5F1', muted: '#AFBAB3', pink: '#F4A38F', aqua: '#A8D8B7', yellow: '#E7C36B', violet: '#B6C7DF' },
    lucia: { bg: '#181516', panel: '#282224', panel2: '#3D3034', border: '#45393E', text: '#F8F3F2', muted: '#C2AFB7', pink: '#F3A3AF', aqua: '#98D1CB', yellow: '#E7C36B', violet: '#D5B5DF' },
    classic
};
export function parseTheme(raw: string): ThemeName { return raw === 'lucia' || raw === 'classic' || raw === 'jason' ? raw : 'jason' }
