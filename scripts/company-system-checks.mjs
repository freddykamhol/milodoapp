import assert from 'node:assert/strict';
export async function checkCompanySystem({db,base,cookie,check}){
 const body={name:'API Wartungsfirma ÄÖÜ',street:'Prüfstraße 7',postalCode:'12345',city:'Musterstadt',phone:'01234567',email:'service@example.invalid',contactPerson:'Jörg Müller'};
 async function api(user,path,method='GET',data){const response=await fetch(base+path,{method,headers:{cookie:'milodo_auth='+cookie(user),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:response.status,data:await response.json()};}
 let id;
 await check('Maintenance company CRUD is manager-only',async()=>{
  assert.equal((await fetch(base+'/api/maintenance-companies/1')).status,401);
  for(const user of [3,4])for(const [path,method,data] of [['/api/maintenance-companies','GET'],['/api/maintenance-companies','POST',body],['/api/maintenance-companies/1','GET'],['/api/maintenance-companies/1','PATCH',body],['/api/maintenance-companies/1','DELETE']])assert.equal((await api(user,path,method,data)).status,403);
  const created=await api(2,'/api/maintenance-companies','POST',body);assert.equal(created.status,200,JSON.stringify(created));id=created.data.company.id;assert.equal((await api(1,'/api/maintenance-companies/'+id)).data.company.contactPerson,body.contactPerson);assert.ok((await api(1,'/api/vehicles/companies')).data.companies.some(row=>row.id===id));
 });
 await check('Company edits validate fields, uniqueness and missing records',async()=>{
  for(const invalid of [{name:''},{street:''},{city:''},{postalCode:''},{email:'invalid'},{name:'x'.repeat(201)},{phone:{invalid:true}}])assert.equal((await api(1,'/api/maintenance-companies/'+id,'PATCH',{...body,...invalid})).status,400);
  const other=await api(1,'/api/maintenance-companies','POST',{...body,name:'API Dublettenprüfung'});assert.equal(other.status,200);assert.equal((await api(1,'/api/maintenance-companies/'+id,'PATCH',{...body,name:'API Dublettenprüfung'})).status,409);assert.equal((await api(1,'/api/maintenance-companies','POST',body)).status,409);
  assert.equal((await api(2,'/api/maintenance-companies/'+id,'PATCH',{...body,name:body.name+' bearbeitet',phone:'0987654'})).status,200);assert.equal((await api(1,'/api/maintenance-companies/'+id)).data.company.phone,'0987654');
  assert.equal((await api(1,'/api/maintenance-companies/not-a-number','DELETE')).status,400);assert.equal((await api(1,'/api/maintenance-companies/999999','GET')).status,404);assert.equal((await api(1,'/api/maintenance-companies/999999','PATCH',body)).status,404);assert.equal((await api(1,'/api/maintenance-companies/999999','DELETE')).status,404);assert.equal((await api(1,'/api/maintenance-companies/'+other.data.company.id,'DELETE')).status,200);
 });
 await check('Deleting a company preserves vehicle maintenance and both defect appointment snapshots',async()=>{
  const savedName=body.name+' bearbeitet',startAt=new Date(Date.now()+86400000).toISOString(),ids=[];
  for(const domain of ['vehicle','inventory']){const response=await api(1,'/api/defect-appointments','POST',{domain,defectId:1,companyId:id,title:'Firmenkaskade',startAt,location:'Historischer Ort'});assert.equal(response.status,201);ids.push(response.data.id);}
  const maintenance=Number(db.prepare('insert into vehicle_maintenance_appointments(vehicle_id,company_id,company_name,address,title,start_at,created_by_id) values(1,?,?,?,?,?,1)').run(id,savedName,'Historischer Ort','Firmenkaskade',Date.parse(startAt)).lastInsertRowid);
  assert.equal((await api(2,'/api/maintenance-companies/'+id,'DELETE')).status,200);assert.equal((await api(1,'/api/maintenance-companies/'+id)).status,404);
  for(const appointmentId of ids){const row=db.prepare('select company_id,company_name,location from defect_appointments where id=?').get(appointmentId);assert.equal(row.company_id,null);assert.equal(row.company_name,savedName);assert.equal(row.location,'Historischer Ort');await api(1,'/api/defect-appointments/'+appointmentId,'DELETE');}
  const retained=db.prepare('select company_id,company_name,address from vehicle_maintenance_appointments where id=?').get(maintenance);assert.equal(retained.company_id,null);assert.equal(retained.company_name,savedName);assert.equal(retained.address,'Historischer Ort');db.prepare('delete from vehicle_maintenance_appointments where id=?').run(maintenance);
 });
}
