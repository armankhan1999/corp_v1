// Loose logo sampling + locate which stylesheet carries the site-specific hexes.
import zlib from "node:zlib";
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36" };
const get = async (u, b = false) => {
  const r = await fetch(u, { headers: UA, redirect: "follow" });
  if (!r.ok) throw new Error(`${r.status}`);
  return b ? Buffer.from(await r.arrayBuffer()) : r.text();
};
const hexOf = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
function decodePng(buf) {
  let p = 8, w = 0, h = 0, bd = 0, ct = 0; const idat = []; let plte = null, trns = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8);
    const d = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; }
    else if (type === "PLTE") plte = d; else if (type === "tRNS") trns = d;
    else if (type === "IDAT") idat.push(d); else if (type === "IEND") break;
    p += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ch, stride = w * bpp, out = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[pos++], line = raw.subarray(pos, pos + stride); pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 0xff;
    }
  }
  const px = [];
  for (let i = 0; i < w * h; i++) {
    const o = i * bpp; let r, g, b, al = 255;
    if (ct === 3) { const ix = out[o]; r = plte[ix * 3]; g = plte[ix * 3 + 1]; b = plte[ix * 3 + 2]; if (trns && ix < trns.length) al = trns[ix]; }
    else if (ct === 0) { r = g = b = out[o]; }
    else if (ct === 4) { r = g = b = out[o]; al = out[o + 1]; }
    else if (ct === 2) { r = out[o]; g = out[o + 1]; b = out[o + 2]; }
    else { r = out[o]; g = out[o + 1]; b = out[o + 2]; al = out[o + 3]; }
    px.push([r, g, b, al]);
  }
  return { w, h, ct, bd, px };
}

const out = { logos: [], hexSources: {} };

for (const url of [
  "https://www.bhushancorp.in/wp-content/uploads/2024/06/Bhushan-footer-logo.png",
  "https://www.bhushancorp.in/wp-content/uploads/2024/06/cropped-Bhushan-footer-logo-32x32.png",
  "https://www.bhushancorp.in/wp-content/uploads/2024/06/cropped-Bhushan-footer-logo-192x192.png",
]) {
  try {
    const { w, h, ct, bd, px } = decodePng(await get(url, true));
    const all = new Map(), sat = new Map();
    for (const [r, g, b, a] of px) {
      if (a < 128) continue;
      const k = `${r >> 3 << 3},${g >> 3 << 3},${b >> 3 << 3}`;
      all.set(k, (all.get(k) ?? 0) + 1);
      const [, s, l] = rgbToHsl(r, g, b);
      if (s >= 12 && l > 5 && l < 95) sat.set(k, (sat.get(k) ?? 0) + 1);
    }
    const fmt = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => {
      const [r, g, b] = k.split(",").map(Number);
      return { hex: hexOf(r, g, b), n, hsl: rgbToHsl(r, g, b) };
    });
    out.logos.push({ url, size: `${w}x${h}`, colourType: ct, bitDepth: bd, opaquePx: px.filter((p) => p[3] >= 128).length, allTop: fmt(all), saturatedTop: fmt(sat) });
  } catch (e) { out.logos.push({ url, error: e.message }); }
}

const sheets = [
  "https://www.bhushancorp.in/wp-content/cache/wpfc-minified/dh6woi1t/27yg0.css",
  "https://www.bhushancorp.in/wp-content/cache/wpfc-minified/g4z0bx9i/27yg0.css",
  "https://www.bhushancorp.in/wp-content/cache/wpfc-minified/dpxwpx35/27yg0.css",
  "https://www.bhushancorp.in/wp-content/cache/wpfc-minified/kkwvw7bg/27yg0.css",
  "https://www.bhushancorp.in/wp-content/cache/wpfc-minified/lp1xhhew/27yg0.css",
  "https://www.bhushancorp.in/wp-content/cache/wpfc-minified/eewsoxv9/27yg0.css",
  "https://www.bhushancorp.in/wp-content/cache/wpfc-minified/e59glpfr/27yg0.css",
  "https://www.bhushancorp.in/wp-content/cache/wpfc-minified/6zc2kyag/27yg0.css",
  "https://www.bhushancorp.in/wp-content/cache/wpfc-minified/3syotuy/27yg0.css",
  "https://www.bhushancorp.in/wp-content/cache/wpfc-minified/dubtpqhd/27yg0.css",
];
for (const hex of ["#fd6701", "#fc3116", "#003388", "#0757fe", "#1ea0c3"]) {
  out.hexSources[hex] = [];
  for (const s of sheets) {
    try {
      const css = await get(s);
      if (css.toLowerCase().includes(hex)) {
        const i = css.toLowerCase().indexOf(hex);
        out.hexSources[hex].push({ sheet: s.split("/").slice(-2)[0], ctx: css.slice(Math.max(0, i - 110), i + 30).replace(/\s+/g, " ") });
      }
    } catch { /* ignore */ }
  }
}
console.log(JSON.stringify(out, null, 2));
