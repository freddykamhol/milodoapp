import {spawn} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
function run(args){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{stdio:"inherit",env:{...process.env,NODE_ENV:"production"},windowsHide:true});child.on("error",reject);child.on("exit",code=>code===0?resolve():reject(new Error("Prozess beendet: "+code)));});}
try{
 await run(["scripts/build-styles.mjs"]);
 await run(["--import","./scripts/windows-fs-compat.mjs",require.resolve("next/dist/bin/next"),"build","--webpack"]);
 await run([require.resolve("next/dist/bin/next"),"start","-H","localhost","-p",process.env.PREVIEW_PORT??"3001"]);
}catch(error){console.error(error);process.exitCode=1;}
