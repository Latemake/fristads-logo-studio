import * as cheerio from "cheerio";
import { classifyGarment } from "../src/garments.js";
export function validateProductUrl(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new Error("Anna Fristadsin yksittäisen tuotteen linkki.");
  }
  if (
    u.protocol !== "https:" ||
    !["fristads.com", "www.fristads.com"].includes(u.hostname) ||
    u.port ||
    u.username ||
    u.password ||
    !/\/[^/]+\/[^/]+\/[^/]+-\d{6}-\d{3}\/?$/.test(u.pathname)
  )
    throw new Error("Anna Fristadsin yksittäisen tuotteen linkki.");
  u.hostname = "www.fristads.com";
  u.hash = "";
  u.search = "";
  return u.href;
}
export function allowedImage(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      /^mediacdn\d+\.fristadskansas\.com$/.test(u.hostname) &&
      !u.port &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
export async function fetchLimited(url, max = 6_000_000) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    redirect: "error",
    headers: { "User-Agent": "FristadsLogoStudio/1.0" },
  });
  if (!r.ok)
    throw new Error(
      "Tuotetietojen hakeminen epäonnistui. Tarkista linkki ja yritä uudelleen.",
    );
  const chunks = [];
  let size = 0;
  for await (const chunk of r.body) {
    size += chunk.length;
    if (size > max) throw new Error("Tiedosto on liian suuri.");
    chunks.push(chunk);
  }
  return {
    buffer: Buffer.concat(chunks),
    type: r.headers.get("content-type") || "",
  };
}
export function parseProduct(html, url) {
  const $ = cheerio.load(html);
  const title =
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.split("|")[0].trim();
  const primary = $('meta[property="og:image"]').attr("content");
  if (!title || !allowedImage(primary))
    throw new Error("Tuotesivulta ei löytynyt vaatteen kuvaa.");
  const images = [];
  $(".slide--product img").each((_, el) => {
    const highRes = $(el).attr("srcset")?.split(",")[0]?.trim().split(/\s+/)[0];
    const src = allowedImage(highRes) ? highRes : $(el).attr("src");
    if (allowedImage(src) && !images.includes(src)) images.push(src);
  });
  if (!images.length) images.push(primary);
  if (images.length === 1 && images[0] === primary)
    $("img").each((_, el) => {
      const alt = $(el).attr("alt") || "";
      const src = $(el).attr("src");
      if (
        alt.startsWith(title) &&
        !/Small/i.test(alt) &&
        allowedImage(src) &&
        !images.includes(src)
      )
        images.push(src);
    });
  const sku = new URL(url).pathname.match(/(\d{6}-\d{3})\/?$/)[1];
  const color =
    $(".product-details__color")
      .first()
      .text()
      .replace(/^.*?:\s*/, "")
      .replace(/\s*-\s*\d{3}\s*$/, "")
      .trim() ||
    $('meta[property="og:title"]').attr("content")?.split("|")[1]?.trim() ||
    "";
  const variants = [];
  $("a[title][href]").each((_, el) => {
    try {
      const variantUrl = validateProductUrl(
        new URL($(el).attr("href"), url).href,
      );
      const id = new URL(variantUrl).pathname.match(/(\d{6}-\d{3})\/?$/)[1];
      if (!id.startsWith(sku.slice(0, 6)) || variants.some((v) => v.id === id))
        return;
      variants.push({
        id,
        name: $(el).attr("title"),
        url: variantUrl,
        colors: ($(el).attr("style") || "")
          .match(/#[0-9a-f]{6}/gi)
          ?.slice(0, 2) || ["#999999"],
      });
    } catch {
      /* Other navigation links are not product variants. */
    }
  });
  const category = classifyGarment(title);
  return {
    id: sku,
    name: title,
    color,
    category,
    url,
    images: images.slice(0, 8),
    variants,
    importedAt: new Date().toISOString(),
  };
}
