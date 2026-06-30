/* ============================================================
   LEADER — a two-personality camera (Digital film / Professional)
   All processing happens on-device. No network calls, no analytics.
   Settings, the permission flag, and the roll itself never leave
   this browser/device (localStorage + IndexedDB only).
   ============================================================ */

(() => {
  'use strict';

  /* ---------------- Look definitions ---------------- */
  // FXN R sits first in the Digital array, which makes it the default look.
  const LOOKS = {
    digital: [
      {
        id: 'fxnr', name: 'FXN R', short: 'FX',
        css: 'contrast(1.3) saturate(0.8) brightness(1.07) hue-rotate(-8deg)',
        grain: 0.22, vignette: 0.34,
        leak: null, tint: 'rgba(150,195,185,0.07)', stamp: true, flashy: true,
      },
      {
        id: 'kodacolor', name: 'KODACOLOR 400', short: 'KC',
        css: 'contrast(1.06) saturate(1.18) brightness(1.04) sepia(0.08)',
        grain: 0.16, vignette: 0.28,
        leak: { color: 'rgba(255,150,60,0.35)', corner: 'tr' },
        tint: 'rgba(255,196,128,0.05)', stamp: true,
      },
      {
        id: 'disposable', name: 'DISPOSABLE FLASH', short: 'DF',
        css: 'contrast(1.22) saturate(0.92) brightness(1.1) hue-rotate(-4deg)',
        grain: 0.32, vignette: 0.48,
        leak: null, tint: 'rgba(140,170,255,0.05)', stamp: true, flashy: true,
      },
      {
        id: 'vhs', name: 'VHS NIGHT', short: 'VHS',
        css: 'contrast(1.12) saturate(0.55) brightness(0.95) hue-rotate(6deg)',
        grain: 0.34, vignette: 0.4, scanlines: true,
        tint: 'rgba(60,255,150,0.04)', stamp: true, chroma: true,
      },
      {
        id: 'sunbleached', name: 'SUNBLEACHED', short: 'SB',
        css: 'contrast(0.92) saturate(1.05) brightness(1.16) sepia(0.18)',
        grain: 0.12, vignette: 0.18,
        leak: { color: 'rgba(255,225,160,0.5)', corner: 'tl' },
        tint: 'rgba(255,232,190,0.07)', stamp: true,
      },
      {
        id: 'noirgrain', name: 'NOIR GRAIN', short: 'NG',
        css: 'grayscale(1) contrast(1.35) brightness(0.98)',
        grain: 0.30, vignette: 0.52, tint: null, stamp: true,
      },
    ],
    pro: [
      {
        id: 'studio', name: 'STUDIO NEUTRAL', short: 'SN',
        css: 'contrast(1.07) saturate(1.04) brightness(1.01)',
        grain: 0, vignette: 0.06, sharpen: true,
      },
      {
        id: 'portra', name: 'PORTRA WARM', short: 'PW',
        css: 'contrast(1.04) saturate(1.08) brightness(1.03) sepia(0.05)',
        grain: 0.03, vignette: 0.1, sharpen: true,
        tint: 'rgba(255,210,170,0.04)',
      },
      {
        id: 'cineteal', name: 'CINEMATIC TEAL', short: 'CT',
        css: 'contrast(1.16) saturate(1.1) brightness(1.0)',
        grain: 0.02, vignette: 0.22, sharpen: true,
        splitTone: { shadow: 'rgba(10,55,60,0.30)', hi: 'rgba(255,170,90,0.16)' },
      },
      {
        id: 'monopro', name: 'MONOCHROME PRO', short: 'MP',
        css: 'grayscale(1) contrast(1.22) brightness(1.02)',
        grain: 0, vignette: 0.16, sharpen: true,
      },
      {
        id: 'vivid', name: 'VIVID HDR', short: 'VH',
        css: 'contrast(1.2) saturate(1.45) brightness(1.02)',
        grain: 0, vignette: 0.12, sharpen: true,
      },
    ],
  };

  const ASPECTS = {
    '4:3': { ratio: 3 / 4, label: '4:3', desc: '4:3 — classic frame' },
    '5:4': { ratio: 4 / 5, label: '5:4', desc: '5:4 — near-square frame' },
    '3:2': { ratio: 2 / 3, label: '3:2', desc: '3:2 — classic 35mm frame' },
    '1:1': { ratio: 1, label: '1:1', desc: '1:1 — square frame' },
    '16:9': { ratio: 9 / 16, label: '16:9', desc: '16:9 — widescreen frame' },
    full: { ratio: null, label: 'Full', desc: 'Full — fills the screen' },
  };
  const ASPECT_ORDER = ['4:3', '5:4', '3:2', '1:1', '16:9', 'full'];

  // Photo quality controls the camera sensor resolution requested while in Photo mode.
  const PHOTO_QUALITIES = {
    '4k': { width: 3840, height: 2160, frameRate: 30 },
    '1080p': { width: 1920, height: 1080, frameRate: 30 },
    '720p': { width: 1280, height: 720, frameRate: 30 },
  };
  // Video resolution and frame rate are independent dials — every resolution can be
  // paired with 24/30/60fps. Lower combinations record cooler & with smaller files.
  const VIDEO_RESOLUTIONS = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '4k': { width: 3840, height: 2160 },
  };
  const VIDEO_FPS_OPTIONS = [24, 30, 60];

  /* ---------------- Persisted preferences ---------------- */
  const PREF = {
    frame: 'leader_frame',
    aspect: 'leader_aspect',
    autoSave: 'leader_autosave',
    cameraGranted: 'leader_camera_granted',
    photoQuality: 'leader_photo_quality',
    videoResolution: 'leader_video_resolution',
    videoFps: 'leader_video_fps',
    stamp: 'leader_stamp_enabled',
  };

  /* ---------------- State ---------------- */
  const state = {
    mode: 'digital',
    captureMode: 'photo', // 'photo' | 'video'
    lookIndex: 0,
    aspect: localStorage.getItem(PREF.aspect) || '4:3',
    photoQuality: localStorage.getItem(PREF.photoQuality) || '4k',
    videoResolution: localStorage.getItem(PREF.videoResolution) || '1080p',
    videoFps: Number(localStorage.getItem(PREF.videoFps) || '30'),
    facing: 'environment',
    stream: null,
    track: null,
    flash: false,
    autoSave: localStorage.getItem(PREF.autoSave) !== 'false', // default true
    stampEnabled: localStorage.getItem(PREF.stamp) !== 'false', // default true
    frame: Number(localStorage.getItem(PREF.frame) || '0'),
    noiseTiles: [],
    noiseIdx: 0,
    noisePatternCache: new WeakMap(),
    overlayCacheKey: '',
    overlayCacheLayers: null,
    rafId: null,
    recording: false,
    recorder: null,
    recChunks: [],
    recStart: 0,
    recTimerId: null,
    rollCache: [],
    viewerIndex: -1,
    micTrack: null,
    micRequested: localStorage.getItem('leader_mic_requested') === 'true',
    shutterReady: false,    // guards against a stray click bleeding through the native permission sheet
    renderPaused: false,    // true while gallery/viewer/settings cover the camera
    lastFrameTime: 0,
    zoom: 1,                // digital zoom multiplier applied on top of whichever lens is active
    zoomMax: 4,
    activeDeviceId: null,   // explicit lens override (ultra-wide / telephoto), null = default facingMode lens
    cameraDevices: { back: {}, front: {} }, // discovered lens deviceIds, keyed by facing
    devicesScanned: false,
  };

  /* ---------------- DOM ---------------- */
  const $ = (id) => document.getElementById(id);
  const video = $('video');
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  const captureCanvas = $('captureCanvas');
  const permMsg = $('permMsg');
  const fcNum = $('fcNum');
  const dial = $('dial');
  const dialDrawer = $('dialDrawer');
  const lookToggle = $('lookToggle');
  const ltChip = $('ltChip');
  const ltName = $('ltName');
  const thumbFrame = $('thumbFrame');
  const toastEl = $('toast');
  const viewfinder = $('viewfinder');
  const viewfinderWrap = $('viewfinderWrap');
  const btnAspect = $('btnAspect');
  const recTimer = $('recTimer');
  const recTime = $('recTime');
  const btnShutter = $('btnShutter');
  const zoomBadge = $('zoomBadge');
  const zoomCluster = $('zoomCluster');
  const appEl = $('app');

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  /* ---------------- IndexedDB roll store ---------------- */
  const DB_NAME = 'leader-roll';
  const STORE = 'photos'; // holds both photos and videos, distinguished by `type`
  let dbPromise = null;
  function getDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  async function dbAdd(record) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function dbAll() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.ts - a.ts));
      req.onerror = () => reject(req.error);
    });
  }
  async function dbDelete(id) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ---------------- Camera ---------------- */
  function activeQuality() {
    if (state.captureMode === 'video') {
      const r = VIDEO_RESOLUTIONS[state.videoResolution];
      return { width: r.width, height: r.height, frameRate: state.videoFps };
    }
    return PHOTO_QUALITIES[state.photoQuality];
  }

  async function startCamera() {
    stopCamera();
    state.shutterReady = false;
    try {
      const q = activeQuality();
      const videoConstraints = {
        width: { ideal: q.width },
        height: { ideal: q.height },
        frameRate: { ideal: q.frameRate, max: q.frameRate },
      };
      if (state.activeDeviceId) videoConstraints.deviceId = { exact: state.activeDeviceId };
      else videoConstraints.facingMode = state.facing;

      const constraints = { audio: false, video: videoConstraints }; // no mic request here — single permission prompt
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      state.stream = stream;
      state.track = stream.getVideoTracks()[0];
      video.srcObject = stream;
      await video.play();
      permMsg.classList.add('hidden');
      video.classList.toggle('mirror', state.facing === 'user');
      localStorage.setItem(PREF.cameraGranted, 'true');
      layoutViewfinder();
      invalidateOverlayCache();
      runLoop();
      syncZoomCapabilities();
      if (!state.devicesScanned) { state.devicesScanned = true; refreshDeviceList(); }
      // Ignore the shutter briefly: WebKit can deliver a stray synthetic click at the
      // same screen coordinates right after the native camera-permission sheet is
      // dismissed, which otherwise looks like the user tapped the shutter/record button.
      setTimeout(() => { state.shutterReady = true; }, 700);
    } catch (err) {
      console.warn('Camera error', err);
      // If an explicit lens (ultra-wide/tele) failed, fall back to the default lens
      // for this facing direction instead of leaving the preview dead.
      if (state.activeDeviceId) {
        state.activeDeviceId = null;
        state.zoom = 1;
        return startCamera();
      }
      permMsg.classList.remove('hidden');
      permMsg.querySelector('.pm-title').textContent =
        err.name === 'NotAllowedError' ? 'Camera access denied' : 'Camera unavailable';
      permMsg.querySelector('.pm-body').textContent =
        err.name === 'NotAllowedError'
          ? 'Allow camera access in your browser settings, then reload.'
          : 'This device or browser could not start the camera.';
    }
  }
  function stopCamera() {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = null;
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
    state.track = null;
  }

  // Release the camera while the tab/app is backgrounded, and while the gallery,
  // viewer, or settings sheet are covering the live preview — this is the single
  // biggest win for heat and battery, since a hidden camera+render loop still
  // burns CPU/GPU otherwise.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopCamera();
    } else if (!state.recording) {
      startCamera();
    }
  });

  /* ---------------- Zoom: lens discovery + digital crop ---------------- */
  // Most phones expose a wide, an ultra-wide, and sometimes a telephoto lens as
  // separate camera devices rather than as a single zoom range — Safari in
  // particular has no reliable optical zoom API, so we detect those lenses by
  // device label (only readable once permission is granted) and switch the whole
  // stream to the matching device for 0.5x. Anything at 1x and above is handled
  // as a fast, lossless-feeling digital crop on top of whichever lens is active.
  async function refreshDeviceList() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === 'videoinput');
      const back = {}; const front = {};
      cams.forEach((d) => {
        const label = (d.label || '').toLowerCase();
        const bucket = label.includes('front') ? front : back;
        if (label.includes('ultra')) bucket.ultrawide = d.deviceId;
        else if (label.includes('tele')) bucket.tele = d.deviceId;
        else if (!bucket.wide) bucket.wide = d.deviceId;
      });
      state.cameraDevices = { back, front };
      updateZoomCluster();
    } catch (e) { /* enumerateDevices can fail quietly in some embedded webviews */ }
  }
  function lensesForFacing() {
    return state.facing === 'user' ? state.cameraDevices.front : state.cameraDevices.back;
  }
  function syncZoomCapabilities() {
    let max = 4;
    if (state.track && state.track.getCapabilities) {
      const caps = state.track.getCapabilities();
      if (caps.zoom && caps.zoom.max) max = Math.max(2, Math.min(caps.zoom.max, 8));
    }
    state.zoomMax = max;
    updateZoomCluster();
  }
  function updateZoomCluster() {
    const lenses = lensesForFacing();
    const has05 = !!lenses.ultrawide;
    zoomCluster.querySelectorAll('.zoom-btn').forEach((b) => {
      const v = Number(b.dataset.zoom);
      if (v === 0.5) b.classList.toggle('hidden', !has05);
      if (v > state.zoomMax) b.classList.toggle('hidden', true);
      else if (v !== 0.5) b.classList.remove('hidden');
    });
  }
  async function setZoomPreset(target) {
    const lenses = lensesForFacing();
    if (target === 0.5) {
      if (!lenses.ultrawide) { toast('Ultra-wide isn\u2019t available on this device'); return; }
      state.activeDeviceId = lenses.ultrawide;
      state.zoom = 1;
      await startCamera();
    } else {
      if (state.activeDeviceId && state.activeDeviceId !== lenses.wide) {
        state.activeDeviceId = lenses.wide || null;
        state.zoom = target;
        await startCamera();
      } else {
        state.zoom = Math.min(target, state.zoomMax);
      }
    }
    highlightZoomPreset(target);
  }
  function highlightZoomPreset(value) {
    let closest = null, dist = Infinity;
    zoomCluster.querySelectorAll('.zoom-btn:not(.hidden)').forEach((b) => {
      const v = Number(b.dataset.zoom);
      const d = Math.abs(v - value);
      if (d < dist) { dist = d; closest = b; }
    });
    zoomCluster.querySelectorAll('.zoom-btn').forEach((b) => b.classList.toggle('active', b === closest));
  }
  zoomCluster.querySelectorAll('.zoom-btn').forEach((b) => {
    b.addEventListener('click', () => setZoomPreset(Number(b.dataset.zoom)));
  });

  let pinchStartDist = null, pinchStartZoom = 1, zoomBadgeTimer = null;
  function showZoomBadge() {
    zoomBadge.textContent = `${state.zoom.toFixed(1)}×`;
    zoomBadge.classList.remove('hidden');
    clearTimeout(zoomBadgeTimer);
    zoomBadgeTimer = setTimeout(() => zoomBadge.classList.add('hidden'), 900);
  }
  viewfinder.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchStartZoom = state.zoom;
    }
  }, { passive: true });
  viewfinder.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchStartDist) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const next = pinchStartZoom * (dist / pinchStartDist);
      state.zoom = Math.min(state.zoomMax, Math.max(1, next));
      showZoomBadge();
      highlightZoomPreset(state.zoom);
    }
  }, { passive: true });
  viewfinder.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pinchStartDist = null;
  }, { passive: true });

  /* ---------------- Viewfinder sizing (fills the screen, no overflow) ---------------- */
  function layoutViewfinder() {
    const wrapRect = viewfinderWrap.getBoundingClientRect();
    const def = ASPECTS[state.aspect];
    let w, h;
    if (!def.ratio) {
      w = wrapRect.width; h = wrapRect.height;
    } else {
      w = wrapRect.width; h = w / def.ratio;
      if (h > wrapRect.height) { h = wrapRect.height; w = h * def.ratio; }
    }
    viewfinder.style.width = `${Math.round(w)}px`;
    viewfinder.style.height = `${Math.round(h)}px`;
    resizeCanvas();
  }
  function resizeCanvas() {
    const rect = viewfinder.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }
  window.addEventListener('resize', layoutViewfinder);

  /* ---------------- Orientation ---------------- */
  // Detect portrait / landscape-left / landscape-right / upside-down and expose it
  // as data-rot on the app root. CSS uses that to keep plain icon glyphs (flip,
  // settings, gallery, flash) upright, the way a native camera app would, without
  // reflowing the rest of the layout — the control bar itself stays put.
  function readOrientationAngle() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
    if (typeof window.orientation === 'number') return ((window.orientation % 360) + 360) % 360;
    return 0;
  }
  function updateOrientation() {
    const angle = readOrientationAngle();
    appEl.dataset.rot = String(angle);
    layoutViewfinder();
  }
  if (screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener('change', updateOrientation);
  } else {
    window.addEventListener('orientationchange', updateOrientation);
  }
  updateOrientation();

  /* ---------------- Noise tiles (pre-baked grain) ---------------- */
  function makeNoiseTile(size = 180) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const cx = c.getContext('2d');
    const imgData = cx.createImageData(size, size);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 255;
      imgData.data[i] = v; imgData.data[i + 1] = v; imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
    }
    cx.putImageData(imgData, 0, 0);
    return c;
  }
  for (let i = 0; i < 6; i++) state.noiseTiles.push(makeNoiseTile());

  /* ---------------- Render pipeline ---------------- */
  function getLook() { return LOOKS[state.mode][state.lookIndex]; }

  function drawCover(targetCtx, vidEl, w, h, zoom = 1) {
    const vw = vidEl.videoWidth, vh = vidEl.videoHeight;
    if (!vw || !vh) return;
    const vRatio = vw / vh, cRatio = w / h;
    let sx, sy, sw, sh;
    if (vRatio > cRatio) { sh = vh; sw = vh * cRatio; sx = (vw - sw) / 2; sy = 0; }
    else { sw = vw; sh = vw / cRatio; sx = 0; sy = (vh - sh) / 2; }
    if (zoom > 1) {
      const nsw = sw / zoom, nsh = sh / zoom;
      sx += (sw - nsw) / 2; sy += (sh - nsh) / 2;
      sw = nsw; sh = nsh;
    }
    targetCtx.drawImage(vidEl, sx, sy, sw, sh, 0, 0, w, h);
  }

  function drawVignette(c, w, h, amount) {
    if (amount <= 0) return;
    const g = c.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${amount})`);
    c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
  }
  function drawLeak(c, w, h, leak) {
    if (!leak) return;
    const positions = { tl: [0, 0], tr: [w, 0], bl: [0, h], br: [w, h] };
    const [x, y] = positions[leak.corner] || [w, 0];
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.6);
    g.addColorStop(0, leak.color); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
  }
  function drawSplitTone(c, w, h, st) {
    if (!st) return;
    c.save(); c.globalCompositeOperation = 'overlay';
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, st.hi); g.addColorStop(1, st.shadow);
    c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
  }
  function drawTint(c, w, h, tint) {
    if (!tint) return;
    c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = tint; c.fillRect(0, 0, w, h); c.restore();
  }
  function drawScanlinesShape(c, w, h) {
    c.save(); c.fillStyle = '#000';
    for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
    c.restore();
  }

  // Vignette / light-leak / split-tone / scanline shapes are pure gradients & patterns
  // that don't depend on the live video frame — building a fresh CanvasGradient and
  // filling the whole canvas for each of them, every single animation frame, was the
  // single biggest cost in the render loop. We bake each shape into an offscreen
  // canvas once per look + canvas size, then every frame just blits that cached
  // bitmap with the correct blend mode — the blend itself still reacts live to
  // whatever the camera frame underneath is, only the *shape* is cached.
  function buildOverlayLayers(look, w, h) {
    const layers = {};
    if (look.vignette > 0) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      drawVignette(c.getContext('2d'), w, h, look.vignette);
      layers.vignette = c;
    }
    if (look.leak) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      drawLeak(c.getContext('2d'), w, h, look.leak);
      layers.leak = c;
    }
    if (look.splitTone) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      drawSplitTone(c.getContext('2d'), w, h, look.splitTone);
      layers.splitTone = c;
    }
    if (look.scanlines) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      drawScanlinesShape(c.getContext('2d'), w, h);
      layers.scanlines = c;
    }
    return layers;
  }
  function getOverlayLayers(look, w, h) {
    const key = `${look.id}:${w}x${h}`;
    if (state.overlayCacheKey !== key) {
      state.overlayCacheKey = key;
      state.overlayCacheLayers = buildOverlayLayers(look, w, h);
    }
    return state.overlayCacheLayers;
  }
  function invalidateOverlayCache() { state.overlayCacheKey = ''; state.overlayCacheLayers = null; }

  function getNoisePatterns(targetCtx) {
    let patterns = state.noisePatternCache.get(targetCtx);
    if (!patterns) {
      patterns = state.noiseTiles.map((tile) => targetCtx.createPattern(tile, 'repeat'));
      state.noisePatternCache.set(targetCtx, patterns);
    }
    return patterns;
  }
  function drawGrain(targetCtx, w, h, amount, animated) {
    if (amount <= 0) return;
    const patterns = getNoisePatterns(targetCtx);
    const pattern = patterns[state.noiseIdx];
    if (animated) state.noiseIdx = (state.noiseIdx + 1) % patterns.length;
    targetCtx.save();
    targetCtx.globalCompositeOperation = 'overlay';
    targetCtx.globalAlpha = Math.min(amount, 0.6);
    targetCtx.fillStyle = pattern;
    targetCtx.fillRect(0, 0, w, h);
    targetCtx.restore();
  }
  function drawStamp(c, w, h, look) {
    if (!look.stamp || !state.stampEnabled) return;
    const now = new Date();
    const txt = `${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')} '${String(now.getFullYear()).slice(2)}`;
    const size = Math.max(14, w * 0.026);
    c.save();
    c.font = `${size}px "JetBrains Mono", monospace`;
    c.textAlign = 'right'; c.textBaseline = 'bottom';
    const px = w - w * 0.035, py = h - h * 0.03;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillText(txt, px + size * 0.06, py + size * 0.06);
    c.fillStyle = '#ff8a1f'; c.fillText(txt, px, py);
    c.restore();
  }

  function render(targetCtx, w, h, look, opts = {}) {
    const { animatedGrain = true, mirror = false, useCache = true } = opts;
    targetCtx.save();
    if (mirror) { targetCtx.translate(w, 0); targetCtx.scale(-1, 1); }
    targetCtx.filter = look.css;
    drawCover(targetCtx, video, w, h, state.zoom);
    targetCtx.restore();
    targetCtx.filter = 'none';

    drawTint(targetCtx, w, h, look.tint);

    if (useCache) {
      const layers = getOverlayLayers(look, w, h);
      if (layers.splitTone) { targetCtx.save(); targetCtx.globalCompositeOperation = 'overlay'; targetCtx.drawImage(layers.splitTone, 0, 0); targetCtx.restore(); }
      if (layers.leak) { targetCtx.save(); targetCtx.globalCompositeOperation = 'screen'; targetCtx.drawImage(layers.leak, 0, 0); targetCtx.restore(); }
      if (layers.vignette) { targetCtx.save(); targetCtx.globalCompositeOperation = 'multiply'; targetCtx.drawImage(layers.vignette, 0, 0); targetCtx.restore(); }
      if (layers.scanlines) { targetCtx.save(); targetCtx.globalCompositeOperation = 'multiply'; targetCtx.globalAlpha = 0.5; targetCtx.drawImage(layers.scanlines, 0, 0); targetCtx.restore(); }
    } else {
      // High-quality, uncached one-off pass used only for the still capture canvas.
      drawSplitTone(targetCtx, w, h, look.splitTone);
      drawLeak(targetCtx, w, h, look.leak);
      drawVignette(targetCtx, w, h, look.vignette);
      if (look.scanlines) { const s = document.createElement('canvas'); s.width = w; s.height = h; drawScanlinesShape(s.getContext('2d'), w, h); targetCtx.save(); targetCtx.globalCompositeOperation = 'multiply'; targetCtx.globalAlpha = 0.5; targetCtx.drawImage(s, 0, 0); targetCtx.restore(); }
    }
    drawGrain(targetCtx, w, h, look.grain, animatedGrain);
  }

  const TARGET_FPS = 30; // live preview cap — recording itself uses the quality setting's own fps
  const FRAME_BUDGET = 1000 / TARGET_FPS;

  function runLoop() {
    function frame(now) {
      if (!state.renderPaused && video.readyState >= 2 && canvas.width && canvas.height) {
        if (now - state.lastFrameTime >= FRAME_BUDGET) {
          state.lastFrameTime = now;
          render(ctx, canvas.width, canvas.height, getLook(), { animatedGrain: true, mirror: state.facing === 'user' });
        }
      }
      state.rafId = requestAnimationFrame(frame);
    }
    state.rafId = requestAnimationFrame(frame);
  }

  /* ---------------- Aspect ratio control ---------------- */
  function setAspect(key) {
    state.aspect = key;
    localStorage.setItem(PREF.aspect, key);
    btnAspect.textContent = ASPECTS[key].label;
    viewfinder.dataset.aspect = key;
    document.getElementById('aspectSettingDesc').textContent = ASPECTS[key].desc;
    document.querySelectorAll('#aspectSettingSwitch .seg-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.aspect === key));
    layoutViewfinder();
  }
  btnAspect.addEventListener('click', () => {
    const idx = ASPECT_ORDER.indexOf(state.aspect);
    setAspect(ASPECT_ORDER[(idx + 1) % ASPECT_ORDER.length]);
  });
  document.querySelectorAll('#aspectSettingSwitch .seg-btn').forEach((b) => {
    b.addEventListener('click', () => setAspect(b.dataset.aspect));
  });

  /* ---------------- Quality control ---------------- */
  const PHOTO_Q_LABEL = { '4k': '4K', '1080p': '1080p', '720p': '720p' };

  function setPhotoQuality(key, restart = true) {
    state.photoQuality = key;
    localStorage.setItem(PREF.photoQuality, key);
    document.querySelectorAll('#photoQualitySwitch .seg-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.photoQuality === key));
    if (restart && state.captureMode === 'photo' && !state.recording) startCamera();
  }
  function setVideoResolution(key, restart = true) {
    state.videoResolution = key;
    localStorage.setItem(PREF.videoResolution, key);
    document.querySelectorAll('#videoResSwitch .seg-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.videoRes === key));
    if (restart && state.captureMode === 'video' && !state.recording) startCamera();
  }
  function setVideoFps(fps, restart = true) {
    state.videoFps = fps;
    localStorage.setItem(PREF.videoFps, String(fps));
    document.querySelectorAll('#videoFpsSwitch .seg-btn').forEach((b) =>
      b.classList.toggle('active', Number(b.dataset.videoFps) === fps));
    if (restart && state.captureMode === 'video' && !state.recording) startCamera();
  }
  document.querySelectorAll('#photoQualitySwitch .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      if (state.recording) { toast('Stop recording first'); return; }
      setPhotoQuality(b.dataset.photoQuality);
      toast(`Photo quality: ${PHOTO_Q_LABEL[b.dataset.photoQuality]}`);
    });
  });
  document.querySelectorAll('#videoResSwitch .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      if (state.recording) { toast('Stop recording first'); return; }
      setVideoResolution(b.dataset.videoRes);
      toast(`Video resolution: ${b.dataset.videoRes}`);
    });
  });
  document.querySelectorAll('#videoFpsSwitch .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      if (state.recording) { toast('Stop recording first'); return; }
      setVideoFps(Number(b.dataset.videoFps));
      toast(`Video frame rate: ${b.dataset.videoFps}fps`);
    });
  });

  /* ---------------- Dial / mode UI ---------------- */
  function buildDial() {
    dial.innerHTML = '';
    LOOKS[state.mode].forEach((look, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.innerHTML = `<button class="dial-chip" type="button"><span>${look.short}</span></button><span class="dial-name">${look.name.split(' ')[0]}</span>`;
      if (i === state.lookIndex) li.classList.add('active');
      li.addEventListener('click', () => selectLook(i));
      dial.appendChild(li);
    });
    updateLookLabel();
    scrollDialIntoView();
  }
  function selectLook(i) {
    const len = LOOKS[state.mode].length;
    state.lookIndex = ((i % len) + len) % len;
    [...dial.children].forEach((li, idx) => li.classList.toggle('active', idx === state.lookIndex));
    updateLookLabel();
    scrollDialIntoView();
  }
  function scrollDialIntoView() {
    const active = dial.children[state.lookIndex];
    if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  function updateLookLabel() {
    const look = getLook();
    ltChip.textContent = look.short;
    ltName.textContent = look.name;
    document.getElementById('lookInfo').textContent = lookDescription(look);
  }
  function lookDescription(look) {
    const bits = [];
    if (look.grain) bits.push('grain');
    if (look.vignette) bits.push('vignette');
    if (look.leak) bits.push('light leak');
    if (look.scanlines) bits.push('scanlines');
    if (look.splitTone) bits.push('split-tone grade');
    if (look.sharpen) bits.push('clarity boost');
    return `${look.name} — ${bits.join(', ') || 'clean & neutral'}`;
  }

  $('dialLeft').addEventListener('click', () => selectLook(state.lookIndex - 1));
  $('dialRight').addEventListener('click', () => selectLook(state.lookIndex + 1));

  lookToggle.addEventListener('click', () => {
    const open = dialDrawer.classList.toggle('open');
    lookToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.querySelectorAll('#gradeModeSwitch .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#gradeModeSwitch .seg-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      state.mode = btn.dataset.mode;
      state.lookIndex = 0;
      buildDial();
    });
  });

  /* ---------------- Microphone (requested once, only for video) ---------------- */
  async function ensureMic() {
    if (state.micTrack || state.micRequested) return;
    state.micRequested = true;
    localStorage.setItem('leader_mic_requested', 'true');
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.micTrack = micStream.getAudioTracks()[0];
      toast('Microphone enabled — videos will record sound');
    } catch (err) {
      toast('Recording without sound — microphone access wasn\u2019t granted');
    }
  }

  document.querySelectorAll('#captureModeSwitch .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.recording) { toast('Stop recording first'); return; }
      if (btn.dataset.capture === state.captureMode) return;
      document.querySelectorAll('#captureModeSwitch .seg-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      state.captureMode = btn.dataset.capture;
      btnShutter.setAttribute('aria-label', state.captureMode === 'video' ? 'Record video' : 'Take photo');
      if (state.captureMode === 'video') ensureMic();
      startCamera(); // re-request the stream at this mode's quality preset
    });
  });

  /* ---------------- Flip / flash ---------------- */
  $('btnFlip').addEventListener('click', () => {
    if (state.recording) { toast('Stop recording first'); return; }
    state.facing = state.facing === 'user' ? 'environment' : 'user';
    state.activeDeviceId = null;
    state.zoom = 1;
    highlightZoomPreset(1);
    startCamera();
  });

  $('btnFlash').addEventListener('click', async () => {
    state.flash = !state.flash;
    const btn = $('btnFlash');
    btn.dataset.state = state.flash ? 'on' : 'off';
    if (state.track && state.track.getCapabilities && state.track.getCapabilities().torch) {
      try { await state.track.applyConstraints({ advanced: [{ torch: state.flash }] }); }
      catch (e) { /* torch not actually supported, ignore */ }
    } else if (state.flash) {
      toast('No hardware torch — flash will simulate a pop on capture');
    }
  });

  $('btnGrant').addEventListener('click', startCamera);

  /* ---------------- Settings sheet ---------------- */
  const settingsSheet = $('settingsSheet');
  const settingsBackdrop = $('settingsBackdrop');
  function openSettings() {
    settingsSheet.classList.remove('hidden');
    settingsBackdrop.classList.remove('hidden');
    state.renderPaused = true;
  }
  function closeSettings() {
    settingsSheet.classList.add('hidden');
    settingsBackdrop.classList.add('hidden');
    state.renderPaused = false;
  }
  $('btnSettings').addEventListener('click', openSettings);
  $('btnCloseSettings').addEventListener('click', closeSettings);
  settingsBackdrop.addEventListener('click', closeSettings);

  const toggleAutoSave = $('toggleAutoSave');
  toggleAutoSave.checked = state.autoSave;
  toggleAutoSave.addEventListener('change', () => {
    state.autoSave = toggleAutoSave.checked;
    localStorage.setItem(PREF.autoSave, String(state.autoSave));
    toast(state.autoSave ? 'Auto-save to Photos turned on' : 'Auto-save to Photos turned off');
  });

  const toggleStamp = $('toggleStamp');
  toggleStamp.checked = state.stampEnabled;
  toggleStamp.addEventListener('change', () => {
    state.stampEnabled = toggleStamp.checked;
    localStorage.setItem(PREF.stamp, String(state.stampEnabled));
    toast(state.stampEnabled ? 'Date stamp enabled' : 'Date stamp disabled');
  });

  /* ---------------- Capture: photo ---------------- */
  function fireFlashPop() {
    const el = document.getElementById('flashPop');
    el.classList.remove('fire');
    void el.offsetWidth;
    el.classList.add('fire');
  }

  function bumpFrameCounter() {
    state.frame += 1;
    localStorage.setItem(PREF.frame, String(state.frame));
    fcNum.textContent = String(state.frame).padStart(3, '0');
  }

  async function takePhoto() {
    if (!video.videoWidth) { toast('Camera still warming up…'); return; }
    btnShutter.classList.add('flashing');
    fireFlashPop();
    if (navigator.vibrate) navigator.vibrate(12);

    const look = getLook();
    const def = ASPECTS[state.aspect];
    const vw = video.videoWidth, vh = video.videoHeight;
    let tw, th;
    if (!def.ratio) { tw = vw; th = vh; }
    else if (vw / vh > def.ratio) { th = vh; tw = Math.round(vh * def.ratio); }
    else { tw = vw; th = Math.round(vw / def.ratio); }

    captureCanvas.width = tw;
    captureCanvas.height = th;
    const cctx = captureCanvas.getContext('2d');
    render(cctx, tw, th, look, { animatedGrain: false, mirror: state.facing === 'user' });
    drawStamp(cctx, tw, th, look);

    const blob = await new Promise((resolve) => captureCanvas.toBlob(resolve, 'image/jpeg', 0.92));
    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.92);

    bumpFrameCounter();

    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(), type: 'photo', mode: state.mode, lookName: look.name, blob,
    };
    await dbAdd(record);

    thumbFrame.innerHTML = `<img src="${dataUrl}" alt="Last photo" />`;

    setTimeout(() => btnShutter.classList.remove('flashing'), 220);
    toast(`Captured — ${look.name}`);
    refreshGalleryIfOpen();

    if (state.autoSave) offerSaveToPhotos(blob, `leader-${record.id}.jpg`, 'image/jpeg', record.id);
  }

  /* ---------------- Capture: video ---------------- */
  function pickRecorderMime() {
    const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (const m of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
  }

  function startRecTimer() {
    state.recStart = Date.now();
    recTimer.classList.remove('hidden');
    state.recTimerId = setInterval(() => {
      const s = Math.floor((Date.now() - state.recStart) / 1000);
      const mm = Math.floor(s / 60), ss = s % 60;
      recTime.textContent = `${mm}:${String(ss).padStart(2, '0')}`;
    }, 250);
  }
  function stopRecTimer() {
    clearInterval(state.recTimerId);
    recTimer.classList.add('hidden');
    recTime.textContent = '0:00';
  }

  async function startRecording() {
    if (!canvas.captureStream) { toast('Video recording isn\u2019t supported in this browser'); return; }
    const mime = pickRecorderMime();
    const fps = state.videoFps;
    const camStream = canvas.captureStream(fps);
    const tracks = [...camStream.getVideoTracks()];
    if (state.micTrack && state.micTrack.readyState === 'live') tracks.push(state.micTrack);
    const combined = new MediaStream(tracks);
    try {
      state.recorder = mime ? new MediaRecorder(combined, { mimeType: mime }) : new MediaRecorder(combined);
    } catch (e) {
      toast('Could not start the recorder on this browser'); return;
    }
    state.recChunks = [];
    state.recorder.ondataavailable = (e) => { if (e.data && e.data.size) state.recChunks.push(e.data); };
    state.recorder.onstop = onRecordingStop;
    state.recorder.start(250);
    state.recording = true;
    btnShutter.classList.add('recording');
    startRecTimer();
    if (navigator.vibrate) navigator.vibrate(15);
  }

  function stopRecording() {
    if (state.recorder && state.recording) state.recorder.stop();
  }

  async function onRecordingStop() {
    state.recording = false;
    btnShutter.classList.remove('recording');
    stopRecTimer();
    const type = state.recorder.mimeType || 'video/webm';
    const blob = new Blob(state.recChunks, { type });
    state.recChunks = [];

    bumpFrameCounter();
    const look = getLook();
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(), type: 'video', mode: state.mode, lookName: look.name, blob, mime: type,
    };
    await dbAdd(record);
    toast(`Saved video — ${look.name}`);
    refreshGalleryIfOpen();

    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    if (state.autoSave) offerSaveToPhotos(blob, `leader-${record.id}.${ext}`, type, record.id);
  }

  function handleShutter() {
    if (!state.shutterReady) return; // camera just started — ignore any stray click from the permission sheet
    if (state.captureMode === 'video') {
      if (state.recording) stopRecording(); else startRecording();
    } else {
      takePhoto();
    }
  }
  btnShutter.addEventListener('click', handleShutter);

  /* ---------------- Saving to your camera roll ---------------- */
  // iOS/Safari has no API that writes straight into Photos — the only two routes
  // a website has are (1) the native Share Sheet's "Save Image"/"Save Video" action,
  // or (2) a long-press on an on-screen <img>/<video> element, both of which save to
  // Photos directly. We never fall back to an <a download> link, since that saves to
  // the Files app instead of the camera roll.
  async function offerSaveToPhotos(blob, filename, mime, recordId) {
    try {
      const file = new File([blob], filename, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        toast('Choose "Save Image" / "Save Video" to add it to your camera roll');
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user dismissed the share sheet — respect it
    }
    // Share isn't available here — open the photo/video full-screen so a long-press
    // can save it straight to Photos.
    await refreshGallery();
    const idx = state.rollCache.findIndex((r) => r.id === recordId);
    if (idx > -1) {
      openViewer(idx);
      toast('Long-press the image to save it to Photos');
    }
  }

  /* ---------------- Gallery ---------------- */
  const gallery = $('gallery');
  const galleryGrid = $('galleryGrid');
  const galleryEmpty = $('galleryEmpty');
  let galleryOpen = false;
  const PLAY_ICON = '<span class="g-play"><svg viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,.4)"/><path d="M10 8l7 4-7 4V8z" fill="white"/></svg></span>';

  async function openGallery() {
    galleryOpen = true;
    gallery.classList.remove('hidden');
    state.renderPaused = true;
    await refreshGallery();
  }
  function closeGallery() {
    galleryOpen = false;
    gallery.classList.add('hidden');
    if (viewer.classList.contains('hidden')) state.renderPaused = false;
  }
  function refreshGalleryIfOpen() { if (galleryOpen) refreshGallery(); }

  async function refreshGallery() {
    const items = await dbAll();
    state.rollCache = items;
    galleryGrid.innerHTML = '';
    galleryEmpty.classList.toggle('hidden', items.length > 0);
    items.forEach((item, idx) => {
      const url = URL.createObjectURL(item.blob);
      const btn = document.createElement('button');
      const mediaTag = item.type === 'video'
        ? `<video src="${url}" muted playsinline></video>${PLAY_ICON}`
        : `<img src="${url}" alt="${item.lookName}">`;
      btn.innerHTML = `${mediaTag}<span class="g-mode">${item.mode === 'pro' ? 'PRO' : 'DIG'}${item.type === 'video' ? ' · VID' : ''}</span>`;
      btn.addEventListener('click', () => openViewer(idx));
      galleryGrid.appendChild(btn);
    });
  }

  $('btnGallery').addEventListener('click', openGallery);
  $('btnCloseGallery').addEventListener('click', closeGallery);

  /* ---------------- Viewer (with swipe + arrow navigation) ---------------- */
  const viewer = $('viewer');
  const viewerImg = $('viewerImg');
  const viewerVideo = $('viewerVideo');
  const viewerTag = $('viewerTag');
  const viewerStage = $('viewerStage');
  const btnViewerPrev = $('btnViewerPrev');
  const btnViewerNext = $('btnViewerNext');

  function currentViewerItem() { return state.rollCache[state.viewerIndex]; }

  function openViewer(index) {
    state.viewerIndex = index;
    state.renderPaused = true;
    renderViewer();
    viewer.classList.remove('hidden');
  }
  function closeViewer() {
    viewer.classList.add('hidden');
    viewerVideo.pause();
    state.viewerIndex = -1;
    if (!galleryOpen) state.renderPaused = false;
  }
  function renderViewer() {
    const item = currentViewerItem();
    if (!item) { closeViewer(); return; }
    const url = URL.createObjectURL(item.blob);
    if (item.type === 'video') {
      viewerVideo.src = url;
      viewerVideo.classList.remove('hidden');
      viewerImg.classList.add('hidden');
    } else {
      viewerImg.src = url;
      viewerImg.classList.remove('hidden');
      viewerVideo.classList.add('hidden');
      viewerVideo.pause();
    }
    const d = new Date(item.ts);
    viewerTag.textContent = `${item.lookName} · ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    btnViewerPrev.disabled = state.viewerIndex <= 0;
    btnViewerNext.disabled = state.viewerIndex >= state.rollCache.length - 1;
  }
  function viewerStep(delta) {
    const next = state.viewerIndex + delta;
    if (next < 0 || next >= state.rollCache.length) return;
    state.viewerIndex = next;
    renderViewer();
  }
  $('btnCloseViewer').addEventListener('click', closeViewer);
  btnViewerPrev.addEventListener('click', () => viewerStep(-1));
  btnViewerNext.addEventListener('click', () => viewerStep(1));

  // Touch swipe across the stage
  let touchStartX = null, touchStartY = null;
  viewerStage.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  viewerStage.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      viewerStep(dx > 0 ? -1 : 1);
    }
    touchStartX = null; touchStartY = null;
  }, { passive: true });

  // Keyboard navigation when the viewer is open
  document.addEventListener('keydown', (e) => {
    if (viewer.classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft') viewerStep(-1);
    if (e.key === 'ArrowRight') viewerStep(1);
    if (e.key === 'Escape') closeViewer();
  });

  $('btnSave').addEventListener('click', () => {
    const item = currentViewerItem();
    if (!item) return;
    const ext = item.type === 'video' ? (item.mime && item.mime.includes('mp4') ? 'mp4' : 'webm') : 'jpg';
    const mime = item.type === 'video' ? (item.mime || 'video/webm') : 'image/jpeg';
    offerSaveToPhotos(item.blob, `leader-${item.id}.${ext}`, mime, item.id);
  });
  $('btnDelete').addEventListener('click', async () => {
    const item = currentViewerItem();
    if (!item) return;
    await dbDelete(item.id);
    const wasLast = state.viewerIndex === state.rollCache.length - 1;
    await refreshGallery();
    if (!state.rollCache.length) { closeViewer(); return; }
    state.viewerIndex = wasLast ? state.rollCache.length - 1 : Math.min(state.viewerIndex, state.rollCache.length - 1);
    renderViewer();
  });

  /* ---------------- Init ---------------- */
  fcNum.textContent = String(state.frame).padStart(3, '0');
  setAspect(state.aspect);
  setPhotoQuality(state.photoQuality, false);
  setVideoQuality(state.videoQuality, false);
  buildDial();
  startCamera();

  window.addEventListener('beforeunload', () => {
    localStorage.setItem(PREF.frame, String(state.frame));
    if (state.micTrack) state.micTrack.stop();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
