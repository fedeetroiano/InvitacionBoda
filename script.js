/* ==========================================================================
   LARA & FEDERICO — SCROLL WORLD V2 ENGINE (726 CLEANED 9:16 VERTICAL FRAMES)
   Stops: 0 (Sobre) → 130 (Torta) → 290 (Civil) → 490 (Salón) → 600 (Auto) → 700 (Atardecer/RSVP)
   Triggers: Tap, small scroll/wheel, touch swipe, keyboard arrows, or nav rail
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const loaderScreen = document.getElementById('loader-screen');
  const loaderBarFill = document.getElementById('loader-bar-fill');
  const loaderPercent = document.getElementById('loader-percent');

  const stageViewport = document.getElementById('stage-viewport');
  const worldCanvas = document.getElementById('scroll-world-canvas');
  const worldCtx = worldCanvas.getContext('2d', { alpha: true });

  const chapterGroups = Array.from(document.querySelectorAll('.chapter-group'));
  const chapterAnnouncer = document.getElementById('chapter-announcer');
  const navPrevBtn = document.getElementById('nav-prev-btn');
  const navNextBtn = document.getElementById('nav-next-btn');

  const copyAliasBtn = document.getElementById('copy-alias-btn');
  const rsvpForm = document.getElementById('rsvp-form');
  const toastNotice = document.getElementById('toast-notice');
  const toastMessage = document.getElementById('toast-message');

  // V2 Papercraft Diorama story stops (0-indexed into assets/frames_v2/frame_0000.jpg .. frame_0725.jpg)
  const CHAPTER_STOPS = [0, 130, 290, 490, 600, 700];
  const CHAPTER_LABELS = [
    'Portada: Lara y Federico',
    'Fecha de la boda y cuenta regresiva',
    'Ceremonia Civil: Registro Civil, Viernes 12 de Marzo de 2027',
    'Ceremonia en el Salón del Reino, Sábado 13 de Marzo de 2027',
    'Presente y alias bancario',
    'Resumen y confirmación de asistencia'
  ];

  const TOTAL_FRAMES = 726;
  const FRAMES_DIR = 'assets/frames_v2';
  const frames = new Array(TOTAL_FRAMES).fill(null);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Playback state
  let currentStopIndex = 0;
  let targetStopIndex = 0;
  let currentFrame = 0;
  let isPlaying = false;
  let lastDrawnFrameIndex = -1;
  let lastFrameTimestamp = 0;
  let lastTriggerTime = 0;
  let lastTouchEndTime = 0;

  // ==========================================================================
  // 1. CANVAS SIZING (FULL-BLEED VERTICAL)
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
    drawFrame(Math.round(currentFrame), true);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ==========================================================================
  // 2. PRIORITY PROGRESSIVE FRAME PRELOADER
  // ==========================================================================
  function getFramePath(index) {
    return `${FRAMES_DIR}/frame_${String(index).padStart(4, '0')}.jpg`;
  }

  function loadSingleFrame(index) {
    return new Promise((resolve) => {
      if (index < 0 || index >= TOTAL_FRAMES) {
        resolve(null);
        return;
      }
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
    // Stage 0: Load all exact chapter stop frames first so every stop is crisp immediately
    await Promise.all(CHAPTER_STOPS.map((idx) => loadSingleFrame(idx)));
    drawFrame(0, true);

    // Stage 1: Dense pass on first segment (0..130) + coarse pass across the full journey (0..700)
    const stage1Set = new Set();
    for (let i = 0; i <= 130; i += 2) stage1Set.add(i);
    for (let i = 130; i <= 700; i += 6) stage1Set.add(i);
    const stage1Indices = Array.from(stage1Set).filter((i) => !frames[i]);

    let loadedStage1 = 0;
    const CONCURRENCY = 12;

    for (let i = 0; i < stage1Indices.length; i += CONCURRENCY) {
      const batch = stage1Indices.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((idx) => loadSingleFrame(idx)));
      loadedStage1 += batch.length;

      const pct = Math.min(100, Math.round((loadedStage1 / Math.max(1, stage1Indices.length)) * 100));
      if (loaderBarFill) loaderBarFill.style.width = `${Math.max(15, pct)}%`;
      if (loaderPercent) loaderPercent.textContent = `Cargando invitación… ${pct}%`;
    }

    loaderScreen.classList.add('hidden');
    drawFrame(Math.round(currentFrame), true);

    // Stage 2: Load remaining intermediate frames silently in background for 100% silky playback
    const remainingIndices = [];
    for (let i = 0; i <= 700; i++) {
      if (!frames[i]) remainingIndices.push(i);
    }

    for (let i = 0; i < remainingIndices.length; i += 16) {
      const batch = remainingIndices.slice(i, i + 16);
      await Promise.all(batch.map((idx) => loadSingleFrame(idx)));
      const rounded = Math.round(currentFrame);
      if (batch.includes(rounded)) {
        drawFrame(rounded, true);
      }
    }
  }

  // ==========================================================================
  // 3. DRAW FULL-BLEED NATIVE 9:16 VERTICAL FRAME
  // ==========================================================================
  function getNearestLoadedFrame(targetIndex) {
    const clamped = Math.max(0, Math.min(TOTAL_FRAMES - 1, targetIndex));
    if (frames[clamped]) return { img: frames[clamped], index: clamped };

    for (let offset = 1; offset <= 16; offset++) {
      const prev = clamped - offset;
      if (prev >= 0 && frames[prev]) return { img: frames[prev], index: prev };
      const next = clamped + offset;
      if (next < TOTAL_FRAMES && frames[next]) return { img: frames[next], index: next };
    }

    return frames[0] ? { img: frames[0], index: 0 } : null;
  }

  function drawFrame(targetIndex, force = false) {
    const cw = worldCanvas.width;
    const ch = worldCanvas.height;
    if (!cw || !ch) return;

    const found = getNearestLoadedFrame(targetIndex);
    if (!found || !found.img) return;

    if (!force && found.index === lastDrawnFrameIndex) return;
    lastDrawnFrameIndex = found.index;

    const img = found.img;
    const sw = img.naturalWidth || 720;
    const sh = img.naturalHeight || 1270;
    const frameAspect = sw / sh;
    const screenAspect = cw / ch;

    worldCtx.clearRect(0, 0, cw, ch);

    let drawW, drawH, drawX, drawY;

    if (screenAspect <= 0.85) {
      // Mobile / Portrait: true full-bleed cover across 100% of the screen
      const scale = Math.max(cw / sw, ch / sh);
      drawW = sw * scale;
      drawH = sh * scale;
      drawX = (cw - drawW) * 0.5;
      drawY = (ch - drawH) * 0.5;
    } else {
      // Desktop / Landscape: full-height centered 9:16 vertical stage with soft side-feather
      drawH = ch;
      drawW = drawH * frameAspect;
      drawX = (cw - drawW) * 0.5;
      drawY = 0;
    }

    worldCtx.save();
    worldCtx.drawImage(img, drawX, drawY, drawW, drawH);

    // On wide desktop viewports, gently feather left & right edges into the botanical cloud backdrop
    if (drawX > 4) {
      const fadeSide = drawW * 0.07;
      worldCtx.globalCompositeOperation = 'destination-in';
      const hMask = worldCtx.createLinearGradient(drawX, 0, drawX + drawW, 0);
      hMask.addColorStop(0, 'rgba(0, 0, 0, 0)');
      hMask.addColorStop(fadeSide / drawW, 'rgba(0, 0, 0, 1)');
      hMask.addColorStop(1 - fadeSide / drawW, 'rgba(0, 0, 0, 1)');
      hMask.addColorStop(1, 'rgba(0, 0, 0, 0)');
      worldCtx.fillStyle = hMask;
      worldCtx.fillRect(drawX, drawY, drawW, drawH);
    }

    worldCtx.restore();
  }

  // ==========================================================================
  // 4. CHAPTER OVERLAY & AUTO-PLAYBACK CONTROLLER
  // ==========================================================================
  function setActiveChapter(stopIndex) {
    chapterGroups.forEach((group) => {
      const idx = parseInt(group.dataset.stop || '-1', 10);
      const isActive = idx === stopIndex;
      group.classList.toggle('active', isActive);
      group.setAttribute('aria-hidden', String(!isActive));
    });

    if (stageViewport) {
      stageViewport.classList.toggle('is-last-stop', stopIndex === CHAPTER_STOPS.length - 1);
    }

    if (navPrevBtn) navPrevBtn.disabled = stopIndex <= 0;
    if (navNextBtn) navNextBtn.disabled = stopIndex >= CHAPTER_STOPS.length - 1;

    if (chapterAnnouncer && stopIndex >= 0 && CHAPTER_LABELS[stopIndex]) {
      chapterAnnouncer.textContent = CHAPTER_LABELS[stopIndex];
    }
  }

  function clearActiveChapters() {
    chapterGroups.forEach((group) => {
      group.classList.remove('active');
      group.setAttribute('aria-hidden', 'true');
    });
  }

  function goToStop(nextIndex) {
    const clamped = Math.max(0, Math.min(CHAPTER_STOPS.length - 1, nextIndex));
    const targetFrame = CHAPTER_STOPS[clamped];

    if (clamped === targetStopIndex && Math.abs(currentFrame - targetFrame) < 0.5) {
      return;
    }

    targetStopIndex = clamped;

    if (navPrevBtn) navPrevBtn.disabled = clamped <= 0;
    if (navNextBtn) navNextBtn.disabled = clamped >= CHAPTER_STOPS.length - 1;

    if (prefersReducedMotion.matches) {
      isPlaying = false;
      currentStopIndex = clamped;
      currentFrame = targetFrame;
      drawFrame(targetFrame, true);
      setActiveChapter(clamped);
      return;
    }

    clearActiveChapters();
    isPlaying = true;
    lastFrameTimestamp = performance.now();
  }

  function advanceChapter(direction) {
    const now = performance.now();
    if (now - lastTriggerTime < 320) return;
    lastTriggerTime = now;

    const nextIndex = targetStopIndex + direction;
    if (nextIndex < 0 || nextIndex >= CHAPTER_STOPS.length) return;
    goToStop(nextIndex);
  }

  function playbackLoop(timestamp) {
    if (isPlaying) {
      const dt = Math.min(0.05, Math.max(0.001, (timestamp - lastFrameTimestamp) / 1000));
      lastFrameTimestamp = timestamp;

      const targetFrame = CHAPTER_STOPS[targetStopIndex];
      const diff = targetFrame - currentFrame;
      const distance = Math.abs(diff);

      if (distance <= 0.35) {
        currentFrame = targetFrame;
        currentStopIndex = targetStopIndex;
        isPlaying = false;
        drawFrame(targetFrame, false);
        setActiveChapter(targetStopIndex);
      } else {
        // Smooth cinematic playback: ~30 fps cruising speed with gentle ease-out near each stop
        const cruisingFps = 30;
        const easeWindow = 20;
        const speedFactor = distance < easeWindow ? Math.max(0.3, distance / easeWindow) : 1;
        const step = Math.sign(diff) * Math.min(distance, cruisingFps * speedFactor * dt);

        currentFrame += step;
        drawFrame(Math.round(currentFrame), false);

        if (distance <= 4) {
          setActiveChapter(targetStopIndex);
        }
      }
    }

    requestAnimationFrame(playbackLoop);
  }

  // ==========================================================================
  // 5. INTERACTION TRIGGERS (WHEEL, TOUCH SWIPE, TAP, KEYBOARD, NAV BUTTONS)
  // ==========================================================================
  function isInteractiveTarget(target) {
    if (!target || !target.closest) return false;
    return Boolean(
      target.closest('a, button, input, select, textarea, label, form, .chapter-rail')
    );
  }

  window.addEventListener(
    'wheel',
    (e) => {
      if (isInteractiveTarget(e.target) && e.target.closest('select, textarea')) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) < 16) return;
      advanceChapter(e.deltaY > 0 ? 1 : -1);
    },
    { passive: false }
  );

  let touchStartY = 0;
  let touchStartX = 0;
  let touchStartTime = 0;
  let touchStartedInteractive = false;

  stageViewport.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      touchStartedInteractive = isInteractiveTarget(e.target);
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
      touchStartTime = performance.now();
    },
    { passive: true }
  );

  stageViewport.addEventListener(
    'touchend',
    (e) => {
      if (touchStartedInteractive || e.changedTouches.length !== 1) return;
      lastTouchEndTime = performance.now();

      const dy = touchStartY - e.changedTouches[0].clientY;
      const dx = touchStartX - e.changedTouches[0].clientX;
      const elapsed = lastTouchEndTime - touchStartTime;

      if (Math.abs(dy) >= 26 && Math.abs(dy) > Math.abs(dx)) {
        advanceChapter(dy > 0 ? 1 : -1);
        return;
      }

      if (Math.abs(dy) < 12 && Math.abs(dx) < 12 && elapsed < 350) {
        if (targetStopIndex < CHAPTER_STOPS.length - 1) {
          advanceChapter(1);
        }
      }
    },
    { passive: true }
  );

  stageViewport.addEventListener('click', (e) => {
    if (performance.now() - lastTouchEndTime < 450) return;
    if (isInteractiveTarget(e.target)) return;
    if (targetStopIndex < CHAPTER_STOPS.length - 1) {
      advanceChapter(1);
    }
  });

  document.querySelectorAll('[data-action="next"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      advanceChapter(1);
    });
  });

  if (navPrevBtn) {
    navPrevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      advanceChapter(-1);
    });
  }

  if (navNextBtn) {
    navNextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      advanceChapter(1);
    });
  }

  window.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA') {
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      advanceChapter(1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      advanceChapter(-1);
    }
  });

  // ==========================================================================
  // 6. COUNTDOWN TIMER (Viernes 12 de Marzo de 2027, 10:50 hs UTC-3)
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
  // 7. COPY ALIAS & WHATSAPP RSVP
  // ==========================================================================
  let toastTimeoutId = null;

  function showToast(msg) {
    if (!toastNotice || !toastMessage) return;
    toastMessage.textContent = msg;
    toastNotice.classList.add('show');
    if (toastTimeoutId) clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => {
      toastNotice.classList.remove('show');
    }, 2800);
  }

  if (copyAliasBtn) {
    copyAliasBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const alias = document.getElementById('bank-alias')?.textContent.trim() || 'BODA.FEDE.Y.LARA';
      navigator.clipboard
        .writeText(alias)
        .then(() => showToast('Alias copiado'))
        .catch(() => showToast(`Alias: ${alias}`));
    });
  }

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('guest-name');
      const name = nameInput?.value.trim();
      const eventChoice = document.getElementById('guest-event')?.value;

      if (!name) {
        showToast('Ingresá tu nombre y apellido');
        nameInput?.focus();
        return;
      }

      const text = [
        'Hola Lara y Fede,',
        '',
        'Confirmo mi asistencia a su casamiento:',
        `• Nombre: ${name}`,
        `• Asistencia: ${eventChoice}`,
        '',
        'Muchas felicidades.'
      ].join('\n');

      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  // Initialize
  setActiveChapter(0);
  preloadFrameSequence();
  requestAnimationFrame(playbackLoop);
});
