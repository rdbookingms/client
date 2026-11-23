/*
 * RDbookingMS - builds the banner-free website from "Booking App/Index.html".
 * Run it after every Booking App update, from the project folder:
 *     node "Option 2 - Banner-free hosting/web/update-web.cjs"
 * (or from inside the web folder:  node update-web.cjs)
 *
 * What it does (no extra software needed, only Node.js):
 *   1. Splits Index.html into index.html (page layout), app.css (styles) and app.js (program),
 *      so browsers keep the big parts cached instead of downloading 500 KB on every visit.
 *   2. Adds the connection to the server (config.js + gas-bridge.js), the install-as-app files
 *      (manifest + icons), early connections to Google, and loads the receipt-image tool later.
 *   3. Stamps a new version into sw.js (the offline/caching helper) so phones pick up the update.
 * It never changes config.js.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const webDir = __dirname;
const candidates = [
  path.join(webDir, '..', '..', 'Booking App', 'Index.html'),    // main project copy (the one you paste into Apps Script)
  path.join(webDir, '..', 'Booking App', 'Index.html')           // fallback: a copy next to the web folder
];
const source = candidates.find(p => fs.existsSync(p));
if (!source) fail('Could not find "Booking App/Index.html" next to this folder.');

// ---- Link previews (Facebook, Messenger, Viber, WhatsApp, Google...). Edit these if the name or address changes.
const SITE = {
  url: 'https://rdbookingms.com/',
  title: 'RD Booking Management System',
  description: 'Online resort bookings, confirmations, availability calendar, expenses and financial reports.',
  image: 'og-image.png',                     // 1200 x 630 picture in the web folder
  imageAlt: 'RD Booking Management System logo'
};

const HTML2CANVAS = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
let html = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n');

function fail(msg) { console.error('Nothing was changed: ' + msg); process.exit(1); }
function hash(text) { return crypto.createHash('sha256').update(text).digest('hex').slice(0, 10); }
function write(name, text) { fs.writeFileSync(path.join(webDir, name), text, 'utf8'); }

// ---- 1. styles: the single <style> block in <head>
const headEnd = html.search(/<\/head>/i);
if (headEnd < 0) fail('Index.html has no </head>.');
const styleRe = /<style>([\s\S]*?)<\/style>/i;
const styleMatch = styleRe.exec(html.slice(0, headEnd));
if (!styleMatch) fail('The <style> block in <head> was not found.');
const css = styleMatch[1].replace(/^\n/, '');

// ---- 2. program: the last inline <script> before </body>
const bodyEnd = html.search(/<\/body>/i);
if (bodyEnd < 0) fail('Index.html has no </body>.');
const lastOpen = html.lastIndexOf('<script>', bodyEnd);
const lastClose = html.indexOf('</script>', lastOpen);
if (lastOpen < 0 || lastClose < 0 || lastClose > bodyEnd) fail('The main <script> block was not found.');
const js = html.slice(lastOpen + '<script>'.length, lastClose).replace(/^\n/, '');
if (js.length < 50000) fail('The main <script> block looks too small - is this the right Index.html?');

const cssV = hash(css), jsV = hash(js);
const bridgeV = hash(fs.readFileSync(path.join(webDir, 'gas-bridge.js'), 'utf8'));

// ---- 3. rebuild the page
html = html.slice(0, lastOpen) +
  '<script src="app.js?v=' + jsV + '"></script>\n' +
  '<script>\n' +
  '  // Install-as-app and fast repeat visits (sw.js). Skipped on plain http except localhost testing.\n' +
  "  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {\n" +
  "    addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });\n" +
  '  }\n' +
  '</script>' +
  html.slice(lastClose + '</script>'.length);

html = html.replace(styleRe, '<link rel="stylesheet" href="app.css?v=' + cssV + '">');

const tagRe = new RegExp('<script src="' + HTML2CANVAS.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '"><\\/script>\\n?');
if (!tagRe.test(html)) fail('The html2canvas <script> tag was not found (has its version changed?).');
html = html.replace(tagRe, [
  '<script>',
  '  // The receipt-image tool (html2canvas) loads after the page is ready instead of delaying it.',
  '  (function () {',
  "    var url = '" + HTML2CANVAS + "', loading = null, stub;",
  '    function load() {',
  '      if (!loading) loading = new Promise(function (resolve, reject) {',
  "        var s = document.createElement('script'); s.src = url; s.async = true; s.crossOrigin = 'anonymous';",
  '        s.onload = function () { window.html2canvas !== stub ? resolve() : reject(new Error(\'The image tool did not start.\')); };',
  "        s.onerror = function () { s.remove(); loading = null; reject(new Error('The image tool could not load. Check your connection and try again.')); };",
  '        document.head.appendChild(s);',
  '      });',
  '      return loading;',
  '    }',
  '    stub = window.html2canvas = function () {',
  '      var args = arguments, self = this;',
  '      return load().then(function () { return window.html2canvas.apply(self, args); });',
  '    };',
  "    addEventListener('load', function () { setTimeout(function () { load().catch(function () {}); }, 2500); });",
  '  })();',
  '</script>',
  ''
].join('\n'));

const attr = t => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const imageUrl = new URL(SITE.image, SITE.url).href;
html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + attr(SITE.title) + '</title>');
html = html.replace(/<meta name="description"[^>]*>\n?/i, '');
const previewTags = [
  '<meta name="description" content="' + attr(SITE.description) + '">',
  '<link rel="canonical" href="' + attr(SITE.url) + '">',
  '<meta property="og:type" content="website">',
  '<meta property="og:site_name" content="' + attr(SITE.title) + '">',
  '<meta property="og:title" content="' + attr(SITE.title) + '">',
  '<meta property="og:description" content="' + attr(SITE.description) + '">',
  '<meta property="og:url" content="' + attr(SITE.url) + '">',
  '<meta property="og:image" content="' + attr(imageUrl) + '">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta property="og:image:alt" content="' + attr(SITE.imageAlt) + '">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:title" content="' + attr(SITE.title) + '">',
  '<meta name="twitter:description" content="' + attr(SITE.description) + '">',
  '<meta name="twitter:image" content="' + attr(imageUrl) + '">',
  ''
].join('\n');

const headTop = [
  '<script src="config.js"></script>',
  '<script src="gas-bridge.js?v=' + bridgeV + '"></script>',
  '<link rel="preconnect" href="https://script.google.com" crossorigin>',
  '<link rel="preconnect" href="https://script.googleusercontent.com" crossorigin>',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="manifest" href="manifest.webmanifest">',
  '<meta name="theme-color" content="#0f9aa8">',
  '<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">',
  '<link rel="apple-touch-icon" href="apple-touch-icon.png">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<meta name="apple-mobile-web-app-title" content="RD Booking">',
  ''
].join('\n');
if (html.includes('gas-bridge.js')) fail('Index.html already contains gas-bridge.js - use the original Booking App/Index.html.');
html = html.replace(/<meta charset="utf-8">\n?/i, '');                 // re-added first: it must be near the top of the page
html = html.replace(/<head>\s*/i, m => m + '<meta charset="utf-8">\n' + previewTags + headTop);

// ---- 4. write the files and stamp the service worker
write('app.css', css);
write('app.js', js);
write('index.html', html);

const swPath = path.join(webDir, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
const build = hash(cssV + jsV + bridgeV + hash(html));
const assets = ['./', 'app.css?v=' + cssV, 'app.js?v=' + jsV, 'gas-bridge.js?v=' + bridgeV, 'config.js', 'terms.html',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png'];
sw = sw.replace(/^const BUILD = .*$/m, "const BUILD = '" + build + "';")
       .replace(/^const ASSETS = .*$/m, 'const ASSETS = ' + JSON.stringify(assets) + ';');
fs.writeFileSync(swPath, sw, 'utf8');

// ---- 5. License Admin pages: /partners/ (referral partners) and /admin/ (Admin panel)
const laCandidates = [path.join(webDir, '..', 'License Admin'), path.join(webDir, '..', '..', 'License Admin')];
const laDir = laCandidates.find(d => fs.existsSync(path.join(d, 'Referrer.html')) && fs.existsSync(path.join(d, 'Admin.html')));
const built = [];
if (!laDir) console.warn('Note: "License Admin/Referrer.html" and "Admin.html" were not found - /partners/ and /admin/ were not rebuilt.');
else {
  const gateV = hash(fs.readFileSync(path.join(webDir, 'admin', 'google-gate.js'), 'utf8'));
  const page = (file, dir, extraHead, ownIcon) => {
    let h = fs.readFileSync(path.join(laDir, file), 'utf8').replace(/\r\n/g, '\n');
    if (h.includes('gas-bridge.js')) fail(file + ' already contains gas-bridge.js - use the original Apps Script file.');
    h = h.replace(/<meta charset="utf-8">\n?/i, '');
    h = h.replace(/<head>\s*/i, m => m + '<meta charset="utf-8">\n' +
      '<script src="../license-config.js"></script>\n' + extraHead.join('\n') + '\n' +
      '<script src="../gas-bridge.js?v=' + bridgeV + '"></script>\n' +
      '<link rel="preconnect" href="https://script.google.com" crossorigin>\n' +
      '<link rel="preconnect" href="https://script.googleusercontent.com" crossorigin>\n' +
      '<link rel="icon" type="image/png" sizes="32x32" href="../favicon-32.png">\n' +
      '<link rel="apple-touch-icon" href="' + (ownIcon ? '' : '../') + 'apple-touch-icon.png">\n' +
      '<meta name="theme-color" content="#0f9aa8">\n');
    fs.mkdirSync(path.join(webDir, dir), { recursive: true });
    fs.writeFileSync(path.join(webDir, dir, 'index.html'), h, 'utf8');
    built.push(dir + '/index.html');
  };
  const partnerUrl = new URL('partners/', SITE.url).href;
  const partnerText = 'Invite resort owners to ' + SITE.title + ' and earn a monthly share of their subscription.';
  page('Referrer.html', 'partners', [
    '<meta name="description" content="' + attr(partnerText) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="' + attr(SITE.title) + '">',
    '<meta property="og:title" content="' + attr(SITE.title + ' - Referral partners') + '">',
    '<meta property="og:description" content="' + attr(partnerText) + '">',
    '<meta property="og:url" content="' + attr(partnerUrl) + '">',
    '<meta property="og:image" content="' + attr(imageUrl) + '">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">'
  ]);
  // The Admin panel can be installed as its own app (admin/manifest.webmanifest, admin/sw.js, admin/install.js, admin/icon-*.png)
  const instV = hash(fs.readFileSync(path.join(webDir, 'admin', 'install.js'), 'utf8'));
  page('Admin.html', 'admin', [
    '<meta name="robots" content="noindex, nofollow">',
    '<link rel="manifest" href="manifest.webmanifest">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-title" content="RD Admin">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    '<script src="google-gate.js?v=' + gateV + '"></script>',
    '<script src="install.js?v=' + instV + '" defer></script>'
  ], true);
}

const kb = n => (Buffer.byteLength(n) / 1024).toFixed(0) + ' KB';
console.log('Built from ' + source);
console.log('  index.html ' + kb(html) + '   app.css ' + kb(css) + '   app.js ' + kb(js) + '   (build ' + build + ')');
if (laDir) console.log('Built ' + built.join(' and ') + ' from ' + laDir);
console.log('Upload to GitHub: index.html, app.css, app.js, sw.js' + (built.length ? ', partners/index.html, admin/index.html (and the admin/ app files: manifest.webmanifest, sw.js, install.js, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png)' : ''));
