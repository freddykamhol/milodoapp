import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
const bundle=await build({stdin:{contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
 import {FileUpload,StagedUpload} from './src/app/_components/file-upload';
 import {RecipientSelector} from './src/app/_components/recipient-selector';
 import {MessagesClient} from './src/app/(app)/messages/messages-client';
 import {DocumentsSettingsClient} from './src/app/(app)/settings/documents/_components/documents-settings-client';
 import {FeedbackHost} from './src/app/_components/feedback';
 const users=[{id:1,username:'Anna',email:'anna@example.invalid',role:'PERSONAL',qualRD:'NFS',qualAusb:'AUSBILDER'},{id:2,username:'Bärbel',email:'baerbel@example.invalid',role:'PERSONAL',qualRD:'RS',qualAusb:'AUSBILDER'}];
 function Harness(){const [files,setFiles]=React.useState([]),[recipients,setRecipients]=React.useState({roles:[],userIds:[],emails:[]});window.currentSelection=recipients;return <div style={{padding:16,maxWidth:900}}><FileUpload files={files} onChange={setFiles}/><RecipientSelector users={users} value={recipients} onChange={setRecipients}/><StagedUpload label="Blogbild" onUpload={async files=>{window.uploaded=files.length;return true;}}/></div>;}
 const root=createRoot(document.getElementById('root'));window.show=mode=>flushSync(()=>root.render(<><FeedbackHost/>{mode==='settings'?<DocumentsSettingsClient key="settings" initial={[{category:'TRAINING',label:'Fortbildung',recipients:[]}]} users={users} manualExpiryRequiresApproval={false}/>:mode==='messages'?<MessagesClient key="messages" users={users} initialItems={[]}/>:<Harness key="uploads"/>}</>));window.show('uploads');
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'mock-next',setup(b){b.onResolve({filter:/^next\/(link|navigation)$/},args=>({path:args.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},args=>({resolveDir:process.cwd(),loader:'js',contents:args.path==='next/link'?"import React from 'react';export default props=>React.createElement('a',props);":"export const useRouter=()=>({refresh(){}});export const usePathname=()=>'/messages';"}));}}]});
const browser=await chromium.launch({headless:true}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:375,height:812},timezoneId:'Europe/Berlin'});page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://uploads.test/',route=>route.fulfill({body:'<div id="root"></div>',contentType:'text/html'}));
 let posts=0;
 let settings=[];await page.route('**/api/settings/documents',async route=>{settings.push(route.request().postDataJSON());return route.fulfill({json:{ok:true}});});
 await page.route('**/api/messages',async route=>{if(route.request().method()==='POST'){posts++;const text=route.request().postDataBuffer().toString();assert.match(text,/Betreff Test/);assert.match(text,/Inhalt Test/);return route.fulfill({status:202,json:{id:1}});}return route.fulfill({json:{items:[]}});});
 await page.goto('http://uploads.test/');await page.addStyleTag({content:await fs.readFile('public/styles.css','utf8')});await page.addScriptTag({content:bundle.outputFiles[0].text});
 const png={name:'Bild.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0LAAAAAASUVORK5CYII=','base64')};
 const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Dateien auswählen',exact:true}).first().click();await (await picker).setFiles([png,{name:'Liste.csv',mimeType:'text/csv',buffer:Buffer.from('Name;Ort\nAnna;Köln')}]);await page.getByAltText('Bild.png',{exact:true}).waitFor();await page.getByText('Name;Ort\nAnna;Köln',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Bild.png entfernen',exact:true}).click();assert.equal(await page.getByAltText('Bild.png',{exact:true}).count(),0);await page.getByRole('button',{name:'Liste.csv entfernen',exact:true}).click();
 await page.getByLabel('Anhänge',{exact:true}).setInputFiles(png);await page.getByRole('button',{name:'Bild.png entfernen',exact:true}).waitFor();await page.getByRole('button',{name:'Bild.png entfernen',exact:true}).click();await page.getByLabel('Anhänge',{exact:true}).setInputFiles(png);await page.getByAltText('Bild.png',{exact:true}).waitFor();assert.equal(await page.getByAltText('Bild.png',{exact:true}).count(),1);
 await page.getByRole('checkbox',{name:'Personal',exact:true}).check();await page.getByRole('tab',{name:'Benutzer',exact:true}).click();const anna=page.getByRole('checkbox',{name:/Anna/});assert.equal(await anna.isChecked(),true);await anna.uncheck();assert.deepEqual(await page.evaluate(()=>window.currentSelection.roles),[]);assert.deepEqual(await page.evaluate(()=>window.currentSelection.userIds),[2]);
 await page.getByRole('tab',{name:'Adressen',exact:true}).click();await page.getByRole('textbox',{name:'Weitere E-Mail-Adresse'}).fill('extra@example.invalid');await page.getByRole('button',{name:'+ Hinzufügen',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.currentSelection.emails),['extra@example.invalid']);await page.getByRole('button',{name:'extra@example.invalid entfernen'}).click();
 await page.getByLabel('Blogbild',{exact:true}).setInputFiles(png);assert.equal(await page.evaluate(()=>window.uploaded??0),0);await page.getByRole('button',{name:'Auswahl hochladen',exact:true}).click();assert.equal(await page.evaluate(()=>window.uploaded),1);
 for(const width of [320,375,768,1280]){await page.setViewportSize({width,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 await page.evaluate(()=>window.show('settings'));const saved=page.waitForResponse('**/api/settings/documents');await page.getByRole('checkbox',{name:'Personal',exact:true}).check();await saved;assert.equal(await page.getByRole('checkbox',{name:'Personal',exact:true}).isChecked(),true);assert.equal(settings.at(-1).recipients[0].role,'PERSONAL');
 await page.evaluate(()=>window.show('messages'));
 assert.equal(await page.getByRole('tab').count(),4);
 await page.getByRole('tab',{name:'Qualifikation',exact:true}).click();
 await page.getByRole('checkbox',{name:'Notfallsanitäter (NFS)',exact:true}).check();
 await page.getByRole('tab',{name:'Benutzer',exact:true}).click();
 assert.equal(await page.getByRole('checkbox',{name:/Anna/}).isChecked(),true);assert.equal(await page.getByRole('checkbox',{name:/Bärbel/}).isChecked(),false);
 await page.getByRole('tab',{name:'Rollen',exact:true}).click();await page.getByRole('checkbox',{name:'Personal',exact:true}).check();
 await page.getByRole('tab',{name:'Benutzer',exact:true}).click();await page.getByRole('checkbox',{name:/Anna/}).uncheck();assert.equal(await page.getByRole('checkbox',{name:/Bärbel/}).isChecked(),true);
 await page.getByRole('tab',{name:'Qualifikation',exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'Notfallsanitäter (NFS)',exact:true}).isChecked(),false);
 await page.getByRole('checkbox',{name:'Ausbilder (AUSBILDER)',exact:true}).check();await page.getByRole('tab',{name:'Benutzer',exact:true}).click();await page.getByRole('checkbox',{name:/Anna/}).uncheck();await page.getByRole('checkbox',{name:/Bärbel/}).uncheck();
 await page.getByRole('tab',{name:'Qualifikation',exact:true}).click();await page.getByRole('checkbox',{name:'Notfallsanitäter (NFS)',exact:true}).check();
 await page.getByRole('tab',{name:'Rollen',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'Qualifikation',exact:true}).getAttribute('aria-selected'),'true');
 await page.getByLabel('Betreff',{exact:true}).fill('Betreff Test');await page.getByLabel('Inhalt',{exact:true}).fill('Inhalt Test');await page.getByLabel('Anhänge',{exact:true}).setInputFiles(png);
 await fs.mkdir('artifacts/messages',{recursive:true});
 for(const width of [320,375,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:'artifacts/messages/compose-'+width+'.png',fullPage:true});}
 await page.getByRole('radio',{name:/Versand planen/}).check();await page.getByLabel(/^Versand am/).fill('2026-10-19T12:00');
 for(const width of [320,375,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 await page.getByRole('radio',{name:/Jetzt senden/}).check();
 await page.getByRole('button',{name:'Nachricht senden',exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(posts,0);await page.getByRole('button',{name:'Bestätigen',exact:true}).click();await page.waitForFunction(()=>document.querySelector('textarea').value==='');assert.equal(posts,1);
 assert.deepEqual(errors,[]);console.log('PASS: image/text previews, individual removal and same-file reselection, staged blog uploads, role exclusions, addresses, mobile bounds and confirmed multipart message submission');
}finally{await browser.close();}
