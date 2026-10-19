import {NextResponse} from "next/server";
import {sqlite} from "./db";
/** Both defect domains use the same atomic, optimistic image removal. */
export function removeDefectImage(domain:'vehicle'|'inventory',id:number,index:unknown,expected:unknown){
 if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(index)||Number(index)<0||typeof expected!=='string')return NextResponse.json({error:'Ungültiges Bild.'},{status:400});
 const table=domain==='vehicle'?'vehicle_defects':'inventory_defects';
 return sqlite.transaction(()=>{
  const row=sqlite.prepare(`select image_urls from ${table} where id=?`).get(id) as {image_urls:string}|undefined;if(!row)return NextResponse.json({error:'Mangel nicht gefunden.'},{status:404});
  const images=JSON.parse(row.image_urls) as string[];if(images[Number(index)]!==expected)return NextResponse.json({error:'Die Bilder wurden inzwischen geändert. Bitte die Seite aktualisieren.'},{status:409});
  images.splice(Number(index),1);sqlite.prepare(`update ${table} set image_urls=?,updated_at=? where id=?`).run(JSON.stringify(images),Date.now(),id);return NextResponse.json({ok:true});
 }).immediate();
}
