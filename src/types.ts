export type Category = 'Places' | 'People' | 'Play Guides' | 'Collections' | 'Money' | 'Story' | 'Vehicles';
export type GuideSourceType = 'official' | 'community' | 'template';
export type GuideStep = {id:string;label:string};
export type GuideSource = {label:string;url:string};
export type GuideEntry = {
  id:string; title:string; category:Category; summary:string; body:string; region:string;
  sourceType:GuideSourceType; sourceUrl:string|null; sourceLabel:string|null;
  sources?:GuideSource[]; spoiler:boolean; tags:string[]; steps:GuideStep[];
  stage?:string; vehicleClass?:string; confidence?:'reported'|'template'|'confirmed'; recommendation?:string;
};
export type Profile = {id:string;name:string};
export type Note = {id:string;profileId:string;title:string;body:string;createdAt:string};
export type Tab = 'Home' | 'Library' | 'Track' | 'Notes' | 'Settings';
