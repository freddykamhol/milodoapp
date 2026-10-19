import { db, sqlite } from "./db";
import { sendCustomEmail } from "./custom-email";
import { createMessageOutbox } from "./message-outbox";
export const messageOutbox=createMessageOutbox(sqlite,sendCustomEmail);
export async function messageRecipientUsers(){return db.query.users.findMany({columns:{id:true,username:true,email:true,role:true,qualRD:true,qualAusb:true},orderBy:(t,{asc})=>[asc(t.role),asc(t.username)]});}
