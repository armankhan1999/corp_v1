// One-off brand probe: pull bhushancorp.in stylesheets + logo, report palette.
import zlib from "node:zlib";

const SITE = "https://www.bhushancorp.in/";
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36" };

async function get(url, asBuffer = false) {
  const r = await fetch(url, { headers: UA, redirect: "follow" });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return asBuffer ? Buffer.from(await r.arrayBuffer()) : await r.text();
}

function normaliseHex(h) {
  let v = h.replace("#", "").toLowerCase();
  if (v.length === 3) v = v.split("").map((c) => c + c).join("");
  return "#" + v;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

const hexOf = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

// ---- minimal PNG decoder (truecolour / truecolour+alpha / palette, 8-bit) ----
function decodePng(buf) {
  let p = 8;
  let w = 0, h = 0, bitDepth = 0, colourType = 0;
  const idat = [];
  let plte = null, trns = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colourType = data[9];
    } else if (type === "PLTE") plte = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("unsupported bit depth " + bitDepth);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colourType];
  if (!channels) throw new Error("unsupported colour type " + colourType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  const px = [];
  for (let i = 0; i < w * h; i++) {
    const o = i * bpp;
    let r, g, b, alpha = 255;
    if (colourType === 3) {
      const idx = out[o];
      r = plte[idx * 3]; g = plte[idx * 3 + 1]; b = plte[idx * 3 + 2];
      if (trns && idx < trns.length) alpha = trns[idx];
    } else if (colourType === 0) { r = g = b = out[o]; }
    else if (colourType === 4) { r = g = b = out[o]; alpha = out[o + 1]; }
    else if (colourType === 2) { r = out[o]; g = out[o + 1]; b = out[o + 2]; }
    else { r = out[o]; g = out[o + 1]; b = out[o + 2]; alpha = out[o + 3]; }
    px.push([r, g, b, alpha]);
  }
  return { w, h, px };
}

const report = { stylesheetHexes: [], inlineHexes: [], logoPalette: [], errors: [] };

try {
  const html = await get(SITE);
  const links = [...html.matchAll(/<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi)].map((m) => m[1]);
  const abs = links.map((h) => (h.startsWith("http") ? h : new URL(h, SITE).href));
  report.stylesheets = abs;

  const inline = [...html.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
  const inlineCount = new Map();
  for (const raw of inline) {
    if (raw.length !== 4 && raw.length !== 7) continue;
    const k = normaliseHex(raw);
    inlineCount.set(k, (inlineCount.get(k) ?? 0) + 1);
  }
  report.inlineHexes = [...inlineCount].sort((a, b) => b[1] - a[1]).slice(0, 25);

  const cssCount = new Map();
  for (const url of abs.slice(0, 14)) {
    try {
      const css = await get(url);
      for (const raw of css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
        if (raw.length !== 4 && raw.length !== 7) continue;
        const k = normaliseHex(raw);
        cssCount.set(k, (cssCount.get(k) ?? 0) + 1);
      }
    } catch (e) { report.errors.push(`css ${url}: ${e.message}`); }
  }
  const saturated = [...cssCount]
    .map(([hex, n]) => {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return { hex, n, hsl: rgbToHsl(r, g, b) };
    })
    .filter((c) => c.hsl[1] > 25 && c.hsl[2] > 8 && c.hsl[2] < 92)
    .sort((a, b) => b.n - a.n);
  report.stylesheetHexes = saturated.slice(0, 30);
  report.blueish = saturated.filter((c) => c.hsl[0] >= 185 && c.hsl[0] <= 250).slice(0, 15);
} catch (e) { report.errors.push("html: " + e.message); }

for (const logo of [
  "https://www.bhushancorp.in/wp-content/uploads/2024/06/Bhushan-footer-logo.png",
]) {
  try {
    const buf = await get(logo, true);
    const { w, h, px } = decodePng(buf);
    const bucket = new Map();
    for (const [r, g, b, a] of px) {
      if (a < 200) continue;
      const [hh, ss, ll] = rgbToHsl(r, g, b);
      if (ss < 18 || ll < 6 || ll > 94) continue;
      const key = `${Math.round(r / 8) * 8},${Math.round(g / 8) * 8},${Math.round(b / 8) * 8}`;
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }
    const top = [...bucket].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => {
      const [r, g, b] = k.split(",").map(Number);
      return { hex: hexOf(r, g, b), n, hsl: rgbToHsl(r, g, b) };
    });
    report.logoPalette.push({ logo, size: `${w}x${h}`, top });
  } catch (e) { report.errors.push(`logo ${logo}: ${e.message}`); }
}

console.log(JSON.stringify(report, null, 2));
