// Photo-based lighting, not a 3D surface model. Keep the ink opaque so white
// logos remain visible on dark garments. Only the garment supplies texture.
const surfaces = new WeakMap();
const previews = new WeakMap();
const limit = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function canvas(w, h = w) {
  const result = document.createElement("canvas");
  result.width = w;
  result.height = h;
  return result;
}
function surface(garment) {
  if (surfaces.has(garment)) return surfaces.get(garment);
  const photo = canvas(800),
    ctx = photo.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 800, 800);
  const scale = Math.min(680 / garment.width, 700 / garment.height);
  const w = garment.width * scale,
    h = garment.height * scale;
  ctx.drawImage(garment, (800 - w) / 2, (800 - h) / 2, w, h);
  const soft = canvas(800),
    blur = soft.getContext("2d");
  blur.filter = "blur(10px)";
  blur.drawImage(photo, 0, 0);
  const luminance = (context) => {
    const pixels = context.getImageData(0, 0, 800, 800).data;
    const values = new Float32Array(800 * 800);
    for (let i = 0; i < values.length; i++)
      values[i] =
        0.2126 * pixels[i * 4] +
        0.7152 * pixels[i * 4 + 1] +
        0.0722 * pixels[i * 4 + 2];
    return values;
  };
  const result = { detail: luminance(ctx), soft: luminance(blur) };
  surfaces.set(garment, result);
  return result;
}
export function printedLogo(image, garment, logo, density) {
  const key = [logo.x, logo.y, logo.w, logo.ratio, logo.rotation, density].join(
    ":",
  );
  const cached = previews.get(image);
  if (cached?.garment === garment && cached.key === key) return cached.canvas;
  const height = logo.w / logo.ratio;
  const padding = 4;
  const spanX = logo.w + padding * 2,
    spanY = height + padding * 2;
  const output = canvas(
    Math.max(1, Math.ceil(spanX * density)),
    Math.max(1, Math.ceil(spanY * density)),
  );
  output.scenePadding = padding;
  const ctx = output.getContext("2d");
  ctx.drawImage(
    image,
    (padding / spanX) * output.width,
    (padding / spanY) * output.height,
    (logo.w / spanX) * output.width,
    (height / spanY) * output.height,
  );
  const pixels = ctx.getImageData(0, 0, output.width, output.height);
  const original = new Uint8ClampedArray(pixels.data);
  const light = surface(garment);
  const angle = (logo.rotation * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const at = (x, y) => {
    const dx = ((x + 0.5) / output.width) * spanX - spanX / 2;
    const dy = ((y + 0.5) / output.height) * spanY - spanY / 2;
    return (
      limit(Math.round(logo.y + dx * s + dy * c), 0, 799) * 800 +
      limit(Math.round(logo.x + dx * c - dy * s), 0, 799)
    );
  };
  let total = 0,
    weight = 0;
  // Normalize against the local fabric, independently of its base color.
  for (let y = 0; y < output.height; y += 4)
    for (let x = 0; x < output.width; x += 4) {
      const alpha = pixels.data[(y * output.width + x) * 4 + 3] / 255;
      total += light.soft[at(x, y)] * alpha;
      weight += alpha;
    }
  const mean = total / (weight || 1);
  // Resample premultiplied color so the displaced transparent edges stay clean.
  const sample = (x, y, offset) => {
    const left = Math.floor(x),
      top = Math.floor(y),
      fx = x - left,
      fy = y - top;
    let alpha = 0,
      r = 0,
      g = 0,
      b = 0;
    for (let yy = 0; yy < 2; yy++)
      for (let xx = 0; xx < 2; xx++) {
        const sx = left + xx,
          sy = top + yy;
        if (sx < 0 || sy < 0 || sx >= output.width || sy >= output.height)
          continue;
        const index = (sy * output.width + sx) * 4;
        const a = original[index + 3] * (xx ? fx : 1 - fx) * (yy ? fy : 1 - fy);
        alpha += a;
        r += original[index] * a;
        g += original[index + 1] * a;
        b += original[index + 2] * a;
      }
    pixels.data[offset] = alpha ? r / alpha : 0;
    pixels.data[offset + 1] = alpha ? g / alpha : 0;
    pixels.data[offset + 2] = alpha ? b / alpha : 0;
    pixels.data[offset + 3] = alpha;
  };
  for (let y = 0; y < output.height; y++)
    for (let x = 0; x < output.width; x++) {
      const i = (y * output.width + x) * 4;
      const j = at(x, y),
        smooth = light.soft[j];
      const gx =
        (light.soft[at(x + 6 * density, y)] -
          light.soft[at(x - 6 * density, y)]) /
        (smooth + 20);
      const gy =
        (light.soft[at(x, y + 6 * density)] -
          light.soft[at(x, y - 6 * density)]) /
        (smooth + 20);
      // Small image-derived displacement follows folds without inventing a
      // repeating wave or changing the logo's placement/selection geometry.
      const dx = limit(gx * 5, -3, 3);
      const dy = limit(gy * 5 + (smooth - mean) / (mean + 20), -3, 3);
      sample(
        x + (dx * output.width) / spanX,
        y + (dy * output.height) / spanY,
        i,
      );
      if (!pixels.data[i + 3]) continue;
      const texture = (light.detail[j] - smooth) / (smooth + 18);
      const shade = limit(
        0.92 + (0.85 * (smooth - mean)) / (mean + 22) + texture * 0.65,
        0.38,
        1.15,
      );
      const sheen = Math.max(0, shade - 0.85) * 32;
      for (let channel = 0; channel < 3; channel++)
        pixels.data[i + channel] = limit(
          pixels.data[i + channel] * shade + sheen,
          0,
          255,
        );
    }
  ctx.putImageData(pixels, 0, 0);
  previews.set(image, { garment, key, canvas: output });
  return output;
}
