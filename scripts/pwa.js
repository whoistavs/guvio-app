// Transforma o site exportado num app instalável (PWA).
// Uso: node scripts/pwa.js dist /guvio-app
const fs = require("fs");
const path = require("path");

const dist = process.argv[2] || "dist";
const base = (process.argv[3] || "").replace(/\/$/, "");
const src = path.join(__dirname, "..", "pwa");

for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dist, f));

const manifest = {
  name: "GUVIO",
  short_name: "GUVIO",
  description: "Rede social de moda: looks, guarda-roupa e estilo pelo mundo.",
  lang: "pt-BR",
  id: `${base}/`,
  start_url: `${base}/`,
  scope: `${base}/`,
  display: "standalone",
  orientation: "portrait",
  background_color: "#090A0C",
  theme_color: "#090A0C",
  icons: [
    { src: `${base}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
    { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
    { src: `${base}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" }
  ]
};
fs.writeFileSync(path.join(dist, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));

const tags = `
    <meta name="description" content="Rede social de moda: looks, guarda-roupa e estilo pelo mundo." />
    <link rel="manifest" href="${base}/manifest.webmanifest" />
    <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#090A0C" media="(prefers-color-scheme: dark)" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="GUVIO" />
    <link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />
    <script>
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("${base}/sw.js", { scope: "${base}/" }).catch(function () {});
        });
      }
    </script>
`;

for (const page of ["index.html", "404.html"]) {
  const file = path.join(dist, page);
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, "utf8");
  html = html.replace('<html lang="en">', '<html lang="pt-BR">');
  html = html.replace(/<title>.*?<\/title>/, "<title>GUVIO</title>");
  // a tela do app não dá zoom (só as fotos, com o gesto de pinça do próprio app);
  // isso também evita o iPhone dar zoom sozinho ao tocar num campo de texto
  const vp = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no" />';
  if (/<meta name="viewport"[^>]*>/.test(html)) html = html.replace(/<meta name="viewport"[^>]*>/, vp);
  else html = html.replace("</head>", "  " + vp + "\n  </head>");
  if (!html.includes("manifest.webmanifest")) html = html.replace("</head>", tags + "  </head>");
  fs.writeFileSync(file, html);
}
console.log("PWA pronto em", dist, "base:", base || "/");
