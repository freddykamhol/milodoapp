import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {chromium} from "@playwright/test";

const bundle=await build({stdin:{contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
 import {Sidebar} from './src/app/(app)/_components/sidebar';
 import {MobileNav} from './src/app/(app)/_components/mobile-nav';
 const root=createRoot(document.getElementById('root'));
 window.renderMenu=(role='ADMIN',path='/dashboard')=>{window.auditPath=path;flushSync(()=>root.render(<div style={{display:'grid',gridTemplateColumns:innerWidth>=768?'240px 1fr':'1fr',gap:24,padding:16}}><Sidebar role={role}/><main><MobileNav role={role}/><h1>Einsatzübersicht</h1><button id="outside">Seiteninhalt</button></main></div>));};
 window.renderMenu();
`,loader:"tsx",resolveDir:process.cwd()},bundle:true,write:false,format:"iife",platform:"browser",define:{"process.env.NODE_ENV":'"development"'},plugins:[{name:"next-mocks",setup(b){
 b.onResolve({filter:/^next\/(navigation|link|image)$/},args=>({path:args.path,namespace:"mock"}));
 b.onLoad({filter:/.*/,namespace:"mock"},args=>({loader:"js",resolveDir:process.cwd(),contents:args.path==="next/navigation"?"export const usePathname=()=>window.auditPath;":args.path==="next/image"?"import React from 'react';export default function Image({priority,...props}){return React.createElement('img',props)}":"import React from 'react';export default function Link({onClick,...props}){return React.createElement('a',{...props,onClick:e=>{e.preventDefault();onClick?.(e);window.lastHref=props.href;}})}"}));
}}]});
const browser=await chromium.launch({headless:true}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("http://navigation.test/",route=>route.fulfill({contentType:"text/html",body:'<div id="root"></div>'}));
 await page.route("**/api/today",route=>route.fulfill({json:{ok:true,today:{confirmed:[],birthdays:[],requests:[]}}}));
 await page.route("**/logo/MILODO.png",async route=>route.fulfill({contentType:"image/png",body:await fs.readFile("public/logo/MILODO.png")}));
 await page.goto("http://navigation.test/");await page.addStyleTag({content:await fs.readFile("public/styles.css","utf8")});await page.addScriptTag({content:bundle.outputFiles[0].text});
 const desktop=page.getByRole("complementary",{name:"Seitennavigation"});
 await desktop.getByRole("link",{name:"Dashboard",exact:true}).waitFor();
 assert.deepEqual(await desktop.getByRole("heading").allTextContents(),["Planung & Einsätze","Fuhrpark & Material","Team & Personal","Verwaltung","Mein Konto"]);
 assert.equal(await desktop.locator('[aria-current="page"]').count(),1);
 await desktop.getByRole("button",{name:"Fahrzeuge Untermenü",exact:true}).click();await desktop.getByRole("link",{name:"Wartungsfirmen",exact:true}).waitFor();
 await page.evaluate(()=>window.renderMenu("ADMIN","/maintenance-companies"));
 await desktop.locator('[aria-current="page"][href="/maintenance-companies"]').waitFor();
 assert.equal(await desktop.getByRole("link",{name:"Wartungsfirmen",exact:true}).count(),1);
 assert.equal(await desktop.getByRole("link",{name:"Wartungsfirmen",exact:true}).evaluate(el=>el.classList.contains('app-nav-sublink')),false);
 assert.equal(await desktop.getByRole("link",{name:"Wartungsfirmen",exact:true}).evaluate(el=>el.closest('section').querySelector('h2').textContent),'Fuhrpark & Material');
 assert.equal(await desktop.locator('a[href="/vehicles/companies"],a[href="/inventory/companies"]').count(),0);
 await page.evaluate(()=>window.renderMenu("VERWALTUNG","/maintenance-companies"));
 await desktop.getByRole("link",{name:"Wartungsfirmen",exact:true}).waitFor();
 await page.evaluate(()=>window.renderMenu("PERSONAL","/inventory/items"));
 assert.equal(await desktop.locator('a[href="/maintenance-companies"]').count(),0);
 await page.evaluate(()=>window.renderMenu("ADMIN","/maintenance-companies"));
 await desktop.getByRole("searchbox",{name:"Menü durchsuchen"}).fill("Mängel");
 assert.equal(await desktop.getByRole("link",{name:"Mängel",exact:true}).count(),2);
 await desktop.getByRole("searchbox").fill("xxxxxxxx");await desktop.getByRole("status").waitFor();
 await desktop.getByRole("searchbox").fill("");
 await page.evaluate(()=>window.renderMenu("ADMIN","/vehicles/defects/42"));
 await desktop.locator('[aria-current="page"][href="/vehicles/defects"]').waitFor();
 assert.equal(await desktop.locator('[aria-current="page"]').count(),1);
 assert.deepEqual(await desktop.locator(".is-active").evaluateAll(elements=>elements.map(element=>element.getAttribute("href"))),["/vehicles/defects"]);
 await fs.mkdir("artifacts/navigation",{recursive:true});await page.screenshot({path:"artifacts/navigation/desktop.png"});
 for(const role of ["ADMIN","VERWALTUNG","PERSONAL","KUNDE"]){
  await page.evaluate(role=>window.renderMenu(role,"/dashboard"),role);
  await desktop.getByRole("link",{name:"Dashboard",exact:true}).waitFor();
  const names=await desktop.locator("a").evaluateAll(elements=>elements.map(el=>el.getAttribute("href")));
  if(role==="PERSONAL"){assert.ok(!names.includes("/vehicles"));assert.ok(!names.includes("/vehicles/companies"));assert.equal(await desktop.getByRole("link",{name:"Fahrzeuge",exact:true}).getAttribute("href"),"/vehicles/trips");assert.ok(!names.includes("/customers"));}
  if(role==="KUNDE"){assert.ok(!names.some(href=>href.startsWith("/vehicles")||href.startsWith("/inventory")));assert.ok(names.includes("/documents/services"));}
  for(const width of [320,375,767]){
   await page.setViewportSize({width,height:640});await page.evaluate(role=>window.renderMenu(role,"/dashboard"),role);
   const trigger=page.getByRole("button",{name:"Menü öffnen",exact:true});await trigger.click();
   const dialog=page.getByRole("dialog",{name:"Navigation"});await dialog.waitFor();await dialog.evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished)));const box=await dialog.boundingBox();
   assert.ok(box.x>=0&&box.x+box.width<=width&&box.height<=641,JSON.stringify({width,box}));
   assert.equal(await page.locator("#root").evaluate(el=>el.inert),true);
   assert.equal(await page.evaluate(()=>document.body.style.overflow),"hidden");
   assert.equal(await dialog.locator('[aria-current="page"]').count(),1);
   const controls=dialog.locator('a,button,input').filter({visible:true});
   await controls.last().focus();await page.keyboard.press("Tab");assert.equal(await dialog.getByRole("button",{name:"Menü schließen"}).evaluate(el=>el===document.activeElement),true);
   await page.keyboard.press("Escape");await dialog.waitFor({state:"detached"});
   assert.equal(await page.locator("#root").evaluate(el=>el.inert),false);assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  }
  await page.setViewportSize({width:1280,height:900});
 }
 await page.setViewportSize({width:375,height:812});await page.evaluate(()=>window.renderMenu("ADMIN","/inventory/inspections"));
 await page.getByRole("button",{name:"Menü öffnen",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Navigation"});
 await dialog.locator('[aria-current="page"][href="/inventory/inspections"]').waitFor();
 await dialog.evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished)));
 await page.locator(".app-mobile-backdrop").evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished)));
 await page.screenshot({path:"artifacts/navigation/mobile.png"});
 await dialog.getByRole("link",{name:"Prüfungen",exact:true}).click();await dialog.waitFor({state:"detached"});
 assert.equal(await page.evaluate(()=>window.lastHref),"/inventory/inspections");
 await page.getByRole("button",{name:"Menü öffnen",exact:true}).click();await page.setViewportSize({width:1024,height:812});await dialog.waitFor({state:"detached"});
 assert.deepEqual(errors,[]);
 console.log("PASS: grouped navigation, search, submenus, active states, all four roles, 320/375/767/1280px, focus trap, scroll lock, dismissal and resizing");
}finally{await browser.close();}
