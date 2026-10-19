import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {eq} from 'drizzle-orm';
import {db} from '@/lib/db';
import {appointments,courseRegistrationLinks} from '@/db/schema';
import {courseRoute} from '@/lib/course-route';
import {CourseError,tokenHash} from '@/lib/courses';
import {courseType} from '@/lib/course-types';
import {buildEmailHtml} from '@/lib/email';
import {sendSmtpMail} from '@/lib/smtp-mail';
import {getAppUrl} from '@/lib/app-url';
export const POST=courseRoute(async(_request,{row,customer})=>{
 if(!courseType(row.courseType)||!row.courseParticipantLimit)throw new CourseError('Bitte zuerst Kursart und Teilnehmerzahl ergänzen.',409);
 if(row.state!=='OPEN'||!row.approved||!row.endAt||row.endAt<=new Date())throw new CourseError('Erfassungslinks sind nur für freigegebene, offene und noch nicht beendete Kurse möglich.',409);
 const token=crypto.randomBytes(32).toString('hex'),hash=tokenHash(token),now=new Date();
 if(row.courseRegistrationHash)await db.insert(courseRegistrationLinks).values({appointmentId:row.id,tokenHash:row.courseRegistrationHash,expiresAt:row.endAt,createdAt:now}).onConflictDoNothing();
 await db.insert(courseRegistrationLinks).values({appointmentId:row.id,tokenHash:hash,expiresAt:row.endAt,createdAt:now});
 await db.update(appointments).set({courseRegistrationHash:hash,courseRegistrationExpiresAt:row.endAt,updatedAt:now}).where(eq(appointments.id,row.id));
 const path='/external/courses/'+token,customerEmail=customer?.email?.trim();
 let emailSent=false;
 if(customerEmail){const url=getAppUrl()+path;const mail=await sendSmtpMail({to:customerEmail,subject:`[MILODO] Erfassungsteilnehmer für ${row.title}`,text:`Bitte erfassen Sie die Kursteilnehmer für ${row.title}:\n${url}`,html:buildEmailHtml({title:'Teilnehmer erfassen',intro:`Bitte erfassen Sie die Teilnehmer für den Kurs „${row.title}“. Der Link bleibt bis zum Kursende gültig.`,sections:[{label:'Kurs',value:row.title},{label:'Kursort',value:row.einsatzort}],button:{label:'Teilnehmer erfassen',url},footerNote:'Wenn Sie bereits einen früheren Link erhalten haben, bleibt dieser bis zum Kursende ebenfalls gültig.'})});emailSent=mail.ok;}
 return NextResponse.json({path,expiresAt:row.endAt.toISOString(),emailSent},{headers:{'cache-control':'no-store'}});
},'operate');
export const DELETE=courseRoute(async(_request,{row})=>{const now=new Date();await db.update(courseRegistrationLinks).set({revokedAt:now}).where(eq(courseRegistrationLinks.appointmentId,row.id));await db.update(appointments).set({courseRegistrationHash:null,courseRegistrationExpiresAt:null,updatedAt:now}).where(eq(appointments.id,row.id));return NextResponse.json({ok:true});},'operate');
