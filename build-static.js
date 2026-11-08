/**
 * OISM.institute — Static Build Generator (`build-static.js`)
 * Compiles `public/` into `dist/` with `.nojekyll`, `CNAME`, `404.html`, and `robots.txt`
 * so the exact same artifact deploys to Cloudflare Workers Static Assets, Cloudflare Pages, and GitHub Pages.
 */

const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "public");
const DIST_DIR = path.join(__dirname, "dist");

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function build() {
  console.log("=== BUILDING OISM.INSTITUTE STATIC EDGE ARTIFACT ===");
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  copyRecursive(PUBLIC_DIR, DIST_DIR);

  // Copy index.html to 404.html for SPA fallback on GitHub Pages
  const indexHtml = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(indexHtml)) {
    fs.copyFileSync(indexHtml, path.join(DIST_DIR, "404.html"));
  }

  // .nojekyll and robots.txt
  fs.writeFileSync(path.join(DIST_DIR, ".nojekyll"), "", "utf8");
  fs.writeFileSync(
    path.join(DIST_DIR, "robots.txt"),
    "User-agent: *\nAllow: /\nSitemap: https://oism.institute/sitemap.xml\n",
    "utf8"
  );

  console.log("=== STATIC BUILD COMPLETE (./dist) ===");
}

if (require.main === module) {
  build();
}

module.exports = { build };
