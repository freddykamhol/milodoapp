import fs from "node:fs";
import path from "node:path";
import {performance} from "node:perf_hooks";
import {chromium} from "@playwright/test";

export async function runPerformanceBenchmark({db,base,cookie,reportDir}){
 const now=Date.now(),day=86400000;
 db.transaction(()=>{
  const service=db.prepare('insert into appointments(id,start_at,end_at,title,einsatzort,customer_id,bereich,dienstart) values(?,?,?,?,?,1,?,?)');
  const application=db.prepare('insert into appointment_applications(appointment_id,user_id,status) values(?,?,?)');
  const booking=db.prepare('insert into appointment_vehicles(appointment_id,vehicle_id) values(?,?)');
  for(let i=3;i<=4002;i++){const start=now+(i%180-30)*day;service.run(i,start,start+8*3600000,'Lasttest Dienst '+i,'Musterstadt','RD_BOERSE','RTW');application.run(i,i%2?1:3,'CONFIRMED');booking.run(i,1);}
  const inventory=db.prepare('insert into inventory_items(id,name,category,inventory_number,quantity,unit,notes,inspection_interval_days,next_inspection_at) values(?,?,?,?,?,?,?,?,?)');
  for(let i=5;i<=1004;i++)inventory.run(i,'Material '+String(i).padStart(4,'0'),i%2?'MEDICAL_DEVICE':'CONSUMABLE','BENCH-'+i,10,'Stück','Dokumentation '.repeat(200),365,now+(i%30)*day);
  const person=db.prepare('insert into users(id,username,password_hash,role,first_name,last_name) values(?,?,?,?,?,?)');
  for(let i=5;i<=1004;i++)person.run(i,'personal-'+i,'not-a-real-password','PERSONAL','Test','Mitglied '+i);
  const notice=db.prepare('insert into notifications(scope,user_id,title,body,href) values(?,?,?,?,?)');
  for(let i=0;i<20000;i++)notice.run(i%2?'USER':'ALL',i%2?1:null,'Hinweis '+i,'Terminänderung','/appointments');
 }).immediate();
 const report={at:new Date().toISOString(),fixture:{appointments:4002,inventory:1004,users:1004,notifications:20001},http:[],browser:[],plans:{}};
 const urls=['/api/vehicles?view=vehicles','/api/inventory','/api/inventory?view=inspections','/api/notifications?view=panel','/api/today','/api/appointments/feed','/dashboard','/appointments','/members','/vehicles','/inventory/items'];
 for(const url of urls){
  const samples=[];let bytes=0,status;
  for(let i=0;i<6;i++){const start=performance.now();const response=await fetch(base+url,{headers:{cookie:'milodo_auth='+cookie(1)}});const body=await response.arrayBuffer();status=response.status;bytes=body.byteLength;if(i>0)samples.push(performance.now()-start);}
  samples.sort((a,b)=>a-b);const result={url,status,medianMs:Math.round(samples[2]*10)/10,p95Ms:Math.round(samples.at(-1)*10)/10,bytes};report.http.push(result);console.log('BENCH',JSON.stringify(result));if(status>=400)throw new Error('Benchmark request failed: '+url);
 }
 // Cover every static application page plus representative parameterized pages.
 // These warm local HTTP timings are not end-user/mobile network guarantees.
 const appRoot=path.join(process.cwd(),'src','app','(app)');
 function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
 const staticRoutes=walk(appRoot).filter(file=>file.endsWith('page.tsx')&&!file.includes('[')).map(file=>'/'+path.relative(appRoot,path.dirname(file)).split(path.sep).join('/')).filter(url=>url!=='/documents/services');
 const detailRoutes=['/inventory/items','/inventory/inspections','/inventory/defects','/inventory/items/1','/inventory/items/2','/inventory/items/3','/inventory/defects/1','/inventory/defects/new','/vehicles/1','/vehicles/defects/1','/appointments/1','/appointments/1/edit','/members/3','/members/3/edit','/documents/3','/documents/approvals/1','/personalfrageboegen/1','/contactanfragen/1','/customers/1/edit','/blog/1','/blog/1/preview'];
 report.routes=[];
 for(const url of new Set([...staticRoutes,...detailRoutes])){
  const samples=[];let status=0,bytes=0;
  for(let i=0;i<4;i++){const started=performance.now();const response=await fetch(base+url,{headers:{cookie:'milodo_auth='+cookie(1)}});bytes=(await response.arrayBuffer()).byteLength;status=response.status;if(i)samples.push(performance.now()-started);}
  samples.sort((a,b)=>a-b);report.routes.push({url,status,medianMs:Math.round(samples[1]*10)/10,bytes});
  if(status>=400)throw new Error('Page benchmark failed: '+url+' '+status);
 }
 console.log('ROUTES',JSON.stringify({count:report.routes.length,slowest:[...report.routes].sort((a,b)=>b.medianMs-a.medianMs).slice(0,8)}));
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900},timezoneId:'Europe/Berlin'});await context.addCookies([{name:'milodo_auth',value:cookie(1),url:base}]);const page=await context.newPage();
  for(const [url,selector] of [['/vehicles','a[href="/vehicles/1"]'],['/inventory/items','table tbody tr'],['/members','a[href="/members/3"]']]){
   for(let round=0;round<2;round++){
    const start=performance.now();const response=await page.goto(base+url,{waitUntil:'domcontentloaded'});await page.locator(selector).first().waitFor({state:'attached'});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const elapsed=performance.now()-start;
    const metrics=await page.evaluate(()=>({fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,resources:performance.getEntriesByType('resource').length,transferBytes:performance.getEntriesByType('resource').reduce((sum,r)=>sum+r.transferSize,0),domElements:document.getElementsByTagName('*').length,apiRequests:performance.getEntriesByType('resource').filter(r=>r.name.includes('/api/')).map(r=>new URL(r.name).pathname+new URL(r.name).search)}));
    report.browser.push({url,round,status:response.status(),contentReadyMs:Math.round(elapsed),...metrics});console.log('BROWSER',JSON.stringify(report.browser.at(-1)));
   }
  }
 }finally{await browser.close();}
 for(const [name,sql] of Object.entries({services:"select id,title from appointments where state='OPEN' and start_at>0 order by start_at limit 100",applications:"select appointment_id from appointment_applications where user_id=1 and status='CONFIRMED'",inventory:"select id,name from inventory_items where status<>'RETIRED' order by name limit 500"}))report.plans[name]=db.prepare('explain query plan '+sql).all();
 fs.writeFileSync(path.join(reportDir,'benchmark.json'),JSON.stringify(report,null,2));return report;
}
