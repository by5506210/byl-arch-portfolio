// ============================================
// MOODBOARD MIND-MAP  (WebGL radial text diagram)
// A typographic concept map in three.js: every photo is a line of text radiating
// from a fixed center, evenly spaced around the full circle and grouped by theme
// (like the reference dendrogram). No ambient sway — the branches sit still; each
// theme rotates as a rigid group only when the cursor sweeps past it, and the gaps
// between groups keep them from overlapping. Hover/tap a branch to show its photo
// on the display side. Text is drawn to supersampled, mipmapped, anisotropic
// canvas textures so it stays crisp. Falls back to the image grid without WebGL.
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

  // Placeholder branch descriptors (images have no captions yet). Override per
  // image with data-desc="..." on its .moodboard-page__item figure.
  var WORDS_A = ['raw concrete', 'board-formed concrete', 'weathered timber', 'blackened steel',
    'pale travertine', 'rammed earth', 'lime plaster', 'brushed brass', 'rough-cut stone',
    'smoked glass', 'oiled oak', 'corrugated zinc', 'cast bronze', 'bush-hammered concrete',
    'charred cedar', 'terracotta', 'polished terrazzo', 'raw plywood'];
  var WORDS_B = ['holding', 'dissolving into', 'folded against', 'washed by', 'carved out by',
    'warmed by', 'split by', 'wrapped in', 'grounded by', 'opening onto', 'softened under',
    'pierced by', 'framing'];
  var WORDS_C = ['the last afternoon light', 'a low northern sun', 'a sheet of falling water',
    'a deep even shadow', 'a quiet sunken courtyard', 'the weight of the earth', 'morning fog',
    'a single high skylight', 'the seam of the horizon', 'a cantilevered void', 'reflected sky',
    'a candle-soft glow', 'a long corridor', 'a garden held in the round'];

  // ---- Layout ----
  var VIEW_HALF = 7.4;
  var INNER_R = 1.2;        // base radius where a branch's text begins
  var STAGGER = 1.5;        // varied inner start so rays don't pile at one radius
  var TEXT_H = 0.24;        // world height of a branch line
  var THEME_TEXT_H = 0.42;  // inner theme labels
  var GAP_SLOTS = 2;        // empty angular slots between theme groups

  // ---- Group rotation (cursor only; no ambient sway) ----
  var MOUSE_REACH = 0.5;
  var MOUSE_TORQUE = 6;
  var SPRING_K = 20;
  var SPRING_C = 4.0;

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
    function describe(it) { return it.desc || (pick(WORDS_A) + ' ' + pick(WORDS_B) + ' ' + pick(WORDS_C)); }

    function textPlane(str, worldH, opacity) {
      var ss = 2, fontPx = 34, pad = 10;
      var probe = document.createElement('canvas').getContext('2d');
      probe.font = '400 ' + fontPx + 'px Inter, system-ui, sans-serif';
      var tw = Math.min(1500, Math.ceil(probe.measureText(str).width));
      var w = tw + pad * 2, h = Math.ceil(fontPx * 1.5);
      var cv = document.createElement('canvas');
      cv.width = w * ss; cv.height = h * ss;
      var ctx = cv.getContext('2d');
      ctx.scale(ss, ss);
      ctx.font = '400 ' + fontPx + 'px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'middle'; ctx.fillStyle = '#171511';
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

    // Center mark
    root.add(new THREE.Mesh(new THREE.CircleGeometry(0.12, 32), new THREE.MeshBasicMaterial({ color: 0x171511 })));
    root.add(new THREE.Mesh(new THREE.RingGeometry(0.26, 0.31, 48), new THREE.MeshBasicMaterial({ color: 0x171511, transparent: true, opacity: 0.5 })));

    // Even angular distribution around the full circle, themes in contiguous arcs
    // with a gap between them.
    var totalSlots = items.length + order.length * GAP_SLOTS;
    var slotAng = (Math.PI * 2) / totalSlots;
    var gapAng = GAP_SLOTS * slotAng;
    var maxRot = gapAng * 0.42; // never let a rotating group close its gap

    var branches = [];     // flat list of photo branches (for hover)
    var groups = [];       // per-theme rotating groups
    var slot = 0;

    order.forEach(function (themeName) {
      var grp = new THREE.Group();
      root.add(grp);
      var bucket = byTheme[themeName];
      var startSlot = slot;

      bucket.forEach(function (it) {
        var ang = slot * slotAng - Math.PI / 2;
        slot++;
        var left = Math.cos(ang) < 0;
        var rInner = INNER_R + rand() * STAGGER;
        var mesh = textPlane(describe(it), TEXT_H, 0.82);
        var rMid = rInner + mesh.userData.worldW * 0.5;
        mesh.position.set(Math.cos(ang) * rMid, Math.sin(ang) * rMid, 0);
        mesh.rotation.z = left ? ang + Math.PI : ang;
        grp.add(mesh);
        branches.push({ mesh: mesh, item: it, baseAngle: ang, rInner: rInner, grp: grp });
      });

      var endSlot = slot;
      var midAng = ((startSlot + endSlot) * 0.5) * slotAng - Math.PI / 2;
      var leftL = Math.cos(midAng) < 0;
      var tl = textPlane(themeName.toLowerCase(), THEME_TEXT_H, 0.95);
      var rL = INNER_R * 0.5;
      tl.position.set(Math.cos(midAng) * (rL + tl.userData.worldW * 0.5), Math.sin(midAng) * (rL + tl.userData.worldW * 0.5), 0.1);
      tl.rotation.z = leftL ? midAng + Math.PI : midAng;
      grp.add(tl);

      groups.push({ grp: grp, midAng: midAng, halfSpan: (endSlot - startSlot) * 0.5 * slotAng, swayOff: 0, swayVel: 0 });
      slot += GAP_SLOTS;
    });

    // ---- Sizing ----
    var viewW = 1, viewH = 1;
    function resize() {
      var rect = mount.getBoundingClientRect();
      viewW = Math.max(1, Math.round(rect.width));
      viewH = Math.max(1, Math.round(rect.height));
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(viewW, viewH, false);
      var aspect = viewW / viewH;
      var hx = aspect >= 1 ? VIEW_HALF * aspect : VIEW_HALF;
      var hy = aspect >= 1 ? VIEW_HALF : VIEW_HALF / aspect;
      camera.left = -hx; camera.right = hx; camera.top = hy; camera.bottom = -hy;
      camera.updateProjectionMatrix();
    }
    page.classList.add('is-mindmap-active');
    resize();

    // ---- Pointer ----
    var hovered = null;
    var hasFine = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
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
    function nearestBranch(wx, wy) {
      var a = Math.atan2(wy, wx), r = Math.sqrt(wx * wx + wy * wy);
      if (r < INNER_R * 0.5) return null;
      var best = null, bestD = 0.13;
      for (var i = 0; i < branches.length; i++) {
        var br = branches[i];
        var da = (br.baseAngle + br.grp.rotation.z) - a;
        while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
        da = Math.abs(da);
        if (da < bestD && r < br.rInner + br.mesh.userData.worldW + 0.5) { bestD = da; best = br; }
      }
      return best;
    }
    function onMove(e) {
      var w = toWorld(e.clientX, e.clientY);
      var a = Math.atan2(w.y, w.x);
      mRad = Math.sqrt(w.x * w.x + w.y * w.y) / VIEW_HALF;
      if (mHave) { var d = a - mAng; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; mAngVel = d; }
      mAng = a; mInside = true; mHave = true;
      if (hasFine) {
        var hit = nearestBranch(w.x, w.y);
        if (hit !== hovered) {
          if (hovered) hovered.mesh.material.opacity = 0.82;
          hovered = hit;
          if (hit) hit.mesh.material.opacity = 1;
          setDisplay(hit ? hit.item : null);
          mount.classList.toggle('is-hovering', !!hit);
        }
      }
    }
    function onClick(e) { var w = toWorld(e.clientX, e.clientY); var hit = nearestBranch(w.x, w.y); if (hit) { hovered = hit; setDisplay(hit.item); } }
    function onLeave() { mInside = false; if (hasFine) { if (hovered) hovered.mesh.material.opacity = 0.82; hovered = null; setDisplay(null); mount.classList.remove('is-hovering'); } }

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    window.addEventListener('resize', resize);

    // ---- Animate: groups rotate toward the cursor sweep, then spring back ----
    var raf = 0, last = null;
    function frame(ts) {
      if (myId !== instanceId) return;
      if (last === null) last = ts;
      var dt = Math.min(0.05, (ts - last) / 1000); last = ts;

      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var torque = 0;
        if (mInside && mRad > 0.1 && Math.abs(mAngVel) > 0.0001) {
          var dmid = g.midAng - mAng;
          while (dmid > Math.PI) dmid -= 6.283; while (dmid < -Math.PI) dmid += 6.283;
          var edge = Math.max(0, Math.abs(dmid) - g.halfSpan);
          if (edge < MOUSE_REACH) {
            var prox = 1 - edge / MOUSE_REACH;
            torque = MOUSE_TORQUE * mAngVel * prox;
          }
        }
        g.swayVel += (torque - SPRING_K * g.swayOff - SPRING_C * g.swayVel) * dt;
        g.swayOff += g.swayVel * dt;
        if (g.swayOff > maxRot) { g.swayOff = maxRot; g.swayVel = 0; }
        else if (g.swayOff < -maxRot) { g.swayOff = -maxRot; g.swayVel = 0; }
        g.grp.rotation.z = g.swayOff;
      }
      mAngVel *= 0.7;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    activeStop = function () {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onMove);
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
    loadThree(function (ok) {
      if (!ok || !window.THREE) { mount.dataset.ready = ''; return; }
      if (!buildScene(mount, page, display, items)) mount.dataset.ready = '';
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
