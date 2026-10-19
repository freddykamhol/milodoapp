export const COURSE_TYPES=[
 {id:'EH_AUSBILDUNG',label:'Erste-Hilfe Ausbildung',description:'Erste-Hilfe-Ausbildung (Grundkurs) für betriebliche Ersthelfer sowie Führerscheinbewerber',units:9,pauseMinutes:45},
 {id:'EH_FORTBILDUNG',label:'Erste-Hilfe Fortbildung / Training',description:'Erste-Hilfe-Fortbildung (Auffrischungskurs) für aktive Ersthelfer im Betrieb mit gültigem Grundkurs und Personen mit Vorkenntnissen',units:9,pauseMinutes:45},
 {id:'EH_BILDUNG',label:'Erste-Hilfe-Schulung in Bildungs- u. Betreuungseinrichtungen',description:'Erste-Hilfe-Schulung in Bildungs- und Betreuungseinrichtungen',units:9,pauseMinutes:45},
 {id:'NOTFALL_KOMPAKT',label:'Notfalltraining - kompakt',description:'Kompaktes Notfalltraining',units:4,pauseMinutes:0},
 {id:'NOTFALL_INTENSIV',label:'Notfalltraining - intensiv',description:'Intensives Notfalltraining',units:6,pauseMinutes:0},
] as const;
export type CourseTypeId=typeof COURSE_TYPES[number]['id'];
export const courseType=(id:unknown)=>COURSE_TYPES.find(type=>type.id===id);
export function courseEnd(start:Date,type:CourseTypeId){const info=courseType(type)!;return new Date(+start+(info.units*45+info.pauseMinutes)*60000);}
export function courseDuration(type:CourseTypeId){const info=courseType(type)!;const minutes=info.units*45+info.pauseMinutes;return `${info.units} UE · ${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')} Std.${info.pauseMinutes?' inkl. 45 Min. Pause':''}`;}
export type CourseParticipant={id:number;firstName:string;lastName:string;dateOfBirth:string;present:boolean;source:'INTERNAL'|'EXTERNAL'};
export type CourseData={id:number;title:string;customerId:number;courseType:string|null;participantLimit:number|null;startAt:string;endAt:string|null;location:string;locationDetails?:{name:string;street:string;houseNumber:string;plz:string;city:string};courseLocationType?:'OWN'|'EXTERNAL';customerName:string;notes:string;requirements?:Array<{kind:'QUAL_RD'|'QUAL_AUSB';value:string;minCount:number}>;state:string;approved:boolean;staffingStatus:string;registrationEnabled:boolean;registrationExpiresAt:string|null;canManage:boolean;canOperate:boolean;canStaff:boolean;participants:CourseParticipant[];materials?:Array<{id:number;itemId:number|null;name:string;inventoryNumber:string;quantity:number}>;files?:Array<{id:number;fileName:string;mimeType:string;sizeBytes:number}>};
