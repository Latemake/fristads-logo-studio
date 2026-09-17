import { cp, mkdir, writeFile } from "node:fs/promises";
await mkdir("docs", { recursive: true });
await cp("dist-pages", "docs", { recursive: true });
await writeFile("docs/.nojekyll", "");
console.log("Pages files ready in docs/. Commit and push to publish.");
