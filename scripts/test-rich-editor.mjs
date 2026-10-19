import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const require = createRequire(process.env.MILODO_TEST_MODULES ? `${process.env.MILODO_TEST_MODULES}/package.json` : import.meta.url);
const { build } = require(process.env.MILODO_TEST_MODULES ? "esbuild-wasm" : "esbuild");
const { chromium } = require("@playwright/test");

const bundle = await build({
  stdin: { contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { RichTextEditor } from './src/app/(app)/blog/_components/rich-text-editor';
    import { BlogEditorClient } from './src/app/(app)/blog/_components/blog-editor-client';
    import { sanitizeBlogHtml } from './src/lib/blog-rich-text';
    function Harness() {
      const [value, setValue] = React.useState('');
      const [key, setKey] = React.useState(0);
      window.saved = value;
      window.restore = () => setKey(k => k + 1);
      window.clean = sanitizeBlogHtml;
      return <><RichTextEditor key={key} value={value} onChange={setValue} placeholder="Testeditor" />
        <div id="preview" className="blog-rich-content" dangerouslySetInnerHTML={{__html: sanitizeBlogHtml(value)}} />
        <button id="blur">Blur</button></>;
    }
    const root = createRoot(document.getElementById('root'));
    let fullKey = 0;
    window.fullEditor = () => root.render(<BlogEditorClient key={++fullKey} mode="edit" postId={42} />);
    root.render(<Harness />);
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "browser", format: "iife",
  nodePaths: process.env.MILODO_TEST_MODULES ? [`${process.env.MILODO_TEST_MODULES}/node_modules`] : [],
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: 'mock-router', setup(build) {
    build.onResolve({filter: /^next\/navigation$/}, () => ({path:'router', namespace:'mock'}));
    build.onLoad({filter: /.*/, namespace:'mock'}, () => ({contents:'export const useRouter = () => ({replace() {}});', loader:'js'}));
  }}],
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({ content: await readFile('public/styles.css', 'utf8') });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const editor = page.getByRole('textbox');
  await editor.waitFor();
  const googleHtml = `<b id="docs-internal-guid-test" style="font-weight:normal"><p style="line-height:1.38;margin-top:0pt;margin-bottom:0pt"><span style="font-size:26pt;font-family:Arial;font-weight:400;white-space:pre-wrap">Dies ist ein sehr umfangreicher Test</span></p><p style="margin-top:0pt;margin-bottom:0pt">Normaler Absatz</p><p><br></p><p>2 Absatz</p><p><br></p><p><br></p><p>3 Absatz</p><p><span style="font-weight:700">Fett</span></p><p><span style="font-style:italic">Kursiv</span></p><p><span style="text-decoration:underline">Unterstrichen</span></p></b>`;
  await editor.focus();
  await editor.evaluate((el, html) => {
    const data = new DataTransfer(); data.setData('text/html', html);
    el.dispatchEvent(new ClipboardEvent('paste', {clipboardData:data, bubbles:true, cancelable:true}));
  }, googleHtml);
  await page.waitForFunction(() => window.saved?.includes('26pt'));
  const canonicalHtml = () => editor.evaluate(el => window.clean(el.innerHTML));
  const before = await canonicalHtml();
  assert.match(before, /font-size:\s*26pt/);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.blog-rich-content')].map(el => {
    const title = el.querySelector('span');
    return { size: parseFloat(getComputedStyle(title).fontSize), height: el.getBoundingClientRect().height,
      empty: el.querySelectorAll('p').length };
  }));
  assert.ok(sizes[0].size > 34, JSON.stringify(sizes));
  assert.equal(sizes[0].size, sizes[1].size);
  assert.equal(sizes[0].empty, sizes[1].empty);
  const inlineStyles = await editor.evaluate(el => [...el.querySelectorAll('span')].map(span => ({
    text: span.textContent, weight: getComputedStyle(span).fontWeight,
    italic: getComputedStyle(span).fontStyle, decoration: getComputedStyle(span).textDecorationLine,
  })));
  assert.equal(inlineStyles.find(s => s.text === 'Fett').weight, '700');
  assert.equal(inlineStyles.find(s => s.text === 'Kursiv').italic, 'italic');
  assert.equal(inlineStyles.find(s => s.text === 'Unterstrichen').decoration, 'underline');
  if (process.env.MILODO_TEST_SCREENSHOT) await page.screenshot({path:process.env.MILODO_TEST_SCREENSHOT});
  await page.locator('#blur').click();
  await page.evaluate(() => window.restore());
  await page.waitForTimeout(100);
  assert.equal(await canonicalHtml(), before, 'Formatting survives save/reload');

  await editor.focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Shift+Enter');
  const trailingBreak = await canonicalHtml();
  await page.locator('#blur').click();
  await page.evaluate(() => window.restore());
  await page.waitForTimeout(100);
  assert.equal(await canonicalHtml(), trailingBreak, 'Trailing Shift+Enter survives reload before typing');
  await editor.focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('Nach Shift Enter');
  await page.waitForFunction(() => window.saved.includes('Nach Shift Enter'));
  assert.match(await editor.innerHTML(), /<br>/);
  const shifted = await canonicalHtml();
  await page.locator('#blur').click();
  await page.evaluate(() => window.restore());
  await page.waitForTimeout(100);
  assert.equal(await canonicalHtml(), shifted, 'Shift+Enter survives reload');
  await editor.focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Neuer Absatz');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Nach Leerabsatz');
  await page.waitForFunction(() => window.saved.includes('Nach Leerabsatz'));
  const entered = await canonicalHtml();
  assert.ok(await editor.evaluate(el => [...el.querySelectorAll('p')].some(p => !p.textContent.trim() && p.querySelector('br'))));
  await page.locator('#blur').click();
  await page.evaluate(() => window.restore());
  await page.waitForTimeout(100);
  assert.equal(await canonicalHtml(), entered, 'Empty paragraphs survive reload');
  await editor.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await editor.evaluate(el => {
    const data = new DataTransfer(); data.setData('text/plain', 'Erste Zeile\n\nDritte Zeile');
    el.dispatchEvent(new ClipboardEvent('paste', {clipboardData:data, bubbles:true, cancelable:true}));
  });
  await page.waitForFunction(() => window.saved.includes('Dritte Zeile'));
  assert.match(await canonicalHtml(), /Erste Zeile<\/p><p><br \/><\/p><p>Dritte Zeile/);
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' Rueckgaengig');
  await page.keyboard.press('Control+z');
  assert.ok(!(await editor.textContent()).includes('Rueckgaengig'), 'Native undo works');
  const safe = await page.evaluate(() => window.clean('<p onclick="alert(1)" style="font-size:26pt;background-image:url(javascript:alert(1))">Text<script>alert(1)</script><a href="javascript:alert(1)">Link</a></p>'));
  assert.ok(!/onclick|javascript|<script|background-image/.test(safe));
  assert.match(safe, /font-size:26pt/);
  await page.evaluate(() => {
    window.post = { id:42, status:'DRAFT', title:'Testbeitrag', category:'allgemein', slug:'testbeitrag', excerpt:'', contentBlocksJson:JSON.stringify([{id:'testblock',type:'p',text:''}]) };
    window.fetch = async (_url, options) => {
      if (options?.method === 'PATCH') Object.assign(window.post, JSON.parse(options.body));
      return new Response(JSON.stringify({ok:true,row:window.post}), {status:200});
    };
    window.fullEditor();
  });
  const fullEditor = page.locator('[contenteditable="true"]');
  await fullEditor.waitFor();
  await page.waitForFunction(() => document.querySelector('input')?.value === 'Testbeitrag');
  await fullEditor.focus();
  await fullEditor.evaluate((el, html) => {
    const data = new DataTransfer(); data.setData('text/html', html);
    el.dispatchEvent(new ClipboardEvent('paste', {clipboardData:data, bubbles:true, cancelable:true}));
  }, googleHtml);
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('Gespeicherter Umbruch');
  await page.getByRole('button', {name:'Speichern', exact:true}).click();
  await page.waitForFunction(() => window.post.contentBlocksJson.includes('Gespeicherter Umbruch'));
  const persisted = await page.evaluate(() => JSON.parse(window.post.contentBlocksJson)[0].html);
  assert.match(persisted, /font-size:\s*26pt/);
  assert.match(persisted, /<br \/>Gespeicherter Umbruch/);
  const previousEditor = await fullEditor.elementHandle();
  await page.evaluate(() => window.fullEditor());
  // root.render is asynchronous: do not mistake the old, still populated
  // editor for the reloaded one before React commits the replacement.
  await page.waitForFunction(element => !element.isConnected, previousEditor);
  await page.waitForFunction(() => document.querySelector('[contenteditable]')?.textContent.includes('Gespeicherter Umbruch'));
  assert.equal(await fullEditor.evaluate(el => window.clean(el.innerHTML)), persisted, 'Full blog editor save/load preserves HTML');
  const previewHtml = await page.locator('.blog-rich-content:not([contenteditable])').last().evaluate(el => window.clean(el.innerHTML));
  assert.equal(previewHtml, persisted, 'Live preview uses the same saved formatting');
  assert.deepEqual(errors, []);
  console.log('PASS: Google Docs title/spacing/formatting, Enter, Shift+Enter, empty paragraphs, undo, plain text, sanitization, full editor save/load and preview');
} finally { await browser.close(); }
