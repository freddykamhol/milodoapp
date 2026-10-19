import {NextResponse} from "next/server";
import {getViewer} from "@/lib/viewer";
import {db} from "@/lib/db";
import {defectAppointments} from "@/db/schema";
import {DefectAppointmentError,loadDefectAppointments,loadDefectAppointmentCompanies,requireDefect,validateDefectAppointment} from "@/lib/defect-appointments";
export async function GET(request:Request){
 const viewer=await getViewer();if(!viewer)return NextResponse.json({error:'Nicht angemeldet.'},{status:401});if(viewer.role==='KUNDE')return NextResponse.json({error:'Keine Berechtigung.'},{status:403});
 const query=new URL(request.url).searchParams;
 if(query.get('companies')==='1'){if(viewer.role!=='ADMIN'&&viewer.role!=='VERWALTUNG')return NextResponse.json({error:'Keine Berechtigung.'},{status:403});return NextResponse.json({companies:await loadDefectAppointmentCompanies()});}
 const domain=query.get('domain'),defectId=query.has('defectId')?Number(query.get('defectId')):undefined,assetId=query.has('assetId')?Number(query.get('assetId')):undefined;
 if((domain!=='vehicle'&&domain!=='inventory')||(defectId===undefined&&assetId===undefined)||[defectId,assetId].some(id=>id!==undefined&&(!Number.isSafeInteger(id)||id<1)))return NextResponse.json({error:'Ungültige Zuordnung.'},{status:400});
 return NextResponse.json({appointments:await loadDefectAppointments({domain,defectId,assetId})},{headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request){
 const viewer=await getViewer();if(!viewer)return NextResponse.json({error:'Nicht angemeldet.'},{status:401});if(viewer.role!=='ADMIN'&&viewer.role!=='VERWALTUNG')return NextResponse.json({error:'Keine Berechtigung.'},{status:403});
 try{const body=await request.json();const parent=await requireDefect(body.domain,body.defectId),values=await validateDefectAppointment(body);const [row]=await db.insert(defectAppointments).values({...parent,...values,createdAt:new Date(),updatedAt:new Date(),createdById:viewer.id}).returning({id:defectAppointments.id});return NextResponse.json({id:row.id},{status:201});}
 catch(error){if(error instanceof DefectAppointmentError)return NextResponse.json({error:error.message},{status:error.status});if(error instanceof SyntaxError||error instanceof TypeError)return NextResponse.json({error:'Ungültiges Formular.'},{status:400});console.error('[defect-appointments] create failed',error);return NextResponse.json({error:'Termin konnte nicht gespeichert werden. Bitte die Zuordnung aktualisieren.'},{status:409});}
}
