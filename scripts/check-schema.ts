import "dotenv/config";
import Database from "better-sqlite3";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../src/db/schema";
const sqlite=new Database((process.argv[2]??process.env.DATABASE_URL??'dev.db').replace(/^file:/,''),{readonly:true});
const problems=[];
for(const value of Object.values(schema))if(value instanceof SQLiteTable){const config=getTableConfig(value);const exists=sqlite.prepare("select name from sqlite_master where type='table' and name=?").get(config.name);if(!exists){problems.push({table:config.name,missingTable:true});continue;}const actual=sqlite.prepare(`pragma table_info('${config.name}')`).all() as {name:string}[];const missing=config.columns.filter(column=>!actual.some(row=>row.name===column.name)).map(column=>column.name);if(missing.length)problems.push({table:config.name,missingColumns:missing});}
console.log(JSON.stringify(problems,null,2));sqlite.close();if(problems.length)process.exitCode=1;
