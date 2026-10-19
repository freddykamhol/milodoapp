import {NextResponse} from 'next/server';
import {getViewer} from '@/lib/viewer';
import {loadCourseMaterialOptions} from '@/lib/course-materials';
export async function GET(){const viewer=await getViewer();if(!viewer)return NextResponse.json({error:'Nicht angemeldet.'},{status:401});if(viewer.role!=='ADMIN'&&viewer.role!=='VERWALTUNG')return NextResponse.json({error:'Keine Berechtigung.'},{status:403});return NextResponse.json({items:await loadCourseMaterialOptions()},{headers:{'cache-control':'no-store'}});}
