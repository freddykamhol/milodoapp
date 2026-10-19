"use client";
import * as React from "react";
import {useRouter} from "next/navigation";
import {StoredFile} from "@/app/_components/stored-file";
import {confirmAction,notify} from "@/app/_components/feedback";
export function DocumentFile({id,name,mimeType,canDelete}:{id:number;name:string;mimeType:string;canDelete:boolean}){
 const router=useRouter(),[busy,setBusy]=React.useState(false);
 async function remove(){if(busy||!await confirmAction(`Dokument „${name}“ endgültig löschen?`))return;setBusy(true);try{const response=await fetch(`/api/documents/${id}`,{method:'DELETE'});if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error||'Löschen fehlgeschlagen.');router.refresh();}catch(error){notify(error instanceof Error?error.message:'Löschen fehlgeschlagen.');}finally{setBusy(false);}}
 return <StoredFile name={name} mimeType={mimeType} url={`/api/documents/${id}/download`} onRemove={canDelete?()=>void remove():undefined} disabled={busy}/>;
}
