import net from 'node:net';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
export async function checkMessageSystem({db,base,cookie,check}){
 const headers=user=>({cookie:'milodo_auth='+cookie(user)});
 await check('Message pages, outbox APIs and attachments are manager-only',async()=>{
  for(const user of [3,4])for(const url of ['/api/messages','/api/messages/1','/api/messages/1/attachments/1'])assert.equal((await fetch(base+url,{headers:headers(user)})).status,403,url);
  for(const user of [3,4])for(const url of ['/messages','/messages/1']){const response=await fetch(base+url,{headers:headers(user)}),html=await response.text();assert.ok(response.status===404||html.includes('NEXT_HTTP_ERROR_FALLBACK;404'),url);assert.ok(!html.includes('E-Mails an Rollen, Benutzer und weitere Adressen senden oder planen.'),url);}
  for(const user of [1,2])assert.equal((await fetch(base+'/api/messages',{headers:headers(user)})).status,200);
  for(const user of [3,4])assert.equal((await fetch(base+'/api/messages',{method:'POST',headers:headers(user),body:new FormData()})).status,403);
 });
 await check('Internal message queue sends through isolated SMTP with deduplication, attachments and cancellation',async()=>{
  const captured=[],sockets=new Set();
  const smtp=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.setEncoding('utf8');let buffer='',data=false,lines=[];socket.write('220 localhost audit SMTP\r\n');socket.on('data',chunk=>{buffer+=chunk;while(buffer.includes('\r\n')){const index=buffer.indexOf('\r\n'),line=buffer.slice(0,index);buffer=buffer.slice(index+2);if(data){if(line==='.'){captured.push(lines.join('\r\n'));lines=[];data=false;socket.write('250 Message accepted\r\n');}else lines.push(line);continue;}if(/^EHLO|^HELO/.test(line))socket.write('250-localhost\r\n250 SIZE 30000000\r\n');else if(/^DATA/.test(line)){data=true;socket.write('354 End with dot\r\n');}else if(/^QUIT/.test(line))socket.end('221 Bye\r\n');else socket.write('250 OK\r\n');}});});
  await new Promise(resolve=>smtp.listen(0,'127.0.0.1',resolve));
  const form=(token=crypto.randomUUID(),scheduledAt=null)=>{const value=new FormData();value.set('token',token);value.set('subject','Testnachricht ÄÖÜ');value.set('body','Inhalt und Grüße');value.set('recipients',JSON.stringify({roles:['PERSONAL'],userIds:[3],emails:['AUDIT-2@EXAMPLE.INVALID']}));value.append('files',new File(['Grüße'],'Anhang.txt',{type:'text/plain'}));if(scheduledAt)value.set('scheduledAt',scheduledAt);return value;};
  const post=async(value,user=1)=>{const response=await fetch(base+'/api/messages',{method:'POST',headers:headers(user),body:value});return {status:response.status,data:await response.json()};};
  try{
   db.prepare('insert into smtp_settings(id,created_at,updated_at,enabled,host,port,secure,from_email) values(1,?,?,0,?,?,0,?) on conflict(id) do update set enabled=0,host=excluded.host,port=excluded.port,secure=0,username=\'\',password=\'\',from_email=excluded.from_email').run(Date.now(),Date.now(),'127.0.0.1',smtp.address().port,'audit-sender@example.invalid');
   assert.equal((await post(form())).status,409);
   db.prepare('update smtp_settings set enabled=1 where id=1').run();
   const token=crypto.randomUUID(),sent=await post(form(token));assert.equal(sent.status,202,JSON.stringify(sent));const duplicate=await post(form(token));assert.equal(duplicate.data.id,sent.data.id);
   let detail;for(let i=0;i<100;i++){detail=await (await fetch(base+'/api/messages/'+sent.data.id,{headers:headers(1)})).json();if(detail.item.status==='SENT')break;await new Promise(resolve=>setTimeout(resolve,100));}
   assert.equal(detail.item.status,'SENT',JSON.stringify(detail));assert.equal(detail.item.total,1);assert.equal(captured.length,1);assert.match(captured[0],/Anhang.txt/);assert.match(captured[0],/R3LDvMOfZQ==/);assert.equal(detail.item.files[0].content,undefined);
   const download=await fetch(base+'/api/messages/'+sent.data.id+'/attachments/'+detail.item.files[0].id,{headers:headers(2)});assert.equal(download.status,200);assert.equal(await download.text(),'Grüße');
   const planned=await post(form(crypto.randomUUID(),new Date(Date.now()+3600000).toISOString()),2);assert.equal(planned.status,202);const pending=await (await fetch(base+'/api/messages/'+planned.data.id,{headers:headers(1)})).json();assert.equal(pending.item.status,'SCHEDULED');
   const cancel=await fetch(base+'/api/messages/'+planned.data.id,{method:'PATCH',headers:{...headers(2),'content-type':'application/json'},body:JSON.stringify({action:'cancel'})});assert.equal(cancel.status,200);assert.equal(db.prepare('select status from message_jobs where id=?').get(planned.data.id).status,'CANCELLED');
   const invalid=form();invalid.set('subject','Injected\r\nBcc: bad@example.invalid');assert.equal((await post(invalid)).status,400);
   db.prepare('update users set qual_rd=?,qual_ausb=? where id=3').run('RS','AUSBILDER');
   const qualificationForm=form(crypto.randomUUID(),new Date(Date.now()+3600000).toISOString());qualificationForm.set('recipients',JSON.stringify({roles:[],qualifications:['RS','AUSBILDER'],userIds:[],emails:[]}));
   const qualificationJob=await post(qualificationForm);assert.equal(qualificationJob.status,202,JSON.stringify(qualificationJob));
   const qualificationDetail=await (await fetch(base+'/api/messages/'+qualificationJob.data.id,{headers:headers(1)})).json();assert.equal(qualificationDetail.item.total,1);assert.deepEqual(qualificationDetail.item.selection.qualifications,['RS','AUSBILDER']);
   const malformed=form();malformed.set('recipients',JSON.stringify({roles:[],qualifications:['ROOT'],userIds:[],emails:[]}));assert.equal((await post(malformed)).status,400);
   db.prepare('update users set qual_rd=?,qual_ausb=null where id=3').run('NFS');
   assert.equal((await post(form(crypto.randomUUID(),new Date(Date.now()-60000).toISOString()))).status,400);
  }finally{db.prepare('update smtp_settings set enabled=0 where id=1').run();for(const socket of sockets)socket.destroy();await new Promise(resolve=>smtp.close(resolve));}
 });
 await check('Both defect domains restrict and atomically remove stored images',async()=>{
  const image='data:image/png;base64,iVBORw0KGgo=';
  for(const domain of ['vehicle','inventory']){const table=domain==='vehicle'?'vehicle_defects':'inventory_defects',url=domain==='vehicle'?'/api/vehicles/defects/1':'/api/inventory/defects/1';db.prepare('update '+table+' set image_urls=? where id=1').run(JSON.stringify([image]));const options=user=>({method:'PATCH',headers:{...headers(user),'content-type':'application/json'},body:JSON.stringify({action:'removeImage',index:0,expected:image})});assert.equal((await fetch(base+url,options(3))).status,403);assert.equal((await fetch(base+url,options(2))).status,200);assert.equal(db.prepare('select image_urls from '+table+' where id=1').get().image_urls,'[]');assert.equal((await fetch(base+url,options(1))).status,409);}
 });
 await check('Stored documents can only be deleted by owner or management',async()=>{
  const row=db.prepare('insert into documents(owner_id,title,category,file_name,storage_key) values(1,?,?,?,?)').run('Löschtest','CV','Test.pdf','1/'+crypto.randomUUID()+'.pdf'),id=Number(row.lastInsertRowid);
  for(const user of [3,4])assert.equal((await fetch(base+'/api/documents/'+id,{method:'DELETE',headers:headers(user)})).status,403);
  assert.equal((await fetch(base+'/api/documents/'+id,{method:'DELETE',headers:headers(2)})).status,200);assert.equal(db.prepare('select id from documents where id=?').get(id),undefined);
 });
}
