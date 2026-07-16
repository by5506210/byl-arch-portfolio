// ============================================
// SOUNDING - a site-investigation game for the
// Aphelion Field dot system. Buried stations hide
// in the field. Click pulses are sonar pings: when
// your wavefront sweeps over a station it answers
// with a counter-ripple from its own position.
// Triangulate the echo, then press-and-hold on top
// of it to core-sample. Located stations stamp
// borehole marks onto the plate.
// ============================================

(function () {
  'use strict';

  var INK = '26, 26, 26';
  var NODE_COUNT = 4;
  var PING_SPEED = 520;
  var ECHO_POWER = 0.55;
  var ECHO_DELAY_MS = 170;
  var ECHO_COOLDOWN = 1.4;
  var CORE_RADIUS = 56;
  var HOLD_MS = 450;

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

  var nodes = [];
  var pings = [];
  var flashes = [];
  var foundCount = 0;
  var holdStart = 0;

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

  function isDotsFieldActive() {
    var layer = page && page.querySelector('canvas[data-field="pressure-dots"]');
    return !!(layer && layer.classList.contains('is-active'));
  }

  function formatClock(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
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
    hintEl.textContent = 'click to ping — buried stations echo back — hold to core-sample';

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

    [plateCanvas, dynCanvas].forEach(function (canvas) {
      canvas.width = Math.ceil(W * dpr);
      canvas.height = Math.ceil(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    });
    plateCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dynCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Marks are lost on resize; restamp located stations.
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].found) stampBoreholeMark(nodes[i]);
    }
  }

  function generateNodes() {
    var rand = mulberry32(runCount * 747796405 + 96821);
    var placed = [];
    var minGap = Math.min(W, H) * 0.3;

    for (var i = 0; i < NODE_COUNT; i++) {
      var candidate = null;
      for (var attempt = 0; attempt < 80; attempt++) {
        var nx = 0.12 + rand() * 0.76;
        var ny = 0.16 + rand() * 0.62;
        var clear = true;
        for (var j = 0; j < placed.length; j++) {
          var dx = (nx - placed[j].x) * W;
          var dy = (ny - placed[j].y) * H;
          if (dx * dx + dy * dy < minGap * minGap) {
            clear = false;
            break;
          }
        }
        candidate = { x: nx, y: ny, found: false, lastEcho: -10, index: i + 1 };
        if (clear) break;
      }
      placed.push(candidate);
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
    nodes = generateNodes();
    pings = [];
    flashes = [];
    foundCount = 0;
    holdStart = 0;

    plateCtx.clearRect(0, 0, W, H);

    plateCanvas.classList.add('is-active');
    dynCanvas.classList.add('is-active');
    statusEl.classList.add('is-visible');
    page.classList.add('is-plate');
    if (toggleBtn) {
      toggleBtn.classList.add('is-on');
      toggleBtn.textContent = '■ end sounding';
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
    if (raf) cancelAnimationFrame(raf);
    raf = null;
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
      toggleBtn.textContent = '▸ sounding';
    }
  }

  function runLabel() {
    return 'sounding ' + (runCount < 10 ? '0' : '') + runCount;
  }

  function markSurvey() {
    var done = false;
    try {
      sessionStorage.setItem('bylSurvey-sounding', '1');
      done = !!(sessionStorage.getItem('bylSurvey-drift') &&
        sessionStorage.getItem('bylSurvey-sounding') &&
        sessionStorage.getItem('bylSurvey-contour'));
    } catch (err) {}
    return done;
  }

  function finishRun() {
    finished = true;
    var finalTime = (performance.now() - startTime) / 1000;
    var surveyLine = markSurvey() ? '\nsite survey complete' : '';
    statusEl.textContent = runLabel() + ' · complete\n' + formatClock(finalTime) + surveyLine;
    if (toggleBtn) toggleBtn.textContent = '▸ sound again';
  }

  // Borehole symbol: circle with two opposite quadrants filled, plus a
  // station label — standard drawing-set shorthand.
  function stampBoreholeMark(node) {
    var x = node.x * W;
    var y = node.y * H;
    var r = 9;

    plateCtx.strokeStyle = 'rgba(' + INK + ', 0.7)';
    plateCtx.lineWidth = 1.1;
    plateCtx.beginPath();
    plateCtx.arc(x, y, r, 0, Math.PI * 2);
    plateCtx.stroke();

    plateCtx.fillStyle = 'rgba(' + INK + ', 0.6)';
    plateCtx.beginPath();
    plateCtx.moveTo(x, y);
    plateCtx.arc(x, y, r, -Math.PI / 2, 0);
    plateCtx.closePath();
    plateCtx.fill();
    plateCtx.beginPath();
    plateCtx.moveTo(x, y);
    plateCtx.arc(x, y, r, Math.PI / 2, Math.PI);
    plateCtx.closePath();
    plateCtx.fill();

    plateCtx.font = '10px "Courier Prime", monospace';
    plateCtx.fillStyle = 'rgba(' + INK + ', 0.55)';
    plateCtx.fillText('B' + node.index, x + r + 5, y + 3);
  }

  function firePing(x, y) {
    pings.push({ x: x, y: y, start: time, echoed: {} });
    if (pings.length > 6) pings.shift();
  }

  function tryCore(x, y) {
    var best = null;
    var bestDistSq = CORE_RADIUS * CORE_RADIUS;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].found) continue;
      var dx = x - nodes[i].x * W;
      var dy = y - nodes[i].y * H;
      var distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        best = nodes[i];
        bestDistSq = distSq;
      }
    }
    if (!best) return;

    best.found = true;
    foundCount++;
    stampBoreholeMark(best);
    flashes.push({ x: best.x * W, y: best.y * H, start: time });
    if (foundCount >= NODE_COUNT) finishRun();
  }

  function updatePings() {
    var maxRadius = Math.max(W, H) * 1.1;
    for (var i = pings.length - 1; i >= 0; i--) {
      var ping = pings[i];
      var radius = (time - ping.start) * PING_SPEED;
      if (radius > maxRadius) {
        pings.splice(i, 1);
        continue;
      }
      for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        if (node.found || ping.echoed[n]) continue;
        var dx = node.x * W - ping.x;
        var dy = node.y * H - ping.y;
        if (radius * radius >= dx * dx + dy * dy) {
          ping.echoed[n] = true;
          if (time - node.lastEcho > ECHO_COOLDOWN) {
            node.lastEcho = time;
            scheduleEcho(node);
          }
        }
      }
    }
  }

  function scheduleEcho(node) {
    var echoX = node.x * W;
    var echoY = node.y * H;
    setTimeout(function () {
      if (!running || typeof window.pressureDotsPulse !== 'function') return;
      window.pressureDotsPulse(echoX, echoY, ECHO_POWER);
    }, ECHO_DELAY_MS);
  }

  function drawDynamic() {
    dynCtx.clearRect(0, 0, W, H);

    for (var i = flashes.length - 1; i >= 0; i--) {
      var flash = flashes[i];
      var age = time - flash.start;
      if (age > 0.7) {
        flashes.splice(i, 1);
        continue;
      }
      var progress = age / 0.7;
      dynCtx.strokeStyle = 'rgba(' + INK + ', ' + (0.55 * (1 - progress)) + ')';
      dynCtx.lineWidth = 1.4;
      dynCtx.beginPath();
      dynCtx.arc(flash.x, flash.y, 12 + progress * 52, 0, Math.PI * 2);
      dynCtx.stroke();
    }
  }

  function updateStatus() {
    if (finished) return;
    var elapsed = (performance.now() - startTime) / 1000;
    var key = Math.floor(elapsed) * 10 + foundCount;
    if (key === statusClock) return;
    statusClock = key;
    statusEl.textContent = runLabel() + '\n' + foundCount + '/' + NODE_COUNT +
      ' located · ' + formatClock(elapsed);
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

    updatePings();
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
      if (!running) return;
      if (e.target.closest('.field-lab__hud') || e.target.closest('.field-lab__home')) return;
      holdStart = performance.now();
    }, { passive: true });

    // The dots field itself pulses on release (short press = ping,
    // long press = charged thump). The game reads the same gesture:
    // short = sonar ping, long = core sample at the release point.
    document.addEventListener('pointerup', function (e) {
      if (!running || !holdStart) return;
      var heldMs = performance.now() - holdStart;
      holdStart = 0;
      if (e.target.closest('.field-lab__hud') || e.target.closest('.field-lab__home')) return;
      if (heldMs >= HOLD_MS) {
        tryCore(e.clientX, e.clientY);
      }
      // Every release fires a dots pulse, so track it as a sonar ping
      // regardless — core-sample thumps sweep the field too.
      firePing(e.clientX, e.clientY);
    }, { passive: true });

    document.addEventListener('click', function (e) {
      var toggle = e.target.closest('[data-sounding-toggle]');
      if (toggle) {
        onToggleClick();
        return;
      }
      var fieldChip = e.target.closest('[data-lab-field]');
      if (fieldChip) {
        var isDots = fieldChip.getAttribute('data-lab-field') === 'dots';
        if (!isDots && running) stopRun();
        updateLaunchVisibility(isDots);
      }
    });
  }

  function updateLaunchVisibility(visible) {
    if (toggleBtn) toggleBtn.classList.toggle('is-visible', !!visible);
  }

  function boot() {
    page = document.querySelector('.field-lab-page');
    if (!page) return;
    toggleBtn = page.querySelector('[data-sounding-toggle]');
    attachListeners();
    updateLaunchVisibility(isDotsFieldActive());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
