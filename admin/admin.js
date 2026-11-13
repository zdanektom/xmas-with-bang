(function () {
  'use strict';
  var C = window.XMAS_CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };
  var session = sessionStorage.getItem('xwb:session');
  var data = null;
  var CH = { sms: 'SMS', whatsapp: 'WhatsApp', email: 'E-mail', instagram: 'Instagram DM' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(body) {
    return fetch(C.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }
  function adm(op, extra) {
    return api(Object.assign({ action: 'admin', session: session, op: op }, extra || {})).then(function (r) {
      if (r.error === 'auth') { logout(true); throw new Error('auth'); }
      return r;
    });
  }
  function when(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('pl-PL', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  function intl(p) {
    p = String(p || '').trim(); var d = p.replace(/\D/g, '');
    if (p[0] === '+') return d; if (d.indexOf('00') === 0) return d.slice(2);
    if (d[0] === '0') return '44' + d.slice(1); if (d.length === 10 && d[0] === '7') return '44' + d; return d;
  }

  if (!C.ENDPOINT) { $('#noEndpoint').hidden = false; }
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault(); $('#loginErr').textContent = '';
    if (!C.ENDPOINT) { $('#loginErr').textContent = 'Backend nie jest podłączony.'; return; }
    api({ action: 'login', password: $('#pw').value }).then(function (r) {
      if (r.ok) { session = r.session; sessionStorage.setItem('xwb:session', session); $('#pw').value = ''; start(); }
      else $('#loginErr').textContent = r.error === 'locked' ? 'Za dużo prób. Spróbuj za 15 minut.' : 'Nieprawidłowe hasło.';
    }).catch(function () { $('#loginErr').textContent = 'Brak połączenia z backendem.'; });
  });
  function logout(expired) {
    if (!expired && session) adm('logout').catch(function () {});
    session = null; sessionStorage.removeItem('xwb:session'); data = null;
    $('#app').classList.add('hidden'); $('#logout').classList.add('hidden'); $('#loginCard').classList.remove('hidden');
    if (expired) $('#loginErr').textContent = 'Sesja wygasła – zaloguj się ponownie.';
  }
  $('#logout').addEventListener('click', function () { logout(false); });

  function start() {
    $('#loginCard').classList.add('hidden'); $('#app').classList.remove('hidden'); $('#logout').classList.remove('hidden');
    load();
  }
  function load() {
    $('#count').textContent = 'Ładowanie…';
    return adm('data').then(function (r) { if (!r.ok) throw new Error(r.error); data = r; render(); }).catch(function (e) { if (e.message !== 'auth') $('#count').textContent = 'Błąd ładowania: ' + e.message; });
  }
  $('#refresh').addEventListener('click', load);

  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      document.querySelectorAll('.tab').forEach(function (s) { s.classList.toggle('hidden', s.id !== 'tab-' + b.dataset.tab); });
    });
  });

  function consented(e) { return e.marketingConsent === true && e.unsubscribed !== true; }
  function render() {
    var E = data.entries, v = data.visits;
    var qr = v.bySrc.qr || 0, cons = E.filter(consented).length, fromQr = E.filter(function (e) { return e.src === 'qr'; }).length;
    var stats = [
      ['red', qr, 'skanów QR (wizyty z ?src=qr)'], ['', v.total, 'wszystkich wizyt'], ['', E.length, 'zgłoszeń'],
      ['', fromQr, 'zgłoszeń z QR' + (qr ? ' (' + Math.round(100 * fromQr / qr) + '%)' : '')], ['', cons, 'zgód marketingowych'],
      ['', E.filter(function (e) { return e.verified === true; }).length, 'zweryfikowanych']
    ];
    $('#stats').innerHTML = stats.map(function (s) { return '<div class="stat ' + s[0] + '"><b>' + s[1] + '</b><span>' + esc(s[2]) + '</span></div>'; }).join('') +
      '<div class="stat"><b style="font-size:18px;line-height:1.4">' + Object.keys(CH).map(function (k) { return CH[k] + ': ' + E.filter(function (e) { return e.contact === k; }).length; }).join('<br>') + '</b><span>preferowany kontakt</span></div>';
    $('#sheetLink').href = data.sheetUrl;
    renderTable(); renderDraw(); renderChan(); renderSend();
  }
  function filtered() {
    var q = $('#q').value.trim().toLowerCase(), f = $('#filter').value;
    return data.entries.filter(function (e) {
      if (f === 'consent' && !consented(e)) return false;
      if (f === 'verified' && e.verified !== true) return false;
      if (f === 'qr' && e.src !== 'qr') return false;
      if (!q) return true;
      return [e.name, e.email, e.phone, e.instagram, e.id].join(' ').toLowerCase().indexOf(q.replace(/^@/, '')) >= 0;
    }).slice().reverse();
  }
  function renderTable() {
    var rows = filtered();
    $('#count').textContent = rows.length + ' z ' + data.entries.length + ' zgłoszeń';
    $('#table tbody').innerHTML = rows.map(function (e) {
      var ig = e.instagram ? '<a href="https://www.instagram.com/' + encodeURIComponent(e.instagram) + '/" target="_blank" rel="noopener">@' + esc(e.instagram) + '</a>' : '';
      return '<tr><td>' + when(e.createdAt) + '</td><td>' + esc(e.name) + (e.winner === true ? ' <span class="pill win">🏆 zwycięzca</span>' : '') + '</td><td>' + esc(e.phone) + '</td><td>' + esc(e.email) +
        '</td><td>' + ig + '</td><td>' + esc(CH[e.contact] || e.contact) + '</td><td>' + (e.unsubscribed === true ? '<span class="pill">wypisany</span>' : e.marketingConsent === true ? '✅' : '—') +
        '</td><td><input type="checkbox" data-ver="' + esc(e.id) + '"' + (e.verified === true ? ' checked' : '') + ' aria-label="zweryfikowany"></td><td class="small">' + esc(e.src) + '</td></tr>';
    }).join('') || '<tr><td colspan="9" class="small">Brak zgłoszeń.</td></tr>';
  }
  $('#q').addEventListener('input', renderTable); $('#filter').addEventListener('change', renderTable);
  $('#table').addEventListener('change', function (ev) {
    var id = ev.target.getAttribute('data-ver'); if (!id) return;
    var val = ev.target.checked, e = data.entries.find(function (x) { return String(x.id) === id; });
    adm('set', { id: id, field: 'verified', value: val }).then(function (r) { if (!r.ok) throw 0; e.verified = val; render(); })
      .catch(function () { ev.target.checked = !val; alert('Nie udało się zapisać.'); });
  });
  $('#csv').addEventListener('click', function () {
    var cols = ['id', 'createdAt', 'name', 'phone', 'email', 'instagram', 'contact', 'marketingConsent', 'unsubscribed', 'verified', 'winner', 'src', 'lang'];
    var q = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v) && !/^\+\d/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var csv = '\ufeff' + cols.join(',') + '\n' + data.entries.map(function (e) { return cols.map(function (c) { return q(e[c]); }).join(','); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'xmas-with-bang-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
  });

  /* Draw */
  function pool() {
    var seen = {};
    return data.entries.filter(function (e) {
      if ($('#onlyVerified').checked && e.verified !== true) return false;
      if (e.winner === true) return false;
      var k = String(e.email).toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true;
    });
  }
  function renderDraw() {
    $('#poolInfo').textContent = 'W puli: ' + pool().length + ' osób' + ($('#onlyVerified').checked ? ' (zweryfikowanych – zaznacz „Zweryf.” w zakładce Zgłoszenia)' : '');
    var w = data.entries.filter(function (e) { return e.winner === true; });
    $('#winners').textContent = w.length ? w.map(function (e) { return e.name + ' (' + e.email + ')'; }).join(', ') : '–';
  }
  $('#onlyVerified').addEventListener('change', renderDraw);
  $('#drawBtn').addEventListener('click', function () {
    var p = pool(); if (!p.length) { alert('Pula jest pusta.'); return; }
    var r = new Uint32Array(1); crypto.getRandomValues(r);
    var e = p[r[0] % p.length], box = $('#drawResult');
    box.classList.remove('hidden');
    box.innerHTML = '<div class="small">Wylosowano spośród ' + p.length + ' osób · ' + new Date().toLocaleString('pl-PL', { timeZone: 'Europe/London' }) + '</div><div class="who">🏆 ' + esc(e.name) + '</div><div>' +
      esc(e.email) + ' · ' + esc(e.phone) + (e.instagram ? ' · @' + esc(e.instagram) : '') + ' · kontakt: ' + esc(CH[e.contact] || e.contact) +
      '</div><div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="markWin" type="button">Oznacz jako zwycięzcę</button></div>';
    $('#markWin').onclick = function () {
      adm('set', { id: e.id, field: 'winner', value: true }).then(function (r) { if (!r.ok) throw 0; e.winner = true; render(); $('#markWin').remove(); })
        .catch(function () { alert('Nie udało się zapisać.'); });
    };
  });

  /* Broadcast */
  function emailTargets() {
    var scope = $('#scope').value, seen = {};
    return data.entries.filter(function (e) {
      if (!consented(e) || !e.email) return false; if (scope === 'email_pref' && e.contact !== 'email') return false;
      var k = String(e.email).toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true;
    });
  }
  function renderSend() {
    var n = emailTargets().length;
    $('#sendBtn').textContent = 'Wyślij e-mail do wszystkich (' + n + ')';
    $('#quota').textContent = 'Limit Gmaila na dziś: ' + data.quota + ' e-maili (darmowe konto Google: ok. 100 odbiorców dziennie; nadwyżkę dokończysz jutro tym samym przyciskiem).';
    $('#history').innerHTML = (data.broadcasts || []).map(function (b) { return '<li>' + when(b.createdAt) + ' – „' + esc(b.subject) + '”: wysłano ' + b.emailed + ', błędy ' + b.failed + ', czeka ' + b.skipped + '</li>'; }).join('') || '<li>Brak.</li>';
  }
  $('#scope').addEventListener('change', renderSend);
  $('#testBtn').addEventListener('click', function () {
    adm('broadcast', { test: true, subject: $('#subj').value, message: $('#msg').value }).then(function (r) {
      showRes(r.ok ? 'Test wysłany na ' + r.to + '.' : 'Błąd: ' + r.error);
    });
  });
  $('#sendBtn').addEventListener('click', function () {
    var n = emailTargets().length; if (!n) { alert('Brak odbiorców z zgodą.'); return; }
    if (!confirm('Wysłać e-mail „' + $('#subj').value + '” do ' + n + ' osób z Twojego Gmaila?')) return;
    var key = 'xwb:bid:' + $('#subj').value + '|' + $('#msg').value + '|' + $('#scope').value;
    var bid = localStorage.getItem(key) || ('b' + Date.now()); localStorage.setItem(key, bid);
    $('#sendBtn').disabled = true; showRes('Wysyłanie…');
    adm('broadcast', { subject: $('#subj').value, message: $('#msg').value, scope: $('#scope').value, broadcastId: bid }).then(function (r) {
      if (!r.ok) return showRes('Błąd: ' + r.error);
      showRes('Wysłano: ' + r.emailed + ', błędy: ' + r.failed + (r.skipped ? ', czeka (limit dzienny): ' + r.skipped + ' – kliknij ten sam przycisk jutro, wyśle tylko brakujące.' : '.') + ' Pozostały limit: ' + r.quota);
      load();
    }).catch(function () { showRes('Brak połączenia – sprawdź historię i spróbuj ponownie (nie wyśle podwójnie).'); })
      .finally(function () { $('#sendBtn').disabled = false; });
  });
  function showRes(t) { var b = $('#sendResult'); b.classList.remove('hidden'); b.textContent = t; }

  /* Click-to-send SMS / WhatsApp / Instagram */
  var doneKey = function () { return 'xwb:done:' + $('#chan').value + ':' + $('#msg').value.length + ':' + $('#msg').value.slice(0, 40); };
  function doneSet() { try { return JSON.parse(localStorage.getItem(doneKey()) || '{}'); } catch (e) { return {}; } }
  function chanTargets() {
    var ch = $('#chan').value;
    return data.entries.filter(function (e) { return consented(e) && e.contact === ch && (ch === 'instagram' ? e.instagram : e.phone); });
  }
  function personal(e) { return $('#msg').value.replace(/\{name\}/g, String(e.name).split(' ')[0]); }
  function renderChan() {
    if (!data) return;
    var ch = $('#chan').value, list = chanTargets(), done = doneSet();
    $('#chanInfo').textContent = list.length + ' osób ze zgodą wybrało ' + CH[ch] + '. Wysłane: ' + list.filter(function (e) { return done[e.id]; }).length + '.';
    $('#chanList').innerHTML = list.map(function (e) {
      var m = encodeURIComponent(personal(e) + (ch === 'instagram' ? '' : '\n\nReply STOP to opt out.')), num = intl(e.phone), href, label;
      if (ch === 'whatsapp') { href = 'https://wa.me/' + num + '?text=' + m; label = 'WhatsApp'; }
      else if (ch === 'sms') { href = 'sms:+' + num + '?&body=' + m; label = 'SMS'; }
      else { href = 'https://ig.me/m/' + encodeURIComponent(e.instagram); label = 'Instagram DM'; }
      return '<li class="' + (done[e.id] ? 'done' : '') + '"><span class="nm"><b>' + esc(e.name) + '</b><br><span class="small">' + esc(ch === 'instagram' ? '@' + e.instagram : '+' + num) + '</span></span>' +
        '<a class="btn sm" target="_blank" rel="noopener" data-send="' + esc(e.id) + '" href="' + esc(href) + '">' + label + ' ➜</a>' +
        '<button class="icon-btn" type="button" data-undo="' + esc(e.id) + '">' + (done[e.id] ? 'cofnij' : 'oznacz') + '</button></li>';
    }).join('') || '<li class="small">Brak osób dla tego kanału.</li>';
  }
  $('#chan').addEventListener('change', renderChan); $('#msg').addEventListener('input', function () { renderChan(); });
  $('#chanList').addEventListener('click', function (ev) {
    var id = ev.target.getAttribute('data-send') || ev.target.getAttribute('data-undo'); if (!id) return;
    var d = doneSet();
    if (ev.target.hasAttribute('data-undo')) { if (d[id]) delete d[id]; else d[id] = 1; }
    else { d[id] = 1; if ($('#chan').value === 'instagram') copy(personal(data.entries.find(function (x) { return String(x.id) === id; }))); }
    localStorage.setItem(doneKey(), JSON.stringify(d)); setTimeout(renderChan, 50);
  });
  function copy(s) { if (navigator.clipboard) navigator.clipboard.writeText(s).catch(function () {}); }
  $('#copyNums').addEventListener('click', function () {
    var ch = $('#chan').value, list = chanTargets();
    copy(list.map(function (e) { return ch === 'instagram' ? '@' + e.instagram : '+' + intl(e.phone); }).join('\n')); alert('Skopiowano ' + list.length + ' pozycji.');
  });
  $('#copyMsg').addEventListener('click', function () { copy($('#msg').value); });
  $('#resetDone').addEventListener('click', function () { localStorage.removeItem(doneKey()); renderChan(); });

  if (session && C.ENDPOINT) start();
})();
