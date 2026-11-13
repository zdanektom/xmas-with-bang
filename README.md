# Xmas with Bang 💥 – Bang Bang Burger Christmas giveaway

Created by Tomasz Zdankowski. Mobile landing page (EN default, PL toggle) for the Apple Watch giveaway:
follow [@bangbangburgeruk](https://www.instagram.com/bangbangburgeruk/), post a photo tagged **#XmasWithBang**, enter name/phone/email/Instagram + preferred contact.

- `index.html`, `app.js`, `styles.css` – participant page. `?src=qr` (poster QR) is counted as a scan.
- `terms.html`, `privacy.html` – draft T&Cs and privacy notice (UK).
- `admin/` – private panel (password login against the backend; holds no data itself): stats, QR scans, search, CSV,
  verification ticks, random winner draw, email broadcast (Gmail), click-to-send WhatsApp/SMS/Instagram DM lists.
- `backend/Code.gs` – Google Apps Script backend template (Google Sheet storage). See `SETUP.md`.
- `config.js` – endpoint, Instagram handle, hashtag, closing date. No secrets in this repo; entries are never stored here.
