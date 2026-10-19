import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {build} from "esbuild";
import {chromium} from "@playwright/test";

const bundle=await build({stdin:{contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
 import {InventoryList} from './src/app/(app)/inventory/_components/inventory-ui';
 import {MembersClient} from './src/app/(app)/members/_components/members-client';
 import {DefectOverview} from './src/app/(app)/_components/defects';
 import {HoursClient} from './src/app/(app)/hours/_components/hours-client';
 import {dateFormatter} from './src/lib/date-format';
 const items=Array.from({length:135},(_,i)=>({id:i+1,name:'Artikel'+(i+1),category:'CONSUMABLE',inventoryNumber:'VER-'+(i+1),quantity:10,minimumQuantity:1,unit:'Stück',location:'Lager',status:'ACTIVE',nextInspectionAt:null,expiryAt:null,oxygenCapacityLiters:null}));
 const members=items.map((item,i)=>({id:item.id,username:'Mitglied'+item.id,firstName:'Test',lastName:'Person'+item.id,role:'PERSONAL',contractType:null,geb:null,qualRD:'NFS',qualAusb:null,einsatzort:'RD'}));
 const defects=items.map(item=>({id:item.id,title:'Mangel'+item.id,subject:'Testgerät',createdAt:'2026-10-18T08:00:00Z',status:'ERSTELLT',href:'/inventory/defects/'+item.id}));
 const root=createRoot(document.getElementById('root'));
 window.formatter=dateFormatter;window.show=(mode)=>flushSync(()=>root.render(mode==='hours'?<HoursClient key={mode} viewer={{id:1,username:'Admin',role:'ADMIN'}} initialYear={2026} initialMonth={10} initialStatus="OPEN" initialReopen={null} initialTotalMinutes={0} initialEntries={[]} initialForUserId={1} initialForUserName="Admin" members={members.map(m=>({...m,isClosedCurrentMonth:false,lastClosedLabel:'Offen'}))}/>:mode==='members'?<MembersClient key={mode} members={members} canCreate canManage/>:mode==='defects'?<DefectOverview key={mode} rows={defects} createHref="/inventory/defects/new"/>:<InventoryList key={mode} section="items" canManage initialData={{items}}/>));
 window.show('inventory');
`,resolveDir:process.cwd(),loader:"tsx"},bundle:true,write:false,format:"iife",platform:"browser",define:{"process.env.NODE_ENV":'"development"'},plugins:[{name:"mock-next",setup(b){
 b.onResolve({filter:/^next\/(navigation|link)$/},args=>({path:args.path,namespace:"mock"}));b.onLoad({filter:/.*/,namespace:"mock"},args=>({resolveDir:process.cwd(),loader:"js",contents:args.path==="next/link"?"import React from 'react';export default props=>React.createElement('a',props)":"export const usePathname=()=>'/inventory/items';export const useRouter=()=>({push(){},refresh(){}});"}));
}}]});
const browser=await chromium.launch({headless:true}),errors=[];let inventoryRequests=0,formRequests=0;
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on("pageerror",error=>errors.push(error.message));
 await page.route("http://performance.test/",route=>route.fulfill({contentType:"text/html",body:'<div id="root"></div>'}));
 await page.route("**/api/inventory",route=>{inventoryRequests++;return route.fulfill({json:{items:[]}});});
 await page.route("**/api/member-registration-forms",route=>{formRequests++;return route.fulfill({json:{ok:true,forms:[]}});});
 await page.goto("http://performance.test/");await page.addStyleTag({content:await fs.readFile("public/styles.css","utf8")});await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.getByRole("table").waitFor();assert.equal(await page.locator("tbody tr").count(),50);
 assert.equal(inventoryRequests,0,"Initial server data must not be fetched a second time");
 await page.getByRole("button",{name:"Nächste Seite",exact:true}).click();assert.match(await page.locator("tbody tr").first().innerText(),/Artikel51/);
 await page.getByPlaceholder("Bezeichnung, Inventarnummer oder Standort").fill("Artikel135");assert.equal(await page.locator("tbody tr").count(),1);assert.match(await page.locator("tbody").innerText(),/Artikel135/);
 await page.evaluate(()=>{const now=Date.now;window.originalNow=now;Date.now=()=>now()+31000;window.dispatchEvent(new Event("focus"));});await page.getByText("Keine passenden Artikel vorhanden.",{exact:true}).waitFor();assert.equal(inventoryRequests,1);await page.evaluate(()=>{Date.now=window.originalNow;});
 await page.evaluate(()=>window.show("members"));assert.equal(await page.locator("ul > li").count(),50);
 assert.equal(formRequests,0,"Closed registration dialog must not load data");
 await page.getByRole("button",{name:"Nächste Seite",exact:true}).click();assert.ok(await page.locator('a[href="/members/51"]').count());
 await page.getByRole("textbox",{name:"Suche",exact:true}).fill("Mitglied135");assert.equal(await page.locator("ul > li").count(),1);assert.ok(await page.locator('a[href="/members/135"]').count());
 await page.getByRole("button",{name:"Registrierungsformulare",exact:true}).click();await page.getByRole("heading",{name:"Registrierungsformulare",exact:true}).waitFor();await page.waitForFunction(()=>document.body.innerText.includes("Noch keine Registrierungsformulare"));assert.equal(formRequests,1);
 await page.evaluate(()=>window.show("defects"));assert.equal(await page.locator("tbody tr").count(),50);
 await page.getByRole("button",{name:"Nächste Seite",exact:true}).click();assert.match(await page.locator("tbody tr").first().innerText(),/Mangel51/);
 await page.getByPlaceholder("Titel oder Inventar / Kennzeichen suchen").fill("Mangel135");assert.equal(await page.locator("tbody tr").count(),1);
 await page.evaluate(()=>window.show("hours"));await page.getByRole('button',{name:'Mitglieder',exact:true}).click();assert.equal(await page.locator('aside button').count(),52);
 await page.getByRole('textbox',{name:'Mitglieder suchen',exact:true}).fill('Mitglied135');assert.equal(await page.locator('aside button').count(),1);assert.match(await page.locator('aside').innerText(),/Mitglied135/);
 assert.equal(await page.evaluate(()=>window.formatter({dateStyle:"short"})===window.formatter({dateStyle:"short"})),true);
 assert.deepEqual(errors,[]);console.log("PASS: bounded list rendering, complete search, pagination reset, initial-data request deduplication, focus refresh, lazy forms and formatter reuse");
}finally{await browser.close();}
