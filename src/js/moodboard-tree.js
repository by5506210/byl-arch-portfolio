// ============================================
// MOODBOARD MIND-MAP  (SVG radial text diagram)
// A typographic concept map: each theme is a line of text radiating from a fixed
// center, ending in a small cluster of dots — one dot per inspo photo. The stiff
// spokes sway gently (wind) and react to the cursor sweeping past (velocity), then
// settle. Hover (or tap) a dot to show that photo large on the display side.
// Crisp HTML/SVG text — no WebGL. Falls back to the plain image grid if anything
// is missing; prefers-reduced-motion stills it.
// ============================================

(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';

  // Placeholder theme buckets. Re-bucket by adding data-theme="<name>" to the
  // .moodboard-page__item figures; untagged images spread round-robin.
  var THEME_NAMES = [
    'Light & Shadow', 'Materiality', 'Form & Mass', 'Structure',
    'Landscape', 'Texture', 'Atmosphere'
  ];

  // ---- Layout (fractions of the available half-radius) ----
  var TEXT_R = 0.14;     // where each theme word starts
  var DOT_R0 = 0.5;      // inner edge of the photo-dot cluster
  var DOT_R1 = 0.92;     // outer edge of the cluster
  var FAN = 0.62;        // cluster angular spread (fraction of the theme sector)

  // ---- Sway ----
  var WIND = 0.05;       // ambient bend (radians) the spokes drift through
  var MOUSE_REACH = 0.6; // angular reach of the cursor (radians)
  var MOUSE_TORQUE = 9;  // how hard a fast sweep pushes a spoke
  var SPRING_K = 26;     // spring back to rest
  var SPRING_C = 4.4;    // damping

  var activeStop = null;

  function el(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function readItems(scope) {
    var figs = scope.querySelectorAll('.moodboard-page__item');
    var items = [];
    for (var i = 0; i < figs.length; i++) {
      var img = figs[i].querySelector('img');
      if (!img) continue;
      var full = img.getAttribute('src') || '';
      if (!full) continue;
      items.push({
        full: full,
        alt: img.getAttribute('alt') || '',
        caption: (figs[i].querySelector('figcaption') || {}).textContent || '',
        theme: figs[i].getAttribute('data-theme') || THEME_NAMES[i % THEME_NAMES.length],
        index: i
      });
    }
    return items;
  }

  function build(mount, page, display, items) {
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // Remove any prior render (SPA re-entry) / the placeholder canvas.
    var oldCanvas = mount.querySelector('canvas');
    if (oldCanvas) oldCanvas.remove();
    var oldSvg = mount.querySelector('svg');
    if (oldSvg) oldSvg.remove();

    // Group by theme, canonical order first.
    var byTheme = {}, order = [];
    items.forEach(function (it) {
      if (!byTheme[it.theme]) { byTheme[it.theme] = []; order.push(it.theme); }
      byTheme[it.theme].push(it);
    });
    order.sort(function (a, b) {
      var ia = THEME_NAMES.indexOf(a), ib = THEME_NAMES.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

    var svg = el('svg', { 'class': 'moodboard-svg' });
    var rotor = el('g');
    svg.appendChild(rotor);
    mount.appendChild(svg);

    // Center mark.
    rotor.appendChild(el('circle', { 'class': 'mb-core', r: 3.2, cx: 0, cy: 0 }));

    var seed = 5;
    function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    var N = order.length;
    var spokes = [];
    order.forEach(function (name, i) {
      var baseRad = (i / N) * Math.PI * 2 - Math.PI / 2;
      var deg = baseRad * 180 / Math.PI;
      var nrm = ((deg % 360) + 360) % 360;
      var left = nrm > 90 && nrm < 270;

      var g = el('g', { 'class': 'mb-spoke' });
      rotor.appendChild(g);
      var line = el('line', { 'class': 'mb-spoke-line', x1: 0, y1: 0, x2: 0, y2: 0 });
      g.appendChild(line);
      var txt = el('text', { 'class': 'mb-theme', 'text-anchor': left ? 'end' : 'start', 'dominant-baseline': 'middle' });
      txt.textContent = name;
      g.appendChild(txt);

      var sectorHalf = (Math.PI / N) * FAN;
      var dots = byTheme[name].map(function (it) {
        var c = el('circle', { 'class': 'mb-dot', r: 3.6 });
        c.addEventListener('pointerenter', function () { setDisplay(it); markActive(c); });
        c.addEventListener('click', function () { setDisplay(it); markActive(c); });
        g.appendChild(c);
        return { el: c, item: it, rf: DOT_R0 + rand() * (DOT_R1 - DOT_R0), off: (rand() - 0.5) * 2 * sectorHalf };
      });

      spokes.push({ g: g, line: line, txt: txt, dots: dots, left: left, baseDeg: deg,
        phase: i * 1.73, swayOff: 0, swayVel: 0 });
    });

    var activeDot = null;
    function markActive(c) {
      if (activeDot && activeDot !== c) activeDot.classList.remove('is-active');
      activeDot = c; c.classList.add('is-active');
    }
    function setDisplay(item) {
      if (!display) return;
      var img = display.querySelector('.moodboard-display__img');
      var cap = display.querySelector('.moodboard-display__caption');
      if (item) {
        if (img && img.getAttribute('src') !== item.full) img.setAttribute('src', item.full);
        if (img) img.setAttribute('alt', item.alt);
        if (cap) cap.textContent = item.theme + (item.caption ? '  ·  ' + item.caption : '');
        display.classList.add('is-active'); page.classList.add('is-display-active');
      } else {
        display.classList.remove('is-active'); page.classList.remove('is-display-active');
        if (activeDot) { activeDot.classList.remove('is-active'); activeDot = null; }
      }
    }

    // ---- Sizing / static placement ----
    var cx = 0, cy = 0, R = 1;
    function layout() {
      var rect = mount.getBoundingClientRect();
      var w = Math.max(1, rect.width), h = Math.max(1, rect.height);
      svg.setAttribute('width', w); svg.setAttribute('height', h);
      cx = w / 2; cy = h / 2;
      R = Math.min(cx, cy) * 0.97;
      rotor.setAttribute('transform', 'translate(' + cx + ',' + cy + ')');

      var textR = R * TEXT_R;
      spokes.forEach(function (sp) {
        sp.line.setAttribute('x1', textR * 0.2);
        sp.line.setAttribute('x2', R * DOT_R1);
        // Place the theme word at textR reading outward; flip on the left half so
        // it stays upright (standard radial-label trick).
        // Theme word reads outward; on the left half flip it upright (standard
        // radial-label trick: same outward translate + rotate(180), anchor end).
        sp.txt.setAttribute('transform', 'translate(' + textR + ',0)' + (sp.left ? ' rotate(180)' : ''));
        sp.dots.forEach(function (d) {
          d.lx = Math.cos(d.off) * (R * d.rf);
          d.ly = Math.sin(d.off) * (R * d.rf);
          d.el.setAttribute('cx', d.lx.toFixed(2));
          d.el.setAttribute('cy', d.ly.toFixed(2));
        });
      });
    }

    // ---- Cursor tracking (angle + angular velocity around the center) ----
    var mAng = 0, mAngVel = 0, mRad = 0, mInside = false, mHave = false;
    function onMove(e) {
      var rect = mount.getBoundingClientRect();
      var x = e.clientX - rect.left - cx, y = e.clientY - rect.top - cy;
      var a = Math.atan2(y, x);
      mRad = Math.sqrt(x * x + y * y) / (R || 1);
      if (mHave) {
        var d = a - mAng;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        mAngVel = d;
      }
      mAng = a; mInside = true; mHave = true;
    }
    function onLeave() { mInside = false; setDisplay(null); }

    mount.addEventListener('pointermove', onMove);
    mount.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', layout);
    layout();

    // ---- Animate sway ----
    var raf = 0, last = null, t = 0;
    function frame(ts) {
      if (mount.dataset.ready !== 'true') return; // superseded
      if (last === null) last = ts;
      var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      t += dt;

      for (var i = 0; i < spokes.length; i++) {
        var sp = spokes[i];
        var rotDeg = sp.baseDeg;
        if (!reduceMotion) {
          var wind = WIND * (Math.sin(t * 0.5 + sp.phase) + 0.4 * Math.sin(t * 0.23 + sp.phase * 1.7));
          var torque = 0;
          if (mInside && mRad > 0.12 && Math.abs(mAngVel) > 0.0001) {
            var spokeRad = sp.baseDeg * Math.PI / 180;
            var da = spokeRad - mAng;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            if (Math.abs(da) < MOUSE_REACH) {
              var prox = 1 - Math.abs(da) / MOUSE_REACH;
              torque = MOUSE_TORQUE * mAngVel * prox * prox;
            }
          }
          sp.swayVel += (torque - SPRING_K * sp.swayOff - SPRING_C * sp.swayVel) * dt;
          sp.swayOff += sp.swayVel * dt;
          rotDeg += (wind + sp.swayOff) * 180 / Math.PI;
        }
        sp.g.setAttribute('transform', 'rotate(' + rotDeg.toFixed(3) + ')');
      }
      mAngVel *= 0.7;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    page.classList.add('is-mindmap-active');

    activeStop = function () {
      cancelAnimationFrame(raf);
      mount.removeEventListener('pointermove', onMove);
      mount.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', layout);
      if (svg.parentNode) svg.remove();
    };
    return true;
  }

  function initMoodboardMindmap(rootArg) {
    var scope = (rootArg && rootArg.querySelector) ? rootArg : document;
    var mount = scope.querySelector('[data-moodboard-mindmap]');
    if (!mount || mount.dataset.ready === 'true') return;
    var page = mount.closest('.moodboard-page') || scope.querySelector('.moodboard-page');
    if (!page) return;
    var display = page.querySelector('[data-moodboard-display]');
    var items = readItems(page);
    if (!items.length) return;

    if (activeStop) { try { activeStop(); } catch (e) {} activeStop = null; }
    mount.dataset.ready = 'true';
    if (!build(mount, page, display, items)) mount.dataset.ready = '';
  }

  window.initMoodboardMindmap = initMoodboardMindmap;

  if (window.barba && window.barba.hooks && typeof window.barba.hooks.after === 'function') {
    window.barba.hooks.after(function () { initMoodboardMindmap(document); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initMoodboardMindmap(document); });
  } else {
    initMoodboardMindmap(document);
  }
})();
