import {removeDefectImage} from "@/lib/defect-image-actions";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { inventoryDefects } from "@/db/schema";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { defectStatuses, type DefectStatus } from "@/lib/defects";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const viewer=await getViewer();if(!viewer)return NextResponse.json({error:"Nicht angemeldet"},{status:401});if(viewer.role!=="ADMIN"&&viewer.role!=="VERWALTUNG")return NextResponse.json({error:"Keine Berechtigung"},{status:403});const id=Number((await params).id),body=await request.json().catch(()=>null);if(body?.action==='removeImage')return removeDefectImage('inventory',id,body.index,body.expected);if(!Number.isInteger(id)||!defectStatuses.includes(body?.status))return NextResponse.json({error:"Ungültiger Status"},{status:400});const rows=await db.update(inventoryDefects).set({status:body.status as DefectStatus,updatedAt:new Date()}).where(eq(inventoryDefects.id,id)).returning({id:inventoryDefects.id});if(!rows.length)return NextResponse.json({error:"Mangel nicht gefunden"},{status:404});return NextResponse.json({ok:true});}
