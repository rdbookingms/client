/*
 * RDbookingMS - hosted Admin panel: "Sign in with Google" before the Admin PIN.
 * The License Admin server checks with Google that the sign-in is genuine and belongs to the account that owns
 * License Admin (the same rule as opening the Admin Panel from the sheet), then asks for the Admin PIN as usual.
 * The sign-in lasts about an hour; after that this screen appears again and the waiting action continues.
 */
(function () {
  'use strict';
  var CLIENT_ID = String(window.RD_ADMIN_GOOGLE_CLIENT_ID || '').trim();
  var configured = /\.apps\.googleusercontent\.com$/.test(CLIENT_ID) && CLIENT_ID.indexOf('PASTE_') !== 0;
  var KEY = 'la_gid', token = '', exp = 0, queue = [], overlay = null, gisReady = false, scriptObj = null;

  function decodeExp(t) {
    try {
      var part = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return Number(JSON.parse(decodeURIComponent(escape(atob(part)))).exp) || 0;
    } catch (e) { return 0; }
  }
  function emailOf(t) {
    try { var part = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(part)))).email || ''; }
    catch (e) { return ''; }
  }
  function setToken(t) {
    token = t || ''; exp = token ? decodeExp(token) : 0;
    try { if (token) sessionStorage.setItem(KEY, token); else sessionStorage.removeItem(KEY); } catch (e) {}
  }
  function ready() { return !!token && exp * 1000 > Date.now() + 60000; }
  try { setToken(sessionStorage.getItem(KEY) || ''); if (!ready()) setToken(''); } catch (e) {}

  function flush() { var q = queue; queue = []; q.forEach(function (fn) { setTimeout(fn, 0); }); }
  function $(id) { return document.getElementById(id); }

  function build() {
    if (overlay) return overlay;
    var css = document.createElement('style');
    css.textContent =
      '#gGate{position:fixed;inset:0;z-index:2147483000;background:linear-gradient(140deg,#0b6d79,#0f9aa8 55%,#55c9a6);display:none;align-items:center;justify-content:center;padding:18px;font-family:Inter,Arial,sans-serif}' +
      '#gGate .card{background:#fff;border-radius:16px;max-width:400px;width:100%;padding:26px 22px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.18);color:#17333a}' +
      '#gGate img{width:72px;height:72px;border-radius:16px}#gGate h1{font-size:21px;margin:12px 0 6px}#gGate p{font-size:14px;line-height:1.5;color:#5b6f75;margin:0 0 16px}' +
      '#gGate #gBtn{display:flex;justify-content:center;min-height:44px}#gGate #gMsg{margin-top:14px;font-size:13px;color:#b3261e;min-height:18px}' +
      '#gGate small{display:block;margin-top:14px;color:#8a9a9f;font-size:12px}';
    document.head.appendChild(css);
    overlay = document.createElement('div');
    overlay.id = 'gGate';
    overlay.innerHTML = '<div class="card" role="dialog" aria-modal="true" aria-labelledby="gTitle">' +
      '<img src="../icon-192.png" alt=""><h1 id="gTitle">License Admin</h1>' +
      '<p>Sign in with the Google account that owns License Admin. Your Admin PIN is asked next.</p>' +
      '<div id="gBtn"></div><div id="gMsg" role="alert"></div>' +
      '<small>Only the owner\'s Google account is accepted.</small></div>';
    document.body.appendChild(overlay);
    return overlay;
  }
  function show(message) {
    if (!document.body) { document.addEventListener('DOMContentLoaded', function () { show(message); }); return; }
    build().style.display = 'flex';
    $('gMsg').textContent = message || (configured ? '' : 'Sign-in is not set up yet: put your Google client ID in license-config.js (see the setup guide).');
    loadGis();
  }
  function hide() { if (overlay) overlay.style.display = 'none'; }

  function onCredential(r) {
    if (!r || !r.credential) { if (overlay) $('gMsg').textContent = 'Google did not return a sign-in. Please try again.'; return; }
    setToken(r.credential);
    hide();
    flush();
  }
  function loadGis() {
    if (!configured || gisReady || document.getElementById('gisScript')) return;
    scriptObj = window.google && window.google.script;               // keep the server bridge if Google's script replaces window.google
    var s = document.createElement('script');
    s.id = 'gisScript'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = function () {
      if (scriptObj && window.google && !window.google.script) window.google.script = scriptObj;
      try {
        google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential, auto_select: true, cancel_on_tap_outside: false,
                                        use_fedcm_for_prompt: true, context: 'signin', ux_mode: 'popup' });
        google.accounts.id.renderButton($('gBtn'), { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', logo_alignment: 'left' });
        gisReady = true;
        if (overlay && overlay.style.display !== 'none') google.accounts.id.prompt();
      } catch (e) { $('gMsg').textContent = 'Google sign-in could not start: ' + e.message; }
    };
    s.onerror = function () { s.remove(); if (overlay) $('gMsg').textContent = 'Could not reach Google sign-in. Check your connection, then reload the page.'; };
    document.head.appendChild(s);
  }

  window.RD_AUTH_GATE = {
    ready: ready,
    token: function () { return ready() ? token : ''; },
    email: function () { return token ? emailOf(token) : ''; },
    wait: function (fn) { if (ready()) { setTimeout(fn, 0); return; } queue.push(fn); if (!overlay || overlay.style.display === 'none') show(''); },
    needed: function (message, kind) {
      setToken('');
      if (kind === 'NotOwner' && gisReady) { try { google.accounts.id.disableAutoSelect(); } catch (e) {} }
      show(kind === 'NotOwner' ? message : 'Please sign in again to continue.');
    },
    signOut: function () { setToken(''); if (gisReady) { try { google.accounts.id.disableAutoSelect(); } catch (e) {} } show(''); }
  };

  if (!ready()) show('');
})();
