import {messageOutbox} from "./messages";
declare global {
 var messageScheduler:{timer:ReturnType<typeof setInterval>;running:boolean;wake:()=>void}|undefined;
}
export function startMessageScheduler(){
 if(globalThis.messageScheduler)return;
 const state={timer:undefined as unknown as ReturnType<typeof setInterval>,running:false,wake:()=>{}};
 async function poll(){if(state.running)return;state.running=true;try{await messageOutbox.processDue();}catch(error){console.error('[message-outbox] Queue-Verarbeitung fehlgeschlagen',error);}finally{state.running=false;}}
 state.wake=()=>{void poll();};state.timer=setInterval(state.wake,15000);state.timer.unref?.();globalThis.messageScheduler=state;state.wake();
}
export function wakeMessageScheduler(){startMessageScheduler();globalThis.messageScheduler?.wake();}
