import "dotenv/config";
import Database from "better-sqlite3";
import { displayText } from "../src/lib/display-text";
const sqlite=new Database((process.argv[2]??process.env.DATABASE_URL??'dev.db').replace(/^file:/,''),{readonly:true}),report=[];
const tables=sqlite.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%'").all() as {name:string}[];
for(const {name} of tables){const columns=sqlite.prepare(`pragma table_info('${name}')`).all() as {name:string;type:string}[];for(const column of columns.filter(column=>column.type==='TEXT'&&!/password|hash|secret|token|storage|key/i.test(column.name))){const rows=sqlite.prepare(`select "${column.name}" as value from "${name}" where "${column.name}" is not null`).all() as {value:string}[];const changed=rows.filter(row=>displayText(row.value)!==row.value).length;if(changed)report.push({table:name,column:column.name,affected:changed});}}
console.log(JSON.stringify(report,null,2));sqlite.close();if(report.length)process.exitCode=1;
