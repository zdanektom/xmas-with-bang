(function () {
  'use strict';
  var C = window.XMAS_CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };
  var T = {
    pl: {
      kicker: 'Świąteczny konkurs', prize: 'Wygraj <b>Apple Watch Series&nbsp;11</b>',
      s1h: 'Obserwuj nas na Instagramie', s1p: 'Zaobserwuj <b>@bangbangburgeruk</b>.', s1b: 'Obserwuj @bangbangburgeruk',
      s2h: 'Wrzuć zdjęcie i oznacz nas', s2p: 'Opublikuj zdjęcie z Bang Bang (post lub relacja), oznacz <b>@bangbangburgeruk</b> i dodaj hashtag:',
      s2n: 'Tylko konta publiczne – musimy widzieć Twoje oznaczenie.', copy: 'Kopiuj', copyTag: 'Kopiuj #XmasWithBang', copied: 'Skopiowano!',
      s3h: 'Wpisz swoje dane', notOpen: 'Zgłoszenia ruszają już wkrótce – zajrzyj za chwilę!', closedMsg: 'Konkurs zakończony. Dziękujemy za udział!',
      fName: 'Imię i nazwisko', fPhone: 'Numer telefonu', fEmail: 'E-mail', fIg: 'Nazwa na Instagramie', fIgOpt: '(żebyśmy znaleźli Twoje oznaczenie)',
      fContact: 'Jak mamy się z Tobą kontaktować?',
      cTerms: 'Mam 18+ lat, mieszkam w Wielkiej Brytanii i akceptuję <a href="terms.html" target="_blank">Regulamin</a> oraz <a href="privacy.html" target="_blank">Informację o prywatności</a>.',
      cMkt: 'Tak, Bang Bang Burger może wysyłać mi oferty i nowości wybraną drogą. Mogę się wypisać w każdej chwili. (Opcjonalne – nie wpływa na udział.)',
      submit: 'Biorę udział', sending: 'Wysyłanie…', okH: 'Jesteś w grze!',
      okP: 'Powodzenia! Pamiętaj: obserwuj <b>@bangbangburgeruk</b> i wrzuć zdjęcie z <b>#XmasWithBang</b> przed końcem konkursu – sprawdzamy oznaczenia przed losowaniem.',
      dup: 'Już bierzesz udział – jedno zgłoszenie na osobę.', okIg: 'Otwórz Instagram',
      foot: 'Zakup nie jest wymagany. Konkurs nie jest sponsorowany, popierany ani prowadzony przez Instagram/Meta ani Apple i nie jest z nimi powiązany.',
      tc: 'Regulamin', pn: 'Prywatność', closes: 'Zgłoszenia do {d} · losowanie i ogłoszenie zwycięzcy 25 grudnia', closedOn: 'Zakończono {d}',
      eName: 'Wpisz swoje imię.', ePhone: 'Wpisz poprawny numer telefonu.', eEmail: 'Wpisz poprawny e-mail.', eContact: 'Wybierz formę kontaktu.',
      eIg: 'Wpisz nazwę na Instagramie (wybrano kontakt przez Instagram).', eTerms: 'Zaakceptuj regulamin, aby wziąć udział.',
      eNet: 'Nie udało się wysłać. Sprawdź internet i spróbuj ponownie – Twoje dane są nadal w formularzu.', eClosed: 'Konkurs jest już zamknięty.'
    },
    en: {
      copied: 'Copied!', sending: 'Sending…', closes: 'Entries close {d} · winner drawn & announced on Christmas Day', closedOn: 'Closed {d}',
      eName: 'Please enter your name.', ePhone: 'Please enter a valid phone number.', eEmail: 'Please enter a valid email.',
      eContact: 'Please choose how we should contact you.', eIg: 'Please add your Instagram username (you chose Instagram DM).',
      eTerms: 'Please accept the Terms & Conditions to enter.', eNet: 'Couldn’t send. Check your connection and try again – your details are still in the form.',
      eClosed: 'This giveaway has closed.'
    }
  };
  // Capture English defaults from the HTML.
  document.querySelectorAll('[data-t]').forEach(function (el) {
    var k = el.getAttribute('data-t'); if (!(k in T.en)) T.en[k] = el.hasAttribute('data-html') ? el.innerHTML : el.textContent;
  });
  var params = new URLSearchParams(location.search);
  var lang = params.get('lang') || localStorage.getItem('xwb:lang') || 'en';
  if (lang !== 'pl') lang = 'en';
  var src = (params.get('src') || 'direct').replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || 'direct';
  function t(k) { return (T[lang] && T[lang][k]) || T.en[k] || k; }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }); } catch (e) { return iso; }
  }
  var closes = new Date(C.CLOSES_AT || '2100-01-01').getTime();
  function isClosed() { return Date.now() >= closes; }
  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach(function (el) {
      var v = t(el.getAttribute('data-t')); if (el.hasAttribute('data-html')) el.innerHTML = v; else el.textContent = v;
    });
    document.querySelectorAll('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    $('#closes').textContent = (isClosed() ? t('closedOn') : t('closes')).replace('{d}', fmtDate(C.CLOSES_AT));
  }
  document.querySelectorAll('.lang button').forEach(function (b) {
    b.addEventListener('click', function () { lang = b.dataset.lang; localStorage.setItem('xwb:lang', lang); apply(); });
  });
  apply();

  function toast(msg) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 1800); }
  function copyTag() {
    var s = '#' + (C.HASHTAG || 'XmasWithBang');
    (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(function () { toast(t('copied')); }, function () {
      var r = document.createRange(); r.selectNodeContents($('#tag')); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast(s);
    });
  }
  $('#copyTag').addEventListener('click', copyTag); $('#copyTag2').addEventListener('click', copyTag);

  function post(body) {
    return fetch(C.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }

  var form = $('#form'), submit = $('#submit'), err = $('#err');
  var enabled = !!C.ENDPOINT && !isClosed();
  if (!C.ENDPOINT) $('#notOpen').classList.remove('hidden');
  if (isClosed()) $('#closedMsg').classList.remove('hidden');
  if (!enabled) form.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });

  // Count visits/scans once per browser session per source (e.g. ?src=qr from the poster QR code).
  if (C.ENDPOINT && !sessionStorage.getItem('xwb:v:' + src)) {
    sessionStorage.setItem('xwb:v:' + src, '1');
    post({ action: 'visit', src: src, lang: lang, ref: document.referrer ? new URL(document.referrer).hostname : '' }).catch(function () {});
  }

  function showSuccess(dup) {
    $('#flow').classList.add('hidden'); var s = $('#success'); s.classList.remove('hidden');
    $('#dupMsg').hidden = !dup; s.focus(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (localStorage.getItem('xwb:entered') && params.get('new') !== '1') showSuccess(false);

  function fail(msg, el) { err.textContent = msg; if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } return false; }
  form.addEventListener('input', function (e) { e.target.removeAttribute('aria-invalid'); err.textContent = ''; });
  form.addEventListener('submit', function (e) {
    e.preventDefault(); if (!enabled) return;
    if (isClosed()) return fail(t('eClosed'));
    var f = form.elements;
    var name = f.name.value.trim(), phone = f.phone.value.trim(), email = f.email.value.trim();
    var ig = f.instagram.value.trim().replace(/^@+/, '');
    var c = form.querySelector('input[name=contact]:checked');
    if (!name) return fail(t('eName'), f.name);
    if (phone.replace(/\D/g, '').length < 7 || /[^\d+\s().-]/.test(phone)) return fail(t('ePhone'), f.phone);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(t('eEmail'), f.email);
    if (!c) return fail(t('eContact'), form.querySelector('input[name=contact]'));
    if (c.value === 'instagram' && !ig) return fail(t('eIg'), f.instagram);
    if (!$('#terms').checked) return fail(t('eTerms'), $('#terms'));
    submit.disabled = true; submit.textContent = t('sending');
    post({ action: 'enter', name: name, phone: phone, email: email, instagram: ig, contact: c.value, terms: true,
      marketing: $('#marketing').checked, lang: lang, src: src, website: f.website.value })
      .then(function (r) {
        if (r && r.ok) { localStorage.setItem('xwb:entered', '1'); showSuccess(!!r.duplicate); return; }
        if (r && r.error === 'closed') return fail(t('eClosed'));
        fail(t('eNet'));
      })
      .catch(function () { fail(t('eNet')); })
      .finally(function () { submit.disabled = false; submit.textContent = t('submit'); });
  });
})();
