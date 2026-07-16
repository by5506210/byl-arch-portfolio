// ============================================
// CONTOUR - a site-grading game for the Aphelion
// Field fabric system. Ghost contour rings mark a
// target topography. Press-and-hold deposits a
// permanent hill into the fabric (the grid warps
// like mass pressing it, persistent via the
// dot-field terrain uniforms); double-tap cuts a
// hill away. Match the ghost contours until the
// grade is accepted. Terrace mode reads your
// earthworks as stepped contour bands.
// ============================================

(function () {
  'use strict';

  var INK = '26, 26, 26';
  var TARGET_COUNT = 3;
  var BLOB_RADIUS = 110;
  var AMP_MAX = 60;
  var FILL_RATE = 40;
  var MAX_BLOBS = 16;
  var MERGE_RADIUS = 60;
  var CUT_RADIUS = 130;
  var PRUNE_AMP = 9;
  var ACCEPT_GRADE = 0.8;
  var DOUBLE_TAP_MS = 400;
  var DOUBLE_TAP_DIST = 44;

  var page = null;
  var toggleBtn = null;
  var statusEl = null;
  var hintEl = null;
  var hintTimer = null;
  var plateCanvas = null;
  var dynCanvas = null;
  var plateCtx = null;
  var dynCtx = null;

  var running = false;
  var finished = false;
  var raf = null;
  var time = 0;
  var lastFrame = 0;
  var startTime = 0;
  var runCount = 0;
  var statusClock = -1;

  var W = 0;
  var H = 0;
  var dpr = 1;
  var blobRadius = BLOB_RADIUS;

  var targets = [];
  var blobs = [];
  var probes = [];
  var flashes = [];
  var grade = 0;
  var holding = false;
  var activeBlob = null;
  var lastTapTime = -10000;
  var lastTapX = -1000;
  var lastTapY = -1000;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isFabricFieldActive() {
    var layer = page && page.querySelector('canvas[data-field="dots"]');
    return !!(layer && layer.classList.contains('is-active'));
  }

  function formatClock(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  // Height falloff shared with the shader's "smooth" curve:
  // s = (1 - smoothstep(0, R, d))^2, height = amp * s.
  function falloff(dist) {
    if (dist >= blobRadius) return 0;
    var u = dist / blobRadius;
    var s = 1 - u * u * (3 - 2 * u);
    return s * s;
  }

  function heightAt(list, x, y) {
    var h = 0;
    for (var i = 0; i < list.length; i++) {
      var dx = x - list[i].fx * W;
      var dy = y - list[i].fy * H;
      h += list[i].amp * falloff(Math.sqrt(dx * dx + dy * dy));
    }
    return h;
  }

  // Radius where the falloff crosses a fraction of peak (for ghost rings).
  function ringRadius(level) {
    var lo = 0;
    var hi = blobRadius;
    for (var i = 0; i < 24; i++) {
      var mid = (lo + hi) / 2;
      if (falloff(mid) > level) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function ensureSurfaces() {
    if (plateCanvas) return;

    plateCanvas = document.createElement('canvas');
    plateCanvas.className = 'field-lab__plate-canvas';
    dynCanvas = document.createElement('canvas');
    dynCanvas.className = 'field-lab__plate-canvas';
    statusEl = document.createElement('div');
    statusEl.className = 'field-lab__plate-status';
    hintEl = document.createElement('div');
    hintEl.className = 'field-lab__plate-hint';
    hintEl.textContent = 'hold to fill — double-tap to cut — match the ghost contours';

    var uiAnchor = page.querySelector('.field-lab__home');
    page.insertBefore(plateCanvas, uiAnchor);
    page.insertBefore(dynCanvas, uiAnchor);
    page.appendChild(statusEl);
    page.appendChild(hintEl);

    plateCtx = plateCanvas.getContext('2d');
    dynCtx = dynCanvas.getContext('2d');
  }

  function resizeSurfaces() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    blobRadius = W < 768 ? 92 : BLOB_RADIUS;

    [plateCanvas, dynCanvas].forEach(function (canvas) {
      canvas.width = Math.ceil(W * dpr);
      canvas.height = Math.ceil(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    });
    plateCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dynCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (running) {
      buildProbes();
      drawGhosts();
    }
  }

  function generateTargets() {
    var rand = mulberry32(runCount * 362437 + 52361);
    var placed = [];
    var minGap = blobRadius * 2.4;

    for (var i = 0; i < TARGET_COUNT; i++) {
      var candidate = null;
      for (var attempt = 0; attempt < 80; attempt++) {
        var tx = 0.18 + rand() * 0.64;
        var ty = 0.22 + rand() * 0.5;
        var clear = true;
        for (var j = 0; j < placed.length; j++) {
          var dx = (tx - placed[j].fx) * W;
          var dy = (ty - placed[j].fy) * H;
          if (dx * dx + dy * dy < minGap * minGap) {
            clear = false;
            break;
          }
        }
        candidate = { fx: tx, fy: ty, amp: 30 + Math.round(rand() * 22) };
        if (clear) break;
      }
      placed.push(candidate);
    }

    return placed;
  }

  // Sample points where the two height fields are compared: each target's
  // center and two rings, plus every player hill's center (so stray
  // earthworks count against the grade).
  function buildProbes() {
    probes = [];
    for (var i = 0; i < targets.length; i++) {
      var cx = targets[i].fx * W;
      var cy = targets[i].fy * H;
      probes.push({ x: cx, y: cy });
      for (var k = 0; k < 8; k++) {
        var angle = (k / 8) * Math.PI * 2;
        probes.push({ x: cx + Math.cos(angle) * blobRadius * 0.5, y: cy + Math.sin(angle) * blobRadius * 0.5 });
        probes.push({ x: cx + Math.cos(angle) * blobRadius * 0.95, y: cy + Math.sin(angle) * blobRadius * 0.95 });
      }
    }
  }

  function computeGrade() {
    var errorSum = 0;
    var normSum = 0;
    var i;
    for (i = 0; i < probes.length; i++) {
      var ht = heightAt(targets, probes[i].x, probes[i].y);
      var hp = heightAt(blobs, probes[i].x, probes[i].y);
      errorSum += Math.abs(hp - ht);
      normSum += ht;
    }
    for (i = 0; i < blobs.length; i++) {
      var bx = blobs[i].fx * W;
      var by = blobs[i].fy * H;
      errorSum += Math.abs(heightAt(blobs, bx, by) - heightAt(targets, bx, by));
      normSum += 4;
    }
    if (normSum <= 0) return 0;
    return Math.max(0, 1 - errorSum / normSum);
  }

  function drawGhosts(accepted) {
    plateCtx.clearRect(0, 0, W, H);
    var levels = [0.75, 0.45, 0.18];
    var alphas = accepted ? [0.5, 0.42, 0.34] : [0.34, 0.27, 0.2];

    for (var i = 0; i < targets.length; i++) {
      var x = targets[i].fx * W;
      var y = targets[i].fy * H;

      for (var l = 0; l < levels.length; l++) {
        plateCtx.strokeStyle = 'rgba(' + INK + ', ' + alphas[l] + ')';
        plateCtx.lineWidth = 1;
        if (!accepted) plateCtx.setLineDash([4, 5]);
        plateCtx.beginPath();
        plateCtx.arc(x, y, ringRadius(levels[l]), 0, Math.PI * 2);
        plateCtx.stroke();
        plateCtx.setLineDash([]);
      }

      plateCtx.strokeStyle = 'rgba(' + INK + ', 0.55)';
      plateCtx.beginPath();
      plateCtx.moveTo(x - 5, y);
      plateCtx.lineTo(x + 5, y);
      plateCtx.moveTo(x, y - 5);
      plateCtx.lineTo(x, y + 5);
      plateCtx.stroke();

      plateCtx.font = '10px "Courier Prime", monospace';
      plateCtx.fillStyle = 'rgba(' + INK + ', 0.55)';
      plateCtx.fillText('+' + targets[i].amp, x + 8, y - 8);
    }
  }

  function pushTerrain() {
    if (typeof window.setDotFieldTerrain !== 'function') return;
    var list = [];
    for (var i = 0; i < blobs.length; i++) {
      list.push({
        x: blobs[i].fx * W,
        y: blobs[i].fy * H,
        amp: blobs[i].amp,
        radius: blobRadius
      });
    }
    window.setDotFieldTerrain(list);
  }

  function clearTerrain() {
    if (typeof window.setDotFieldTerrain === 'function') {
      window.setDotFieldTerrain([]);
    }
  }

  function startRun() {
    ensureSurfaces();
    running = true;
    finished = false;
    runCount++;
    time = 0;
    lastFrame = 0;
    statusClock = -1;
    startTime = performance.now();
    resizeSurfaces();
    targets = generateTargets();
    blobs = [];
    flashes = [];
    grade = 0;
    holding = false;
    activeBlob = null;
    buildProbes();
    drawGhosts();
    clearTerrain();

    plateCanvas.classList.add('is-active');
    dynCanvas.classList.add('is-active');
    statusEl.classList.add('is-visible');
    page.classList.add('is-plate');
    if (toggleBtn) {
      toggleBtn.classList.add('is-on');
      toggleBtn.textContent = '■ end contour';
    }

    if (hintTimer) clearTimeout(hintTimer);
    if (runCount === 1) {
      hintEl.classList.add('is-visible');
      hintTimer = setTimeout(function () {
        hintEl.classList.remove('is-visible');
        hintTimer = null;
      }, 5600);
    }

    if (!raf) raf = requestAnimationFrame(tick);
  }

  function stopRun() {
    running = false;
    finished = false;
    holding = false;
    activeBlob = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    clearTerrain();
    if (page) page.classList.remove('is-plate');
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = null;
    }
    if (plateCanvas) {
      plateCanvas.classList.remove('is-active');
      dynCanvas.classList.remove('is-active');
      statusEl.classList.remove('is-visible');
      hintEl.classList.remove('is-visible');
    }
    if (toggleBtn) {
      toggleBtn.classList.remove('is-on');
      toggleBtn.textContent = '▸ contour';
    }
  }

  function runLabel() {
    return 'contour ' + (runCount < 10 ? '0' : '') + runCount;
  }

  function markSurvey() {
    var done = false;
    try {
      sessionStorage.setItem('bylSurvey-contour', '1');
      done = !!(sessionStorage.getItem('bylSurvey-drift') &&
        sessionStorage.getItem('bylSurvey-sounding') &&
        sessionStorage.getItem('bylSurvey-contour'));
    } catch (err) {}
    return done;
  }

  function finishRun() {
    finished = true;
    holding = false;
    activeBlob = null;
    var finalTime = (performance.now() - startTime) / 1000;
    var surveyLine = markSurvey() ? '\nsite survey complete' : '';
    statusEl.textContent = runLabel() + ' · grade accepted\n' + formatClock(finalTime) + surveyLine;
    if (toggleBtn) toggleBtn.textContent = '▸ grade again';
    drawGhosts(true);
    for (var i = 0; i < targets.length; i++) {
      flashes.push({ x: targets[i].fx * W, y: targets[i].fy * H, start: time });
    }
  }

  function cutAt(x, y) {
    var best = -1;
    var bestAmp = 0;
    for (var i = 0; i < blobs.length; i++) {
      var dx = x - blobs[i].fx * W;
      var dy = y - blobs[i].fy * H;
      if (dx * dx + dy * dy < CUT_RADIUS * CUT_RADIUS && blobs[i].amp > bestAmp) {
        best = i;
        bestAmp = blobs[i].amp;
      }
    }
    if (best >= 0) {
      blobs.splice(best, 1);
      pushTerrain();
    }
  }

  function beginDeposit(x, y) {
    var nearest = null;
    var nearestDistSq = MERGE_RADIUS * MERGE_RADIUS;
    var fallback = null;
    var fallbackDistSq = Infinity;

    for (var i = 0; i < blobs.length; i++) {
      var dx = x - blobs[i].fx * W;
      var dy = y - blobs[i].fy * H;
      var distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearest = blobs[i];
        nearestDistSq = distSq;
      }
      if (distSq < fallbackDistSq) {
        fallback = blobs[i];
        fallbackDistSq = distSq;
      }
    }

    if (nearest) {
      activeBlob = nearest;
    } else if (blobs.length < MAX_BLOBS) {
      activeBlob = { fx: x / W, fy: y / H, amp: 6 };
      blobs.push(activeBlob);
    } else {
      activeBlob = fallback;
    }
    holding = true;
  }

  function drawDynamic() {
    dynCtx.clearRect(0, 0, W, H);

    // Deposit centers: small crosses so cuts have something to aim at.
    dynCtx.strokeStyle = 'rgba(' + INK + ', 0.45)';
    dynCtx.lineWidth = 1;
    for (var i = 0; i < blobs.length; i++) {
      var x = blobs[i].fx * W;
      var y = blobs[i].fy * H;
      dynCtx.beginPath();
      dynCtx.moveTo(x - 4, y);
      dynCtx.lineTo(x + 4, y);
      dynCtx.moveTo(x, y - 4);
      dynCtx.lineTo(x, y + 4);
      dynCtx.stroke();
    }

    for (var f = flashes.length - 1; f >= 0; f--) {
      var flash = flashes[f];
      var age = time - flash.start;
      if (age > 0.8) {
        flashes.splice(f, 1);
        continue;
      }
      var progress = age / 0.8;
      dynCtx.strokeStyle = 'rgba(' + INK + ', ' + (0.5 * (1 - progress)) + ')';
      dynCtx.lineWidth = 1.4;
      dynCtx.beginPath();
      dynCtx.arc(flash.x, flash.y, 14 + progress * 60, 0, Math.PI * 2);
      dynCtx.stroke();
    }
  }

  function updateStatus() {
    if (finished) return;
    var elapsed = (performance.now() - startTime) / 1000;
    var gradePct = Math.round(grade * 100);
    var key = Math.floor(elapsed) * 1000 + gradePct;
    if (key === statusClock) return;
    statusClock = key;
    statusEl.textContent = runLabel() + '\ngrade ' + gradePct + '% · ' + formatClock(elapsed);
  }

  function tick(timestamp) {
    raf = null;
    if (!running) return;
    if (!page.isConnected) {
      stopRun();
      return;
    }

    if (!lastFrame) lastFrame = timestamp;
    var dt = (timestamp - lastFrame) / 1000;
    lastFrame = timestamp;
    if (dt > 0.08) dt = 0.05;
    if (dt <= 0) dt = 1 / 60;
    time += dt;

    if (Math.abs(window.innerWidth - W) > 2 || Math.abs(window.innerHeight - H) > 2) {
      resizeSurfaces();
      pushTerrain();
    }

    if (holding && activeBlob && !finished) {
      activeBlob.amp = Math.min(AMP_MAX, activeBlob.amp + FILL_RATE * dt);
      pushTerrain();
    }

    grade = computeGrade();
    if (!finished && grade >= ACCEPT_GRADE) finishRun();

    drawDynamic();
    updateStatus();

    raf = requestAnimationFrame(tick);
  }

  function onToggleClick() {
    if (!running || finished) {
      startRun();
    } else {
      stopRun();
    }
  }

  function attachListeners() {
    document.addEventListener('pointerdown', function (e) {
      if (!running || finished) return;
      if (e.target.closest('.field-lab__hud') || e.target.closest('.field-lab__home')) return;

      var now = performance.now();
      var dx = e.clientX - lastTapX;
      var dy = e.clientY - lastTapY;
      var isDoubleTap = now - lastTapTime < DOUBLE_TAP_MS &&
        dx * dx + dy * dy < DOUBLE_TAP_DIST * DOUBLE_TAP_DIST;
      lastTapTime = now;
      lastTapX = e.clientX;
      lastTapY = e.clientY;

      if (isDoubleTap) {
        cutAt(e.clientX, e.clientY);
        holding = false;
        activeBlob = null;
        return;
      }

      beginDeposit(e.clientX, e.clientY);
    }, { passive: true });

    function releaseHold() {
      if (!holding && !activeBlob) return;
      holding = false;
      // Drop accidental specks (e.g. the first tap of a double-tap).
      if (activeBlob && activeBlob.amp < PRUNE_AMP) {
        var idx = blobs.indexOf(activeBlob);
        if (idx >= 0) blobs.splice(idx, 1);
        pushTerrain();
      }
      activeBlob = null;
    }

    document.addEventListener('pointerup', releaseHold, { passive: true });
    document.addEventListener('pointercancel', releaseHold, { passive: true });

    document.addEventListener('click', function (e) {
      var toggle = e.target.closest('[data-contour-toggle]');
      if (toggle) {
        onToggleClick();
        return;
      }
      var fieldChip = e.target.closest('[data-lab-field]');
      if (fieldChip) {
        var isFabric = fieldChip.getAttribute('data-lab-field') === 'fabric';
        if (!isFabric && running) stopRun();
        updateLaunchVisibility(isFabric);
      }
    });
  }

  function updateLaunchVisibility(visible) {
    if (toggleBtn) toggleBtn.classList.toggle('is-visible', !!visible);
  }

  function boot() {
    page = document.querySelector('.field-lab-page');
    if (!page) return;
    toggleBtn = page.querySelector('[data-contour-toggle]');
    attachListeners();
    updateLaunchVisibility(isFabricFieldActive());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
