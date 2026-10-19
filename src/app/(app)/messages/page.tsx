import {redirect,notFound} from "next/navigation";
import {AppShell} from "../_components/app-shell";
import {getViewer} from "@/lib/viewer";
import {canSendMessages} from "@/lib/message-types";
import {messageOutbox,messageRecipientUsers} from "@/lib/messages";
import {MessagesClient} from "./messages-client";
export default async function MessagesPage(){const viewer=await getViewer();if(!viewer)redirect('/login');if(!canSendMessages(viewer.role))notFound();return <AppShell title="Nachricht senden" subtitle="E-Mails an Rollen, Benutzer und weitere Adressen senden oder planen."><MessagesClient users={await messageRecipientUsers()} initialItems={messageOutbox.list()}/></AppShell>;}
