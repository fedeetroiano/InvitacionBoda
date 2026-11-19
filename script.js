/* ==========================================================================
   FEDERICO & LARA — PURE IMAGE-SEQUENCE SCROLL WORLD ENGINE (621 HD FRAMES)
   Zero video decoding in browser — instant 0ms frame scrubbing
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const loaderScreen = document.getElementById('loader-screen');
  const loaderBarFill = document.getElementById('loader-bar-fill');
  const loaderPercent = document.getElementById('loader-percent');

  const worldCanvas = document.getElementById('scroll-world-canvas');
  const worldCtx = worldCanvas.getContext('2d', { alpha: false });

  const mistCanvas = document.getElementById('mist-canvas');
  const mistCtx = mistCanvas.getContext('2d');

  const progressBar = document.getElementById('scroll-progress-bar');
  const percentLabel = document.getElementById('scroll-percent-label');
  const sceneIndicatorText = document.getElementById('scene-indicator-text');
  const cornerCards = Array.from(document.querySelectorAll('.corner-card'));
  const chapterDots = Array.from(document.querySelectorAll('.chapter-dot'));
  const btnScrollTop = document.getElementById('btn-scroll-top');

  const audioToggle = document.getElementById('audio-toggle');
  const copyAliasBtn = document.getElementById('copy-alias-btn');
  const rsvpForm = document.getElementById('rsvp-form');
  const toastNotice = document.getElementById('toast-notice');
  const toastMessage = document.getElementById('toast-message');

  // Remove unused hidden <video> tag if present so browser uses zero video decoders
  const oldVideo = document.getElementById('source-video');
  if (oldVideo) {
    oldVideo.removeAttribute('src');
    oldVideo.remove();
  }

  // 621 pre-extracted HD frames in assets/frames/frame_0000.jpg ... frame_0620.jpg
  const TOTAL_FRAMES = 621;
  const frames = new Array(TOTAL_FRAMES).fill(null);

  let targetProgress = 0;
  let smoothProgress = 0;
  let lastDrawnFrameIndex = -1;

  // ==========================================================================
  // 1. RESIZE CANVASES
  // ==========================================================================
  let viewW = window.innerWidth;
  let viewH = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function resizeCanvases() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    worldCanvas.width = Math.round(viewW * dpr);
    worldCanvas.height = Math.round(viewH * dpr);

    mistCanvas.width = viewW;
    mistCanvas.height = viewH;

    lastDrawnFrameIndex = -1;
    drawFrameForProgress(smoothProgress, true);
  }

  window.addEventListener('resize', resizeCanvases);
  resizeCanvases();

  // ==========================================================================
  // 2. PROGRESSIVE IMAGE SEQUENCE LOADER (assets/frames/frame_0000.jpg .. 0620)
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
    // 1. Load frame 0 immediately so the envelope appears right away
    await loadSingleFrame(0);
    drawFrameForProgress(0, true);

    // 2. Stage 1: Fast keyframe pass (every 6th frame = ~104 frames) for instant full-page scroll
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
      if (loaderPercent) loaderPercent.textContent = `Cargando fotogramas... ${ pct }%`;
    }

    // Unlock screen immediately after Stage 1 (~0.5 seconds on local disk!)
    loaderScreen.classList.add('hidden');
    drawFrameForProgress(smoothProgress, true);

    // 3. Stage 2: Load all remaining intermediate frames smoothly in batches of 16
    const remainingIndices = [];
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      if (!frames[i]) remainingIndices.push(i);
    }

    for (let i = 0; i < remainingIndices.length; i += 16) {
      const batch = remainingIndices.slice(i, i + 16);
      await Promise.all(batch.map(idx => loadSingleFrame(idx)));
      // If user is currently resting on a frame that just loaded, refresh canvas
      const targetIdx = Math.round(smoothProgress * (TOTAL_FRAMES - 1));
      if (batch.includes(targetIdx)) {
        drawFrameForProgress(smoothProgress, true);
      }
    }
  }

  // ==========================================================================
  // 3. FIND NEAREST LOADED FRAME & DRAW TO CANVAS (ONLY WHEN FRAME CHANGES!)
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

    // Only redraw canvas if the actual frame index changed (0% GPU usage when idle!)
    if (!force && found.index === lastDrawnFrameIndex) return;
    lastDrawnFrameIndex = found.index;

    const img = found.img;
    const sw = img.naturalWidth || 1920;
    const sh = img.naturalHeight || 1080;
    const videoAspect = sw / sh;
    const screenAspect = cw / ch;

    // 1. Deep Forest Green base canvas fill
    worldCtx.fillStyle = '#0b1811';
    worldCtx.fillRect(0, 0, cw, ch);

    let drawW, drawH, drawX, drawY;

    if (screenAspect < videoAspect) {
      // MOBILE / VERTICAL PORTRAIT:
      // Fit full 16:9 width in the center without cropping or zooming!
      drawW = cw * 1.02;
      drawH = drawW / videoAspect;
      drawX = (cw - drawW) * 0.5;
      drawY = (ch - drawH) * 0.5;

      // Subtle atmospheric green-tinted ambient glow above and below the video
      worldCtx.save();
      worldCtx.globalAlpha = 0.16;
      const bgScale = Math.max(cw / sw, ch / sh);
      const bgW = sw * bgScale;
      const bgH = sh * bgScale;
      worldCtx.drawImage(img, (cw - bgW) * 0.5, (ch - bgH) * 0.5, bgW, bgH);
      worldCtx.restore();
    } else {
      // DESKTOP / LANDSCAPE:
      const coverScale = Math.max(cw / sw, ch / sh) * 1.04;
      drawW = sw * coverScale;
      drawH = sh * coverScale;
      drawX = (cw - drawW) * 0.5;
      drawY = (ch - drawH) * 0.46;
    }

    // 2. Draw the crisp 16:9 video frame in the center
    worldCtx.drawImage(img, drawX, drawY, drawW, drawH);

    // 3. Soft dark-green mist feathering on the top & bottom edges of the video
    // so there are no harsh borders between the 16:9 video and the top/bottom cards
    const topFadeH = drawH * 0.16;
    const topGrad = worldCtx.createLinearGradient(0, drawY - 2, 0, drawY + topFadeH);
    topGrad.addColorStop(0, '#0b1811');
    topGrad.addColorStop(0.35, 'rgba(11, 24, 17, 0.65)');
    topGrad.addColorStop(1, 'rgba(11, 24, 17, 0)');
    worldCtx.fillStyle = topGrad;
    worldCtx.fillRect(drawX, drawY - 2, drawW, topFadeH + 2);

    const botFadeH = drawH * 0.20;
    const botGrad = worldCtx.createLinearGradient(0, drawY + drawH - botFadeH, 0, drawY + drawH + 2);
    botGrad.addColorStop(0, 'rgba(11, 24, 17, 0)');
    botGrad.addColorStop(0.65, 'rgba(11, 24, 17, 0.72)');
    botGrad.addColorStop(1, '#0b1811');
    worldCtx.fillStyle = botGrad;
    worldCtx.fillRect(drawX, drawY + drawH - botFadeH, drawW, botFadeH + 4);

    // 4. Watermark shield in the video frame's own bottom-right coordinates
    // Covers the Gemini star accurately on both vertical phones and horizontal monitors
    const wmCenterX = drawX + drawW * 0.935;
    const wmCenterY = drawY + drawH * 0.915;
    const wmRadius = Math.max(drawW, drawH) * 0.16;

    const shieldGrad = worldCtx.createRadialGradient(
      wmCenterX, wmCenterY, wmRadius * 0.08,
      wmCenterX, wmCenterY, wmRadius
    );
    shieldGrad.addColorStop(0, '#0b1811');
    shieldGrad.addColorStop(0.52, 'rgba(14, 30, 21, 0.96)');
    shieldGrad.addColorStop(0.78, 'rgba(18, 38, 26, 0.65)');
    shieldGrad.addColorStop(1, 'rgba(18, 38, 26, 0)');

    worldCtx.fillStyle = shieldGrad;
    worldCtx.fillRect(
      drawX + drawW * 0.72,
      drawY + drawH * 0.72,
      drawW * 0.30,
      drawH * 0.30
    );
  }

  // ==========================================================================
  // 4. SCROLL SYNCHRONIZATION LOOP (60/120/144 Hz LERP + UI CARDS)
  // ==========================================================================
  const SCENE_NAMES = [
    { max: 0.08, title: 'Escena 1 · El Sobre de Invitación' },
    { max: 0.26, title: 'Escena 2 · Federico & Lara' },
    { max: 0.45, title: 'Escena 3 · Registro Civil (Acha y Elcano)' },
    { max: 0.55, title: 'Escena 4 · Llegada al Salón del Reino' },
    { max: 0.69, title: 'Escena 5 · Discurso de Bodas (Monseñor Rau 1758)' },
    { max: 0.88, title: 'Escena 6 · Salida de los Recién Casados' },
    { max: 1.01, title: 'Escena 7 · Confirmación de Asistencia' }
  ];

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

    const pct = Math.round(p * 100);
    if (progressBar) progressBar.style.width = `${ (p * 100).toFixed(2) }%`;
    if (percentLabel) percentLabel.textContent = `${ pct }%`;

    const currentScene = SCENE_NAMES.find(s => p <= s.max) || SCENE_NAMES[SCENE_NAMES.length - 1];
    if (sceneIndicatorText) sceneIndicatorText.textContent = currentScene.title;

    cornerCards.forEach(card => {
      const start = parseFloat(card.dataset.start || '0');
      const end = parseFloat(card.dataset.end || '1');
      if (p >= start && p <= end) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    let closestDot = chapterDots[0];
    let minDiff = Infinity;
    chapterDots.forEach(dot => {
      const target = parseFloat(dot.dataset.target || '0');
      const diff = Math.abs(p - target);
      if (diff < minDiff) {
        minDiff = diff;
        closestDot = dot;
      }
    });
    chapterDots.forEach(dot => dot.classList.toggle('active', dot === closestDot));
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

    renderSparkles();
    requestAnimationFrame(masterAnimationLoop);
  }

  // Chapter navigation clicks
  chapterDots.forEach(dot => {
    dot.addEventListener('click', () => {
      const target = parseFloat(dot.dataset.target || '0');
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({
        top: target * maxScroll,
        behavior: 'smooth'
      });
    });
  });

  if (btnScrollTop) {
    btnScrollTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ==========================================================================
  // 5. LIGHTWEIGHT GOLDEN SPARKLES (CSS handles the clouds at 0% CPU cost)
  // ==========================================================================
  const sparkles = [];
  for (let i = 0; i < 22; i++) {
    sparkles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2.0 + 0.8,
      vy: -(Math.random() * 0.35 + 0.12),
      vx: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.6 + 0.2
    });
  }

  function renderSparkles() {
    mistCtx.clearRect(0, 0, viewW, viewH);
    sparkles.forEach(s => {
      s.x += s.vx;
      s.y += s.vy;
      if (s.y < -10) {
        s.y = viewH + 10;
        s.x = Math.random() * viewW;
      }
      mistCtx.fillStyle = `rgba(245, 224, 172, ${ s.alpha })`;
      mistCtx.beginPath();
      mistCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      mistCtx.fill();
    });
  }

  // ==========================================================================
  // 6. COUNTDOWN TIMER (Target: Viernes 12 de Marzo de 2027, 10:50 AM UTC-3)
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
  // 7. PROCEDURAL AMBIENT HARP MUSIC CONTROLLER
  // ==========================================================================
  let audioCtx = null;
  let isMusicPlaying = false;
  let melodyTimer = null;

  const chords = [
    [293.66, 369.99, 440.00, 587.33],
    [246.94, 293.66, 369.99, 493.88],
    [196.00, 246.94, 293.66, 392.00],
    [220.00, 277.18, 329.63, 440.00]
  ];
  let chordIdx = 0;

  function playNote(freq, startTime, duration = 2.6, gainVal = 0.06) {
    if (!audioCtx || !isMusicPlaying) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  function triggerMelodyBar() {
    if (!audioCtx || !isMusicPlaying) return;
    const now = audioCtx.currentTime;
    const notes = chords[chordIdx];
    chordIdx = (chordIdx + 1) % chords.length;

    notes.forEach((freq, i) => {
      playNote(freq, now + i * 0.45, 2.8, 0.065);
      if (i === 0 || i === 2) {
        playNote(freq * 2, now + i * 0.45 + 0.12, 1.8, 0.02);
      }
    });
  }

  if (audioToggle) {
    audioToggle.addEventListener('click', () => {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      isMusicPlaying = !isMusicPlaying;
      audioToggle.classList.toggle('playing', isMusicPlaying);

      if (isMusicPlaying) {
        triggerMelodyBar();
        melodyTimer = setInterval(triggerMelodyBar, 2200);
        showToast('🎵 Música activada');
      } else {
        clearInterval(melodyTimer);
        showToast('🔇 Música silenciada');
      }
    });
  }

  // ==========================================================================
  // 8. COPY ALIAS & WHATSAPP RSVP
  // ==========================================================================
  function showToast(msg) {
    if (!toastNotice || !toastMessage) return;
    toastMessage.textContent = msg;
    toastNotice.classList.add('show');
    setTimeout(() => {
      toastNotice.classList.remove('show');
    }, 3000);
  }

  if (copyAliasBtn) {
    copyAliasBtn.addEventListener('click', () => {
      const alias = document.getElementById('bank-alias')?.textContent.trim() || 'BODA.FEDE.Y.LARA';
      navigator.clipboard.writeText(alias).then(() => {
        showToast('¡Alias copiado al portapapeles!');
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
      const message = document.getElementById('guest-message')?.value.trim();

      if (!name) {
        showToast('Por favor ingresá tu nombre');
        return;
      }

      let text = `¡Hola Fede y Lara! 💍✨\n\n`;
      text += `Quiero confirmar mi asistencia a su boda:\n`;
      text += `• *Nombre:* ${ name }\n`;
      text += `• *Asistencia:* ${ eventChoice }\n`;
      if (message) text += `• *Mensaje:* "${ message }"\n`;
      text += `\n¡Muchas felicidades! 🥂`;

      const url = `https://api.whatsapp.com/send?text=${ encodeURIComponent(text) }`;
      window.open(url, '_blank');
      showToast('¡Abriendo WhatsApp para enviar confirmación!');
    });
  }

  // Start image-sequence preloader & master loop
  preloadFrameSequence();
  updateUIForProgress(0);
  requestAnimationFrame(masterAnimationLoop);
});
