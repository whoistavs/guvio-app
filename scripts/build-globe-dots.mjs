/**
 * Gera src/data/globeDots.ts: pontos espalhados uniformemente (espiral de Fibonacci)
 * que caem sobre terra firme, usando o mapa Natural Earth 1:50m (world-atlas).
 *
 * Uso (precisa de: world-atlas topojson-client @turf/boolean-point-in-polygon @turf/helpers):
 *   node scripts/build-globe-dots.mjs [pasta-com-node_modules]
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import path from "path";

const base = process.argv[2] ? path.resolve(process.argv[2]) + "/" : import.meta.url;
const require = createRequire(base.startsWith("file:") ? base : "file://" + base);
const topojson = require("topojson-client");
const pip = require("@turf/boolean-point-in-polygon").default;
const { point } = require("@turf/helpers");
const land50 = require("world-atlas/land-50m.json");

const land = topojson.feature(land50, land50.objects.land);
// separa cada polígono com sua caixa, para testar rápido
const polys = [];
for (const f of land.features) {
  const geoms = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
  for (const coords of geoms) {
    let minX = 180, maxX = -180, minY = 90, maxY = -90;
    for (const [x, y] of coords[0]) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    polys.push({ bbox: [minX, minY, maxX, maxY], feature: { type: "Feature", geometry: { type: "Polygon", coordinates: coords } } });
  }
}

function isLand(lat, lon) {
  const p = point([lon, lat]);
  for (const { bbox, feature } of polys) {
    if (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3]) continue;
    if (pip(p, feature)) return true;
  }
  return false;
}

const N = Number(process.env.GLOBE_POINTS || 42000);
const golden = Math.PI * (3 - Math.sqrt(5));
const out = [];
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2;
  const theta = golden * i;
  const lat = (Math.asin(y) * 180) / Math.PI;
  let lon = ((theta * 180) / Math.PI) % 360;
  if (lon > 180) lon -= 360;
  if (lat < -62) continue; // Antártida fica de fora: deixa o globo mais limpo
  if (isLand(lat, lon)) out.push(Math.round(lat * 100), Math.round(lon * 100));
}

const bytes = Buffer.from(new Int16Array(out).buffer);
const b64 = bytes.toString("base64");
const file = `// Gerado por scripts/build-globe-dots.mjs a partir do Natural Earth 1:50m (domínio público).
// ${out.length / 2} pontos de terra firme, lat/lon em centésimos de grau (Int16, base64).
export const GLOBE_DOTS_COUNT = ${out.length / 2};
export const GLOBE_DOTS_B64 =
  "${b64}";
`;
writeFileSync(new URL("../src/data/globeDots.ts", import.meta.url), file);
console.log("pontos de terra:", out.length / 2, "| tamanho:", (file.length / 1024).toFixed(1), "KB");
