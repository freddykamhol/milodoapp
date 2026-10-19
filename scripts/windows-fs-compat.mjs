import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

// Some mounted Windows volumes report EISDIR rather than EINVAL when a build
// tracer probes a regular file with readlink. Preserve genuine link errors.
if (process.platform === "win32") {
  function normalize(error, path) {
    if (error?.code !== "EISDIR") return error;
    try {
      if (!fs.lstatSync(path).isSymbolicLink()) {
        error.code = "EINVAL";
        error.message = error.message.replaceAll("EISDIR", "EINVAL");
      }
    } catch { /* Preserve the original failure if the target disappears. */ }
    return error;
  }
  const readlink = fs.readlink;
  fs.readlink = function(path, options, callback) {
    if (typeof options === "function") { callback=options; options=undefined; }
    return readlink.call(fs,path,options,(error,result)=>callback(normalize(error,path),result));
  };
  const readlinkSync=fs.readlinkSync;
  fs.readlinkSync=function(path,options){try{return readlinkSync.call(fs,path,options);}catch(error){throw normalize(error,path);}};
  const promiseReadlink=fs.promises.readlink;
  fs.promises.readlink=async function(path,options){try{return await promiseReadlink.call(fs.promises,path,options);}catch(error){throw normalize(error,path);}};
  syncBuiltinESMExports();
}
