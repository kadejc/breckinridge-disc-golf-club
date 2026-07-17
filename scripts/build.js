// Builds the two deployable HTML files from the split source in src/ + artifact_data.json.
//
//   breckinridge_artifact.html — Cowork-compatible build, includes the "Ask the Data" chat tab
//                                 (window.cowork.askClaude). Self-contained single file.
//   stats.html / breckinridge_public.html — public deploy build, chat tab stripped.
//                                 stats.html is what's linked from the rest of the site and
//                                 pushed to GitHub Pages; breckinridge_public.html is kept as an
//                                 identical reference copy.
//
// Both builds get the shared global site header/footer (shared/site-header.html,
// shared/site-footer.html, shared/site.css) inlined so they match the rest of the site's nav —
// inlined rather than linked because the Cowork build must stay a single self-contained file.
//
// Run: node scripts/build.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const head = read('src/head.html');
const sharedCss = read('shared/site.css');
const baseCss = read('src/style.css');
const chatCss = read('src/chat.css');
const body = read('src/body.html');
const chatPanelHtml = read('src/chat-panel.html');
const headScripts = read('src/head-scripts.html');
const tail = read('src/tail.html');
// stats.html/breckinridge_artifact.html are root-level pages, so the shared header/footer's
// {{ROOT}} placeholder (used for depth-relative links on one-level-deep content pages) resolves
// to the empty string here.
const globalHeader = read('shared/site-header.html').split('{{ROOT}}').join('');
const globalFooter = read('shared/site-footer.html').split('{{ROOT}}').join('');
// appJs starts with '\n// RAW.course ...'; drop that leading newline since rawLiteral
// already ends with one.
const appJs = read('src/app.js').replace(/^\n/, '');
const chatJs = read('src/chat.js');
const rawData = JSON.parse(read('artifact_data.json'));
const rawLiteral = '\nconst RAW = ' + JSON.stringify(rawData) + ';\n';

// Use function-form replacements throughout: chatJs and other injected strings can contain
// literal "$'" etc. sequences (e.g. `'totalWinnings:$'+Math.round(...)`), which String.replace
// treats as special replacement patterns when passed as a plain string, silently corrupting
// output. A function replacement is inserted verbatim.
function render({ includeChat }) {
  const style = sharedCss + '\n' + baseCss.replace('/*__CHAT_CSS__*/', () => (includeChat ? chatCss : ''));
  const nav = includeChat ? '<div class="tab" data-tab="chat">Ask the Data</div>\n    ' : '';
  const filterNote = body.replace(
    '__CHAT_FILTER_NOTE__',
    () => (includeChat ? ', including Ask the Data' : '')
  ).replace('<!--__CHAT_NAV__-->', () => nav)
   .replace('<!--__CHAT_PANEL__-->', () => (includeChat ? chatPanelHtml : ''))
   .replace('<!--__GLOBAL_HEADER__-->', () => globalHeader)
   .replace('<!--__GLOBAL_FOOTER__-->', () => globalFooter);
  const script = rawLiteral + appJs.replace(
    '/*__CHAT_JS_HOOK__*/',
    () => (includeChat ? chatJs : '')
  );

  return (
    head + style + '</style>' +
    filterNote +
    headScripts +
    '<script>' + script + tail
  );
}

fs.writeFileSync(path.join(root, 'breckinridge_artifact.html'), render({ includeChat: true }));
const publicHtml = render({ includeChat: false });
fs.writeFileSync(path.join(root, 'breckinridge_public.html'), publicHtml);
fs.writeFileSync(path.join(root, 'stats.html'), publicHtml);

console.log('Built breckinridge_artifact.html, breckinridge_public.html, stats.html');
