import {NextResponse} from "next/server";
import {getViewer} from "@/lib/viewer";
import {canSendMessages} from "@/lib/message-types";
import {sqlite} from "@/lib/db";
export async function GET(request:Request,{params}:{params:Promise<{id:string;fileId:string}>}){
 const viewer=await getViewer();if(!viewer)return NextResponse.json({error:'Nicht angemeldet.'},{status:401});if(!canSendMessages(viewer.role))return NextResponse.json({error:'Keine Berechtigung.'},{status:403});
 const values=await params,id=Number(values.id),fileId=Number(values.fileId);if(!Number.isSafeInteger(id)||!Number.isSafeInteger(fileId))return new Response(null,{status:400});
 const file=sqlite.prepare('select name,mime_type,content from message_attachments where id=? and job_id=?').get(fileId,id) as {name:string;mime_type:string;content:Buffer}|undefined;
 if(!file)return new Response(null,{status:404});
 const safe=/^(image\/(png|jpeg|webp|gif|avif)|application\/pdf)$/.test(file.mime_type),inline=safe&&new URL(request.url).searchParams.get('inline')==='1';
 return new Response(Uint8Array.from(file.content),{headers:{'content-type':safe?file.mime_type:'application/octet-stream','content-disposition':(inline?'inline':'attachment')+'; filename*=UTF-8\'\''+encodeURIComponent(file.name),'cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"sandbox"}});
}
