import {NextResponse} from "next/server";
import {eq} from "drizzle-orm";
import {getViewer} from "@/lib/viewer";
import {db} from "@/lib/db";
import {defectAppointments} from "@/db/schema";
import {DefectAppointmentError,validateDefectAppointment} from "@/lib/defect-appointments";
async function manager(){const viewer=await getViewer();return !viewer?NextResponse.json({error:'Nicht angemeldet.'},{status:401}):viewer.role!=='ADMIN'&&viewer.role!=='VERWALTUNG'?NextResponse.json({error:'Keine Berechtigung.'},{status:403}):null;}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 const denied=await manager();if(denied)return denied;const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'Ungültiger Termin.'},{status:400});
 try{const values=await validateDefectAppointment(await request.json());const rows=await db.update(defectAppointments).set({...values,updatedAt:new Date()}).where(eq(defectAppointments.id,id)).returning({id:defectAppointments.id});return rows.length?NextResponse.json({ok:true}):NextResponse.json({error:'Termin nicht gefunden.'},{status:404});}
 catch(error){return NextResponse.json({error:error instanceof DefectAppointmentError?error.message:'Termin konnte nicht gespeichert werden.'},{status:error instanceof DefectAppointmentError?error.status:400});}
}
export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
 const denied=await manager();if(denied)return denied;const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'Ungültiger Termin.'},{status:400});
 const rows=await db.delete(defectAppointments).where(eq(defectAppointments.id,id)).returning({id:defectAppointments.id});return rows.length?NextResponse.json({ok:true}):NextResponse.json({error:'Termin nicht gefunden.'},{status:404});
}
