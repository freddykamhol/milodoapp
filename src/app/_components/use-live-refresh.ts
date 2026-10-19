"use client";
import * as React from "react";
/** Keep server-provided data fresh without repeating its initial request. */
export function useLiveRefresh(refresh:()=>Promise<void>,intervalMs=0){
 React.useEffect(()=>{
  let last=Date.now(),running=false;
  const run=()=>{
   if(document.visibilityState!=="visible"||running||Date.now()-last<30000)return;
   last=Date.now();running=true;void refresh().finally(()=>{running=false;});
  };
  window.addEventListener("focus",run);document.addEventListener("visibilitychange",run);
  const timer=intervalMs?window.setInterval(run,intervalMs):undefined;
  return()=>{window.removeEventListener("focus",run);document.removeEventListener("visibilitychange",run);if(timer)window.clearInterval(timer);};
 },[refresh,intervalMs]);
}
