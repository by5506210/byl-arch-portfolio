// ============================================
// MOODBOARD MIND-MAP  (WebGL radial text diagram)
// A typographic concept map in three.js: every photo is a descriptive line of
// text radiating from an open center ring. Phrases vary in length — long ones
// start near the hub so their inner ends pack into a ring of text that "draws" the
// circle, while shorter ones are pushed outward so the lines don't overlap.
// Themes are labelled by light dividers in the gaps. The diagram breathes and each
// group drifts; the cursor / a finger drag nudges groups. Hover or tap a branch to
// show its photo and turn that line black. Auto-fits the partition; rendered at a
// forced 2x with mipmapped, anisotropic text for resolution. Falls back to the grid.
// ============================================

(function () {
  'use strict';

  var THREE_SOURCES = [
    '../src/js/vendor/three.min.js',
    'https://unpkg.com/three@0.152.2/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js'
  ];

  var THEME_NAMES = [
    'Light & Shadow', 'Materiality', 'Form & Mass', 'Structure',
    'Landscape', 'Texture', 'Atmosphere'
  ];

  // Placeholder descriptors (images have no captions yet). Override per image with
  // data-desc="..." on its .moodboard-page__item figure.
  var WORDS_A = ['raw concrete', 'board-formed concrete', 'weathered timber', 'blackened steel',
    'pale travertine', 'rammed earth', 'lime plaster', 'brushed brass', 'rough-cut stone',
    'smoked glass', 'oiled oak', 'corrugated zinc', 'cast bronze', 'bush-hammered concrete',
    'charred cedar', 'terracotta', 'polished terrazzo', 'raw plywood'];
  var WORDS_B = ['holding', 'dissolving into', 'folded against', 'washed by', 'carved out by',
    'warmed by', 'split by', 'wrapped in', 'grounded by', 'opening onto', 'softened under',
    'pierced by', 'framing'];
  var WORDS_C = ['the last afternoon light', 'a low northern sun', 'a sheet of falling water',
    'a deep even shadow', 'a quiet sunken courtyard', 'morning fog', 'a single high skylight',
    'the seam of the horizon', 'a cantilevered void', 'reflected sky', 'a candle-soft glow',
    'a long quiet corridor'];
  var WORDS_D = ['before dusk', 'at rest', 'in silence', 'drawn underground', 'at the soft edge',
    'held a moment still', 'in the round', 'off the open sea', 'at first light', 'through cut stone',
    'where the room goes quiet', 'as the day gives out'];

  // ---- Layout ----
  var INNER_R = 3.0;        // radius of the central ring of text (where long lines begin)
  var OUTER_PUSH = 2.6;     // how far short lines are pushed out from the ring
  var RING_JITTER = 0.4;    // per-line radial offset (4 levels) so neighbours never overlap
  var RING_LEVELS = 4;
  var CENTER_R = 0.55;      // where each group's anchor spokes begin (just off the hub)
  var ANCHOR_STEP = 0.6;    // radial stagger between a group's anchor spokes
  var TEXT_H = 0.2;         // world height of a branch line
  var THEME_TEXT_H = 0.26;  // smaller, minimal divider labels
  var GAP_SLOTS = 2;
  var TEXT_CAP = 2800;      // room for the long phrases
  var FIT_MARGIN = 1.0;     // fit the content tight to the partition

  // ---- Type ----
  var FONT_PX = 44;
  var FONT_WEIGHT = 300;
  var INK_BRANCH = '#2c2823';
  var INK_THEME = '#8b8478';      // lighter, not so black
  var BRANCH_OPACITY = 0.95;
  var THEME_OPACITY = 0.7;
  var THEME_WEIGHT = 300;

  // ---- Motion ----
  var GLOBAL_AMP = 0.06;
  var AMBIENT_FRAC = 0.6;
  var MOUSE_REACH = 0.5;
  var MOUSE_TORQUE = 6;
  var SPRING_K = 20;
  var SPRING_C = 4.0;
  var ENTRY_DUR = 0.9;      // bloom-in duration (seconds)
  var ENTRY_SCALE0 = 0.6;   // scale the diagram blooms up from
  var INDIV_SWAY = 0.03;    // tiny per-phrase flutter on top of the group sway (rad)

  var instanceId = 0;
  var activeStop = null;

  function loadThree(onReady) {
    if (window.THREE) { onReady(true); return; }
    var i = 0;
    function next() {
      if (window.THREE) { onReady(true); return; }
      if (i >= THREE_SOURCES.length) { onReady(false); return; }
      var existing = document.querySelector('script[data-mb-three="' + i + '"]');
      if (existing) {
        existing.addEventListener('load', function () { onReady(!!window.THREE); }, { once: true });
        existing.addEventListener('error', function () { i++; next(); }, { once: true });
        return;
      }
      var s = document.createElement('script');
      s.src = THREE_SOURCES[i]; s.async = true; s.dataset.mbThree = String(i);
      s.onload = function () { onReady(!!window.THREE); };
      s.onerror = function () { i++; next(); };
      document.head.appendChild(s);
    }
    next();
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
        desc: figs[i].getAttribute('data-desc') || '',
        theme: figs[i].getAttribute('data-theme') || THEME_NAMES[i % THEME_NAMES.length],
        index: i
      });
    }
    return items;
  }

  function buildScene(mount, page, display, items) {
    var THREE = window.THREE;
    var myId = ++instanceId;
    var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var textCap = coarse ? 1800 : TEXT_CAP; // keep texture memory sane on phones

    Array.prototype.forEach.call(mount.querySelectorAll('canvas, svg'), function (n) { n.remove(); });
    var canvas = document.createElement('canvas');
    mount.appendChild(canvas);

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) { return false; }
    renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    var maxAniso = (renderer.capabilities && renderer.capabilities.getMaxAnisotropy) ? renderer.capabilities.getMaxAnisotropy() : 1;

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    camera.position.z = 10;
    var root = new THREE.Group();
    scene.add(root);

    var seed = 11;
    function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function pick(a) { return a[Math.floor(rand() * a.length)]; }
    // Wide length spread (deep valleys -> tall hills) with a long average, so the
    // outer edge reads as varied ridges rather than a uniform ring.
    function describe(it) {
      if (it.desc) return it.desc;
      var core = pick(WORDS_A) + ' ' + pick(WORDS_B) + ' ' + pick(WORDS_C);
      var r = rand();
      if (r < 0.08) return pick(WORDS_A);                                   // valley
      if (r < 0.18) return pick(WORDS_A) + ', ' + pick(WORDS_C);            // short
      if (r < 0.36) return core;                                           // medium
      if (r < 0.60) return core + ', ' + pick(WORDS_D);                     // long
      if (r < 0.84) return core + ', ' + pick(WORDS_D) + ', ' + pick(WORDS_A) + ' ' + pick(WORDS_B) + ' ' + pick(WORDS_C); // taller
      return core + ', ' + pick(WORDS_D) + ', ' + pick(WORDS_A) + ' ' + pick(WORDS_B) + ' ' + pick(WORDS_C) + ' ' + pick(WORDS_D); // hill
    }
    // Extra-long phrases for the anchor spokes that reach the center.
    function describeLong(it) {
      if (it.desc) return it.desc;
      return pick(WORDS_A) + ' ' + pick(WORDS_B) + ' ' + pick(WORDS_C) + ', ' + pick(WORDS_D) + ', '
        + pick(WORDS_A) + ' ' + pick(WORDS_B) + ' ' + pick(WORDS_C) + ' ' + pick(WORDS_D);
    }

    function textPlane(str, worldH, opacity, weight, color) {
      var pad = 12;
      var probe = document.createElement('canvas').getContext('2d');
      probe.font = weight + ' ' + FONT_PX + 'px Inter, system-ui, sans-serif';
      var tw = Math.min(textCap, Math.ceil(probe.measureText(str).width));
      var w = tw + pad * 2, h = Math.ceil(FONT_PX * 1.5);
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      var ctx = cv.getContext('2d');
      ctx.font = weight + ' ' + FONT_PX + 'px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'middle'; ctx.fillStyle = color;
      ctx.fillText(str, pad, h / 2);
      var tex = new THREE.CanvasTexture(cv);
      if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      var worldW = worldH * (w / h);
      var mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(worldW, worldH),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: opacity })
      );
      mesh.userData.worldW = worldW;
      return mesh;
    }

    // ---- Group by theme ----
    var byTheme = {}, order = [];
    items.forEach(function (it) {
      if (!byTheme[it.theme]) { byTheme[it.theme] = []; order.push(it.theme); }
      byTheme[it.theme].push(it);
    });
    order.sort(function (a, b) {
      var ia = THEME_NAMES.indexOf(a), ib = THEME_NAMES.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

    root.add(new THREE.Mesh(new THREE.RingGeometry(0.34, 0.355, 64),
      new THREE.MeshBasicMaterial({ color: 0x8b8478, transparent: true, opacity: 0.5 })));

    var totalSlots = items.length + order.length * GAP_SLOTS;
    var slotAng = (Math.PI * 2) / totalSlots;
    var gapAng = GAP_SLOTS * slotAng;
    var maxRot = gapAng * 0.42;

    var branches = [];
    var groups = [];
    var dividerData = [];
    var pending = [];
    var slot = 0, gi = 0;

    // Pass A: create + measure every branch line.
    order.forEach(function (themeName) {
      var grp = new THREE.Group();
      root.add(grp);
      var bucket = byTheme[themeName];
      var startSlot = slot;
      // The central 2-3 lines of the group are anchors: extra-long, reaching the hub.
      var n = bucket.length, mid = (n - 1) / 2;
      var anchorCount = Math.min(n, n >= 7 ? 3 : 2);
      var byDist = [];
      for (var bi = 0; bi < n; bi++) byDist.push(bi);
      byDist.sort(function (a, b) { return Math.abs(a - mid) - Math.abs(b - mid); });
      var anchorRank = {};
      for (var ar = 0; ar < anchorCount; ar++) anchorRank[byDist[ar]] = ar;
      bucket.forEach(function (it, j) {
        var ang = slot * slotAng - Math.PI / 2;
        slot++;
        var isAnchor = anchorRank.hasOwnProperty(j);
        var mesh = textPlane(isAnchor ? describeLong(it) : describe(it), TEXT_H, BRANCH_OPACITY, FONT_WEIGHT, INK_BRANCH);
        pending.push({ mesh: mesh, ang: ang, grp: grp, gi: gi++, item: it, worldW: mesh.userData.worldW,
          anchor: isAnchor, anchorRank: isAnchor ? anchorRank[j] : -1 });
      });
      var endSlot = slot;
      dividerData.push({ ang: startSlot * slotAng - Math.PI / 2 - gapAng * 0.5, name: themeName });
      groups.push({ grp: grp, midAng: ((startSlot + endSlot) * 0.5) * slotAng - Math.PI / 2,
        halfSpan: (endSlot - startSlot) * 0.5 * slotAng, swayOff: 0, swayVel: 0, phase: rand() * 6.28 });
      slot += GAP_SLOTS;
    });

    // Pass B: position by length — long lines anchor the inner ring, short lines
    // get pushed outward, so the inner ends form a circle and lines don't collide.
    var maxWorldW = 0.001;
    pending.forEach(function (p) { if (p.worldW > maxWorldW) maxWorldW = p.worldW; });
    var longRef = maxWorldW * 0.8;
    var maxExtent = INNER_R + 2;
    pending.forEach(function (p) {
      var rInner;
      if (p.anchor) {
        // Reach in to the center ring, staggered so a group's spokes don't collide.
        rInner = CENTER_R + p.anchorRank * ANCHOR_STEP;
      } else {
        var lengthFrac = Math.min(1, p.worldW / longRef);
        rInner = INNER_R + (1 - lengthFrac) * OUTER_PUSH + (p.gi % RING_LEVELS) * RING_JITTER;
      }
      var left = Math.cos(p.ang) < 0;
      var rMid = rInner + p.worldW * 0.5;
      var baseRot = left ? p.ang + Math.PI : p.ang;
      p.mesh.position.set(Math.cos(p.ang) * rMid, Math.sin(p.ang) * rMid, 0);
      p.mesh.rotation.z = baseRot;
      p.grp.add(p.mesh);
      branches.push({ mesh: p.mesh, item: p.item, baseAngle: p.ang, rInner: rInner, grp: p.grp,
        baseRot: baseRot, phase: rand() * 6.28 });
      maxExtent = Math.max(maxExtent, rInner + p.worldW);
    });

    var fitHalf = maxExtent * FIT_MARGIN;

    // Dividers (faint line + light minimal theme label).
    dividerData.forEach(function (d) {
      var left = Math.cos(d.ang) < 0;
      var lineIn = INNER_R * 0.5, lineOut = fitHalf * 0.97;
      var lineLen = lineOut - lineIn, lineMid = lineIn + lineLen * 0.5;
      var line = new THREE.Mesh(new THREE.PlaneGeometry(lineLen, 0.014),
        new THREE.MeshBasicMaterial({ color: 0x8b8478, transparent: true, opacity: 0.16 }));
      line.position.set(Math.cos(d.ang) * lineMid, Math.sin(d.ang) * lineMid, -0.2);
      line.rotation.z = d.ang;
      root.add(line);
      var tl = textPlane(d.name.toLowerCase(), THEME_TEXT_H, THEME_OPACITY, THEME_WEIGHT, INK_THEME);
      var lr = lineIn + lineLen * 0.4;
      tl.position.set(Math.cos(d.ang) * lr, Math.sin(d.ang) * lr, 0.2);
      tl.rotation.z = left ? d.ang + Math.PI : d.ang;
      root.add(tl);
    });

    // ---- Sizing ----
    var viewW = 1, viewH = 1;
    function resize() {
      var rect = mount.getBoundingClientRect();
      viewW = Math.max(1, Math.round(rect.width));
      viewH = Math.max(1, Math.round(rect.height));
      renderer.setPixelRatio(Math.min(2.5, Math.max(window.devicePixelRatio || 1, 2)));
      renderer.setSize(viewW, viewH, false);
      var aspect = viewW / viewH;
      var hx = aspect >= 1 ? fitHalf * aspect : fitHalf;
      var hy = aspect >= 1 ? fitHalf : fitHalf / aspect;
      camera.left = -hx; camera.right = hx; camera.top = hy; camera.bottom = -hy;
      camera.updateProjectionMatrix();
    }
    resize();

    // ---- Pointer (mouse + touch) ----
    var current = null;
    var hasFine = !coarse;
    var dragging = false;
    var mAng = 0, mAngVel = 0, mRad = 0, mInside = false, mHave = false;

    function toWorld(clientX, clientY) {
      var rect = mount.getBoundingClientRect();
      var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      var ny = -((clientY - rect.top) / rect.height) * 2 + 1;
      return { x: nx * camera.right, y: ny * camera.top };
    }
    function setDisplay(item) {
      if (!display) return;
      var img = display.querySelector('.moodboard-display__img');
      var cap = display.querySelector('.moodboard-display__caption');
      if (item) {
        if (img && img.getAttribute('src') !== item.full) img.setAttribute('src', item.full);
        if (img) img.setAttribute('alt', item.alt);
        if (cap) cap.textContent = item.theme;
        display.classList.add('is-active'); page.classList.add('is-display-active');
      } else {
        display.classList.remove('is-active'); page.classList.remove('is-display-active');
      }
    }
    // Highlight: the selected line turns black and opaque; the rest stay soft.
    function highlight(br) {
      if (current === br) return;
      if (current) { current.mesh.material.color.setHex(0xffffff); current.mesh.material.opacity = BRANCH_OPACITY; }
      current = br;
      if (br) { br.mesh.material.color.setHex(0x000000); br.mesh.material.opacity = 1; }
      setDisplay(br ? br.item : null);
      mount.classList.toggle('is-hovering', !!br);
    }
    function nearestBranch(wx, wy) {
      var a = Math.atan2(wy, wx), r = Math.sqrt(wx * wx + wy * wy);
      if (r < INNER_R * 0.4) return null;
      var best = null, bestD = 0.1;
      for (var i = 0; i < branches.length; i++) {
        var br = branches[i];
        var da = (br.baseAngle + br.grp.rotation.z + root.rotation.z) - a;
        while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
        da = Math.abs(da);
        if (da < bestD && r > br.rInner - 0.3 && r < br.rInner + br.mesh.userData.worldW + 0.4) { bestD = da; best = br; }
      }
      return best;
    }
    function track(clientX, clientY) {
      var w = toWorld(clientX, clientY);
      var a = Math.atan2(w.y, w.x);
      mRad = Math.sqrt(w.x * w.x + w.y * w.y) / fitHalf;
      if (mHave) { var d = a - mAng; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; mAngVel = d; }
      mAng = a; mInside = true; mHave = true;
      return w;
    }
    // Hover on desktop; on touch, a finger drag continuously reveals the photo too.
    function onMove(e) { var w = track(e.clientX, e.clientY); if (hasFine || dragging) highlight(nearestBranch(w.x, w.y)); }
    function onDown(e) { dragging = true; var w = track(e.clientX, e.clientY); mAngVel = 0; if (!hasFine) highlight(nearestBranch(w.x, w.y)); }
    function onUp() { dragging = false; mInside = false; mAngVel = 0; }
    function onClick(e) { var w = toWorld(e.clientX, e.clientY); var hit = nearestBranch(w.x, w.y); if (hit) highlight(hit); }
    function onLeave() { mInside = false; if (hasFine) highlight(null); }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    window.addEventListener('resize', resize);

    // ---- Animate ----
    var raf = 0, last = null, t = 0;
    function frame(ts) {
      if (myId !== instanceId) return;
      if (last === null) last = ts;
      var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      t += dt;

      // Bloom: scale the whole diagram up from the center on entry.
      var entryEase = 1 - Math.pow(1 - Math.min(1, t / ENTRY_DUR), 3);
      var entryScale = ENTRY_SCALE0 + (1 - ENTRY_SCALE0) * entryEase;
      root.scale.x = entryScale; root.scale.y = entryScale;

      root.rotation.z = GLOBAL_AMP * Math.sin(t * 0.28) + GLOBAL_AMP * 0.45 * Math.sin(t * 0.13 + 1.3);
      var ambAmp = maxRot * AMBIENT_FRAC;

      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var torque = 0;
        if (mInside && mRad > 0.1 && Math.abs(mAngVel) > 0.0001) {
          var dmid = g.midAng - mAng + root.rotation.z;
          while (dmid > Math.PI) dmid -= 6.283; while (dmid < -Math.PI) dmid += 6.283;
          var edge = Math.max(0, Math.abs(dmid) - g.halfSpan);
          if (edge < MOUSE_REACH) torque = MOUSE_TORQUE * mAngVel * (1 - edge / MOUSE_REACH);
        }
        g.swayVel += (torque - SPRING_K * g.swayOff - SPRING_C * g.swayVel) * dt;
        g.swayOff += g.swayVel * dt;
        var ambient = ambAmp * (Math.sin(t * 0.5 + g.phase) + 0.4 * Math.sin(t * 0.27 + g.phase * 1.7));
        var rot = ambient + g.swayOff;
        if (rot > maxRot) rot = maxRot; else if (rot < -maxRot) rot = -maxRot;
        g.grp.rotation.z = rot;
      }
      mAngVel *= 0.7;

      // Tiny individual flutter on each phrase, on top of its group's sway.
      for (var bi = 0; bi < branches.length; bi++) {
        var b = branches[bi];
        b.mesh.rotation.z = b.baseRot + INDIV_SWAY * Math.sin(t * 1.4 + b.phase);
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    // Fade the canvas in once it has painted at least once (pairs with the bloom).
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (myId === instanceId) mount.classList.add('is-ready'); });
    });

    activeStop = function () {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('resize', resize);
      try { renderer.dispose(); } catch (e) {}
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
    instanceId++;
    mount.dataset.ready = 'true';
    page.classList.remove('is-fallback');
    loadThree(function (ok) {
      if (!ok || !window.THREE) { mount.dataset.ready = ''; page.classList.add('is-fallback'); return; }
      if (!buildScene(mount, page, display, items)) { mount.dataset.ready = ''; page.classList.add('is-fallback'); }
    });
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
