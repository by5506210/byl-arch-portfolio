// ============================================
// MOODBOARD MIND-MAP  (WebGL radial text diagram)
// A typographic concept map in three.js: each photo is a long line of text
// radiating from a fixed center, like the reference dendrogram. The stiff spokes
// sway gently (wind) and react to the cursor sweeping past (angular velocity),
// then settle. Hover/tap a branch to show its photo on the display side. Text is
// drawn to supersampled canvas textures (mipmapped + anisotropic) so it stays
// crisp. Falls back to the plain image grid without WebGL; reduced-motion stills.
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

  // Placeholder descriptors for the branches (the images have no captions yet).
  // Override per image with data-desc="..." on its .moodboard-page__item figure.
  var WORDS_A = ['raw concrete', 'board-formed concrete', 'weathered timber', 'blackened steel',
    'pale travertine', 'rammed earth', 'lime plaster', 'brushed brass', 'rough-cut stone',
    'smoked glass', 'oiled oak', 'corrugated zinc', 'cast bronze', 'bush-hammered concrete',
    'charred cedar', 'terracotta', 'polished terrazzo', 'raw plywood'];
  var WORDS_B = ['holding', 'dissolving into', 'folded against', 'washed by', 'carved out by',
    'warmed by', 'split by', 'wrapped in', 'grounded by', 'opening onto', 'softened under',
    'pierced by', 'framing'];
  var WORDS_C = ['the last of the afternoon light', 'a low northern sun', 'a sheet of falling water',
    'a deep, even shadow', 'a quiet sunken courtyard', 'the weight of the earth', 'morning fog',
    'a single high skylight', 'the seam of the horizon', 'a cantilevered void', 'reflected sky',
    'a candle-soft glow', 'the hush of a long corridor', 'a garden held in the round'];

  // ---- Layout ----
  var VIEW_HALF = 6.9;
  var INNER_R = 0.95;       // where branch text begins
  var TEXT_H = 0.3;         // world height of branch text
  var THEME_TEXT_H = 0.46;  // world height of the inner theme labels
  var SECTOR_PAD = 0.1;
  var INK = '#171511';

  // ---- Sway ----
  var WIND = 0.05;
  var FLUTTER = 0.02;
  var MOUSE_REACH = 0.55;
  var MOUSE_TORQUE = 8;
  var SPRING_K = 24;
  var SPRING_C = 4.2;

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
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // Clear any prior render (SVG or canvas) on re-entry.
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
    var group = new THREE.Group();
    scene.add(group);

    var seed = 11;
    function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
    function describe(it) { return it.desc || (pick(WORDS_A) + ' ' + pick(WORDS_B) + ' ' + pick(WORDS_C)); }

    // Supersampled text texture -> a plane sized to its aspect.
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
      ctx.textBaseline = 'middle';
      ctx.fillStyle = INK;
      ctx.fillText(str, pad, h / 2);
      var tex = new THREE.CanvasTexture(cv);
      if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
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
    group.add(new THREE.Mesh(new THREE.CircleGeometry(0.12, 32),
      new THREE.MeshBasicMaterial({ color: 0x171511 })));
    group.add(new THREE.Mesh(new THREE.RingGeometry(0.26, 0.31, 48),
      new THREE.MeshBasicMaterial({ color: 0x171511, transparent: true, opacity: 0.5 })));

    var branches = [];   // { mesh, item, baseAngle, left, swayOff, swayVel, phase }
    var themeCount = order.length;

    function place(mesh, ang, rInner) {
      var left = Math.cos(ang) < 0;
      mesh.userData.left = left;
      mesh.userData.rInner = rInner;
      return left;
    }

    order.forEach(function (themeName, ti) {
      var midA = (ti / themeCount) * Math.PI * 2 - Math.PI / 2;
      var half = (Math.PI / themeCount) * (1 - SECTOR_PAD);
      var bucket = byTheme[themeName];

      // Inner theme label along the sector mid.
      var tl = textPlane(themeName.toLowerCase(), THEME_TEXT_H, 0.95);
      place(tl, midA, INNER_R * 0.6);
      group.add(tl);
      branches.push({ mesh: tl, item: null, baseAngle: midA, isTheme: true,
        left: Math.cos(midA) < 0, rInner: INNER_R * 0.6, swayOff: 0, swayVel: 0, phase: rand() * 6.28 });

      bucket.forEach(function (it, j) {
        var f = bucket.length > 1 ? (j / (bucket.length - 1) - 0.5) : 0;
        var ang = midA + f * half;
        var mesh = textPlane(describe(it), TEXT_H, 0.8);
        var left = place(mesh, ang, INNER_R);
        group.add(mesh);
        branches.push({ mesh: mesh, item: it, baseAngle: ang, isTheme: false,
          left: left, rInner: INNER_R, swayOff: 0, swayVel: 0, phase: rand() * 6.28, curAngle: ang });
      });
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
      var best = null, bestD = 0.16;
      for (var i = 0; i < branches.length; i++) {
        var br = branches[i];
        if (br.isTheme) continue;
        var da = (br.curAngle || br.baseAngle) - a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        da = Math.abs(da);
        if (da < bestD && r < br.rInner + br.mesh.userData.worldW + 0.4) { bestD = da; best = br; }
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
          if (hovered) hovered.mesh.material.opacity = 0.8;
          hovered = hit;
          if (hit) hit.mesh.material.opacity = 1;
          setDisplay(hit ? hit.item : null);
          mount.classList.toggle('is-hovering', !!hit);
        }
      }
    }
    function onClick(e) { var w = toWorld(e.clientX, e.clientY); var hit = nearestBranch(w.x, w.y); if (hit) { hovered = hit; setDisplay(hit.item); } }
    function onLeave() { mInside = false; if (hasFine) { if (hovered) hovered.mesh.material.opacity = 0.8; hovered = null; setDisplay(null); mount.classList.remove('is-hovering'); } }

    canvas.addEventListener('pointermove', onMove);
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

      var windDir = 0.5 + Math.sin(t * 0.13) * 1.4 + Math.sin(t * 0.3 + 1) * 0.5;
      var gust = 0.55 + 0.45 * Math.sin(t * 0.5);

      for (var i = 0; i < branches.length; i++) {
        var br = branches[i];
        var ang = br.baseAngle;
        if (!reduceMotion) {
          var wind = WIND * Math.sin(windDir - br.baseAngle) * gust + FLUTTER * Math.sin(t * 1.6 + br.phase);
          var torque = 0;
          if (mInside && mRad > 0.1 && Math.abs(mAngVel) > 0.0001) {
            var da = br.baseAngle - mAng;
            while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
            if (Math.abs(da) < MOUSE_REACH) {
              var prox = 1 - Math.abs(da) / MOUSE_REACH;
              torque = MOUSE_TORQUE * mAngVel * prox * prox;
            }
          }
          br.swayVel += (torque - SPRING_K * br.swayOff - SPRING_C * br.swayVel) * dt;
          br.swayOff += br.swayVel * dt;
          ang += wind + br.swayOff;
        }
        br.curAngle = ang;
        var rMid = br.rInner + br.mesh.userData.worldW * 0.5;
        br.mesh.position.set(Math.cos(ang) * rMid, Math.sin(ang) * rMid, br === hovered ? 1 : 0);
        br.mesh.rotation.z = br.left ? ang + Math.PI : ang;
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
