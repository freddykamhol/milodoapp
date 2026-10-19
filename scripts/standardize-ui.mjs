import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const write = process.argv.includes("--write");
const byteMap = new Map();
const decoder = new TextDecoder("windows-1252");
for (let i = 0; i < 256; i++) { byteMap.set(String.fromCharCode(i), i); byteMap.set(decoder.decode(Uint8Array.of(i)), i); }
// Node builds without full ICU may decode this label as Latin-1.
const cp1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";
[...cp1252].forEach((char,index)=>byteMap.set(char,0x80+index));
const utf8 = new TextDecoder("utf-8", { fatal: true });
function repair(text) {
  for (let round = 0; round < 4; round++) {
    let result = "", changes = 0;
    for (let i = 0; i < text.length; i++) {
      const first = byteMap.get(text[i]);
      const size = first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 0;
      if (size) {
        const chars = text.slice(i, i + size), bytes = [...chars].map(char => byteMap.get(char));
        if (bytes.length === size && bytes.slice(1).every(byte => byte >= 0x80 && byte <= 0xbf)) {
          try { const decoded = utf8.decode(Uint8Array.from(bytes)); if (decoded !== chars) { result += decoded; i += size - 1; changes++; continue; } } catch {}
        }
      }
      result += text[i];
    }
    text = result; if (!changes) break;
  }
  return text;
}
function walk(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]); }
const report = { files: 0, repaired: [], selects: [], feedback: [], warnings: [] };
for (const file of walk("src").filter(file => /\.(tsx?|css)$/.test(file))) {
  const original = fs.readFileSync(file, "utf8");
  let text = file.endsWith("display-text.ts") ? original : original.split("\n").map(line => line.startsWith("const displayText=") ? line : repair(line)).join("\n");
  if (file.endsWith(".tsx")) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const edits = [];
    function visit(node) {
      if (ts.isJsxText(node) || (ts.isStringLiteral(node) && ts.isJsxAttribute(node.parent))) {
        const raw = node.getText(source), fixed = raw.replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
        if (fixed !== raw) edits.push({ start: node.getStart(source), end: node.end, fixed });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.fixed + text.slice(edit.end);
  }
  if (text !== original) report.repaired.push(file);
  if (file.endsWith(".tsx") && !file.endsWith("select.tsx") && /<select\b/.test(text)) {
    text = text.replace(/<select\b/g, "<AppSelect").replace(/<\/select\s*>/g, "</AppSelect>");
    text = addImport(text, 'import { AppSelect } from "@/app/_components/select";');
    report.selects.push(file);
  }
  if (file.endsWith(".tsx") && !file.endsWith("feedback.tsx")) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const edits = [], imports = new Set(), functions = new Set();
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const name = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === "window" ? node.expression.name.text : "";
        if (["alert", "confirm", "prompt"].includes(name)) {
          const replacement = name === "alert" ? "notify" : name === "confirm" ? "confirmAction" : "requestText"; imports.add(replacement);
          if (name === "alert") edits.push({ start: node.expression.getStart(source), end: node.expression.end, text: replacement });
          else {
            edits.push({ start: node.getStart(source), end: node.end, text: `(await ${replacement}(${node.arguments.map(arg => arg.getText(source)).join(", ")}))` });
            let parent = node.parent; while (parent && !ts.isFunctionLike(parent)) parent = parent.parent;
            if (parent && !parent.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) functions.add(parent);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    for (const fn of functions) {
      if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) edits.push({ start: fn.getStart(source), end: fn.getStart(source), text: "async " });
      else if (ts.isFunctionDeclaration(fn)) { const keyword = fn.getChildren(source).find(child => child.kind === ts.SyntaxKind.FunctionKeyword); edits.push({ start: keyword.getStart(source), end: keyword.getStart(source), text: "async " }); }
      else report.warnings.push(`${file}: manual async review needed`);
    }
    for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    if (imports.size) { text = addImport(text, `import { ${[...imports].join(", ")} } from "@/app/_components/feedback";`); report.feedback.push(file); }
  }
  report.files++;
  if (write && original !== text) fs.writeFileSync(file, text.replace(/^\uFEFF/, ""), "utf8");
}
function addImport(text, statement) {
  if (text.includes(statement)) return text;
  const directive = text.match(/^\uFEFF?\s*["']use client["'];?\s*/);
  return directive ? text.slice(0, directive[0].length) + statement + "\n" + text.slice(directive[0].length) : statement + "\n" + text;
}
console.log(JSON.stringify(report, null, 2));
