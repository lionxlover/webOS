# Leonux OS 2.3 (web)
Open `index.html` — works straight from disk. First run shows the installer (account, look, install to system).
**Offline install (PWA + service worker)** needs http(s): run `python3 -m http.server 8000` in this folder, open http://localhost:8000, finish setup, then use the browser's Install button. After that it runs with no network.
Skip setup/lock for testing: `index.html?nolock`.
Store: built-in Starter Store works from file:// (store/starter.js). Rebuild with `python3 scripts/build_starter.py`; after any file change run `python3 scripts/gen_sw.py` to refresh the offline cache list.
Shortcuts: Ctrl+Space Spotlight · Alt+A Lion Assistant · Ctrl+Alt+↑ Mission Control · Space = Quick Look in Files · Ctrl+Shift+V Clipboard.
