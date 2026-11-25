import type {ThemeName} from './types';
const classic={bg:'#0B0D19',panel:'#17192D',panel2:'#22243B',border:'#353451',text:'#F5F1F8',muted:'#A8A4BC',pink:'#FF59A8',aqua:'#5CE8DE',yellow:'#FFC66D',violet:'#A78BFA'};
export type Palette=typeof classic;
export const THEMES:Record<ThemeName,Palette>={
 jason:{bg:'#101415',panel:'#1C2324',panel2:'#283333',border:'#3D4B4B',text:'#F2F5F2',muted:'#AABBB7',pink:'#E4AB72',aqua:'#A4E1C5',yellow:'#FFD084',violet:'#B9C7E3'},
 lucia:{bg:'#15111C',panel:'#241D2D',panel2:'#302439',border:'#514158',text:'#F9F1F7',muted:'#C4B2CB',pink:'#FF96BD',aqua:'#C9B3FF',yellow:'#FFD5A1',violet:'#B8B6F8'},
 classic
};
export function parseTheme(raw:string):ThemeName{return raw==='lucia'||raw==='classic'||raw==='jason'?raw:'jason'}
