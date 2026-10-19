import {notFound,redirect} from "next/navigation";
import {getViewer} from "@/lib/viewer";
import {canSendMessages} from "@/lib/message-types";
import {messageOutbox} from "@/lib/messages";
import {AppShell} from "../../_components/app-shell";
import {MessageDetailClient} from "../message-detail-client";
export default async function MessagePage({params}:{params:Promise<{id:string}>}){const viewer=await getViewer();if(!viewer)redirect('/login');if(!canSendMessages(viewer.role))notFound();const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)notFound();const item=messageOutbox.detail(id);if(!item)notFound();return <AppShell title={item.subject} subtitle="Versanddetails und Anhänge"><MessageDetailClient initial={item}/></AppShell>;}
