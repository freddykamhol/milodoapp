import {NextResponse} from 'next/server';
import {sqlite} from '@/lib/db';
import {courseRoute} from '@/lib/course-route';
import {participantValues,CourseError} from '@/lib/courses';
export const PATCH=courseRoute(async(request,{row},viewer,params)=>{
 if(row.state==='CANCELLED')throw new CourseError('Der Kurs wurde abgesagt.',409);
 const id=Number(params.participantId);if(!Number.isSafeInteger(id)||id<1)throw new CourseError('Ungültiger Teilnehmer.');
 const body=await request.json();
 sqlite.transaction(()=>{const existing=sqlite.prepare('select first_name,last_name,date_of_birth,present from course_participants where id=? and appointment_id=?').get(id,row.id) as {first_name:string;last_name:string;date_of_birth:string;present:number}|undefined;if(!existing)throw new CourseError('Teilnehmer nicht gefunden.',404);
  if(body.present!==undefined&&typeof body.present!=='boolean')throw new CourseError('Ungültige Anwesenheitsangabe.');
  const values=participantValues({firstName:body.firstName??existing.first_name,lastName:body.lastName??existing.last_name,dateOfBirth:body.dateOfBirth??existing.date_of_birth});
  const duplicate=sqlite.prepare('select id from course_participants where appointment_id=? and identity_key=? and id<>?').get(row.id,values.identityKey,id);if(duplicate)throw new CourseError('Diese Person ist bereits eingetragen.',409);
  sqlite.prepare('update course_participants set first_name=?,last_name=?,date_of_birth=?,identity_key=?,present=?,updated_at=?,updated_by_id=? where id=? and appointment_id=?').run(values.firstName,values.lastName,values.dateOfBirth,values.identityKey,body.present===undefined?existing.present:Number(body.present),Date.now(),viewer.id,id,row.id);
 }).immediate();return NextResponse.json({ok:true});
},'operate');
export const DELETE=courseRoute(async(_request,{row},_viewer,params)=>{const id=Number(params.participantId);if(!Number.isSafeInteger(id)||id<1)throw new CourseError('Ungültiger Teilnehmer.');const result=sqlite.prepare('delete from course_participants where id=? and appointment_id=?').run(id,row.id);if(!result.changes)throw new CourseError('Teilnehmer nicht gefunden.',404);return NextResponse.json({ok:true});},'operate');
