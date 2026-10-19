import {NextResponse} from 'next/server';
import {courseRoute} from '@/lib/course-route';
import {addParticipants} from '@/lib/courses';
export const POST=courseRoute(async(request,{row},viewer)=>{const body=await request.json();return NextResponse.json(addParticipants(row.id,[body],viewer.id),{status:201});},'operate');
