/* ==========================================================================
   LARA & FEDERICO — NATIVE 9:16 VERTICAL SCROLL WORLD ENGINE (621 HD FRAMES)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const loaderScreen = document.getElementById('loader-screen');
  const loaderBarFill = document.getElementById('loader-bar-fill');
  const loaderPercent = document.getElementById('loader-percent');

  const worldCanvas = document.getElementById('scroll-world-canvas');
  const worldCtx = worldCanvas.getContext('2d', { alpha: true });

  const infoBlocks = Array.from(document.querySelectorAll('.info-block'));
  const copyAliasBtn = document.getElementById('copy-alias-btn');
  const rsvpForm = document.getElementById('rsvp-form');
  const toastNotice = document.getElementById('toast-notice');
  const toastMessage = document.getElementById('toast-message');

  const TOTAL_FRAMES = 621;
  const frames = new Array(TOTAL_FRAMES).fill(null);

  let targetProgress = 0;
  let smoothProgress = 0;
  let lastDrawnFrameIndex = -1;

  // ==========================================================================
  // 1. RESIZE CANVAS
  // ==========================================================================
  let viewW = window.innerWidth;
  let viewH = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function resizeCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    worldCanvas.width = Math.round(viewW * dpr);
    worldCanvas.height = Math.round(viewH * dpr);

    lastDrawnFrameIndex = -1;
    drawFrameForProgress(smoothProgress, true);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ==========================================================================
  // 2. PROGRESSIVE IMAGE SEQUENCE LOADER (621 VERTICAL 9:16 FRAMES)
  // ==========================================================================
  function getFramePath(index) {
    return `assets/frames/frame_${ String(index).padStart(4, '0') }.jpg`;
  }

  function loadSingleFrame(index) {
    return new Promise((resolve) => {
      if (frames[index]) {
        resolve(frames[index]);
        return;
      }
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        frames[index] = img;
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = getFramePath(index);
    });
  }

  async function preloadFrameSequence() {
    await loadSingleFrame(0);
    drawFrameForProgress(0, true);

    const stage1Indices = [];
    for (let i = 0; i < TOTAL_FRAMES; i += 6) {
      stage1Indices.push(i);
    }
    if (stage1Indices[stage1Indices.length - 1] !== TOTAL_FRAMES - 1) {
      stage1Indices.push(TOTAL_FRAMES - 1);
    }

    let loadedStage1 = 0;
    const CONCURRENCY = 12;

    for (let i = 0; i < stage1Indices.length; i += CONCURRENCY) {
      const batch = stage1Indices.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(idx => loadSingleFrame(idx)));
      loadedStage1 += batch.length;

      const pct = Math.min(100, Math.round((loadedStage1 / stage1Indices.length) * 100));
      if (loaderBarFill) loaderBarFill.style.width = `${ Math.max(15, pct) }%`;
      if (loaderPercent) loaderPercent.textContent = `Cargando invitación... ${ pct }%`;
    }

    loaderScreen.classList.add('hidden');
    drawFrameForProgress(smoothProgress, true);

    const remainingIndices = [];
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      if (!frames[i]) remainingIndices.push(i);
    }

    for (let i = 0; i < remainingIndices.length; i += 16) {
      const batch = remainingIndices.slice(i, i + 16);
      await Promise.all(batch.map(idx => loadSingleFrame(idx)));
      const targetIdx = Math.round(smoothProgress * (TOTAL_FRAMES - 1));
      if (batch.includes(targetIdx)) {
        drawFrameForProgress(smoothProgress, true);
      }
    }
  }

  // ==========================================================================
  // 3. DRAW NATIVE 9:16 VERTICAL FRAME
  // ==========================================================================
  function getNearestLoadedFrame(targetIndex) {
    if (frames[targetIndex]) return { img: frames[targetIndex], index: targetIndex };

    for (let offset = 1; offset <= 12; offset++) {
      const prev = targetIndex - offset;
      if (prev >= 0 && frames[prev]) return { img: frames[prev], index: prev };
      const next = targetIndex + offset;
      if (next < TOTAL_FRAMES && frames[next]) return { img: frames[next], index: next };
    }

    return frames[0] ? { img: frames[0], index: 0 } : null;
  }

  function drawFrameForProgress(progress, force = false) {
    const cw = worldCanvas.width;
    const ch = worldCanvas.height;
    if (!cw || !ch) return;

    const clamped = Math.max(0, Math.min(1, progress));
    const targetIndex = Math.round(clamped * (TOTAL_FRAMES - 1));

    const found = getNearestLoadedFrame(targetIndex);
    if (!found || !found.img) return;

    if (!force && found.index === lastDrawnFrameIndex) return;
    lastDrawnFrameIndex = found.index;

    const img = found.img;
    const sw = img.naturalWidth || 720;
    const sh = img.naturalHeight || 1280;
    const frameAspect = sw / sh; // 9:16 (0.5625)
    const screenAspect = cw / ch;

    worldCtx.clearRect(0, 0, cw, ch);

    let drawW, drawH, drawX, drawY;

    if (screenAspect <= 0.85) {
      // Mobile / Portrait screen: fill the vertical viewport while keeping the horizontal width 100% uncropped
      drawW = cw;
      drawH = drawW / frameAspect;
      if (drawH < ch) {
        drawH = ch;
        drawW = drawH * frameAspect;
      }
      drawX = (cw - drawW) * 0.5;
      drawY = (ch - drawH) * 0.5;
    } else {
      // Desktop / Landscape monitor: display full 9:16 vertical stage centered with soft cloud side-fade
      drawH = ch;
      drawW = drawH * frameAspect;
      drawX = (cw - drawW) * 0.5;
      drawY = 0;
    }

    worldCtx.save();
    worldCtx.drawImage(img, drawX, drawY, drawW, drawH);

    // On wide desktop screens, softly feather the left and right edges of the 9:16 vertical video into the pastel clouds
    if (drawX > 4) {
      const fadeSide = drawW * 0.08;
      worldCtx.globalCompositeOperation = 'destination-in';
      const hMask = worldCtx.createLinearGradient(drawX, 0, drawX + drawW, 0);
      hMask.addColorStop(0, 'rgba(0, 0, 0, 0)');
      hMask.addColorStop(fadeSide / drawW, 'rgba(0, 0, 0, 1)');
      hMask.addColorStop(1 - (fadeSide / drawW), 'rgba(0, 0, 0, 1)');
      hMask.addColorStop(1, 'rgba(0, 0, 0, 0)');
      worldCtx.fillStyle = hMask;
      worldCtx.fillRect(drawX, drawY, drawW, drawH);
    }

    worldCtx.restore();
  }

  // ==========================================================================
  // 4. SCROLL LOOP & INFO BLOCK ACTIVATION
  // ==========================================================================
  function getScrollFraction() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    return Math.max(0, Math.min(1, window.scrollY / maxScroll));
  }

  window.addEventListener('scroll', () => {
    targetProgress = getScrollFraction();
  }, { passive: true });

  let lastUiProgress = -1;

  function updateUIForProgress(p) {
    if (Math.abs(p - lastUiProgress) < 0.0005) return;
    lastUiProgress = p;

    infoBlocks.forEach(block => {
      const start = parseFloat(block.dataset.start || '0');
      const end = parseFloat(block.dataset.end || '1');
      if (p >= start && p <= end) {
        block.classList.add('active');
      } else {
        block.classList.remove('active');
      }
    });
  }

  function masterAnimationLoop() {
    targetProgress = getScrollFraction();
    const delta = targetProgress - smoothProgress;

    if (Math.abs(delta) > 0.0001) {
      smoothProgress += delta * 0.16;
      drawFrameForProgress(smoothProgress, false);
      updateUIForProgress(smoothProgress);
    } else if (smoothProgress !== targetProgress) {
      smoothProgress = targetProgress;
      drawFrameForProgress(smoothProgress, false);
      updateUIForProgress(smoothProgress);
    }

    requestAnimationFrame(masterAnimationLoop);
  }

  // ==========================================================================
  // 5. COUNTDOWN TIMER (Viernes 12 de Marzo de 2027, 10:50 hs UTC-3)
  // ==========================================================================
  const targetWeddingDate = new Date('2027-03-12T10:50:00-03:00').getTime();

  function updateCountdown() {
    const now = Date.now();
    const diff = Math.max(0, targetWeddingDate - now);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    const elDays = document.getElementById('cd-days');
    const elHours = document.getElementById('cd-hours');
    const elMins = document.getElementById('cd-mins');
    const elSecs = document.getElementById('cd-secs');

    if (elDays) elDays.textContent = String(days).padStart(2, '0');
    if (elHours) elHours.textContent = String(hours).padStart(2, '0');
    if (elMins) elMins.textContent = String(mins).padStart(2, '0');
    if (elSecs) elSecs.textContent = String(secs).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // ==========================================================================
  // 6. COPY ALIAS & WHATSAPP RSVP
  // ==========================================================================
  function showToast(msg) {
    if (!toastNotice || !toastMessage) return;
    toastMessage.textContent = msg;
    toastNotice.classList.add('show');
    setTimeout(() => {
      toastNotice.classList.remove('show');
    }, 2800);
  }

  if (copyAliasBtn) {
    copyAliasBtn.addEventListener('click', () => {
      const alias = document.getElementById('bank-alias')?.textContent.trim() || 'BODA.FEDE.Y.LARA';
      navigator.clipboard.writeText(alias).then(() => {
        showToast('Alias copiado');
      }).catch(() => {
        showToast(`Alias: ${ alias }`);
      });
    });
  }

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('guest-name')?.value.trim();
      const eventChoice = document.getElementById('guest-event')?.value;

      if (!name) {
        showToast('Ingresá tu nombre y apellido');
        return;
      }

      let text = `Hola Lara y Fede,\n\n`;
      text += `Confirmo mi asistencia a su casamiento:\n`;
      text += `• Nombre: ${ name }\n`;
      text += `• Asistencia: ${ eventChoice }\n\n`;
      text += `Muchas felicidades.`;

      const url = `https://api.whatsapp.com/send?text=${ encodeURIComponent(text) }`;
      window.open(url, '_blank');
    });
  }

  preloadFrameSequence();
  updateUIForProgress(0);
  requestAnimationFrame(masterAnimationLoop);
});
