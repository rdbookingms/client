/*
 * RDbookingMS - "Install app" for the License Admin panel (/admin/).
 * Chrome / Edge (computer and Android): an Install app button in the top bar and on the PIN screen.
 * iPhone / iPad (Safari): the same button shows how to use Share > Add to Home Screen.
 * Hidden when the panel is already running as an installed app.
 */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', function () { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {}); });
  }
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (standalone) return;
  var ua = navigator.userAgent || '';
  var ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var iosSafari = ios && /safari/i.test(ua) && !/crios|fxios|edgios|fban|fbav|instagram|line\//i.test(ua);
  var deferred = null, buttons = [], tip = null;

  function css() {
    var s = document.createElement('style');
    s.textContent = '.inst-btn{display:none}.inst-btn.on{display:inline-flex;align-items:center;gap:6px}' +
      '.inst-link{background:none!important;color:var(--teal-d,#0b6d79)!important;text-decoration:underline;padding:6px!important;margin-top:8px!important;font-weight:700;width:auto!important}' +
      '#instTip{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483001;max-width:360px;width:calc(100% - 28px);background:#17333a;color:#fff;border-radius:14px;padding:14px 16px;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25)}' +
      '#instTip b{color:#9fe8de}#instTip button{float:right;margin:-4px -6px 0 8px;background:none;border:0;color:#fff;font-size:20px;line-height:1;cursor:pointer}';
    document.head.appendChild(s);
  }
  function make(cls, label) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn inst-btn ' + cls; b.textContent = label;
    b.title = 'Install the License Admin as an app on this device';
    b.addEventListener('click', install); buttons.push(b); return b;
  }
  function show(on) { buttons.forEach(function (b) { b.classList.toggle('on', !!on); }); }
  function place() {
    var tools = document.querySelector('.top .tools'), lock = document.getElementById('btnLock');
    if (tools && !tools.querySelector('.inst-btn')) { var b = make('', '⬇ Install app'); if (lock) tools.insertBefore(b, lock); else tools.appendChild(b); }
    var card = document.getElementById('lg_pin');
    if (card && !card.querySelector('.inst-btn')) card.appendChild(make('inst-link', 'Install as an app on this device'));
  }
  function showTip() {
    if (tip) { tip.remove(); tip = null; return; }
    tip = document.createElement('div'); tip.id = 'instTip'; tip.setAttribute('role', 'dialog');
    tip.innerHTML = '<button type="button" aria-label="Close">&times;</button><div>To install on this iPhone or iPad: tap <b>Share</b> ' +
      '(the square with an arrow) in Safari, then <b>Add to Home Screen</b>, then <b>Add</b>.</div>';
    tip.querySelector('button').addEventListener('click', function () { tip.remove(); tip = null; });
    document.body.appendChild(tip);
  }
  function install() {
    if (deferred) {
      var e = deferred; deferred = null;
      e.prompt();
      show(false);                                       // the browser offers the button again later if it was dismissed
      (e.userChoice || Promise.resolve({})).catch(function () {});
    } else if (iosSafari) showTip();
  }
  addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; show(true); });
  addEventListener('appinstalled', function () { deferred = null; show(false); if (tip) { tip.remove(); tip = null; } });
  function start() { css(); place(); if (iosSafari) show(true); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
