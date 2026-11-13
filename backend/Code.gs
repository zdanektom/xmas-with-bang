/**
 * Xmas with Bang 💥 — backend (Google Apps Script web app + Google Sheet).
 * Stores entries privately in a Google Sheet in the owner's Google Drive, counts QR scans,
 * and powers the password-protected admin panel (list, CSV, winner draw, email broadcast).
 *
 * SETUP (once, ~5 minutes) — see SETUP.md:
 *  1. script.google.com → New project → paste this file → set ADMIN_PASSWORD_SHA256 below.
 *  2. Run `setup` once (Run ▶) and allow access. It creates the Google Sheet "Xmas with Bang – entries".
 *  3. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone → Deploy.
 *  4. Copy the Web app URL (ends with /exec) into config.js (ENDPOINT) on the website.
 *
 * Nothing in this file is secret except ADMIN_PASSWORD_SHA256, which is only a SHA-256 hash.
 * Entries are never readable without a valid admin session.
 */

// SHA-256 (hex) of the admin password. Generate: echo -n 'your password' | sha256sum
const ADMIN_PASSWORD_SHA256 = 'PASTE_SHA256_HEX_HERE';
// Closing date for entries (ISO, UTC). Keep in sync with config.js.
const CLOSES_AT = '2026-12-21T23:59:00Z';
const PROMO_NAME = 'Xmas with Bang';
const SENDER_NAME = 'Bang Bang Burger';
const SESSION_HOURS = 8;

const ENTRY_HEADERS = ['id', 'createdAt', 'name', 'phone', 'email', 'instagram', 'contact', 'marketingConsent',
  'termsAccepted', 'lang', 'src', 'unsubscribed', 'verified', 'winner', 'token', 'lastBroadcast', 'notes'];
const VISIT_HEADERS = ['ts', 'src', 'lang', 'ref'];
const BROADCAST_HEADERS = ['id', 'createdAt', 'subject', 'message', 'emailed', 'failed', 'skipped', 'remainingQuota'];

/* ---------------- setup ---------------- */
function setup() {
  const ss = sheet_();
  Logger.log('Sheet ready: ' + ss.getUrl());
  Logger.log('Email quota left today: ' + MailApp.getRemainingDailyQuota());
  if (!/^[0-9a-f]{64}$/.test(ADMIN_PASSWORD_SHA256)) Logger.log('WARNING: set ADMIN_PASSWORD_SHA256 before deploying.');
}

function sheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SHEET_ID');
  let ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
    if (!ss) ss = SpreadsheetApp.create(PROMO_NAME + ' – entries (private)');
    props.setProperty('SHEET_ID', ss.getId());
  }
  ensureTab_(ss, 'Entries', ENTRY_HEADERS);
  ensureTab_(ss, 'Visits', VISIT_HEADERS);
  ensureTab_(ss, 'Broadcasts', BROADCAST_HEADERS);
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Arkusz1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 3) ss.deleteSheet(def);
  return ss;
}

function ensureTab_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.appendRow(headers); sh.setFrozenRows(1); sh.getRange(1, 1, 1, headers.length).setFontWeight('bold'); }
  return sh;
}

/* ---------------- HTTP ---------------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.unsub) return unsubscribePage_(p.unsub);
  return json_({ ok: true, open: isOpen_(), closesAt: CLOSES_AT });
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
  try {
    switch (body.action) {
      case 'visit': return json_(visit_(body));
      case 'enter': return json_(enter_(body));
      case 'login': return json_(login_(body));
      case 'admin': return json_(admin_(body));
      default: return json_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function isOpen_() { return Date.now() < new Date(CLOSES_AT).getTime(); }
function clip_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }
// Prevent spreadsheet formula injection when the sheet is opened/exported.
function safe_(v) { v = String(v); return /^[=+\-@\t\r]/.test(v) && !/^\+\d/.test(v) ? "'" + v : v; }

/* ---------------- public: visits + entries ---------------- */
function visit_(b) {
  const src = clip_(b.src || 'direct', 30).replace(/[^a-z0-9_-]/gi, '') || 'direct';
  const sh = sheet_().getSheetByName('Visits');
  sh.appendRow([new Date(), src, clip_(b.lang, 5), safe_(clip_(b.ref, 120))]);
  return { ok: true };
}

function enter_(b) {
  if (!isOpen_()) return { ok: false, error: 'closed' };
  if (b.website) return { ok: true, id: 'x' }; // honeypot: pretend success for bots
  const name = clip_(b.name, 80);
  const email = clip_(b.email, 120).toLowerCase();
  const phone = clip_(b.phone, 30).replace(/[^\d+]/g, '');
  let ig = clip_(b.instagram, 40).replace(/^@+/, '').replace(/[^a-z0-9._]/gi, '');
  const contact = ['sms', 'whatsapp', 'email', 'instagram'].indexOf(b.contact) >= 0 ? b.contact : '';
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || phone.replace(/\D/g, '').length < 7 || !contact) return { ok: false, error: 'invalid' };
  if (b.terms !== true) return { ok: false, error: 'terms' };
  if (contact === 'instagram' && !ig) return { ok: false, error: 'invalid' };

  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = sheet_().getSheetByName('Entries');
    const n = sh.getLastRow() - 1;
    if (n > 0) {
      const emails = sh.getRange(2, 5, n, 1).getValues().map(function (r) { return String(r[0]).toLowerCase(); });
      const phones = sh.getRange(2, 4, n, 1).getValues().map(function (r) { return String(r[0]).replace(/\D/g, '').slice(-9); });
      if (emails.indexOf(email) >= 0 || phones.indexOf(phone.replace(/\D/g, '').slice(-9)) >= 0) return { ok: true, duplicate: true };
    }
    const id = Utilities.getUuid().slice(0, 8);
    const token = Utilities.getUuid().replace(/-/g, '');
    sh.appendRow([id, new Date(), safe_(name), "'" + phone, email, ig, contact, b.marketing === true, true,
      clip_(b.lang, 5), clip_(b.src, 30).replace(/[^a-z0-9_-]/gi, ''), false, false, false, token, '', '']);
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

function unsubscribePage_(token) {
  token = String(token).replace(/[^a-f0-9]/gi, '');
  let done = false;
  if (token.length >= 20) {
    const sh = sheet_().getSheetByName('Entries');
    const n = sh.getLastRow() - 1;
    if (n > 0) {
      const col = ENTRY_HEADERS.indexOf('token') + 1, uCol = ENTRY_HEADERS.indexOf('unsubscribed') + 1;
      const toks = sh.getRange(2, col, n, 1).getValues();
      for (let i = 0; i < n; i++) if (toks[i][0] === token) { sh.getRange(i + 2, uCol).setValue(true); done = true; }
    }
  }
  const msg = done ? 'You have been unsubscribed from Bang Bang Burger messages. / Wypisano Cię z wiadomości Bang Bang Burger.'
    : 'This link is not valid. / Ten link jest nieprawidłowy.';
  return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width,initial-scale=1"><div style="font:18px system-ui;padding:40px;max-width:520px;margin:auto">' + msg + '</div>').setTitle('Bang Bang Burger');
}

/* ---------------- admin auth ---------------- */
function sha256Hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function login_(b) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('fails') || 0);
  if (fails >= 8) return { ok: false, error: 'locked' }; // global lockout ~15 min after 8 bad tries
  if (!/^[0-9a-f]{64}$/.test(ADMIN_PASSWORD_SHA256) || sha256Hex_(String(b.password || '')) !== ADMIN_PASSWORD_SHA256) {
    cache.put('fails', String(fails + 1), 900);
    Utilities.sleep(800);
    return { ok: false, error: 'bad_password' };
  }
  cache.remove('fails');
  const session = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('s_' + session, '1', SESSION_HOURS * 3600);
  return { ok: true, session: session, hours: SESSION_HOURS };
}

function admin_(b) {
  const s = String(b.session || '').replace(/[^a-f0-9]/g, '');
  if (s.length < 40 || !CacheService.getScriptCache().get('s_' + s)) return { ok: false, error: 'auth' };
  switch (b.op) {
    case 'data': return adminData_();
    case 'set': return adminSet_(b);
    case 'broadcast': return broadcast_(b);
    case 'logout': CacheService.getScriptCache().remove('s_' + s); return { ok: true };
    default: return { ok: false, error: 'unknown_op' };
  }
}

function rows_(sh) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const w = sh.getLastColumn();
  const head = sh.getRange(1, 1, 1, w).getValues()[0];
  return sh.getRange(2, 1, n, w).getValues().map(function (r, i) {
    const o = { _row: i + 2 }; head.forEach(function (h, j) { o[h] = r[j] instanceof Date ? r[j].toISOString() : r[j]; }); return o;
  });
}

function adminData_() {
  const ss = sheet_();
  const entries = rows_(ss.getSheetByName('Entries')).map(function (r) { delete r.token; return r; });
  const visits = rows_(ss.getSheetByName('Visits'));
  const bySrc = {}; const byDay = {};
  visits.forEach(function (v) {
    bySrc[v.src] = (bySrc[v.src] || 0) + 1;
    const d = String(v.ts).slice(0, 10); byDay[d] = byDay[d] || { qr: 0, all: 0 }; byDay[d].all++; if (v.src === 'qr') byDay[d].qr++;
  });
  const broadcasts = rows_(ss.getSheetByName('Broadcasts')).slice(-20).reverse();
  return {
    ok: true, entries: entries, visits: { total: visits.length, bySrc: bySrc, byDay: byDay },
    broadcasts: broadcasts, quota: MailApp.getRemainingDailyQuota(), closesAt: CLOSES_AT, open: isOpen_(), sheetUrl: ss.getUrl()
  };
}

function adminSet_(b) {
  const field = ['verified', 'winner', 'unsubscribed', 'notes'].indexOf(b.field) >= 0 ? b.field : null;
  if (!field) return { ok: false, error: 'field' };
  const sh = sheet_().getSheetByName('Entries');
  const n = sh.getLastRow() - 1; if (n < 1) return { ok: false, error: 'not_found' };
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < n; i++) if (String(ids[i][0]) === String(b.id)) {
    sh.getRange(i + 2, ENTRY_HEADERS.indexOf(field) + 1).setValue(field === 'notes' ? safe_(clip_(b.value, 300)) : b.value === true);
    return { ok: true };
  }
  return { ok: false, error: 'not_found' };
}

/* ---------------- broadcast (email, from the owner's Gmail) ---------------- */
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function broadcast_(b) {
  const subject = clip_(b.subject, 150), message = String(b.message || '').slice(0, 5000).trim();
  if (!subject || !message) return { ok: false, error: 'empty' };
  const base = ScriptApp.getService().getUrl();
  const footer = function (tok) {
    return '\n\n—\nYou are receiving this because you entered ' + PROMO_NAME + ' and agreed to hear from Bang Bang Burger.\n' +
      'Unsubscribe / Wypisz się: ' + base + '?unsub=' + tok;
  };
  const html = function (name, tok) {
    const body = esc_(message.replace(/\{name\}/g, name || '')).replace(/\n/g, '<br>');
    return '<div style="font:16px/1.5 Arial,sans-serif;color:#111;max-width:560px">' + body +
      '<p style="margin-top:28px;font-size:12px;color:#777">You are receiving this because you entered ' + PROMO_NAME +
      ' and agreed to hear from Bang Bang Burger.<br><a href="' + base + '?unsub=' + tok + '">Unsubscribe / Wypisz się</a></p></div>';
  };

  if (b.test === true) { // send one test copy to the owner's own Gmail
    const me = Session.getEffectiveUser().getEmail();
    MailApp.sendEmail({ to: me, subject: '[TEST] ' + subject, body: message.replace(/\{name\}/g, 'Test') + footer('test'), htmlBody: html('Test', 'test'), name: SENDER_NAME });
    return { ok: true, test: true, to: me, quota: MailApp.getRemainingDailyQuota() };
  }

  const bid = String(b.broadcastId || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || ('b' + Date.now());
  const scope = b.scope === 'all_consented' ? 'all_consented' : 'email_pref';
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const ss = sheet_(); const sh = ss.getSheetByName('Entries');
    const rows = rows_(sh);
    const C = function (h) { return ENTRY_HEADERS.indexOf(h) + 1; };
    let emailed = 0, failed = 0, skipped = 0;
    let quota = MailApp.getRemainingDailyQuota();
    const seen = {};
    rows.forEach(function (r) {
      const ok = r.marketingConsent === true && r.unsubscribed !== true && r.email && (scope === 'all_consented' || r.contact === 'email');
      if (!ok || seen[r.email]) return;
      seen[r.email] = 1;
      if (String(r.lastBroadcast) === bid) return; // already sent in this broadcast (resume safely)
      if (quota <= 0) { skipped++; return; }
      try {
        const first = String(r.name).split(' ')[0];
        MailApp.sendEmail({ to: r.email, subject: subject, body: message.replace(/\{name\}/g, first) + footer(r.token), htmlBody: html(first, r.token), name: SENDER_NAME });
        sh.getRange(r._row, C('lastBroadcast')).setValue(bid);
        emailed++; quota--;
      } catch (err) { failed++; }
    });
    const bs = ss.getSheetByName('Broadcasts');
    bs.appendRow([bid, new Date(), safe_(subject), safe_(message), emailed, failed, skipped, MailApp.getRemainingDailyQuota()]);
    return { ok: true, broadcastId: bid, emailed: emailed, failed: failed, skipped: skipped, quota: MailApp.getRemainingDailyQuota() };
  } finally { lock.releaseLock(); }
}
