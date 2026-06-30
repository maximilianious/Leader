/* ============================================================
   LEADER — a two-personality camera (Digital film / Professional)
   All processing happens on-device. No network calls, no analytics.
   ============================================================ */

(() => {
  'use strict';

  /* ---------------- Look definitions ---------------- */
  const LOOKS = {
    digital: [
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

  /* ---------------- State ---------------- */
  const state = {
    mode: 'digital',
    lookIndex: 0,
    facing: 'environment',
    stream: null,
    track: null,
    flash: false,
    frame: Number(localStorage.getItem('leader_frame') || '0'),
    noiseTiles: [],
    noiseIdx: 0,
    rafId: null,
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
  const currentLookLabel = $('currentLookLabel');
  const lastShot = $('lastShot');
  const lastShotImg = $('lastShotImg');
  const thumbFrame = $('thumbFrame');
  const toastEl = $('toast');

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  /* ---------------- IndexedDB photo store ---------------- */
  const DB_NAME = 'leader-roll';
  const STORE = 'photos';
  let dbPromise = null;
  function getDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
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
  async function startCamera() {
    stopCamera();
    try {
      const constraints = {
        audio: false,
        video: {
          facingMode: state.facing,
          width: { ideal: 1920 },
          height: { ideal: 1920 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      state.stream = stream;
      state.track = stream.getVideoTracks()[0];
      video.srcObject = stream;
      await video.play();
      permMsg.classList.add('hidden');
      video.classList.toggle('mirror', state.facing === 'user');
      resizeCanvas();
      runLoop();
    } catch (err) {
      console.warn('Camera error', err);
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
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
    state.track = null;
  }
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  window.addEventListener('resize', resizeCanvas);

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
  function getLook() {
    return LOOKS[state.mode][state.lookIndex];
  }

  function drawVignette(c, w, h, amount) {
    if (amount <= 0) return;
    const g = c.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${amount})`);
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  function drawLeak(c, w, h, leak) {
    if (!leak) return;
    const positions = { tl: [0, 0], tr: [w, 0], bl: [0, h], br: [w, h] };
    const [x, y] = positions[leak.corner] || [w, 0];
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.6);
    g.addColorStop(0, leak.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.save();
    c.globalCompositeOperation = 'screen';
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  function drawSplitTone(c, w, h, st) {
    if (!st) return;
    c.save();
    c.globalCompositeOperation = 'overlay';
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, st.hi);
    g.addColorStop(1, st.shadow);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  function drawTint(c, w, h, tint) {
    if (!tint) return;
    c.save();
    c.globalCompositeOperation = 'screen';
    c.fillStyle = tint;
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  function drawGrain(c, w, h, amount, animated) {
    if (amount <= 0) return;
    const tile = state.noiseTiles[state.noiseIdx];
    if (animated) state.noiseIdx = (state.noiseIdx + 1) % state.noiseTiles.length;
    const pattern = c.createPattern(tile, 'repeat');
    c.save();
    c.globalCompositeOperation = 'overlay';
    c.globalAlpha = Math.min(amount, 0.6);
    c.fillStyle = pattern;
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  function drawScanlines(c, w, h) {
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = 0.5;
    c.fillStyle = '#000';
    for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
    c.restore();
  }

  function drawStamp(c, w, h, look) {
    if (!look.stamp) return;
    const now = new Date();
    const txt = `${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')} '${String(now.getFullYear()).slice(2)}`;
    const size = Math.max(14, w * 0.026);
    c.save();
    c.font = `${size}px "JetBrains Mono", monospace`;
    c.textAlign = 'right';
    c.textBaseline = 'bottom';
    const px = w - w * 0.035;
    const py = h - h * 0.03;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillText(txt, px + size * 0.06, py + size * 0.06);
    c.fillStyle = '#ff8a1f';
    c.fillText(txt, px, py);
    c.restore();
  }

  function render(targetCtx, w, h, look, opts = {}) {
    const { animatedGrain = true, mirror = false } = opts;
    targetCtx.save();
    if (mirror) { targetCtx.translate(w, 0); targetCtx.scale(-1, 1); }
    targetCtx.filter = look.css;
    targetCtx.drawImage(video, 0, 0, w, h);
    targetCtx.restore();
    targetCtx.filter = 'none';

    drawSplitTone(targetCtx, w, h, look.splitTone);
    drawTint(targetCtx, w, h, look.tint);
    drawLeak(targetCtx, w, h, look.leak);
    drawVignette(targetCtx, w, h, look.vignette);
    if (look.scanlines) drawScanlines(targetCtx, w, h);
    drawGrain(targetCtx, w, h, look.grain, animatedGrain);
  }

  function runLoop() {
    function frame() {
      if (video.readyState >= 2 && canvas.width && canvas.height) {
        render(ctx, canvas.width, canvas.height, getLook(), {
          animatedGrain: true,
          mirror: state.facing === 'user',
        });
      }
      state.rafId = requestAnimationFrame(frame);
    }
    state.rafId = requestAnimationFrame(frame);
  }

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
    currentLookLabel.textContent = getLook().name;
  }

  $('dialLeft').addEventListener('click', () => selectLook(state.lookIndex - 1));
  $('dialRight').addEventListener('click', () => selectLook(state.lookIndex + 1));

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      state.mode = btn.dataset.mode;
      state.lookIndex = 0;
      buildDial();
    });
  });

  /* ---------------- Flip / flash ---------------- */
  $('btnFlip').addEventListener('click', () => {
    state.facing = state.facing === 'user' ? 'environment' : 'user';
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
      toast('This device has no torch — flash will simulate a pop on capture');
    }
  });

  $('btnGrant').addEventListener('click', startCamera);

  /* ---------------- Capture ---------------- */
  function fireFlashPop() {
    const el = document.getElementById('flashPop');
    el.classList.remove('fire');
    void el.offsetWidth;
    el.classList.add('fire');
  }

  async function takePhoto() {
    if (!video.videoWidth) { toast('Camera still warming up…'); return; }
    $('btnShutter').classList.add('flashing');
    fireFlashPop();
    if (navigator.vibrate) navigator.vibrate(12);

    const look = getLook();
    const w = video.videoWidth;
    const h = video.videoHeight;
    captureCanvas.width = w;
    captureCanvas.height = h;
    const cctx = captureCanvas.getContext('2d');
    render(cctx, w, h, look, { animatedGrain: false, mirror: state.facing === 'user' });
    drawStamp(cctx, w, h, look);

    const blob = await new Promise((resolve) => captureCanvas.toBlob(resolve, 'image/jpeg', 0.92));
    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.92);

    state.frame += 1;
    localStorage.setItem('leader_frame', String(state.frame));
    fcNum.textContent = String(state.frame).padStart(3, '0');

    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      mode: state.mode,
      lookName: look.name,
      blob,
    };
    await dbAdd(record);

    lastShotImg.src = dataUrl;
    lastShot.classList.add('show');
    thumbFrame.innerHTML = `<img src="${dataUrl}" alt="Last photo" />`;

    setTimeout(() => $('btnShutter').classList.remove('flashing'), 220);
    toast(`Captured — ${look.name}`);
    refreshGalleryIfOpen();
  }

  $('btnShutter').addEventListener('click', takePhoto);
  lastShot.addEventListener('click', () => openGallery());

  /* ---------------- Saving to Photos ---------------- */
  async function savePhotoBlob(blob, filename) {
    const file = new File([blob], filename, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        toast('Choose "Save Image" to add it to your camera roll');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // user cancelled
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Saved — check Downloads, or long-press the image to add to Photos');
  }

  /* ---------------- Gallery ---------------- */
  const gallery = $('gallery');
  const galleryGrid = $('galleryGrid');
  const galleryEmpty = $('galleryEmpty');
  let galleryOpen = false;

  async function openGallery() {
    galleryOpen = true;
    gallery.classList.remove('hidden');
    await refreshGallery();
  }
  function closeGallery() {
    galleryOpen = false;
    gallery.classList.add('hidden');
  }
  function refreshGalleryIfOpen() { if (galleryOpen) refreshGallery(); }

  async function refreshGallery() {
    const items = await dbAll();
    galleryGrid.innerHTML = '';
    galleryEmpty.classList.toggle('hidden', items.length > 0);
    items.forEach((item) => {
      const url = URL.createObjectURL(item.blob);
      const btn = document.createElement('button');
      btn.innerHTML = `<img src="${url}" alt="${item.lookName}"><span class="g-mode">${item.mode === 'pro' ? 'PRO' : 'DIG'}</span>`;
      btn.addEventListener('click', () => openViewer(item, url));
      galleryGrid.appendChild(btn);
    });
  }

  $('btnGallery').addEventListener('click', openGallery);
  $('btnCloseGallery').addEventListener('click', closeGallery);

  /* ---------------- Viewer ---------------- */
  const viewer = $('viewer');
  const viewerImg = $('viewerImg');
  const viewerTag = $('viewerTag');
  let viewerItem = null;

  function openViewer(item, url) {
    viewerItem = item;
    viewerImg.src = url;
    const d = new Date(item.ts);
    viewerTag.textContent = `${item.lookName} · ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    viewer.classList.remove('hidden');
  }
  function closeViewer() {
    viewer.classList.add('hidden');
    viewerItem = null;
  }
  $('btnCloseViewer').addEventListener('click', closeViewer);

  $('btnSave').addEventListener('click', () => {
    if (!viewerItem) return;
    savePhotoBlob(viewerItem.blob, `leader-${viewerItem.id}.jpg`);
  });
  $('btnDelete').addEventListener('click', async () => {
    if (!viewerItem) return;
    await dbDelete(viewerItem.id);
    closeViewer();
    refreshGallery();
  });

  /* ---------------- Info ---------------- */
  $('btnInfo').addEventListener('click', () => {
    const look = getLook();
    const bits = [];
    if (look.grain) bits.push('grain');
    if (look.vignette) bits.push('vignette');
    if (look.leak) bits.push('light leak');
    if (look.scanlines) bits.push('scanlines');
    if (look.splitTone) bits.push('split-tone grade');
    if (look.sharpen) bits.push('clarity boost');
    toast(`${look.name}: ${bits.join(', ') || 'clean & neutral'}`);
  });

  /* ---------------- Init ---------------- */
  fcNum.textContent = String(state.frame).padStart(3, '0');
  buildDial();
  startCamera();

  window.addEventListener('beforeunload', () => {
    localStorage.setItem('leader_frame', String(state.frame));
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
