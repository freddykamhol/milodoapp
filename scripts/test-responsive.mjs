import fs from "node:fs";
import { runPerformanceBenchmark } from "./performance-benchmark.mjs";
import {checkMessageSystem} from "./message-system-checks.mjs";
import {checkDefectAppointments} from "./defect-appointment-checks.mjs";
import {checkCompanySystem} from "./company-system-checks.mjs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { chromium } from "@playwright/test";

const benchmark=process.argv.find(arg=>arg.startsWith("--benchmark-"));
const production=process.argv.includes('--production');
const require=createRequire(import.meta.url),root=process.cwd(),reportDir=path.join(root,'artifacts',benchmark?('performance/'+benchmark.slice(12)):(production?'responsive-production':'responsive-audit'));fs.mkdirSync(reportDir,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'milodo-ui-audit-')),database=path.join(temp,'audit.db'),port=production?3118:3117,base=`http://localhost:${port}`,secret=crypto.randomBytes(32).toString('hex');
const env={...process.env,DATABASE_URL:database,AUTH_SECRET:secret,ALLOW_DEMO_AUTH:'0',NEXT_DIST_DIR:production?'.next':'.next-responsive-audit',NODE_ENV:production?'production':'development'};
const migration=spawnSync(process.execPath,[require.resolve('tsx/cli'),'scripts/migrate.ts'],{env,encoding:'utf8',cwd:root});if(migration.status!==0)throw new Error(migration.stdout+ migration.stderr);
const db=new Database(database);db.pragma('foreign_keys=ON');
const prepare=db.prepare.bind(db);
db.prepare=(sql)=>{const match=sql.match(/^insert into (\w+)\(([^)]+)\) values\((.*)\)$/i);if(match){const columns=match[2].split(',');const missing=prepare(`pragma table_info(${match[1]})`).all().filter(column=>column.notnull&&!column.pk&&column.dflt_value===null&&!columns.includes(column.name));if(missing.length)sql=`insert into ${match[1]}(${match[2]},${missing.map(column=>column.name).join(',')}) values(${match[3]},${missing.map(column=>column.name.endsWith('_at')?Date.now():column.type==='TEXT'?"''":0).join(',')})`;}return prepare(sql);};
const now=Date.now(),future=now+86400000,salt=crypto.randomBytes(16),password='Ui-Audit-2026!',hash=`scrypt$${salt.toString('hex')}$${crypto.scryptSync(password,salt,32).toString('hex')}`;
const roles=['ADMIN','VERWALTUNG','PERSONAL','KUNDE'];
roles.forEach((role,index)=>db.prepare('insert into users(id,username,password_hash,role,first_name,last_name,email,qual_rd) values(?,?,?,?,?,?,?,?)').run(index+1,`audit-${role.toLowerCase()}`,hash,role,'Jörg','Müller',`audit-${index}@example.invalid`,'NFS'));
db.prepare('update customers set name=?,account_user_id=4 where id=1').run('Testkunde Ärztedienst');
db.prepare('insert into appointments(id,start_at,end_at,title,einsatzort,customer_id,bereich,dienstart) values(1,?,?,?,?,1,?,?)').run(future,future+3600000,'Testdienst - Sanitätswache','Musterstraße 12','RD_BOERSE','RTW');
db.prepare('insert into appointment_applications(appointment_id,user_id,status) values(1,3,?)').run('CONFIRMED');
db.prepare('insert into vehicles(id,license_plate,type,mileage,initial_mileage,tuv_last_at) values(1,?,?,1000,1000,?)').run('B-MD 100','RTW',now-86400000);
db.prepare('insert into appointment_vehicles(appointment_id,vehicle_id) values(1,1)').run();
db.prepare('insert into appointment_vehicle_members(appointment_vehicle_id,user_id) values(1,3)').run();
db.prepare('insert into appointments(id,start_at,end_at,title,einsatzort,customer_id,bereich) values(2,?,?,?,?,1,?)').run(future+7200000,future+10800000,'Testabsage','Musterstraße','RD_BOERSE');
db.prepare('insert into appointment_applications(appointment_id,user_id,status) values(2,3,?)').run('CONFIRMED');
db.prepare('insert into appointment_sections(id,appointment_id,title) values(1,2,?)').run('Testabschnitt');
db.prepare('insert into appointment_section_members(section_id,user_id) values(1,3)').run();
db.prepare('insert into appointment_vehicles(id,appointment_id,vehicle_id) values(2,2,1)').run();
db.prepare('insert into appointment_vehicle_members(appointment_vehicle_id,user_id) values(2,3)').run();
db.prepare('insert into vehicle_defects(id,vehicle_id,title,description,category,reported_by_id) values(1,1,?,?,?,3)').run('Testmangel Fahrzeug','Elektrik prüfen - ausführliche Beschreibung','ELEKTRIK');
db.prepare('insert into vehicle_maintenances(vehicle_id,title,last_at,interval_days,next_at) values(1,?,?,365,?)').run('Jahreswartung',now-366*86400000,now-86400000);
db.prepare('insert into inventory_items(id,name,category,inventory_number,quantity,minimum_quantity,unit,inspection_interval_days,next_inspection_at,oxygen_capacity_liters) values(?,?,?,?,?,?,?,?,?,?)').run(1,'Medizinprodukt Überwachung','MEDICAL_DEVICE','MED-0001',1,0,'Stück',365,now-86400000,null);
db.prepare('insert into inventory_items(id,name,category,inventory_number,quantity,minimum_quantity,unit) values(?,?,?,?,?,?,?)').run(2,'Notfallrucksack','BAG','TAS-0001',1,0,'Stück');
db.prepare('insert into inventory_items(id,name,category,inventory_number,quantity,minimum_quantity,unit) values(?,?,?,?,?,?,?)').run(3,'Verbandpäckchen','CONSUMABLE','VER-0001',10,2,'Stück');
db.prepare('insert into inventory_items(id,name,category,inventory_number,quantity,minimum_quantity,unit,oxygen_capacity_liters) values(?,?,?,?,?,?,?,?)').run(4,'Sauerstoffflasche 10 l','CONSUMABLE','VER-0002',5,1,'Flaschen',10);
db.prepare('insert into inventory_defects(id,item_id,title,description,reported_by_id) values(1,1,?,?,3)').run('Testmangel Medizinprodukt','Akku hält nicht lange');
db.prepare('insert into notifications(title,body,href) values(?,?,?)').run('Nächster Dienst: Prüfung','Eine ausführliche Benachrichtigung '.repeat(10),'/appointments/1');
db.prepare('insert into blog_posts(id,title,status,category,slug) values(1,?,?,?,?)').run('Testbeitrag','DRAFT','allgemein','testbeitrag');
db.prepare('insert into personal_questionnaires(id,first_name,last_name,email) values(1,?,?,?)').run('Jörg','Müller','audit@example.invalid');
db.prepare('insert into contact_inquiries(id,name,email,message) values(1,?,?,?)').run('Jörg Müller','audit@example.invalid','Testanfrage');
db.prepare('insert into member_registration_forms(token,user_limit,expires_at,created_by_id) values(?,10,?,1)').run('ui-audit-token',now+86400000);
db.prepare('insert into documents(owner_id,title,category,file_name,storage_key,expiry_approval_status,requested_expires_at) values(3,?,?,?,?,?,?)').run('Prüfnachweis','TRAINING','audit.pdf','audit/nonexistent.pdf','PENDING',future);
const logs=fs.createWriteStream(path.join(reportDir,'server.log'));const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),...(production?['start']:['dev','--webpack']),'-H','localhost','-p',String(port)],{env,cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true});server.stdout.pipe(logs);server.stderr.pipe(logs);
const report={startedAt:new Date().toISOString(),database,checks:[],pages:[],failures:[]};let browser;
function check(name,fn){return Promise.resolve().then(fn).then(()=>{report.checks.push(name);console.log('PASS',name);}).catch(error=>{report.failures.push({name,error:error.message});console.log('FAIL',name,error.message);});}
function cookie(user){const id=String(user);return `${id}.${crypto.createHmac('sha256',secret).update(id).digest('base64url')}`;}
async function request(user,url,method='GET',body){const response=await fetch(base+url,{method,headers:{cookie:`milodo_auth=${cookie(user)}`,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});let data;try{data=await response.json();}catch{data=null;}return{status:response.status,data};}

db.prepare("update users set qual_ausb='AUSBILDER' where id=3").run();
db.prepare("insert or ignore into vehicle_service_companies(id,name) values(1,?)").run('Testfirma Medizintechnik');
db.prepare("insert into appointments(id,start_at,end_at,title,einsatzort,customer_id,bereich,course_type,course_participant_limit,approved) values(3,?,?,?,?,1,?,?,8,1)").run(future,future+27000000,'Erste-Hilfe-Kurs mit ausführlichem Titel','Eigene Ausbildungsräume','ERSTE_HILFE','EH_AUSBILDUNG');
db.prepare('insert into vehicle_trips(id,vehicle_id,title,km_start,km_end,start_at,end_at,created_by_id) values(1,1,?,1000,1010,?,?,3)').run('Testfahrt mit langem Titel',now-3600000,now);
db.prepare('insert into message_jobs(id,created_by_id,client_token,subject,body,selection_json,scheduled_at,status) values(1,1,?,?,?,?,?,?)').run('responsive-test','Information zum nächsten Dienst','Testnachricht für die Detailansicht','{}',now,'SENT');
const courseToken='a'.repeat(64);
db.prepare('insert into course_registration_links(appointment_id,token_hash,expires_at) values(3,?,?)').run(crypto.createHash('sha256').update(courseToken).digest('hex'),future);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
try{
 let ready=false;
 for(let i=0;i<240;i++){if(server.exitCode!==null)throw new Error('Testserver beendet');try{const r=await fetch(base+'/api/viewer');if(r.status<500){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw new Error('Testserver nicht bereit');
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({timezoneId:'Europe/Berlin'});
 await context.addCookies([{name:'milodo_auth',value:cookie(1),url:base}]);
 const page=await context.newPage();
 const routes=[...new Set([...walk('src/app/(app)').filter(f=>f.endsWith('page.tsx')&&!f.includes('[')).map(f=>'/'+path.relative('src/app/(app)',path.dirname(f)).split(path.sep).join('/')),
 '/maintenance-companies/1','/inventory/items','/inventory/inspections','/inventory/defects','/inventory/items/1','/inventory/items/2','/inventory/items/3','/inventory/defects/1','/vehicles/1','/vehicles/defects/1','/appointments/1','/appointments/1/edit','/courses/3','/members/3','/members/3/edit','/documents/3','/documents/approvals/1','/personalfrageboegen/1','/contactanfragen/1','/customers/1/edit','/blog/1','/blog/1/preview'])];
 routes.push('/vehicles/trips/1','/messages/1','/external/courses/'+courseToken);
 const widths=(process.env.AUDIT_WIDTHS??'320,390,768,1024,1440').split(',').map(Number);
 for(const width of widths){
  await page.setViewportSize({width,height:844});
  for(const route of routes){
   const errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
   try{
    const response=await page.goto(base+route,{waitUntil:'networkidle',timeout:90000});
    const layout=await page.evaluate(()=>({
     overflow:document.documentElement.scrollWidth>innerWidth+1,
     wide:[...document.querySelectorAll('main *')].filter(el=>{const r=el.getBoundingClientRect();if(r.width<1||r.right<=innerWidth+1)return false;let p=el.parentElement;while(p){if(['auto','scroll','hidden','clip'].includes(getComputedStyle(p).overflowX))return false;p=p.parentElement;}return true;}).slice(0,8).map(el=>({tag:el.tagName,class:el.className,text:el.textContent?.slice(0,70)}))
    }));
    const result={route,width,status:response.status(),...layout,errors};report.pages.push(result);
    if(result.status>=400||result.overflow||errors.length)report.failures.push(result);
    console.log('PAGE',width,result.status,route,result.overflow?'OVERFLOW':'',errors.join(';'));
    if(width===390&&['/dashboard','/calendar','/courses/3','/settings/roles','/members','/hours','/customers'].includes(route))await page.screenshot({path:path.join(reportDir,route.replaceAll('/','_')+'.png'),fullPage:true});
   }catch(e){report.failures.push({route,width,error:e.message});console.log('FAIL',width,route,e.message);}
   finally{page.off('pageerror',onError);}
  }
 }
 for(const width of [320,768]){
  await page.setViewportSize({width,height:740});
  await page.goto(base+'/courses/3',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Alle Kursdaten bearbeiten',exact:true}).click();
  await page.getByRole('combobox',{name:'Kursart',exact:true}).click();
  const box=await page.locator('.ui-select-popover').boundingBox();
  assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y+box.height<=741,'Course dropdown viewport');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Course edit overflow');
  await page.getByRole('button',{name:'Menü öffnen',exact:true}).click();
  await page.getByRole('dialog',{name:'Navigation'}).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Benachrichtigungen',exact:true}).click();
  const panel=await page.getByRole('dialog',{name:'Benachrichtigungen'}).boundingBox();
  assert.ok(panel.x>=0&&panel.x+panel.width<=width+1,'Notification viewport');
  await page.keyboard.press('Escape');
  report.checks.push('Course editing, dropdown, mobile navigation, notifications at '+width);
 }
 for(const user of [2,3,4]){
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  await ctx.addCookies([{name:'milodo_auth',value:cookie(user),url:base}]);
  const p=await ctx.newPage();
  const paths=user===4?['/dashboard','/appointments/new','/courses','/profile','/settings/notifications']:['/dashboard','/calendar','/appointments','/courses','/vehicles/trips','/vehicles/defects','/inventory/defects','/members','/hours','/documents','/profile','/settings/notifications'];
  for(const route of paths){const r=await p.goto(base+route,{waitUntil:'networkidle'});const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);const result={route,role:roles[user-1],width:390,status:r.status(),overflow};report.pages.push(result);if(overflow||r.status()>=400)report.failures.push(result);}
  await ctx.close();
 }
 const ctx=await browser.newContext({viewport:{width:320,height:740}});
 const p=await ctx.newPage();
 for(const route of ['/login','/forgot-password','/reset-password?token=invalid','/signed-out','/personalfragebogen-honorar','/personalfragebogen-minijob','/registrierung/ui-audit-token']){
  const r=await p.goto(base+route,{waitUntil:'networkidle'});const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);const result={route,width:320,status:r.status(),overflow};report.pages.push(result);if(overflow||r.status()>=400)report.failures.push(result);
 }
}catch(e){report.failures.push({error:e.stack});}
finally{if(browser)await browser.close();server.kill();logs.end();db.close();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pages:report.pages.length,failures:report.failures},null,2));if(report.failures.length)process.exitCode=1;}

