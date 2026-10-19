import path from "node:path";
import {unlink} from "node:fs/promises";
import {eq} from "drizzle-orm";
import {NextResponse} from "next/server";
import {documents} from "@/db/schema";
import {db} from "@/lib/db";
import {getViewer} from "@/lib/viewer";
import {getDataDir} from "@/lib/data-dir";
import {isSftpEnabled,withSftp,buildUserRemoteFilePath} from "@/lib/sftp";
export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
 const viewer=await getViewer();if(!viewer)return NextResponse.json({error:'Nicht angemeldet.'},{status:401});const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)return new Response(null,{status:400});
 const doc=await db.query.documents.findFirst({where:(t,{eq})=>eq(t.id,id)});if(!doc)return new Response(null,{status:404});if(viewer.id!==doc.ownerId&&viewer.role!=='ADMIN'&&viewer.role!=='VERWALTUNG')return new Response(null,{status:403});
 const parts=doc.storageKey.split('/'),storedName=parts.at(-1)??'',ownerKey=parts[0];if(!ownerKey||!storedName||storedName==='.'||storedName==='..'||/[\\/\x00]/.test(storedName))return NextResponse.json({error:'Ungültiger Speicherpfad.'},{status:409});
 try{
  if(await isSftpEnabled()){
   const result=await withSftp(async(client,basePath)=>{const remote=buildUserRemoteFilePath(basePath,ownerKey,storedName);if(await client.exists(remote))await client.delete(remote);return true;});if(!result)throw new Error('SFTP nicht verfügbar');
  }else{
   const owner=Number(ownerKey);if(!Number.isSafeInteger(owner)||owner!==doc.ownerId)throw new Error('Ungültiger Eigentümerpfad');
   const base=path.resolve(getDataDir(),'uploads',String(owner)),target=path.resolve(base,storedName),relative=path.relative(base,target);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Ungültiger Dateipfad');
   try{await unlink(target);}catch(error){if(!(error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT'))throw error;}
  }
  await db.delete(documents).where(eq(documents.id,id));return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Dokument konnte nicht gelöscht werden. Bitte Speicherverbindung prüfen.'},{status:503});}
}
