"use client";
import { useRouter } from "next/navigation";
import { AppSelect } from "@/app/_components/select";
import { navigationGroupsFor, type ViewerRole } from "@/lib/navigation";

export function PageSearch({role,qualAusb}:{role:ViewerRole|null;qualAusb?:string|null}){
 const router=useRouter();
 return <div className="hidden w-48 xl:block"><AppSelect aria-label="Seite suchen" value="" onChange={event=>{if(event.target.value)router.push(event.target.value);}} className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm"><option value="">Seite suchen …</option>{navigationGroupsFor(role,qualAusb).map(group=><optgroup key={group.label} label={group.label}>{group.items.flatMap(item=>item.children?item.children.map(child=><option key={child.href} value={child.href}>{item.label+" · "+child.label}</option>):[<option key={item.href} value={item.href}>{item.label}</option>])}</optgroup>)}</AppSelect></div>;
}
