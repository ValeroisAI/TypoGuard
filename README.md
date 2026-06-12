# TypoGuard
Browser extension that auto-corrects mistyped domains using a trusted list. Prevents typosquatting and accidental wrong-site visits. By Valerois.

```markdown
# Valerois TypoGuard 🛡️🔗

**Valerois TypoGuard** is a lightweight browser extension that **fixes mistyped domain names** directly in the address bar.  
If you accidentally type `gogle.com` instead of `google.com`, TypoGuard redirects you to the correct, trusted site – instantly and silently.

The extension uses a curated list from `trusted_domains.py` to match typos against legitimate domains, helping you avoid **typosquatting attacks**, phishing, and dead pages.

> ✅ **No data collection, no tracking.** All correction happens locally on your device.

---

## ✨ Features

- 🔍 **Real‑time domain correction** – catches typos as you type in the omnibox.
- 📄 **Configurable trusted domain list** – edit `trusted_domains.py` to add/remove domains.
- 🛡️ **Anti‑typosquatting** – prevents fake look‑alike sites from loading.
- ⚡ **Minimal performance impact** – only activates on navigation, uses simple string matching.
- 🌐 **Works offline** – no external lookups, all logic runs in the browser.
- 🧩 **Open source, self‑hosted** – you control the domain list entirely.

---

## 🧠 How It Works

1. You type a URL in the address bar and press Enter.
2. TypoGuard extracts the domain name and checks it against the **trusted domains** defined in `trusted_domains.py`.
3. If a close match is found (e.g., `facebok.com` → `facebook.com`), the browser is **automatically redirected** to the correct domain **before** any request is sent to the wrong address.
4. Corrections are logged in the browser console (optional, for debugging).

The matching algorithm supports:
- Deletion/insertion of characters (e.g., `gooogle` → `google`)
- Character transpositions (e.g., `gmial` → `gmail`)
- Common misspellings

---

## 📦 Installation

### Load unpacked (developer mode)

1. Clone or download this repo:
   ```bash
   git clone https://github.com/Valerois/Valerois-TypoGuard.git
   cd Valerois-TypoGuard
   ```

2. **Chrome / Edge / Brave**:
   - Go to `chrome://extensions/`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the folder containing `manifest.json`

3. **Firefox** (temporary):
   - Go to `about:debugging#/runtime/this-firefox`
   - Click **Load Temporary Add‑on**
   - Select the `manifest.json` file

The extension icon will appear in the toolbar – no further setup required.

---

## ⚙️ Configuration

The core of TypoGuard is the **trusted domain list**.

- Open `trusted_domains.py`
- Add your own trusted domains in the following format:

```python
TRUSTED_DOMAINS = [
    "google.com",
    "facebook.com",
    "twitter.com",
    "github.com",
    "wikipedia.org",
    # ... more domains
]
```

- Save the file and reload the extension from the browser's extensions page.
- The matching algorithm automatically detects typos of any added domain.

> 🔒 **Important:** Only include domains you **trust completely**, because the extension will redirect to them without user confirmation.

---

## 🧪 Usage

Just browse normally. If you make a typo in a known domain:

- **Before:** `https://reddt.com` → error or squatter page
- **After:** TypoGuard intercepts and sends you to `reddit.com`

No pop‑ups, no warnings – just seamless correction.

To see what was corrected, check the **background console** of the extension.

---

> The `trusted_domains.py` file is fetched by the extension during runtime; it can also be a simple JSON list if you prefer.

---

## 👤 Copyright

Copyright (c) 2026 **Berkay Şahin**  
Company: **Valerois**

---

**⭐ Star this repo if it saves you from a typo!**

Bunları `Valerois-TypoGuard` adıyla bir GitHub repo açıp içine attığında hazır olur.  
Ekstra bir şey eklemek istersen yine haber et.
