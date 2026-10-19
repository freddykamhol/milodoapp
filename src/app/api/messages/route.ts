import {NextResponse} from "next/server";
import {getViewer} from "@/lib/viewer";
import {canSendMessages} from "@/lib/message-types";
import {messageOutbox,messageRecipientUsers} from "@/lib/messages";
import {MessageValidationError,parseRecipients} from "@/lib/message-outbox";
import {getSmtpConfig} from "@/lib/smtp-mail";
import {wakeMessageScheduler} from "@/lib/message-scheduler";
export const runtime='nodejs';
export async function GET(){const viewer=await getViewer();if(!viewer)return NextResponse.json({error:'Nicht angemeldet.'},{status:401});if(!canSendMessages(viewer.role))return NextResponse.json({error:'Keine Berechtigung.'},{status:403});return NextResponse.json({items:messageOutbox.list()},{headers:{'cache-control':'no-store'}});}
export async function POST(request:Request){
 const viewer=await getViewer();if(!viewer)return NextResponse.json({error:'Nicht angemeldet.'},{status:401});if(!canSendMessages(viewer.role))return NextResponse.json({error:'Keine Berechtigung.'},{status:403});
 try{
  // Bound the actual stream as well as Content-Length before multipart parsing.
  const limit=22*1024*1024;
  if(Number(request.headers.get('content-length'))>limit)return NextResponse.json({error:'Anhänge dürfen zusammen maximal 20 MB groß sein.'},{status:413});
  const reader=request.body?.getReader();if(!reader)throw new MessageValidationError('Formular fehlt.');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();return NextResponse.json({error:'Anhänge dürfen zusammen maximal 20 MB groß sein.'},{status:413});}chunks.push(part.value);}}finally{reader.releaseLock();}
  const form=await new Response(Buffer.concat(chunks),{headers:{'content-type':request.headers.get('content-type')??''}}).formData();
  const subject=String(form.get('subject')??'').trim(),body=String(form.get('body')??'').trim(),token=String(form.get('token')??'');
  if(!subject||subject.length>200||/[\r\n]/.test(subject))throw new MessageValidationError('Bitte einen Betreff mit maximal 200 Zeichen eingeben.');
  if(!body||body.length>100000)throw new MessageValidationError('Bitte einen Inhalt mit maximal 100.000 Zeichen eingeben.');
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(token))throw new MessageValidationError('Ungültige Versandkennung. Bitte die Seite neu laden.');
  const rawDate=form.get('scheduledAt'),date=rawDate?Date.parse(String(rawDate)):Date.now();
  if(!Number.isFinite(date)||(rawDate&&date<Date.now()+10000)||date>Date.now()+366*86400000)throw new MessageValidationError('Bitte einen zukünftigen Versandtermin innerhalb des nächsten Jahres wählen.');
  const {selection,emails}=parseRecipients(JSON.parse(String(form.get('recipients')??'null')),await messageRecipientUsers());
  const rawFiles=form.getAll('files');if(rawFiles.length>10)throw new MessageValidationError('Maximal 10 Anhänge sind möglich.');
  const files=[];let bytes=0;
  for(const file of rawFiles){if(!(file instanceof File)||!file.size)throw new MessageValidationError('Ein Anhang ist leer oder ungültig.');bytes+=file.size;if(file.size>10*1024*1024||bytes>20*1024*1024)throw new MessageValidationError('Maximal 10 MB je Datei und 20 MB insgesamt.');files.push({name:file.name.replace(/[\r\n\x00-\x1f\\/]/g,'_').slice(0,180)||'Anhang',mimeType:file.type||'application/octet-stream',content:Buffer.from(await file.arrayBuffer())});}
  const smtp=await getSmtpConfig();if(!smtp.ok)return NextResponse.json({error:'SMTP ist nicht vollständig eingerichtet oder deaktiviert. Bitte zuerst die E-Mail-Einstellungen prüfen.'},{status:409});
  const job=messageOutbox.enqueue({senderId:viewer.id,token,subject,body,selection,emails,scheduledAt:date,files});
  wakeMessageScheduler();return NextResponse.json({id:job.id,existing:job.existing},{status:202});
 }catch(error){if(error instanceof MessageValidationError||error instanceof SyntaxError||error instanceof TypeError)return NextResponse.json({error:error instanceof MessageValidationError?error.message:'Das Formular konnte nicht gelesen werden.'},{status:400});console.error('[messages] Nachricht konnte nicht gespeichert werden',error);return NextResponse.json({error:'Nachricht konnte nicht gespeichert werden.'},{status:500});}
}
