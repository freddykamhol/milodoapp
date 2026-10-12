import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = process.cwd();
const input = path.join(root, "src", "app", "globals.css");
const output = path.join(root, "public", "styles.css");
const source = await fs.readFile(input, "utf8");
const result = await postcss([tailwind()]).process(source, { from: input });
await fs.writeFile(output, result.css, "utf8");
console.log(`Generated ${path.relative(root, output)}`);
