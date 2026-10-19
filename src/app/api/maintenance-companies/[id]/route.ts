import {NextResponse} from "next/server";
import {eq} from "drizzle-orm";
import {db} from "@/lib/db";
import {vehicleServiceCompanies} from "@/db/schema";
import {getViewer} from "@/lib/viewer";
import {validateCompany,CompanyValidationError,isDuplicateCompany} from "@/lib/maintenance-company";
async function access(){const viewer=await getViewer();return !viewer?NextResponse.json({error:'Nicht angemeldet.'},{status:401}):viewer.role!=='ADMIN'&&viewer.role!=='VERWALTUNG'?NextResponse.json({error:'Keine Berechtigung.'},{status:403}):null;}
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){
 const denied=await access();if(denied)return denied;const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'Ungültige Firma.'},{status:400});
 const company=await db.query.vehicleServiceCompanies.findFirst({where:eq(vehicleServiceCompanies.id,id)});return company?NextResponse.json({company},{headers:{'cache-control':'no-store'}}):NextResponse.json({error:'Firma nicht gefunden.'},{status:404});
}
export async function PATCH(request:Request,{params}:Context){
 const denied=await access();if(denied)return denied;const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'Ungültige Firma.'},{status:400});
 try{const values=validateCompany(await request.json());const [company]=await db.update(vehicleServiceCompanies).set({...values,updatedAt:new Date()}).where(eq(vehicleServiceCompanies.id,id)).returning();return company?NextResponse.json({company}):NextResponse.json({error:'Firma nicht gefunden.'},{status:404});}
 catch(error){if(error instanceof CompanyValidationError||error instanceof SyntaxError)return NextResponse.json({error:error.message},{status:400});if(isDuplicateCompany(error))return NextResponse.json({error:'Eine Firma mit diesem Namen existiert bereits.'},{status:409});console.error('[maintenance-companies] update failed',error);return NextResponse.json({error:'Firma konnte nicht gespeichert werden.'},{status:500});}
}
export async function DELETE(_request:Request,{params}:Context){
 const denied=await access();if(denied)return denied;const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'Ungültige Firma.'},{status:400});
 const rows=await db.delete(vehicleServiceCompanies).where(eq(vehicleServiceCompanies.id,id)).returning({id:vehicleServiceCompanies.id});return rows.length?NextResponse.json({ok:true}):NextResponse.json({error:'Firma nicht gefunden.'},{status:404});
}
