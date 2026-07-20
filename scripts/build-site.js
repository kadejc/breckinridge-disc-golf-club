// Builds the static marketing pages (everything except the stats dashboard, which has its own
// build in scripts/build.js) from site/**/*.html content fragments + shared/site-header.html +
// shared/site-footer.html.
//
// Each fragment in site/ starts with a `<!-- title: Page Title -->` comment on its own first
// line. site/home.html builds to index.html; everything else preserves its subdirectory, e.g.
// site/about/who-we-are.html -> about/who-we-are.html (one page per dropdown nav item).
//
// The shared header/footer/CSS link use a {{ROOT}} placeholder so the same partials work at any
// depth: '' for root-level pages, '../' for one-level-deep pages (every content page here is
// exactly one level deep, so that's the only other case).
//
// Run: node scripts/build-site.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const headerTemplate = read('shared/site-header.html');
const footerTemplate = read('shared/site-footer.html');

function walk(dir) {
  const entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(rel));
    else if (entry.name.endsWith('.html')) files.push(rel);
  }
  return files;
}

const pageFiles = walk('site');
let count = 0;

for (const file of pageFiles) {
  const raw = read(file);
  const titleMatch = raw.match(/^<!--\s*title:\s*(.+?)\s*-->\s*\n/);
  if (!titleMatch) throw new Error(`${file} is missing a leading <!-- title: ... --> comment`);
  const title = titleMatch[1];
  const content = raw.slice(titleMatch[0].length);

  const relFromSite = path.posix.relative('site', file); // e.g. "about/who-we-are.html" or "home.html"
  const outPath = relFromSite === 'home.html' ? 'index.html' : relFromSite;
  const depth = outPath.split('/').length - 1;
  const rootPrefix = depth > 0 ? '../'.repeat(depth) : '';

  const header = headerTemplate.split('{{ROOT}}').join(rootPrefix);
  const footer = footerTemplate.split('{{ROOT}}').join(rootPrefix);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Breckinridge DGC</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${rootPrefix}shared/site.css">
</head>
<body>
${header}
<main>
${content}</main>
${footer}
</body>
</html>
`;
  const outFull = path.join(root, outPath);
  fs.mkdirSync(path.dirname(outFull), { recursive: true });
  fs.writeFileSync(outFull, html);
  count++;
}

console.log(`Built ${count} page(s) from ${pageFiles.length} source fragment(s).`);
