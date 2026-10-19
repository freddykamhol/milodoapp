import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
export async function checkDefectAppointments({db,base,cookie,check}){
 const headers=user=>({cookie:'milodo_auth='+cookie(user)});
 async function api(user,path,method='GET',body){const response=await fetch(base+path,{method,headers:{...headers(user),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});let data;try{data=await response.json();}catch{data=null;}return {status:response.status,data};}
 const from=new Date(Date.now()+86400000),to=new Date(+from+3600000),window='?from='+encodeURIComponent(new Date(+from-3600000).toISOString())+'&to='+encodeURIComponent(new Date(+to+3600000).toISOString());
 const payload=domain=>({domain,defectId:1,title:'Mangeltermin '+(domain==='vehicle'?'Fahrzeug':'MP'),description:'Reparatur und Funktionskontrolle',location:'Prüfstraße 12',startAt:from.toISOString(),endAt:to.toISOString()});
 const ids={};
 await check('Defect appointments enforce read and write permissions',async()=>{
  for(const user of [3,4])assert.equal((await api(user,'/api/defect-appointments','POST',payload('vehicle'))).status,403);
  assert.equal((await api(4,'/api/defect-appointments?domain=vehicle&defectId=1')).status,403);assert.equal((await api(3,'/api/defect-appointments?companies=1')).status,403);assert.equal((await fetch(base+'/api/defect-appointments?domain=vehicle&defectId=1')).status,401);
 });
 await check('Both defect domains share persistent appointments on defect, asset and calendar',async()=>{
  const company=Number(db.prepare('insert into vehicle_service_companies(name,address) values(?,?)').run('Prüffirma Mangeltermine','Werkstattstraße 5').lastInsertRowid);
  for(const domain of ['vehicle','inventory']){
   const beforeStatus=db.prepare('select status from '+(domain==='vehicle'?'vehicle_defects':'inventory_defects')+' where id=1').get().status;
   const created=await api(2,'/api/defect-appointments','POST',{...payload(domain),companyId:company});assert.equal(created.status,201,JSON.stringify(created));ids[domain]=created.data.id;
   assert.equal(db.prepare('select status from '+(domain==='vehicle'?'vehicle_defects':'inventory_defects')+' where id=1').get().status,beforeStatus);
   const defect=await api(3,'/api/defect-appointments?domain='+domain+'&defectId=1'),asset=await api(1,'/api/defect-appointments?domain='+domain+'&assetId=1');assert.equal(defect.data.appointments.length,1);assert.equal(asset.data.appointments[0].id,created.data.id);assert.equal(asset.data.appointments[0].companyName,'Prüffirma Mangeltermine');
   const assetPath=domain==='vehicle'?'/vehicles/1':'/inventory/items/1',defectPath=domain==='vehicle'?'/vehicles/defects/1':'/inventory/defects/1';
   for(const path of [assetPath,defectPath]){const page=await fetch(base+path,{headers:headers(1)});assert.equal(page.status,200);assert.ok((await page.text()).includes(payload(domain).title),path);}
   if(domain==='inventory')assert.ok((await api(1,'/api/inventory/1')).data.defectAppointments.some(row=>row.id===created.data.id));
  }
  for(const user of [1,2,3]){const response=await api(user,'/api/calendar/confirmed'+window),events=response.data.events.filter(row=>row.kind==='DEFECT_APPOINTMENT');assert.equal(events.length,2);assert.equal(new Set(events.map(row=>row.id)).size,2);assert.ok(events.some(row=>row.href==='/vehicles/defects/1'));assert.ok(events.some(row=>row.href==='/inventory/defects/1'));}
  assert.equal((await api(4,'/api/calendar/confirmed'+window)).data.events.filter(row=>row.kind==='DEFECT_APPOINTMENT').length,0);
 });
 await check('Calendar exports include the same defect events without customer leakage',async()=>{
  for(const type of ['ics','csv']){const response=await fetch(base+'/api/calendar/confirmed/'+type+window,{headers:headers(1)});assert.equal(response.status,200);const text=await response.text();assert.ok(text.includes('Mangeltermin Fahrzeug'));assert.ok(text.includes('Mangeltermin MP'));if(type==='ics')assert.ok(text.includes('UID:defect-appointment-'+ids.vehicle+'@milodo'));const customer=await fetch(base+'/api/calendar/confirmed/'+type+window,{headers:headers(4)});assert.ok(!(await customer.text()).includes('Mangeltermin'));}
  const webcal=await fetch(base+'/api/calendar/webcal'+window,{headers:headers(3)});assert.ok((await webcal.text()).includes('Mangeltermin MP'));
  const pdf=await fetch(base+'/api/calendar/confirmed/pdf'+window,{headers:headers(1)});assert.equal(pdf.status,200);assert.ok((await PDFDocument.load(await pdf.arrayBuffer())).getPageCount()>0);
 });
 await check('Rescheduling and deleting propagate across defect, asset and calendar',async()=>{
  const changed={...payload('vehicle'),title:'Verschobener Mangeltermin',companyId:null,location:'Neuer Prüfort',startAt:new Date(+from+3*86400000).toISOString(),endAt:new Date(+to+3*86400000).toISOString()};
  for(const user of [3,4]){assert.equal((await api(user,'/api/defect-appointments/'+ids.vehicle,'PATCH',changed)).status,403);assert.equal((await api(user,'/api/defect-appointments/'+ids.vehicle,'DELETE')).status,403);}
  assert.equal((await api(2,'/api/defect-appointments/'+ids.vehicle,'PATCH',changed)).status,200);const list=(await api(1,'/api/defect-appointments?domain=vehicle&assetId=1')).data.appointments;assert.equal(list[0].title,changed.title);assert.equal(list[0].location,changed.location);
  assert.equal((await api(1,'/api/calendar/confirmed'+window)).data.events.filter(row=>row.id==='defect-appointment-'+ids.vehicle).length,0);
  assert.equal((await api(1,'/api/defect-appointments/'+ids.inventory,'DELETE')).status,200);assert.equal((await api(1,'/api/inventory/1')).data.defectAppointments.length,0);assert.equal((await api(1,'/api/calendar/confirmed'+window)).data.events.filter(row=>row.kind==='DEFECT_APPOINTMENT').length,0);
  const restored=await api(1,'/api/defect-appointments','POST',payload('inventory'));assert.equal(restored.status,201);ids.inventory=restored.data.id;
 });
 await check('Appointment validation and foreign-key cascades protect both asset domains',async()=>{
  for(const invalid of [{title:''},{startAt:'invalid'},{startAt:'2026-02-30T10:00:00Z'},{startAt:'2026-10-18T10:00:00'},{endAt:from.toISOString()},{endAt:new Date(+from-1).toISOString()},{companyId:999999},{domain:'wrong'},{defectId:0},{defectId:999999},{description:'x'.repeat(5001)}])assert.ok([400,404].includes((await api(1,'/api/defect-appointments','POST',{...payload('vehicle'),...invalid})).status),JSON.stringify(invalid));
  for(const domain of ['vehicle','inventory']){
   if(domain==='vehicle')db.prepare('insert into vehicles(id,license_plate,type,mileage,initial_mileage,tuv_last_at) values(9001,?,?,0,0,?)').run('B-KA 9001','PKW',Date.now());
   else db.prepare('insert into inventory_items(id,name,category,inventory_number) values(9001,?,?,?)').run('Kaskadentest','MEDICAL_DEVICE','KAS-9001');
   if(domain==='vehicle')db.prepare('insert into vehicle_defects(id,vehicle_id,title,category,reported_by_id) values(9001,9001,?,?,1)').run('Kaskadenmangel','ELEKTRIK');
   else db.prepare('insert into inventory_defects(id,item_id,title,reported_by_id) values(9001,9001,?,1)').run('Kaskadenmangel');
   const created=await api(1,'/api/defect-appointments','POST',{...payload(domain),defectId:9001});assert.equal(created.status,201);db.prepare('delete from '+(domain==='vehicle'?'vehicles':'inventory_items')+' where id=9001').run();assert.equal(db.prepare('select id from defect_appointments where id=?').get(created.data.id),undefined);
  }
  const company=Number(db.prepare('insert into vehicle_service_companies(name,address) values(?,?)').run('Temporäre Prüffirma','Prüfstraße 7').lastInsertRowid);
  const snapshot=await api(1,'/api/defect-appointments','POST',{...payload('vehicle'),title:'Firmenlöschtest',companyId:company});assert.equal(snapshot.status,201);
  db.prepare('delete from vehicle_service_companies where id=?').run(company);const retained=db.prepare('select company_id,company_name from defect_appointments where id=?').get(snapshot.data.id);assert.equal(retained.company_id,null);assert.equal(retained.company_name,'Temporäre Prüffirma');assert.equal((await api(1,'/api/defect-appointments/'+snapshot.data.id,'DELETE')).status,200);
 });
}
