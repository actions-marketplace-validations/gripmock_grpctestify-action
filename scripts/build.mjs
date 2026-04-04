import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");

await fs.mkdir(distDir, { recursive: true });

const sourcePath = path.join(srcDir, "main.js");
const distPath = path.join(distDir, "main.js");
const source = await fs.readFile(sourcePath, "utf8");
const rendered = `// This file is generated from src/main.js. Do not edit directly.\n${source}`;

await fs.writeFile(distPath, rendered, "utf8");
