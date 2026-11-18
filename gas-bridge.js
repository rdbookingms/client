/*
 * RDbookingMS - banner-free hosting (Option 2)
 * Recreates google.script.run and google.script.url for a page hosted outside Google
 * (GitHub Pages, Netlify, Cloudflare Pages, your own domain).
 *
 * google.script.run.withSuccessHandler(ok).withFailureHandler(fail).someFunction(a, b)
 *   -> POST {fn:'someFunction', args:[a, b]} to the Booking App /exec link (doPost in Code.gs)
 *   -> ok(result) or fail(Error)
 *
 * Index.html needs no other changes: it already checks for window.google.script and calls the server through it.
 *
 * Pages that need a Google sign-in (the hosted License Admin panel) set window.RD_AUTH_GATE before this file runs:
 *   { ready(): boolean, token(): string, wait(fn), needed(message) }
 * Calls then carry the ID token, wait while nobody is signed in, and are retried once after a new sign-in.
 */
(function () {
  'use strict';

  var API = String(window.RD_API_URL || '').trim();

  // <app address>?page=terms (used in sign-up and the subscription screen) opens the Terms page.
  try {
    if (/(^|[?&])page=terms(&|$)/i.test(location.search) && !/terms\.html$/i.test(location.pathname)) {
      location.replace('terms.html');
      return;
    }
  } catch (e) {}

  function later(fn, value) { setTimeout(function () { fn(value); }, 0); }   // handlers run outside the fetch promise, like Google's

  function makeError(message, name) {
    var err = new Error(message || 'The server did not answer. Please try again.');
    if (name) err.name = name;
    err.fromBridge = true;
    return err;
  }

  function call(name, args, h, retried) {
    var gate = window.RD_AUTH_GATE;
    if (gate && !gate.ready()) { gate.wait(function () { call(name, args, h, retried); }); return; }
    function fail(err) {
      if (h.fail) later(function (e) { h.fail(e, h.user); }, err);
      else if (window.console) console.error(err);
    }
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(API)) {
      fail(makeError('The app is not connected yet: put the Booking App /exec link in config.js.', 'ConfigError'));
      return;
    }
    var undef = [];
    for (var i = 0; i < args.length; i++) if (args[i] === undefined) undef.push(i);
    var body;
    try { body = JSON.stringify({ fn: name, args: args, undef: undef, idToken: gate ? gate.token() : undefined }); }
    catch (e) { fail(makeError('Could not send this request: ' + e.message)); return; }

    fetch(API, {
      method: 'POST',
      // text/plain keeps this a "simple" request, so the browser does not send a CORS preflight that Apps Script cannot answer
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body,
      redirect: 'follow',
      cache: 'no-store',
      credentials: 'omit'
    }).then(function (res) {
      return res.text().then(function (text) { return { status: res.status, text: text }; });
    }).then(function (r) {
      var o = null;
      try { o = JSON.parse(r.text); } catch (e) { o = null; }
      if (!o || typeof o !== 'object') {
        if (/<html|<!doctype/i.test(r.text)) {
          throw makeError('The booking server answered with a web page instead of data. Check that the Booking App is deployed with "Who has access: Anyone" and that config.js has the current /exec link.', 'ServerError');
        }
        throw makeError('Unexpected answer from the booking server (HTTP ' + r.status + '). Please try again.', 'ServerError');
      }
      if (o.ok) { if (h.ok) later(function (v) { h.ok(v, h.user); }, o.result); }
      else if (gate && !retried && (o.name === 'GoogleSignInRequired' || o.name === 'NotOwner')) {
        gate.needed(o.error, o.name);                              // show the sign-in again, then repeat this call once
        gate.wait(function () { call(name, args, h, true); });
      }
      else fail(makeError(o.error, o.name));
    }).catch(function (e) {
      if (e && e.fromBridge) fail(e);
      else fail(makeError('NetworkError: Connection failure. Check your internet connection and try again.', 'NetworkError'));
    });
  }

  function runner(h) {
    return new Proxy({}, {
      get: function (_, name) {
        if (typeof name !== 'string' || name === 'then') return undefined;
        if (name === 'withSuccessHandler') return function (fn) { return runner({ ok: fn, fail: h.fail, user: h.user }); };
        if (name === 'withFailureHandler') return function (fn) { return runner({ ok: h.ok, fail: fn, user: h.user }); };
        if (name === 'withUserObject') return function (obj) { return runner({ ok: h.ok, fail: h.fail, user: obj }); };
        return function () { call(name, Array.prototype.slice.call(arguments), h); };
      }
    });
  }

  function getLocation(cb) {
    var parameter = {}, parameters = {};
    try {
      new URLSearchParams(location.search).forEach(function (v, k) {
        if (!(k in parameter)) parameter[k] = v;
        (parameters[k] = parameters[k] || []).push(v);
      });
    } catch (e) {}
    var loc = { hash: String(location.hash || '').replace(/^#/, ''), parameter: parameter, parameters: parameters };
    if (typeof cb === 'function') later(cb, loc);
  }

  window.google = window.google || {};
  window.google.script = {
    run: runner({}),
    url: { getLocation: getLocation },
    history: { push: function () {}, replace: function () {}, setChangeHandler: function () {} },
    host: { origin: location.origin, close: function () { window.close(); }, setHeight: function () {}, setWidth: function () {}, editor: { focus: function () {} } }
  };
})();
