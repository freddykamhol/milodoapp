export type DefectDomain='vehicle'|'inventory';
export type DefectAppointment={id:number;domain:DefectDomain;defectId:number;defectTitle:string;defectHref:string;assetLabel:string;title:string;description:string;location:string;companyId:number|null;companyName:string;startAt:string;endAt:string|null};
export type DefectAppointmentCompany={id:number;name:string;address:string};
