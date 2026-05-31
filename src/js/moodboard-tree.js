// ============================================
// MOODBOARD MIND-MAP  (WebGL radial tree)
// A fixed center, theme branches, and inspo images at the tips. The whole tree
// sways gently like it's alive in a light wind; hovering an image shows it large
// on the display side. Falls back to the plain image grid if WebGL/three is
// unavailable, or under prefers-reduced-motion the sway is stilled.
// ============================================

(function () {
  'use strict';

  // ---- Tunables (safe to tweak; visuals only) ----------------------------
  var THREE_SOURCES = [
    '../src/js/vendor/three.min.js',
    'https://unpkg.com/three@0.152.2/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js'
  ];

  // Placeholder theme buckets. Re-bucket simply by adding data-theme="<name>"
  // to the .moodboard-page__item figures in moodboard.html; anything untagged is
  // distributed round-robin across these names.
  var THEME_NAMES = [
    'Light & Shadow',
    'Materiality',
    'Form & Mass',
    'Structure',
    'Landscape',
    'Texture',
    'Atmosphere'
  ];

  var THEME_RADIUS = 3.05;     // distance of theme nodes from center
  var IMAGE_RADIUS = 5.15;     // distance of image tips from center
  var IMAGE_RADIUS_JITTER = 0.6;
  var IMAGE_PLANE_W = 0.62;    // world width of an image tip (height follows aspect)
  var SECTOR_PAD = 0.16;       // fraction of each theme sector kept as padding
  var SWAY_WIND = 0.030;       // how far the wind bends the outer tips (world units / radius)
  var SWAY_FLUTTER = 0.006;    // per-node flutter on top of the wind
  var BRANCH_COLOR = 0x141310;
  var INK = '#141310';
  var VIEW_HALF = 6.35;        // ortho half-extent of the shorter axis (frames the tree)

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
      s.src = THREE_SOURCES[i];
      s.async = true;
      s.dataset.mbThree = String(i);
      s.onload = function () { onReady(!!window.THREE); };
      s.onerror = function () { i++; next(); };
      document.head.appendChild(s);
    }
    next();
  }

  function deriveThumb(src) {
    return src
      .replace('/inspo-', '/thumbs/inspo-')
      .replace(/\.(png|jpe?g|webp)$/i, '.jpg');
  }

  function readItems(scope) {
    var figs = scope.querySelectorAll('.moodboard-page__item');
    var items = [];
    for (var i = 0; i < figs.length; i++) {
      var img = figs[i].querySelector('img');
      if (!img) continue;
      var full = img.getAttribute('src') || '';
      if (!full) continue;
      var w = parseFloat(img.getAttribute('width')) || 4;
      var h = parseFloat(img.getAttribute('height')) || 5;
      items.push({
        full: full,
        thumb: deriveThumb(full),
        alt: img.getAttribute('alt') || '',
        caption: (figs[i].querySelector('figcaption') || {}).textContent || '',
        theme: figs[i].getAttribute('data-theme') || THEME_NAMES[i % THEME_NAMES.length],
        aspect: w / h,
        index: i
      });
    }
    return items;
  }

  function makeLabelSprite(THREE, text) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var pad = 10 * dpr;
    var fontPx = 26 * dpr;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    ctx.font = '500 ' + fontPx + 'px Inter, system-ui, sans-serif';
    var w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    var h = Math.ceil(fontPx * 1.5);
    canvas.width = w;
    canvas.height = h;
    ctx.font = '500 ' + fontPx + 'px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    ctx.fillText(text, pad, h / 2);
    var tex = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.82, depthWrite: false });
    var sprite = new THREE.Sprite(mat);
    var scale = 0.0042; // canvas px -> world units
    sprite.scale.set(w * scale, h * scale, 1);
    sprite.userData.aspect = w / h;
    return sprite;
  }

  function buildScene(mount, page, display, items) {
    var THREE = window.THREE;
    var myId = ++instanceId;
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var canvas = mount.querySelector('canvas') || document.createElement('canvas');
    if (!canvas.parentNode) mount.appendChild(canvas);

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) {
      return false;
    }
    renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    camera.position.z = 10;
    var group = new THREE.Group();
    scene.add(group);

    // ---- Group items by theme, preserving THEME_NAMES order ----
    var themeOrder = [];
    var byTheme = {};
    items.forEach(function (it) {
      if (!byTheme[it.theme]) { byTheme[it.theme] = []; themeOrder.push(it.theme); }
      byTheme[it.theme].push(it);
    });
    // Keep canonical order first, then any extras.
    themeOrder.sort(function (a, b) {
      var ia = THEME_NAMES.indexOf(a); var ib = THEME_NAMES.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

    var nodes = [];       // every swaying node {baseX, baseY, baseR, baseAngle, phase, obj}
    var imagePlanes = []; // hoverable image tips
    var segments = [];    // [{a: nodeRef, b: nodeRef}] for branch lines

    // Center ring (fixed anchor)
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.4, 64),
      new THREE.MeshBasicMaterial({ color: BRANCH_COLOR, transparent: true, opacity: 0.9 })
    );
    group.add(ring);
    var centerNode = { baseX: 0, baseY: 0, baseR: 0, baseAngle: 0, phase: 0, x: 0, y: 0, obj: null };
    nodes.push(centerNode);

    var loader = new THREE.TextureLoader();
    var themeCount = themeOrder.length;
    var seed = 1;
    function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    themeOrder.forEach(function (themeName, ti) {
      var sectorMid = (ti / themeCount) * Math.PI * 2 - Math.PI / 2;
      var sectorWidth = (Math.PI * 2 / themeCount) * (1 - SECTOR_PAD);

      var tx = Math.cos(sectorMid) * THEME_RADIUS;
      var ty = Math.sin(sectorMid) * THEME_RADIUS;
      var label = makeLabelSprite(THREE, themeName);
      label.position.set(tx, ty, 1);
      group.add(label);
      var dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.07, 24),
        new THREE.MeshBasicMaterial({ color: BRANCH_COLOR, transparent: true, opacity: 0.85 })
      );
      group.add(dot);
      var themeNode = {
        baseX: tx, baseY: ty, baseR: THEME_RADIUS, baseAngle: sectorMid,
        phase: rand() * Math.PI * 2, x: tx, y: ty, obj: dot, label: label
      };
      nodes.push(themeNode);
      segments.push({ a: centerNode, b: themeNode });

      var bucket = byTheme[themeName];
      bucket.forEach(function (it, j) {
        var f = bucket.length > 1 ? (j / (bucket.length - 1) - 0.5) : 0;
        var ang = sectorMid + f * sectorWidth;
        var r = IMAGE_RADIUS + (rand() - 0.5) * IMAGE_RADIUS_JITTER;
        var ix = Math.cos(ang) * r;
        var iy = Math.sin(ang) * r;

        var aspect = it.aspect || 0.75;
        var pw = IMAGE_PLANE_W;
        var ph = pw / aspect;
        var plane = new THREE.Mesh(
          new THREE.PlaneGeometry(pw, ph),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        );
        plane.position.set(ix, iy, 0.5);
        plane.userData.item = it;
        plane.userData.baseScale = 1;
        group.add(plane);
        imagePlanes.push(plane);

        (function (mat) {
          loader.load(it.thumb, function (tex) {
            if (myId !== instanceId) return;
            if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            mat.map = tex;
            mat.color.set(0xffffff);
            mat.needsUpdate = true;
          }, undefined, function () { /* missing thumb: stays invisible */ });
        })(plane.material);

        var imgNode = {
          baseX: ix, baseY: iy, baseR: r, baseAngle: ang,
          phase: rand() * Math.PI * 2, x: ix, y: iy, obj: plane
        };
        nodes.push(imgNode);
        segments.push({ a: themeNode, b: imgNode });
      });
    });

    // ---- Branch lines (one buffer, updated each frame) ----
    var lineGeo = new THREE.BufferGeometry();
    var linePos = new Float32Array(segments.length * 2 * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    var lineMat = new THREE.LineBasicMaterial({ color: BRANCH_COLOR, transparent: true, opacity: 0.5 });
    var lines = new THREE.LineSegments(lineGeo, lineMat);
    group.add(lines);

    // ---- Sizing ----
    var viewW = 1, viewH = 1;
    function resize() {
      var rect = mount.getBoundingClientRect();
      viewW = Math.max(1, Math.round(rect.width));
      viewH = Math.max(1, Math.round(rect.height));
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(viewW, viewH, false);
      var aspect = viewW / viewH;
      var halfX = aspect >= 1 ? VIEW_HALF * aspect : VIEW_HALF;
      var halfY = aspect >= 1 ? VIEW_HALF : VIEW_HALF / aspect;
      camera.left = -halfX; camera.right = halfX;
      camera.top = halfY; camera.bottom = -halfY;
      camera.updateProjectionMatrix();
    }
    // Reveal the split (hides the fallback grid) BEFORE measuring, so the mount
    // has real dimensions when resize() reads it.
    page.classList.add('is-mindmap-active');
    resize();

    // ---- Hover / pick ----
    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2();
    var hovered = null;
    var hasFinePointer = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    function setDisplay(item) {
      if (!display) return;
      var img = display.querySelector('.moodboard-display__img');
      var cap = display.querySelector('.moodboard-display__caption');
      if (item) {
        if (img && img.getAttribute('src') !== item.full) img.setAttribute('src', item.full);
        if (img) img.setAttribute('alt', item.alt);
        if (cap) cap.textContent = item.theme + (item.caption ? '  ·  ' + item.caption : '');
        display.classList.add('is-active');
        page.classList.add('is-display-active');
      } else {
        display.classList.remove('is-active');
        page.classList.remove('is-display-active');
      }
    }

    function pickAt(clientX, clientY) {
      var rect = mount.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(imagePlanes, false);
      return hits.length ? hits[0].object : null;
    }

    function onPointerMove(e) {
      if (!hasFinePointer) return;
      var hit = pickAt(e.clientX, e.clientY);
      if (hit !== hovered) {
        hovered = hit;
        setDisplay(hit ? hit.userData.item : null);
        mount.classList.toggle('is-hovering', !!hit);
      }
    }
    function onClick(e) {
      var hit = pickAt(e.clientX, e.clientY);
      if (hit) { hovered = hit; setDisplay(hit.userData.item); }
    }
    function onLeave() {
      if (!hasFinePointer) return;
      hovered = null;
      setDisplay(null);
      mount.classList.remove('is-hovering');
    }

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    window.addEventListener('resize', resize);

    // ---- Animate ----
    var raf = 0;
    var startTime = null;
    function frame(ts) {
      if (myId !== instanceId) return;
      if (startTime === null) startTime = ts;
      var time = (ts - startTime) / 1000;

      var windPhase = time * 0.2;
      var wind = Math.sin(windPhase) * 0.6 + Math.sin(windPhase * 0.43 + 1.3) * 0.4;
      if (reduceMotion) wind = 0;

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.baseR === 0) { n.x = 0; n.y = 0; continue; }
        var bend = wind * n.baseR * SWAY_WIND;
        var flutter = reduceMotion ? 0 : n.baseR * SWAY_FLUTTER;
        // Bend mostly along the wind (x), with a little vertical life.
        n.x = n.baseX + bend + (reduceMotion ? 0 : Math.sin(time * 1.1 + n.phase) * flutter);
        n.y = n.baseY + (reduceMotion ? 0 : Math.cos(time * 0.9 + n.phase * 1.3) * flutter);
        if (n.obj) { n.obj.position.x = n.x; n.obj.position.y = n.y; }
        if (n.label) { n.label.position.x = n.x; n.label.position.y = n.y; }
      }

      for (var s = 0; s < segments.length; s++) {
        var seg = segments[s];
        var o = s * 6;
        linePos[o] = seg.a.x; linePos[o + 1] = seg.a.y; linePos[o + 2] = 0;
        linePos[o + 3] = seg.b.x; linePos[o + 4] = seg.b.y; linePos[o + 5] = 0;
      }
      lineGeo.attributes.position.needsUpdate = true;

      // Gentle lift on the hovered tip.
      for (var p = 0; p < imagePlanes.length; p++) {
        var pl = imagePlanes[p];
        var target = pl === hovered ? 1.5 : 1;
        pl.scale.x += (target - pl.scale.x) * 0.18;
        pl.scale.y = pl.scale.x;
        pl.position.z = pl === hovered ? 1.5 : 0.5;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    activeStop = function () {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onPointerMove);
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

    // Stop any previous instance (SPA re-entry).
    if (activeStop) { try { activeStop(); } catch (e) {} activeStop = null; }
    instanceId++;

    mount.dataset.ready = 'true';
    loadThree(function (ok) {
      if (!ok || !window.THREE) {
        // Leave the plain grid visible as the fallback.
        mount.dataset.ready = '';
        return;
      }
      var built = buildScene(mount, page, display, items);
      if (!built) mount.dataset.ready = '';
    });
  }

  window.initMoodboardMindmap = initMoodboardMindmap;

  // Arriving from the projects ribbon is a barba SPA swap, and body scripts don't
  // re-execute on a swap — so re-init after each transition. The dataset.ready
  // guard makes this a no-op on pages without the mind-map mount.
  if (window.barba && window.barba.hooks && typeof window.barba.hooks.after === 'function') {
    window.barba.hooks.after(function () { initMoodboardMindmap(document); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initMoodboardMindmap(document); });
  } else {
    initMoodboardMindmap(document);
  }
})();
