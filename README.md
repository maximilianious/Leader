# LEADER — Digital Film & Professional Camera

A camera web app with two personalities:

- **DIGITAL** — five film-style looks (grain, vignette, light leaks, scanlines, date stamps), in the spirit of disposable/film camera apps.
- **PROFESSIONAL** — five clean color grades (neutral, warm portrait, cinematic teal/orange, monochrome, vivid) with no grain — built for sharp, true-to-life shots.

Every photo is processed live in the viewfinder and on capture using `<canvas>` — nothing is uploaded anywhere. Photos are stored locally in the browser (IndexedDB) as "Your Roll," and can be saved to the device's real camera roll with one tap.

It's a installable Progressive Web App (PWA), so on iPhone it can be added to the Home Screen and used like a native camera replacement.

## Features

- Live front/back camera switch, simulated/real flash (torch where supported)
- 10 total looks across the two modes, each with its own grain, vignette, light leak, split-tone or scanline treatment
- Film-style frame counter that persists across sessions
- In-app "Your Roll" gallery (IndexedDB) — works fully offline
- One-tap **Save to Photos** using the native Share Sheet (`navigator.share`) with a download fallback
- Installable PWA with offline app-shell caching via a service worker
- No backend, no analytics, no external requests — 100% client-side

## Run it locally

Camera access requires HTTPS or `localhost`. Any static file server works:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` (or the port `serve` gives you) in a browser and allow camera access.

## Deploy: GitHub → Netlify

1. **Create a GitHub repo** and push this folder:

   ```bash
   cd leader-camera
   git init
   git add .
   git commit -m "Initial commit: Leader camera app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. **Connect Netlify to the repo:**
   - Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**.
   - Pick GitHub, authorize, then select your repo.
   - Build command: leave **blank** (there's nothing to build).
   - Publish directory: `.` (the repo root — already set in `netlify.toml`).
   - Click **Deploy site**.

3. Netlify will give you a `https://<random-name>.netlify.app` URL immediately. You can rename the site or attach a custom domain under **Site configuration → Domain management**.

That's it — every push to `main` will auto-redeploy.

## Installing it on your iPhone like a camera app

1. Open the Netlify URL in **Safari** on your iPhone (camera access and "Add to Home Screen" both require Safari, not in-app browsers).
2. Tap the **Share** icon → **Add to Home Screen**.
3. Launch it from the Home Screen icon — it opens full-screen, no browser chrome, just like a native camera app.
4. Take a photo, then tap **Save to Photos** in the viewer (or tap your last shot's thumbnail → open it → **Save to Photos**). iOS will show its native share sheet — choose **Save Image** to drop it straight into your camera roll.

> iOS restricts what web apps can do compared to a native camera app — this app cannot bypass the Photos permission prompt the very first time you save an image, and it cannot replace the system Camera app as your default. What it *can* do is feel and behave like a dedicated camera app once installed, with on-device processing and a real save-to-roll flow.

## Project structure

```
leader-camera/
├── index.html        # App markup
├── style.css         # Design system (film/digital camera aesthetic)
├── app.js            # Camera, render pipeline, storage, gallery, save logic
├── manifest.json      # PWA manifest
├── sw.js              # Service worker (offline app-shell cache)
├── netlify.toml        # Netlify build/headers/redirects config
└── icons/
    ├── icon.svg
    ├── icon-180.png
    ├── icon-192.png
    └── icon-512.png
```

## Customizing looks

All looks live in `LOOKS` at the top of `app.js`. Each look is a plain object:

```js
{
  id: 'kodacolor', name: 'KODACOLOR 400', short: 'KC',
  css: 'contrast(1.06) saturate(1.18) brightness(1.04) sepia(0.08)', // canvas filter string
  grain: 0.16,        // 0–1 grain opacity
  vignette: 0.28,      // 0–1 edge darkening
  leak: { color: 'rgba(255,150,60,0.35)', corner: 'tr' }, // optional light leak
  tint: 'rgba(255,196,128,0.05)', // optional color wash
  scanlines: true,     // optional CRT lines
  splitTone: { shadow: '...', hi: '...' }, // optional shadow/highlight grade
  stamp: true,          // optional date-stamp burn-in
}
```

Add, remove, or tweak entries in `LOOKS.digital` / `LOOKS.pro` and the dial UI updates automatically.

## Browser support notes

- Works best in **Safari on iOS** and any modern Chromium/Firefox browser.
- `navigator.share` with files (used for "Save to Photos") is supported in iOS Safari 15+ and most modern mobile browsers. Where it isn't available, the app falls back to a direct download you can long-press to save.
- Torch/flash control depends on device hardware; most phone front cameras and many laptops don't expose a torch, so the app simulates a flash pop on capture in those cases.
