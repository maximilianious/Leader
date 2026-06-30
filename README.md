# LEADER — Digital Film & Professional Camera

A camera web app with two personalities:

- **DIGITAL** — five film-style looks (grain, vignette, light leaks, scanlines, date stamps), in the spirit of disposable/film camera apps.
- **PROFESSIONAL** — five clean color grades (neutral, warm portrait, cinematic teal/orange, monochrome, vivid) with no grain — built for sharp, true-to-life shots.

Every photo is processed live in the viewfinder and on capture using `<canvas>` — nothing is uploaded anywhere. Photos are stored locally in the browser (IndexedDB) as "Your Roll," and can be saved to the device's real camera roll with one tap.

It's a installable Progressive Web App (PWA), so on iPhone it can be added to the Home Screen and used like a native camera replacement.

## Features

- **Photo and video capture** — switch between Photo and Video with one tap; video records sound once the microphone is enabled (see below)
- **Quality control** — Photo defaults to 4K, Video defaults to 1080p/30fps. Photo quality (4K/1080p/720p) and video resolution (720p/1080p/4K) and frame rate (24/30/60fps) are all independently switchable in Settings, so e.g. 4K·60fps or 720p·24fps both work if the device's camera supports them
- **Zoom** — quick 0.5×/1×/2×/3× presets below the preview, plus pinch-to-zoom on the viewfinder for anything in between or beyond. 0.5× switches to the phone's ultra-wide lens when one is detected (falls back gracefully with a toast if the device doesn't have one); 1× and up are a fast digital crop applied identically to the live preview, captures, and recordings
- Live front/back camera switch (sitting in its own row right below the preview), simulated/real flash (torch where supported)
- **Aspect ratio control** — 4:3 (default), 5:4, 3:2, 1:1, 16:9, or Full, switchable from a quick pill in the header (cycles through all six) or precisely from Settings
- 11 total looks across the two modes, each with its own grain, vignette, light leak, split-tone or scanline treatment. **FXN R** is the default Digital look
- **Date stamp toggle** — turn the film-style date burn-in on or off for every look at once, in Settings
- **Orientation-aware** — rotating the phone to landscape (either side) or upside-down is detected live; the flip, settings, gallery, and flash icons rotate to stay upright the way a native camera app's do, while the control layout itself stays put and every feature keeps working
- Looks live in a collapsible drawer; mode switches are compact two-up segmented pills, so the controls stay out of the way and the live preview gets most of the screen
- Film-style frame counter that persists across sessions
- In-app **"Your Roll"** gallery (IndexedDB) — works fully offline, holds both photos and videos, and scrolls as a normal page instead of being boxed into a fixed grid
- Swipe left/right (or use the on-screen arrows / arrow keys) to move between items in the roll viewer
- **Saves straight to your camera roll, not the Files app** — on by default, toggleable in Settings. Every capture is offered through the native Share Sheet's "Save Image"/"Save Video" action; if that's unavailable, the app opens the photo/video full-screen so a long-press can save it to Photos directly. There's intentionally no download-link fallback, since that's what sends files to the Files app instead of Photos
- The camera permission is only ever requested once per browser/device, and the microphone permission is requested exactly once — the first time you tap **Video** — never inside the recording flow itself
- Tuned to stay cool: the live preview caches its gradient/vignette/light-leak/grain artwork instead of rebuilding it every frame, runs at a capped 30fps, and fully releases the camera whenever the app is backgrounded or a sheet (gallery, viewer, settings) covers the preview
- Installable PWA with offline app-shell caching via a service worker
- No backend, no analytics, no external requests, no accounts — 100% client-side, open source

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

> iOS restricts what web apps can do compared to a native camera app — this app cannot bypass the Photos permission prompt the very first time you save an image, and it cannot replace the system Camera app as your default. What it *can* do is feel and behave like a dedicated camera app once installed, with on-device processing and an automatic save-to-roll flow. Browsers (and iOS specifically) remember a granted camera permission themselves, and this app additionally remembers locally that you've granted it before so it never shows its own permission screen again unless access is actually revoked.

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
