import { printedLogo } from "./printed.js";
import { STATIC_SITE, BASE_URL } from "./runtime.js";
export const MAX_LOGOS = 20;
export const MAX_TOTAL_LOGOS = 200;
export const imageSrc = (src) => {
  if (src?.startsWith("https:"))
    return STATIC_SITE ? src : "/api/image?url=" + encodeURIComponent(src);
  return src?.startsWith("/") ? BASE_URL + src.slice(1) : src;
};
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const freshDesign = () => ({
  version: 1,
  title: "Oma työvaatemallisto",
  productId: "100239-940",
  view: 0,
  placements: {},
  products: [],
});
export const allLogos = (design) => Object.values(design.placements).flat();
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (STATIC_SITE && src.startsWith("https:"))
      image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error("Kuvaa ei voitu avata. Tarkista tiedosto tai verkkoyhteys."),
      );
    image.src = src;
  });
}
export function canvasOf(width, height = width) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
export function trimCanvas(canvas) {
  const { width, height } = canvas,
    pixels = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  if (right < left)
    throw new Error(
      "Kuva on kokonaan läpinäkyvä. Valitse näkyvän logon sisältävä tiedosto.",
    );
  const cropped = canvasOf(right - left + 1, bottom - top + 1);
  cropped
    .getContext("2d")
    .drawImage(
      canvas,
      left,
      top,
      cropped.width,
      cropped.height,
      0,
      0,
      cropped.width,
      cropped.height,
    );
  if (
    cropped.width / cropped.height > 100 ||
    cropped.height / cropped.width > 100
  )
    throw new Error("Logo on liian kapea. Tarkista kuvan rajaus.");
  return {
    src: cropped.toDataURL("image/png"),
    ratio: cropped.width / cropped.height,
  };
}
export async function rasterize(file) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Logon enimmäiskoko on 10 Mt.");
  if (
    !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(
      file.type,
    )
  )
    throw new Error("Valitse PNG-, JPG-, WebP- tai SVG-kuva.");
  if (file.type === "image/svg+xml") {
    const svg = new DOMParser().parseFromString(
      await file.text(),
      "image/svg+xml",
    );
    if (
      svg.querySelector("parsererror, script, foreignObject") ||
      [...svg.querySelectorAll("*")].some((el) =>
        [...el.attributes].some(
          (a) =>
            /^on/i.test(a.name) ||
            (/href$/i.test(a.name) && !a.value.startsWith("#")) ||
            [...a.value.matchAll(/url\((.*?)\)/gi)].some(
              (match) =>
                !match[1]
                  .trim()
                  .replace(/^["']|["']$/g, "")
                  .startsWith("#"),
            ),
        ),
      ) ||
      [...svg.querySelectorAll("style")].some((el) =>
        /@import|url\(\s*["']?\s*(?:https?:|\/\/|data:)/i.test(el.textContent),
      )
    )
      throw new Error(
        "SVG sisältää ulkoista tai aktiivista sisältöä. Vie logo PNG-kuvana.",
      );
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (image.width * image.height > 40_000_000)
      throw new Error(
        "Kuvan tarkkuus on liian suuri. Käytä enintään 40 megapikselin kuvaa.",
      );
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = canvasOf(
      Math.max(1, Math.round(image.width * scale)),
      Math.max(1, Math.round(image.height * scale)),
    );
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return trimCanvas(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}
// Only remove nearly white pixels connected to an edge; enclosed white details survive.
export function removeWhitePixels(data, width, height, tolerance = 24) {
  const queue = new Int32Array(width * height),
    seen = new Uint8Array(width * height);
  let head = 0,
    tail = 0;
  const add = (index) => {
    if (seen[index]) return;
    seen[index] = 1;
    const offset = index * 4,
      r = data[offset],
      g = data[offset + 1],
      b = data[offset + 2];
    if (
      data[offset + 3] < 8 ||
      (Math.min(r, g, b) >= 255 - tolerance &&
        Math.max(r, g, b) - Math.min(r, g, b) <= 12)
    )
      queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    add(y * width);
    add(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    data[index * 4 + 3] = 0;
    if (index % width) add(index - 1);
    if (index % width < width - 1) add(index + 1);
    if (index >= width) add(index - width);
    if (index < width * (height - 1)) add(index + width);
  }
  return tail;
}
export async function removeWhiteBackground(src) {
  const image = await loadImage(src),
    canvas = canvasOf(image.width, image.height),
    ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
    changed = removeWhitePixels(pixels.data, canvas.width, canvas.height);
  if (!changed)
    throw new Error(
      "Kuvan reunoilta ei löytynyt poistettavaa valkoista taustaa.",
    );
  ctx.putImageData(pixels, 0, 0);
  return trimCanvas(canvas);
}
export function logoBounds(logo) {
  const radians = (logo.rotation * Math.PI) / 180,
    c = Math.abs(Math.cos(radians)),
    s = Math.abs(Math.sin(radians));
  return {
    x: (logo.w * c + (logo.w / logo.ratio) * s) / 2,
    y: (logo.w * s + (logo.w / logo.ratio) * c) / 2,
  };
}
export function constrainLogo(logo) {
  const result = {
      ...logo,
      w: clamp(logo.w, 24, Math.min(500, 600 * logo.ratio)),
    },
    half = logoBounds(result);
  result.x = clamp(
    result.x,
    Math.min(half.x + 8, 400),
    Math.max(792 - half.x, 400),
  );
  result.y = clamp(
    result.y,
    Math.min(half.y + 8, 400),
    Math.max(792 - half.y, 400),
  );
  return result;
}
export function localPoint(logo, x, y) {
  const a = (-logo.rotation * Math.PI) / 180,
    dx = x - logo.x,
    dy = y - logo.y;
  return {
    x: dx * Math.cos(a) - dy * Math.sin(a),
    y: dx * Math.sin(a) + dy * Math.cos(a),
  };
}
export function hitLogo(logo, x, y) {
  const p = localPoint(logo, x, y);
  return (
    Math.abs(p.x) <= logo.w / 2 + 10 &&
    Math.abs(p.y) <= logo.w / logo.ratio / 2 + 10
  );
}
export function hitHandle(logo, x, y, tolerance = 15) {
  const p = localPoint(logo, x, y);
  return (
    Math.abs(Math.abs(p.x) - (logo.w / 2 + 6)) < tolerance &&
    Math.abs(Math.abs(p.y) - (logo.w / logo.ratio / 2 + 6)) < tolerance
  );
}
const backgrounds = new WeakMap();
export function garmentBackground(image) {
  if (!image) return "#f2f2ee";
  if (backgrounds.has(image)) return backgrounds.get(image);
  const canvas = canvasOf(image.width, image.height),
    ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const corners = [
    [0, 0],
    [image.width - 1, 0],
    [0, image.height - 1],
    [image.width - 1, image.height - 1],
  ].map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]);
  const [r, g, b, a] = corners[0];
  const color =
    a === 255 &&
    Math.min(r, g, b) > 210 &&
    Math.max(r, g, b) - Math.min(r, g, b) < 20 &&
    corners.every((pixel) =>
      pixel.every((v, i) => Math.abs(v - corners[0][i]) < 16),
    )
      ? `rgb(${r},${g},${b})`
      : "#fff";
  backgrounds.set(image, color);
  return color;
}
export function drawScene(
  ctx,
  garment,
  logos,
  images,
  selected,
  guides = false,
) {
  ctx.clearRect(0, 0, 800, 800);
  ctx.fillStyle = garmentBackground(garment);
  ctx.fillRect(0, 0, 800, 800);
  if (garment) {
    const scale = Math.min(680 / garment.width, 700 / garment.height),
      w = garment.width * scale,
      h = garment.height * scale;
    ctx.drawImage(garment, (800 - w) / 2, (800 - h) / 2, w, h);
  }
  for (const logo of logos) {
    const image = images[logo.src];
    if (!image) continue;
    const height = logo.w / logo.ratio;
    ctx.save();
    ctx.translate(logo.x, logo.y);
    ctx.rotate((logo.rotation * Math.PI) / 180);
    ctx.globalAlpha = logo.opacity;
    const ink =
      logo.printed !== false && garment
        ? printedLogo(
            image,
            garment,
            logo,
            Math.min(3, Math.hypot(ctx.getTransform().a, ctx.getTransform().b)),
          )
        : image;
    const padding = ink.scenePadding || 0;
    ctx.drawImage(
      ink,
      -logo.w / 2 - padding,
      -height / 2 - padding,
      logo.w + padding * 2,
      height + padding * 2,
    );
    ctx.globalAlpha = 1;
    if (guides && selected === logo.id) {
      ctx.strokeStyle = "#315f50";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(
        -logo.w / 2 - 6,
        -height / 2 - 6,
        logo.w + 12,
        height + 12,
      );
      ctx.setLineDash([]);
      ctx.fillStyle = "#fff";
      for (const x of [-logo.w / 2 - 6, logo.w / 2 + 6])
        for (const y of [-height / 2 - 6, height / 2 + 6]) {
          ctx.fillRect(x - 5, y - 5, 10, 10);
          ctx.strokeRect(x - 5, y - 5, 10, 10);
        }
    }
    ctx.restore();
  }
}
export async function renderScene(product, view, logos, resolution = 1600) {
  const [garment, ...logosLoaded] = await Promise.all([
    loadImage(imageSrc(product.images[view])),
    ...logos.map((l) => loadImage(l.src)),
  ]);
  const canvas = canvasOf(resolution),
    ctx = canvas.getContext("2d");
  ctx.scale(resolution / 800, resolution / 800);
  drawScene(
    ctx,
    garment,
    logos,
    Object.fromEntries(logos.map((l, i) => [l.src, logosLoaded[i]])),
  );
  return canvas;
}
export function download(blob, name) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
}
export const filename = (title) =>
  (title || "fristads-suunnitelma")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "fristads-suunnitelma";
const db = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("fristads-studio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("designs");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export async function persist(value) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("designs", "readwrite");
    tx.objectStore("designs").put(value, "current");
    tx.oncomplete = () => {
      database.close();
      resolve();
    };
    tx.onerror = tx.onabort = () => {
      database.close();
      reject(tx.error);
    };
  });
}
export async function restore() {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction("designs")
      .objectStore("designs")
      .get("current");
    request.onsuccess = () => {
      database.close();
      resolve(request.result);
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}
function validProductImage(src) {
  if (typeof src !== "string") return false;
  if (/^\/garments\/\d{6}-\d{3}-\d+\.jpg$/.test(src)) return true;
  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      /^mediacdn\d+\.fristadskansas\.com$/.test(url.hostname) &&
      !url.port &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function validateProducts(products) {
  if (!Array.isArray(products) || products.length > 200)
    throw new Error("Virheelliset tuotetiedot.");
  return products.map((p) => {
    const url = new URL(p.url);
    if (
      !/^\d{6}-\d{3}$/.test(p.id) ||
      typeof p.name !== "string" ||
      p.name.length > 200 ||
      !Array.isArray(p.images) ||
      !p.images.length ||
      p.images.length > 20 ||
      !p.images.every(validProductImage) ||
      url.protocol !== "https:" ||
      !["www.fristads.com", "fristads.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error("Suunnitelmassa on virheelliset tuotetiedot.");
    return {
      id: p.id,
      name: p.name,
      color: typeof p.color === "string" ? p.color.slice(0, 100) : "",
      category:
        typeof p.category === "string" ? p.category.slice(0, 100) : "Muut",
      url: url.href,
      images: [...p.images],
      ...(Array.isArray(p.variants)
        ? {
            variants: p.variants.slice(0, 50).map((v) => {
              const link = new URL(v.url);
              if (
                !/^\d{6}-\d{3}$/.test(v.id) ||
                !v.id.startsWith(p.id.slice(0, 6)) ||
                typeof v.name !== "string" ||
                link.protocol !== "https:" ||
                !["www.fristads.com", "fristads.com"].includes(link.hostname) ||
                link.port ||
                link.username ||
                link.password ||
                !Array.isArray(v.colors) ||
                !v.colors.length ||
                v.colors.length > 2 ||
                !v.colors.every((c) => /^#[0-9a-f]{6}$/i.test(c))
              )
                throw Error("Virheellinen tuotteen värivaihtoehto.");
              return {
                id: v.id,
                name: v.name.slice(0, 100),
                url: link.href,
                colors: v.colors,
              };
            }),
          }
        : {}),
      ...(Array.isArray(p.sourceImages) &&
      p.sourceImages.every(validProductImage)
        ? { sourceImages: [...p.sourceImages] }
        : {}),
    };
  });
}
export function validateDesign(design) {
  if (
    design?.version !== 1 ||
    !/^\d{6}-\d{3}$/.test(design.productId) ||
    !Number.isInteger(design.view) ||
    design.view < 0 ||
    design.view > 19 ||
    typeof design.placements !== "object" ||
    !design.placements ||
    Array.isArray(design.placements)
  )
    throw new Error("Tiedosto ei ole Logo Studion suunnitelma.");
  let count = 0;
  const placements = {};
  for (const [key, logos] of Object.entries(design.placements)) {
    if (
      !/^\d{6}-\d{3}:\d{1,2}$/.test(key) ||
      !Array.isArray(logos) ||
      logos.length > MAX_LOGOS
    )
      throw new Error("Virheellinen suunnitelman kuvakulma.");
    const ids = new Set();
    placements[key] = logos.map((l) => {
      if (
        !l ||
        ++count > MAX_TOTAL_LOGOS ||
        typeof l.id !== "string" ||
        l.id.length > 100 ||
        ids.has(l.id) ||
        typeof l.name !== "string" ||
        l.name.length > 250 ||
        typeof l.src !== "string" ||
        l.src.length > 15_000_000 ||
        !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(l.src) ||
        !["x", "y", "w", "ratio", "rotation", "opacity"].every((k) =>
          Number.isFinite(l[k]),
        ) ||
        l.w < 1 ||
        l.w > 600 ||
        l.ratio < 0.001 ||
        l.ratio > 1000 ||
        l.opacity < 0 ||
        l.opacity > 1 ||
        (l.printed !== undefined && typeof l.printed !== "boolean") ||
        l.x < 0 ||
        l.x > 800 ||
        l.y < 0 ||
        l.y > 800 ||
        Math.abs(l.rotation) > 180
      )
        throw new Error("Suunnitelmassa on virheellisiä logotietoja.");
      ids.add(l.id);
      return {
        id: l.id,
        name: l.name,
        src: l.src,
        x: l.x,
        y: l.y,
        w: l.w,
        ratio: l.ratio,
        rotation: l.rotation,
        opacity: l.opacity,
        ...(l.printed !== undefined ? { printed: l.printed } : {}),
      };
    });
  }
  return {
    version: 1,
    productId: design.productId,
    view: design.view,
    placements,
    ...(design.title !== undefined
      ? { title: String(design.title).slice(0, 80) }
      : {}),
    ...(design.products !== undefined
      ? { products: validateProducts(design.products) }
      : {}),
  };
}
