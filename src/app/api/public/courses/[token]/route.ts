import {NextResponse} from 'next/server';
import {addParticipants,CourseError,publicCourse} from '@/lib/courses';
export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
 try{const text=await request.text();if(text.length>50000)throw new CourseError('Die Eingabe ist zu groß.',413);const body=JSON.parse(text);if(!body||typeof body!=='object'||body.website)throw new CourseError('Ungültige Anfrage.');const {token}=await params,row=publicCourse(token);addParticipants(row.id,body.participants,null,token);return NextResponse.json({ok:true,message:'Die Teilnehmerdaten wurden gespeichert.'},{headers:{'cache-control':'no-store'}});}
 catch(error){if(error instanceof CourseError)return NextResponse.json({error:error.message},{status:error.status,headers:{'cache-control':'no-store'}});if(error instanceof SyntaxError)return NextResponse.json({error:'Ungültige Eingabe.'},{status:400});console.error('[public-courses] registration failed',error);return NextResponse.json({error:'Die Teilnehmer konnten nicht gespeichert werden.'},{status:500});}
}
