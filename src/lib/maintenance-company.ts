export type MaintenanceCompany={id:number;name:string;address:string;street:string;postalCode:string;city:string;phone:string;email:string;contactPerson:string};
export class CompanyValidationError extends Error{}
export function isDuplicateCompany(error:unknown):boolean{if(!error||typeof error!=='object')return false;const value=error as {code?:unknown;cause?:unknown};return String(value.code).includes('CONSTRAINT_UNIQUE')||Boolean(value.cause&&value.cause!==error&&isDuplicateCompany(value.cause));}
export function validateCompany(input:unknown){
 if(!input||typeof input!=='object')throw new CompanyValidationError('Ungültige Firmendaten.');
 const body=input as Record<string,unknown>;
 const read=(key:string,label:string,max:number,required=false)=>{const value=body[key]??'';if(typeof value!=='string')throw new CompanyValidationError(`${label} ist ungültig.`);const result=value.trim();if((required&&!result)||result.length>max)throw new CompanyValidationError(`${label} bitte ausfüllen (maximal ${max} Zeichen).`);return result;};
 const name=read('name','Firmenname',200,true),street=read('street','Straße und Hausnummer',250,true),postalCode=read('postalCode','Postleitzahl',20,true),city=read('city','Ort',200,true),phone=read('phone','Telefon',100),email=read('email','E-Mail',254),contactPerson=read('contactPerson','Ansprechpartner',200);
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new CompanyValidationError('Bitte eine gültige E-Mail-Adresse eingeben.');
 return {name,street,postalCode,city,phone,email,contactPerson,address:`${street}, ${postalCode} ${city}`};
}
