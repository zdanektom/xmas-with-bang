(function () {
  var C = window.XMAS_CONFIG || {};
  function fmt(iso, time) {
    try { return new Date(iso).toLocaleString('en-GB', Object.assign({ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }, time ? { hour: '2-digit', minute: '2-digit' } : {})); } catch (e) { return iso; }
  }
  document.querySelectorAll('.closesAt').forEach(function (e) { e.textContent = fmt(C.CLOSES_AT, true); });
  document.querySelectorAll('.drawDate').forEach(function (e) { e.textContent = fmt(C.DRAW_DATE + 'T12:00:00Z'); });
  document.querySelectorAll('.contact').forEach(function (e) {
    var ig = 'https://www.instagram.com/' + (C.INSTAGRAM_HANDLE || 'bangbangburgeruk') + '/';
    e.innerHTML = (C.CONTACT_EMAIL ? '<a href="mailto:' + C.CONTACT_EMAIL + '">' + C.CONTACT_EMAIL + '</a> or ' : '') +
      'Instagram DM <a href="' + ig + '" target="_blank" rel="noopener">@' + (C.INSTAGRAM_HANDLE || 'bangbangburgeruk') + '</a>';
  });
})();
