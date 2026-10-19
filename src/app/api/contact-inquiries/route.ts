import {NextResponse} from "next/server";
import {getViewer} from "@/lib/viewer";
import {loadContactInquiries} from "@/lib/contact-inquiry-read-model";
export const runtime="nodejs";
export async function GET(request:Request){
 const viewer=await getViewer();if(!viewer)return NextResponse.json({ok:false,error:"no_viewer"},{status:401});
 if(viewer.role!=="ADMIN"&&viewer.role!=="VERWALTUNG")return NextResponse.json({ok:false,error:"forbidden"},{status:403});
 return NextResponse.json(await loadContactInquiries(new URL(request.url).searchParams));
}
