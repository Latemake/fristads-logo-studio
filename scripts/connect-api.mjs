import { writeFile } from "node:fs/promises";

const input = process.argv[2];
if (!input)
  throw new Error(
    "Usage: node scripts/connect-api.mjs https://your-service.onrender.com",
  );
const url = new URL(input);
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.port ||
  url.pathname !== "/" ||
  url.search ||
  url.hash
)
  throw new Error(
    "Provide the HTTPS service origin without a path, credentials or query parameters.",
  );
const origin = "https://latemake.github.io";
const response = await fetch(`${url.origin}/api/health`, {
  headers: { Origin: origin },
  signal: AbortSignal.timeout(90000),
});
if (
  !response.ok ||
  response.headers.get("access-control-allow-origin") !== origin
)
  throw new Error(
    "The API must be healthy and allow requests from the GitHub Pages site.",
  );
const health = await response.json();
if (health.app !== "fristads-logo-studio" || health.status !== "ok")
  throw new Error("This URL does not serve the Logo Studio API.");
await writeFile(
  new URL("../data/deployment.json", import.meta.url),
  JSON.stringify({ apiUrl: url.origin }, null, 2) + "\n",
);
console.log(
  "API verified and configured. Run npm run stage:pages, verify the site, then publish docs.",
);
