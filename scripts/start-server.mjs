import {spawn} from "node:child_process";
// A start command must never silently enable on-demand development compilation.
const child=spawn(process.execPath,["server.js"],{stdio:"inherit",env:{...process.env,NODE_ENV:"production"},windowsHide:true});
child.on("error",error=>{console.error(error);process.exitCode=1;});
child.on("exit",code=>{process.exitCode=code??1;});
