import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const bundle = await build({ stdin: { contents: `
  import React from 'react';
  import {createRoot} from 'react-dom/client';
  import {AppSelect} from './src/app/_components/select';
  import {FeedbackHost,confirmAction,requestText,notify} from './src/app/_components/feedback';
  import {NotificationsMenu} from './src/app/(app)/_components/notifications-menu';
  function Harness(){const [value,setValue]=React.useState('');const [result,setResult]=React.useState('');return <>
    <div style={{padding:16,maxWidth:480}}><form onSubmit={e=>{e.preventDefault();setResult(new FormData(e.currentTarget).get('vehicle'));}}>
      <label>Fahrzeug<AppSelect name="vehicle" required aria-label="Fahrzeug" value={value} onChange={e=>setValue(e.target.value)}><option value="">Bitte ausw\u00e4hlen</option><option value="disabled" disabled>Gesperrt</option>{Array.from({length:20},(_,i)=><option key={i} value={'v'+i}>Fahrzeug {i}</option>)}</AppSelect></label>
      <button type="submit">Speichern</button><output data-testid="result">{result}</output></form>
      <label>Prüfergebnis<AppSelect><option value="PASSED">Bestanden</option><option value="FAILED">Nicht bestanden</option></AppSelect></label>
      <button onClick={async()=>setResult(String(await confirmAction('Wirklich fortfahren?')))}>Dialog testen</button>
      <button onClick={async()=>setResult(String(await requestText('Titel eingeben','M\u00e4ngel')))}>Eingabe testen</button>
      <button onClick={()=>notify('Gespeichert: Stra\u00dfe, Pr\u00fcfung, Rucks\u00e4cke')}>Hinweis testen</button>
      <div style={{display:'flex',justifyContent:'flex-start',marginTop:20}}><NotificationsMenu/></div>
    </div><FeedbackHost/></>};createRoot(document.getElementById('root')).render(<Harness/>);
`, loader: "tsx", resolveDir: process.cwd() }, bundle: true, write: false, platform: "browser", format: "iife", define: { "process.env.NODE_ENV": '"development"' } });
const browser = await chromium.launch({ headless: true });
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:320,height:680}});
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/api/notifications**",route=>route.fulfill({json:{ok:true,unreadCount:1,notifications:[{id:1,title:'Sehr langer Hinweis '+ 'Prüfung '.repeat(12),body:'Eine ausführliche Beschreibung '.repeat(20),href:'/inventory/items',createdAt:new Date().toISOString(),read:false}]}}));
 await page.route('http://ui-test.local/',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
 await page.goto('http://ui-test.local/');
 await page.addStyleTag({content:await fs.readFile('public/styles.css','utf8')});
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 const select=page.getByRole('combobox',{name:'Fahrzeug'});
 await select.waitFor();
 assert.equal(await page.getByRole('combobox',{name:/Prüfergebnis/}).count(),1,'Implicit field labels name the visible control');
 await page.getByRole('button',{name:'Speichern',exact:true}).click();
 assert.equal(await select.getAttribute('aria-invalid'),'true','Required select shows validation');
 await select.click();
 await page.getByRole('textbox',{name:'Optionen durchsuchen'}).fill('Fahrzeug 12');
 await page.getByRole('option',{name:'Fahrzeug 12',exact:true}).click();
 assert.match(await select.innerText(),/Fahrzeug 12/);
 await page.getByRole('button',{name:'Speichern',exact:true}).click();
 assert.equal(await page.getByTestId('result').textContent(),'v12','Custom select preserves native form and controlled change');
 await select.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 assert.match(await select.innerText(),/Fahrzeug 13/,'Keyboard selection works');
 await select.click();
 const selectBounds=await page.locator('.ui-select-popover').boundingBox();assert.ok(selectBounds.x>=0&&selectBounds.x+selectBounds.width<=320,'Select fits mobile screen');
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('listbox').count(),0);
 await page.getByRole('button',{name:'Dialog testen'}).click();await page.getByRole('button',{name:'Bestätigen',exact:true}).click();assert.equal(await page.getByTestId('result').textContent(),'true');
 await page.getByRole('button',{name:'Eingabe testen'}).click();await page.getByRole('textbox',{name:'Titel eingeben'}).fill('Prüfung');await page.getByRole('button',{name:'Übernehmen'}).click();assert.equal(await page.getByTestId('result').textContent(),'Prüfung');
 await page.getByRole('button',{name:'Dialog testen'}).click();await page.keyboard.press('Escape');assert.equal(await page.getByTestId('result').textContent(),'false');
 await page.getByRole('button',{name:'Hinweis testen'}).click();await page.locator('.ui-toast').waitFor();
 await page.getByRole('button',{name:'Benachrichtigungen',exact:true}).click();await page.getByRole('dialog',{name:'Benachrichtigungen'}).waitFor();
 for(const width of [320,375,768,1280]){await page.setViewportSize({width,height:680});await page.waitForTimeout(100);const bounds=await page.getByRole('dialog',{name:'Benachrichtigungen'}).boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,`Notifications fit viewport ${width}`);assert.ok(bounds.y+bounds.height<=681,`Notifications fit height ${width}`);}
 await fs.mkdir('artifacts/ui-audit',{recursive:true});await page.setViewportSize({width:375,height:812});await page.screenshot({path:'artifacts/ui-audit/mobile-components.png'});
 assert.deepEqual(errors,[]);console.log('PASS: custom select, required validation, form data, keyboard, search, dialogs, toasts, notifications at 320/375/768/1280px');
}finally{await browser.close();}
