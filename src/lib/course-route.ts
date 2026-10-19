import {NextResponse} from 'next/server';
import {getViewer} from './viewer';
import {courseAccess,CourseError} from './courses';
type Access=Awaited<ReturnType<typeof courseAccess>>;
export type CourseRouteContext={params:Promise<{id:string;participantId?:string}>};
export function courseRoute(fn:(request:Request,access:Access,viewer:{id:number;role:string},params:{id:string;participantId?:string})=>Promise<Response>,mode:'read'|'operate'|'manage'='read'){
 return async(request:Request,context:CourseRouteContext)=>{try{const viewer=await getViewer();if(!viewer)return NextResponse.json({error:'Nicht angemeldet.'},{status:401});const params=await context.params,access=await courseAccess(Number(params.id),viewer);if(mode==='manage'&&!access.canManage||mode==='operate'&&!access.canOperate)throw new CourseError('Keine Berechtigung.',403);return await fn(request,access,viewer,params);}catch(error){if(error instanceof CourseError)return NextResponse.json({error:error.message},{status:error.status});if(error instanceof SyntaxError)return NextResponse.json({error:'Ungültige Eingabe.'},{status:400});console.error('[courses]',error);return NextResponse.json({error:'Die Kursaktion konnte nicht abgeschlossen werden.'},{status:500});}};
}
