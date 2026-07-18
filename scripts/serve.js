// Minimal static file server for local preview + Playwright tests. No dependencies, so it
// works the same in CI as it does locally (unlike relying on `python -m http.server`, which
// isn't guaranteed to be installed).
//
// Run: node scripts/serve.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = Number(process.argv[2]) || 5555;

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.db': 'application/octet-stream',
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const filePath = path.join(root, urlPath);
  if (!filePath.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + urlPath); return; }
    // no-store: this same host:port gets reused across long local sessions serving many
    // different versions of the same files (rebuilds, data updates). Without this, browsers
    // silently serve a stale cached response with no way to tell -- content-length even matches
    // (looks fine at a glance), so a `fetch()` can return old data for an entire session with no
    // error, no console warning, nothing. Cost a lot of debugging time to track down once.
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
