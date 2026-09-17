import { mkdir, writeFile, readFile, rename } from "node:fs/promises";
import { fetchLimited, parseProduct } from "../server/catalog.js";
const slugs = [
  "acode-t-paita-1911-bsj-musta-100239-940",
  "acode-t-paita-1911-bsj-tummanharmaa-100239-941",
  "green-heavy-pikeepaita-7047-gpm-tummansininenharmaa-300509-586",
  "stretch-softshell-takki-4905-ssf-musta-120962-940",
  "high-vis-t-paita-lk-3-7724-thv-neonkeltainenmusta-114100-196",
  "green-heavy-pitkaehihainen-t-paita-7071-gtm-mustaneonkeltainen-301171-982",
  "flex-rakentajan-stretch-housut-2800-gstt-musta-300586-940",
  "rakentajan-stretch-housut-naisten-2901-gwm-navysininen-301223-544",
  "rakentajan-stretch-housut-2760-glws-valkoinenmusta-300036-969",
  "high-vis-green-rakentajan-stretch-housut-lk-1-2906-gwm-high-vis-keltainenmusta-301441-196",
  "airtech-talvihousut-2698-gtt-musta-300858-940",
  "primaloft-stretch-talvitakki-4873-glps-musta-300912-940",
  "stretch-kuoritakki-naisten-4981-gls-musta-301275-940",
  "high-vis-green-stretch-kuoritakki-lk-3-4680-glps-neonoranssi-300331-230",
  "polartec-stretch-fleecetakki-4870-gpy-musta-300490-940",
  "acode-softshell-liivi-1506-sbt-musta-113531-940",
  "high-vis-green-liivi-lk-2-5067-gplu-neonkeltainen-134242-130",
  "flex-rakentajan-stretch-shortsit-2803-ghst-musta-301460-940",
  "rakentajan-stretch-shortsit-2762-lws-valkoinenmusta-300109-969",
  "hupullinen-collegetakki-7831-gki-navysininen-300498-544",
  "high-vis-green-hupullinen-stretch-collegetakki-lk-1-7532-gkc-neonkeltainenmusta-301032-196",
  "collegepaita-close-the-loop-7850-cls-vaaleanharmaa-300599-910",
  "green-umpihaalari-8930-gwm-navysininen-301028-544",
  "high-vis-umpihaalari-lk-3-8026-gplu-high-vis-keltainentummansininen-124376-171",
];
await mkdir("public/garments", { recursive: true });
await mkdir("data", { recursive: true });
let previous = [];
try {
  previous = JSON.parse(await readFile("data/products.json", "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const products = [];
const failures = [];
for (const slug of slugs) {
  const url = "https://www.fristads.com/fi-fi/tuotteet/" + slug;
  try {
    const { buffer } = await fetchLimited(url);
    const p = parseProduct(buffer.toString("utf8"), url);
    // These Flex products put a promotional badge on the first photograph.
    // Lead with the manufacturer's clean front view with pockets instead.
    if (['300586-940','301460-940'].includes(p.id) && p.images.length > 1) [p.images[0],p.images[1]] = [p.images[1],p.images[0]];
    p.sourceImages = [...p.images];
    p.images = await Promise.all(
      p.images.map(async (image, i) => {
        const { buffer } = await fetchLimited(image, 15_000_000);
        const file = `/garments/${p.id}-${i}.jpg`;
        await writeFile("public" + file, buffer);
        return file;
      }),
    );
    products.push(p);
    console.log(p.name, p.images.length);
  } catch (e) {
    console.error(slug, e.message);
    const id = slug.match(/(\d{6}-\d{3})$/)[1];
    const existing = previous.find((p) => p.id === id);
    if (existing) products.push(existing);
    else failures.push(slug);
  }
}
if (failures.length)
  throw new Error(
    "Valikoimaa ei vaihdettu: tuotteita jäi puuttumaan: " + failures.join(", "),
  );
await writeFile("data/products.json.tmp", JSON.stringify(products, null, 2));
await rename("data/products.json.tmp", "data/products.json");
const brand = await fetchLimited(
  "https://mediacdn5.fristadskansas.com/Cache/84000/b2eee1251fc948a5f4ea5cf11b5b95dc.png",
);
await writeFile("public/fristads.png", brand.buffer);
