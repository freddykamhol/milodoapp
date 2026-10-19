export type MessageRole = "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE";
export type MessageQualification = "SAN" | "RH" | "RS" | "RA" | "NFS" | "AUSBILDER";
export type RecipientSelection = { roles: MessageRole[]; qualifications?: MessageQualification[]; userIds: number[]; emails: string[] };
export type RecipientUser = { id: number; username: string; email: string | null; role: MessageRole; qualRD?: string | null; qualAusb?: string | null };
export const messageQualifications: {value:MessageQualification;label:string;description:string}[] = [
 {value:"SAN",label:"Sanitäter",description:"SAN"},
 {value:"RH",label:"Rettungshelfer",description:"RH"},
 {value:"RS",label:"Rettungssanitäter",description:"RS"},
 {value:"RA",label:"Rettungsassistenten",description:"RA"},
 {value:"NFS",label:"Notfallsanitäter",description:"NFS"},
 {value:"AUSBILDER",label:"Ausbilder",description:"Ausbildungsqualifikation"},
];
/** Mailing groups match stored profile qualifications, not service eligibility. */
export function hasMessageQualification(user:RecipientUser,qualification:MessageQualification){return qualification==="AUSBILDER"?user.qualAusb===qualification:user.qualRD===qualification;}
export function isMessageRecipient(user:RecipientUser,selection:RecipientSelection){return selection.roles.includes(user.role)||selection.userIds.includes(user.id)||(selection.qualifications??[]).some(qualification=>hasMessageQualification(user,qualification));}
export function messageRecipientEmails(users:RecipientUser[],selection:RecipientSelection){return [...new Set([...users.filter(user=>isMessageRecipient(user,selection)).flatMap(user=>user.email&&validEmail(user.email.trim())?[user.email.trim().toLowerCase()]:[]),...selection.emails.map(email=>email.trim().toLowerCase())])];}
export function deselectMessageUser(user:RecipientUser,selection:RecipientSelection,users:RecipientUser[]):RecipientSelection{
 const roles=selection.roles.filter(role=>role!==user.role),qualifications=(selection.qualifications??[]).filter(qualification=>!hasMessageQualification(user,qualification));
 const fromRemovedGroups=users.filter(item=>item.id!==user.id&&(selection.roles.filter(role=>!roles.includes(role)).includes(item.role)||(selection.qualifications??[]).filter(qualification=>!qualifications.includes(qualification)).some(qualification=>hasMessageQualification(item,qualification)))).map(item=>item.id);
 return {...selection,roles,qualifications,userIds:[...new Set([...selection.userIds,...fromRemovedGroups])].filter(id=>id!==user.id)};
}
export const messageRoles: { value: MessageRole; label: string }[] = [
 { value: "ADMIN", label: "Administratoren" }, { value: "VERWALTUNG", label: "Verwaltung" },
 { value: "PERSONAL", label: "Personal" }, { value: "KUNDE", label: "Kunden" },
];
export const messageStatusLabels: Record<string,string> = { QUEUED:"Wartet auf Versand", SCHEDULED:"Geplant", SENDING:"Wird gesendet", SENT:"Versendet", PARTIAL:"Teilweise versendet", FAILED:"Versand fehlgeschlagen", CANCELLED:"Abgebrochen", PENDING:"Ausstehend", UNKNOWN:"Versandstatus unklar" };
export type MessageSummary = { id:number; createdAt:string; scheduledAt:string; subject:string; status:string; sender:string; total:number; sent:number; failed:number; unknown:number; attachments:number };
export type MessageDetail = MessageSummary & { body:string; selection:RecipientSelection; deliveries:{id:number;email:string;status:string;error:string|null;sentAt:string|null}[]; files:{id:number;name:string;mimeType:string;sizeBytes:number}[] };
export const canSendMessages = (role:string) => role === "ADMIN" || role === "VERWALTUNG";
export const validEmail = (value:string) => value.length <= 254 && /^[^\s@<>;,\r\n]+@[^\s@<>;,\r\n]+\.[^\s@<>;,\r\n]+$/.test(value);
