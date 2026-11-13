# Xmas with Bang 💥 – connecting the backend (one time, ~5 min, on a computer)

The website is static (GitHub Pages). Entries are saved in a **private Google Sheet** in your own Google account
through a small Google Apps Script web app. Emails are sent from your Gmail. It's free.

1. Open <https://script.google.com> signed in to the Google account that should own the entries → **New project**.
   Name it `Xmas with Bang`.
2. Delete the sample code and paste the whole of `Code.gs` (the private copy that already contains the password hash –
   *not* the template in this repo, which has `PASTE_SHA256_HEX_HERE`). Save (💾).
3. In the toolbar pick the function **`setup`** → **Run** → *Review permissions* → choose your account →
   *Advanced → Go to Xmas with Bang (unsafe)* → **Allow**. (The warning appears because it's your own unverified script.)
   The log shows the link to the new sheet **"Xmas with Bang – entries (private)"**.
4. **Deploy → New deployment** → ⚙ **Web app** → *Execute as:* **Me** · *Who has access:* **Anyone** → **Deploy** →
   copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).
   ("Anyone" only lets people *call* the script – they cannot see the sheet. Entries are only returned after admin login.)
5. Put that URL in `config.js` → `ENDPOINT: '…/exec'`, commit and push. The form switches on automatically.
6. Test: open the site, enter yourself, then open `/admin/`, log in, and check the entry is there. Delete your test row in the sheet.

**Changing the code later:** Deploy → *Manage deployments* → ✏️ → Version: *New version* → Deploy (the URL stays the same).
**Changing the password:** `echo -n 'new password' | sha256sum` → paste into `ADMIN_PASSWORD_SHA256` → redeploy a new version.
**Closing date:** `CLOSES_AT` in both `Code.gs` and `config.js`.
