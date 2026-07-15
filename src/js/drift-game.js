// ============================================
// DRIFT - a traverse game for the Aphelion Field
// vector system. A single mote obeys the field:
// attract pulls it toward the cursor, repel pushes
// it, vortex slings it into orbit, scatter shakes
// it loose, and click shockwaves kick it. You never
// touch the mote - you steer the weather it lives
// in, guiding it through a sequence of survey gates.
// Its full path remains as a plotter-style drawing.
// ============================================

(function () {
  'use strict';

  var INK = '26, 26, 26';
  var GATE_COUNT = 5;
  var CURSOR_RADIUS = 320;
  var CURSOR_FORCE = 1600;
  var WAVE_SPEED = 470;
  var WAVE_BAND = 110;
  var WAVE_KICK = 1400;
  var DRAG = 1.6;
  var MAX_SPEED = 950;
  var WALL_INSET = 16;
  var WALL_BOUNCE = 0.7;

  var page = null;
  var toggleBtn = null;
  var statusEl = null;
  var traceCanvas = null;
  var dynCanvas = null;
  var traceCtx = null;
  var dynCtx = null;

  var running = false;
  var finished = false;
  var raf = null;
  var lastFrame = 0;
  var time = 0;
  var startTime = 0;
  var finalTime = 0;
  var runCount = 0;
  var statusClock = -1;

  var W = 0;
  var H = 0;
  var dpr = 1;
  var gateRadius = 34;

  var mote = { x: 0, y: 0, vx: 0, vy: 0 };
  var prevX = 0;
  var prevY = 0;
  var startFrac = { x: 0.5, y: 0.6 };
  var gates = [];
  var gateIndex = 0;
  var flashes = [];
  var waves = [];

  var pointerX = -1000;
  var pointerY = -1000;

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

  function isVectorFieldActive() {
    var vectorLayer = page && page.querySelector('#vector-field');
    return !!(vectorLayer && vectorLayer.classList.contains('is-active'));
  }

  function formatClock(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function ensureSurfaces() {
    if (traceCanvas) return;

    traceCanvas = document.createElement('canvas');
    traceCanvas.className = 'field-lab__drift-canvas';
    dynCanvas = document.createElement('canvas');
    dynCanvas.className = 'field-lab__drift-canvas';
    statusEl = document.createElement('div');
    statusEl.className = 'field-lab__drift-status';

    var uiAnchor = page.querySelector('.field-lab__home');
    page.insertBefore(traceCanvas, uiAnchor);
    page.insertBefore(dynCanvas, uiAnchor);
    page.appendChild(statusEl);

    traceCtx = traceCanvas.getContext('2d');
    dynCtx = dynCanvas.getContext('2d');
  }

  function resizeSurfaces() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    gateRadius = W < 768 ? 40 : 34;

    [traceCanvas, dynCanvas].forEach(function (canvas) {
      canvas.width = Math.ceil(W * dpr);
      canvas.height = Math.ceil(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    });
    traceCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dynCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The trace is lost on resize; restamp the datum mark so the drawing
    // keeps its origin.
    drawDatumMark(startFrac.x * W, startFrac.y * H);
    mote.x = Math.max(WALL_INSET, Math.min(W - WALL_INSET, mote.x));
    mote.y = Math.max(WALL_INSET, Math.min(H - WALL_INSET, mote.y));
    prevX = mote.x;
    prevY = mote.y;
  }

  function drawDatumMark(x, y) {
    traceCtx.strokeStyle = 'rgba(' + INK + ', 0.5)';
    traceCtx.lineWidth = 1;
    traceCtx.beginPath();
    traceCtx.moveTo(x - 7, y);
    traceCtx.lineTo(x + 7, y);
    traceCtx.moveTo(x, y - 7);
    traceCtx.lineTo(x, y + 7);
    traceCtx.stroke();
  }

  function generateGates() {
    var rand = mulberry32(runCount * 1013904223 + 12345);
    var placed = [];
    var minGap = Math.min(W, H) * 0.34;
    var prev = { x: startFrac.x, y: startFrac.y };

    for (var i = 0; i < GATE_COUNT; i++) {
      var candidate = null;
      for (var attempt = 0; attempt < 60; attempt++) {
        var gx = 0.14 + rand() * 0.72;
        var gy = 0.18 + rand() * 0.6;
        var dx = (gx - prev.x) * W;
        var dy = (gy - prev.y) * H;
        if (dx * dx + dy * dy >= minGap * minGap) {
          candidate = { x: gx, y: gy };
          break;
        }
        candidate = candidate || { x: gx, y: gy };
      }
      placed.push(candidate);
      prev = candidate;
    }

    return placed;
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
    gates = generateGates();
    gateIndex = 0;
    flashes = [];
    waves = [];

    mote.x = startFrac.x * W;
    mote.y = startFrac.y * H;
    mote.vx = 0;
    mote.vy = 0;

    traceCtx.clearRect(0, 0, W, H);
    drawDatumMark(mote.x, mote.y);
    prevX = mote.x;
    prevY = mote.y;

    traceCanvas.classList.add('is-active');
    dynCanvas.classList.add('is-active');
    statusEl.classList.add('is-visible');
    if (toggleBtn) {
      toggleBtn.classList.add('is-on');
      toggleBtn.textContent = 'drift';
    }

    if (!raf) raf = requestAnimationFrame(tick);
  }

  function stopRun() {
    running = false;
    finished = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (traceCanvas) {
      traceCanvas.classList.remove('is-active');
      dynCanvas.classList.remove('is-active');
      statusEl.classList.remove('is-visible');
    }
    if (toggleBtn) {
      toggleBtn.classList.remove('is-on');
      toggleBtn.textContent = 'drift';
    }
  }

  function finishRun() {
    finished = true;
    finalTime = (performance.now() - startTime) / 1000;
    statusEl.textContent = 'traverse complete — ' + formatClock(finalTime) + ' — drift again?';
    if (toggleBtn) toggleBtn.textContent = 'again';
  }

  // Ambient current: the same wave family the field lines ride, so the
  // idle mote visibly drifts with the weather.
  function ambientAngle(x, y, t) {
    var swell = Math.sin(x * 0.006 + t * 1.6) * 1.8 +
      Math.sin(x * 0.004 + y * 0.008 + t * 1.15) * 1.3;
    var cross = Math.cos(y * 0.01 + t * 0.9) * 0.9 +
      Math.sin(x * 0.012 - t * 1.25) * 0.65;
    var deep = Math.sin((x + y) * 0.003 + t * 0.45) * 1.0;
    return swell + cross + deep;
  }

  function applyForces(dt) {
    var ax = 0;
    var ay = 0;

    var wave = ambientAngle(mote.x, mote.y, time);
    ax += Math.cos(wave) * 34;
    ay += Math.sin(wave) * 34;

    var dx = pointerX - mote.x;
    var dy = pointerY - mote.y;
    var distSq = dx * dx + dy * dy;
    if (pointerX > -500 && distSq < CURSOR_RADIUS * CURSOR_RADIUS && distSq > 0.01) {
      var dist = Math.sqrt(distSq);
      var ux = dx / dist;
      var uy = dy / dist;
      var falloff = 1 - dist / CURSOR_RADIUS;
      falloff = falloff * falloff;
      var mode = window.__vectorFieldMode | 0;

      if (mode === 0) {
        ax += ux * CURSOR_FORCE * falloff;
        ay += uy * CURSOR_FORCE * falloff;
      } else if (mode === 1) {
        ax += (-uy + ux * 0.35) * CURSOR_FORCE * falloff;
        ay += (ux + uy * 0.35) * CURSOR_FORCE * falloff;
      } else if (mode === 2) {
        ax -= ux * CURSOR_FORCE * falloff;
        ay -= uy * CURSOR_FORCE * falloff;
      } else {
        var turb = Math.sin(mote.x * 0.011 + time * 2.2) +
          Math.cos(mote.y * 0.013 - time * 1.7) +
          Math.sin((mote.x + mote.y) * 0.008 + time * 1.3);
        var turbAngle = turb * 2.2;
        ax += Math.cos(turbAngle) * CURSOR_FORCE * falloff * 0.9;
        ay += Math.sin(turbAngle) * CURSOR_FORCE * falloff * 0.9;
      }
    }

    // Click shockwaves shove the mote outward as the front passes.
    for (var i = waves.length - 1; i >= 0; i--) {
      var w = waves[i];
      var age = time - w.start;
      var radius = age * WAVE_SPEED;
      if (radius > w.maxRadius) {
        waves.splice(i, 1);
        continue;
      }
      var wdx = mote.x - w.x;
      var wdy = mote.y - w.y;
      var wdist = Math.sqrt(wdx * wdx + wdy * wdy);
      var band = 1 - Math.abs(wdist - radius) / WAVE_BAND;
      if (band > 0 && wdist > 0.01) {
        var fade = 1 - radius / w.maxRadius;
        ax += (wdx / wdist) * WAVE_KICK * band * fade;
        ay += (wdy / wdist) * WAVE_KICK * band * fade;
      }
    }

    var drag = Math.exp(-dt * DRAG);
    mote.vx = (mote.vx + ax * dt) * drag;
    mote.vy = (mote.vy + ay * dt) * drag;

    var speedSq = mote.vx * mote.vx + mote.vy * mote.vy;
    if (speedSq > MAX_SPEED * MAX_SPEED) {
      var scale = MAX_SPEED / Math.sqrt(speedSq);
      mote.vx *= scale;
      mote.vy *= scale;
    }

    mote.x += mote.vx * dt;
    mote.y += mote.vy * dt;

    if (mote.x < WALL_INSET) { mote.x = WALL_INSET; mote.vx = -mote.vx * WALL_BOUNCE; }
    if (mote.x > W - WALL_INSET) { mote.x = W - WALL_INSET; mote.vx = -mote.vx * WALL_BOUNCE; }
    if (mote.y < WALL_INSET) { mote.y = WALL_INSET; mote.vy = -mote.vy * WALL_BOUNCE; }
    if (mote.y > H - WALL_INSET) { mote.y = H - WALL_INSET; mote.vy = -mote.vy * WALL_BOUNCE; }
  }

  function checkGate() {
    if (finished || gateIndex >= gates.length) return;
    var gate = gates[gateIndex];
    var gx = gate.x * W;
    var gy = gate.y * H;
    var dx = mote.x - gx;
    var dy = mote.y - gy;
    var passRadius = gateRadius * 0.8;

    if (dx * dx + dy * dy < passRadius * passRadius) {
      flashes.push({ x: gx, y: gy, start: time });
      stampGateMark(gx, gy, gateIndex + 1);
      gateIndex++;
      if (gateIndex >= gates.length) finishRun();
    }
  }

  // Fixed gates become part of the permanent plate: a small station dot,
  // its circle, and a Courier station number.
  function stampGateMark(x, y, index) {
    traceCtx.strokeStyle = 'rgba(' + INK + ', 0.3)';
    traceCtx.lineWidth = 1;
    traceCtx.beginPath();
    traceCtx.arc(x, y, gateRadius * 0.8, 0, Math.PI * 2);
    traceCtx.stroke();
    traceCtx.fillStyle = 'rgba(' + INK + ', 0.65)';
    traceCtx.beginPath();
    traceCtx.arc(x, y, 2.2, 0, Math.PI * 2);
    traceCtx.fill();
    traceCtx.font = '10px "Courier Prime", monospace';
    traceCtx.fillStyle = 'rgba(' + INK + ', 0.5)';
    traceCtx.fillText('0' + index, x + gateRadius * 0.8 + 5, y + 3);
  }

  function drawTraceSegment() {
    var dx = mote.x - prevX;
    var dy = mote.y - prevY;
    if (dx * dx + dy * dy < 0.09) return;
    traceCtx.strokeStyle = 'rgba(' + INK + ', 0.42)';
    traceCtx.lineWidth = 1.1;
    traceCtx.lineCap = 'round';
    traceCtx.beginPath();
    traceCtx.moveTo(prevX, prevY);
    traceCtx.lineTo(mote.x, mote.y);
    traceCtx.stroke();
    prevX = mote.x;
    prevY = mote.y;
  }

  function drawDynamic() {
    dynCtx.clearRect(0, 0, W, H);

    if (!finished && gateIndex < gates.length) {
      var gate = gates[gateIndex];
      var gx = gate.x * W;
      var gy = gate.y * H;
      var pulse = gateRadius + Math.sin(time * 2.6) * 2.5;

      dynCtx.strokeStyle = 'rgba(' + INK + ', 0.5)';
      dynCtx.lineWidth = 1.1;
      dynCtx.setLineDash([5, 6]);
      dynCtx.beginPath();
      dynCtx.arc(gx, gy, pulse, 0, Math.PI * 2);
      dynCtx.stroke();
      dynCtx.setLineDash([]);

      // Crosshair ticks outside the ring.
      dynCtx.beginPath();
      dynCtx.moveTo(gx - pulse - 7, gy);
      dynCtx.lineTo(gx - pulse - 2, gy);
      dynCtx.moveTo(gx + pulse + 2, gy);
      dynCtx.lineTo(gx + pulse + 7, gy);
      dynCtx.moveTo(gx, gy - pulse - 7);
      dynCtx.lineTo(gx, gy - pulse - 2);
      dynCtx.moveTo(gx, gy + pulse + 2);
      dynCtx.lineTo(gx, gy + pulse + 7);
      dynCtx.stroke();

      dynCtx.font = '10px "Courier Prime", monospace';
      dynCtx.fillStyle = 'rgba(' + INK + ', 0.55)';
      dynCtx.fillText('0' + (gateIndex + 1), gx + pulse + 6, gy - pulse - 4);
    }

    for (var i = flashes.length - 1; i >= 0; i--) {
      var flash = flashes[i];
      var age = time - flash.start;
      if (age > 0.6) {
        flashes.splice(i, 1);
        continue;
      }
      var progress = age / 0.6;
      dynCtx.strokeStyle = 'rgba(' + INK + ', ' + (0.5 * (1 - progress)) + ')';
      dynCtx.lineWidth = 1.4;
      dynCtx.beginPath();
      dynCtx.arc(flash.x, flash.y, gateRadius * 0.8 + progress * 46, 0, Math.PI * 2);
      dynCtx.stroke();
    }

    dynCtx.fillStyle = 'rgba(' + INK + ', 0.9)';
    dynCtx.beginPath();
    dynCtx.arc(mote.x, mote.y, 4.4, 0, Math.PI * 2);
    dynCtx.fill();
    dynCtx.strokeStyle = 'rgba(' + INK + ', 0.3)';
    dynCtx.lineWidth = 1;
    dynCtx.beginPath();
    dynCtx.arc(mote.x, mote.y, 9.5, 0, Math.PI * 2);
    dynCtx.stroke();
  }

  function updateStatus() {
    if (finished) return;
    var elapsed = (performance.now() - startTime) / 1000;
    var second = Math.floor(elapsed);
    if (second === statusClock) return;
    statusClock = second;
    statusEl.textContent = 'traverse — gate ' + Math.min(gateIndex + 1, gates.length) +
      '/' + gates.length + ' — ' + formatClock(elapsed);
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
    }

    applyForces(dt);
    checkGate();
    drawTraceSegment();
    drawDynamic();
    updateStatus();

    raf = requestAnimationFrame(tick);
  }

  function onToggleClick() {
    if (!running) {
      startRun();
    } else if (finished) {
      startRun();
    } else {
      stopRun();
    }
  }

  function attachListeners() {
    document.addEventListener('mousemove', function (e) {
      pointerX = e.clientX;
      pointerY = e.clientY;
    });
    document.addEventListener('mouseleave', function () {
      pointerX = -1000;
      pointerY = -1000;
    });
    document.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches.length) return;
      pointerX = e.touches[0].clientX;
      pointerY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!e.touches || !e.touches.length) return;
      pointerX = e.touches[0].clientX;
      pointerY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', function () {
      pointerX = -1000;
      pointerY = -1000;
    }, { passive: true });

    // Clicks in the field kick the mote via the same shockwave the vector
    // renderer draws. HUD/nav clicks don't count.
    document.addEventListener('pointerdown', function (e) {
      if (!running) return;
      if (e.target.closest('.field-lab__hud') || e.target.closest('.field-lab__home')) return;
      waves.push({
        x: e.clientX,
        y: e.clientY,
        start: time,
        maxRadius: Math.max(W, H) * 0.8
      });
      if (waves.length > 8) waves.shift();
    }, { passive: true });

    document.addEventListener('click', function (e) {
      var toggle = e.target.closest('[data-drift-toggle]');
      if (toggle) {
        onToggleClick();
        return;
      }
      // Leaving the vector system parks the game.
      var fieldChip = e.target.closest('[data-lab-field]');
      if (fieldChip && fieldChip.getAttribute('data-lab-field') !== 'vector' && running) {
        stopRun();
      }
    });
  }

  function boot() {
    page = document.querySelector('.field-lab-page');
    if (!page) return;
    toggleBtn = page.querySelector('[data-drift-toggle]');
    attachListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
