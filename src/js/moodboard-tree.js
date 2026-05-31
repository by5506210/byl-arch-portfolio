// ============================================
// MOODBOARD MIND-MAP  (WebGL radial tree)
// A fixed center, theme boughs, and inspo images at the tips. Branches are drawn
// as tapering strings of dots (thick near the trunk, fine at the tips), curve
// organically, and sway like tree branches on a spring: ambient wind plus a
// velocity-based push wherever the cursor brushes through. Hovering an image
// shows it large on the display side. Falls back to the plain image grid if
// WebGL/three is unavailable; prefers-reduced-motion stills the whole thing.
// ============================================

(function () {
  'use strict';

  var THREE_SOURCES = [
    '../src/js/vendor/three.min.js',
    'https://unpkg.com/three@0.152.2/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js'
  ];

  // Placeholder theme buckets. Re-bucket by adding data-theme="<name>" to the
  // .moodboard-page__item figures; untagged images spread round-robin.
  var THEME_NAMES = [
    'Light & Shadow', 'Materiality', 'Form & Mass', 'Structure',
    'Landscape', 'Texture', 'Atmosphere'
  ];

  // ---- Layout (world units) ----
  var THEME_RADIUS = 3.0;
  var IMAGE_RADIUS = 5.2;
  var IMAGE_RADIUS_JITTER = 0.7;
  var IMAGE_PLANE_W = 0.6;
  var SECTOR_PAD = 0.14;
  var VIEW_HALF = 6.5;
  var INK = '#141310';
  var INK_HEX = 0x141310;

  // ---- Motion (tunable feel) ----
  var SPRING_K = 26;        // restoring stiffness toward the rest pose
  var DAMP = 4.2;           // velocity damping (lower = looser, swingier)
  var WIND_STRENGTH = 7.0;  // ambient wind force on the tips
  var WIND_TURBULENCE = 0.6;
  var MOUSE_RADIUS = 2.2;   // world reach of the cursor disturbance
  var MOUSE_PUSH = 22;      // how hard the cursor shoves branches by its speed
  var TIP_LEAN = 0.5;       // how much image tips tilt into their motion

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
    return src.replace('/inspo-', '/thumbs/inspo-').replace(/\.(png|jpe?g|webp)$/i, '.jpg');
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
        full: full, thumb: deriveThumb(full),
        alt: img.getAttribute('alt') || '',
        caption: (figs[i].querySelector('figcaption') || {}).textContent || '',
        theme: figs[i].getAttribute('data-theme') || THEME_NAMES[i % THEME_NAMES.length],
        aspect: w / h, index: i
      });
    }
    return items;
  }

  function makeLabelSprite(THREE, text) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var pad = 10 * dpr, fontPx = 26 * dpr;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    ctx.font = '500 ' + fontPx + 'px Inter, system-ui, sans-serif';
    var w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    var h = Math.ceil(fontPx * 1.5);
    canvas.width = w; canvas.height = h;
    ctx.font = '500 ' + fontPx + 'px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    ctx.fillText(text, pad, h / 2);
    var tex = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(w * 0.0042, h * 0.0042, 1);
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
    } catch (err) { return false; }
    renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    camera.position.z = 10;
    var group = new THREE.Group();
    scene.add(group);

    // ---- Group items by theme (canonical order first) ----
    var byTheme = {}, themeOrder = [];
    items.forEach(function (it) {
      if (!byTheme[it.theme]) { byTheme[it.theme] = []; themeOrder.push(it.theme); }
      byTheme[it.theme].push(it);
    });
    themeOrder.sort(function (a, b) {
      var ia = THEME_NAMES.indexOf(a), ib = THEME_NAMES.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

    var seed = 7;
    function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    // Node = a point that springs around its rest position.
    // soft: 0 = pinned (center), 1 = whips freely (tips).
    var nodes = [];
    function makeNode(x, y, soft, kind) {
      var n = { bx: x, by: y, x: x, y: y, vx: 0, vy: 0, soft: soft, kind: kind,
        r: Math.sqrt(x * x + y * y), phase: rand() * 6.283, obj: null, label: null };
      nodes.push(n);
      return n;
    }

    var center = makeNode(0, 0, 0, 'center');

    // Center anchor: a ring with a solid core dot.
    group.add(new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.4, 64),
      new THREE.MeshBasicMaterial({ color: INK_HEX, transparent: true, opacity: 0.92 })
    ));
    var core = new THREE.Mesh(
      new THREE.CircleGeometry(0.12, 32),
      new THREE.MeshBasicMaterial({ color: INK_HEX, transparent: true, opacity: 0.9 })
    );
    group.add(core);

    var branches = [];   // { a, b, curve, beads:[{t,r}], baseZ }
    var imagePlanes = [];
    var loader = new THREE.TextureLoader();
    var themeCount = themeOrder.length;

    function addBranch(a, b, rBase, rTip, beadCount, curveAmt, z) {
      var beads = [];
      for (var k = 0; k <= beadCount; k++) {
        var t = beadCount ? k / beadCount : 0;
        beads.push({ t: t, r: rBase + (rTip - rBase) * t });
      }
      branches.push({ a: a, b: b, beads: beads, curve: curveAmt, z: z });
    }

    themeOrder.forEach(function (themeName, ti) {
      var ang = (ti / themeCount) * Math.PI * 2 - Math.PI / 2;
      var sectorW = (Math.PI * 2 / themeCount) * (1 - SECTOR_PAD);
      var tx = Math.cos(ang) * THEME_RADIUS, ty = Math.sin(ang) * THEME_RADIUS;
      var themeNode = makeNode(tx, ty, 0.34, 'theme');

      var label = makeLabelSprite(THREE, themeName);
      label.position.set(tx, ty + 0.34, 2);
      group.add(label);
      themeNode.label = label;
      themeNode.labelDy = 0.34;

      // Thick bough: center -> theme.
      addBranch(center, themeNode, 0.10, 0.052, 9, (rand() - 0.5) * 0.5, 0.05);

      var bucket = byTheme[themeName];
      bucket.forEach(function (it, j) {
        var f = bucket.length > 1 ? (j / (bucket.length - 1) - 0.5) : 0;
        var a2 = ang + f * sectorW;
        var r = IMAGE_RADIUS + (rand() - 0.5) * IMAGE_RADIUS_JITTER;
        var ix = Math.cos(a2) * r, iy = Math.sin(a2) * r;
        var imgNode = makeNode(ix, iy, 1.0, 'image');

        var aspect = it.aspect || 0.75;
        var pw = IMAGE_PLANE_W, ph = pw / aspect;
        var plane = new THREE.Mesh(
          new THREE.PlaneGeometry(pw, ph),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        );
        plane.position.set(ix, iy, 0.5);
        plane.userData.item = it;
        plane.userData.node = imgNode;
        group.add(plane);
        imagePlanes.push(plane);
        imgNode.obj = plane;

        (function (mat) {
          loader.load(it.thumb, function (tex) {
            if (myId !== instanceId) return;
            if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
          }, undefined, function () {});
        })(plane.material);

        // Twig: theme -> image, with more organic curl.
        addBranch(themeNode, imgNode, 0.05, 0.022, 7, (rand() - 0.5) * 0.9, 0.04);
      });
    });

    // ---- Beads as one instanced mesh (1 draw call) ----
    var totalBeads = 0;
    branches.forEach(function (br) { totalBeads += br.beads.length; });
    var beadMesh = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 14),
      new THREE.MeshBasicMaterial({ color: INK_HEX, transparent: true, opacity: 0.66 }),
      totalBeads
    );
    beadMesh.frustumCulled = false;
    group.add(beadMesh);
    var dummy = new THREE.Object3D();

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

    // ---- Pointer: hover-to-display + velocity disturbance ----
    var raycaster = new THREE.Raycaster();
    var ndc = new THREE.Vector2();
    var hovered = null;
    var hasFine = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var mWorldX = 0, mWorldY = 0, mVelX = 0, mVelY = 0, mInside = false, mHave = false;

    function toWorld(clientX, clientY) {
      var rect = mount.getBoundingClientRect();
      var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      var ny = -((clientY - rect.top) / rect.height) * 2 + 1;
      return { x: nx * camera.right, y: ny * camera.top, nx: nx, ny: ny };
    }
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
    function pick(clientX, clientY) {
      var w = toWorld(clientX, clientY);
      ndc.set(w.nx, w.ny);
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(imagePlanes, false);
      return hits.length ? hits[0].object : null;
    }
    function onMove(e) {
      var w = toWorld(e.clientX, e.clientY);
      if (mHave) { mVelX = w.x - mWorldX; mVelY = w.y - mWorldY; }
      mWorldX = w.x; mWorldY = w.y; mInside = true; mHave = true;
      if (hasFine) {
        var hit = pick(e.clientX, e.clientY);
        if (hit !== hovered) {
          hovered = hit;
          setDisplay(hit ? hit.userData.item : null);
          mount.classList.toggle('is-hovering', !!hit);
        }
      }
    }
    function onClick(e) { var hit = pick(e.clientX, e.clientY); if (hit) { hovered = hit; setDisplay(hit.userData.item); } }
    function onLeave() { mInside = false; if (hasFine) { hovered = null; setDisplay(null); mount.classList.remove('is-hovering'); } }

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    window.addEventListener('resize', resize);

    // ---- Animate ----
    var raf = 0, last = null, t = 0;
    function bez(p0, c, p1, u, out) {
      var iu = 1 - u;
      out.x = iu * iu * p0.x + 2 * iu * u * c.x + u * u * p1.x;
      out.y = iu * iu * p0.y + 2 * iu * u * c.y + u * u * p1.y;
    }
    var pt = { x: 0, y: 0 };

    function frame(ts) {
      if (myId !== instanceId) return;
      if (last === null) last = ts;
      var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      t += dt;

      // Ambient wind: a slowly turning, gusting vector.
      var windAng = Math.sin(t * 0.16) * 1.2 + Math.sin(t * 0.37 + 1.1) * 0.5;
      var gust = 0.55 + 0.45 * Math.sin(t * 0.5) + 0.2 * Math.sin(t * 1.27 + 2.0);
      var wx = Math.cos(windAng) * gust, wy = Math.sin(windAng) * gust;

      var mSpeed = Math.sqrt(mVelX * mVelX + mVelY * mVelY);

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.soft === 0 || reduceMotion) { n.x = n.bx; n.y = n.by; continue; }

        // Wind force (tips catch more), with a little per-node turbulence.
        var turb = 1 + WIND_TURBULENCE * Math.sin(t * 1.7 + n.phase);
        var fx = wx * WIND_STRENGTH * n.soft * turb;
        var fy = wy * WIND_STRENGTH * n.soft * turb;

        // Cursor disturbance: shove along the pointer's motion, scaled by speed,
        // proximity and softness — so a quick swipe whips the branches.
        if (mInside && mSpeed > 0.0002) {
          var dx = n.x - mWorldX, dy = n.y - mWorldY;
          var d2 = dx * dx + dy * dy, R2 = MOUSE_RADIUS * MOUSE_RADIUS;
          if (d2 < R2) {
            var prox = 1 - Math.sqrt(d2) / MOUSE_RADIUS;
            var k = MOUSE_PUSH * prox * prox * n.soft;
            fx += mVelX * k; fy += mVelY * k;
          }
        }

        // Spring back to rest + damping (semi-implicit).
        fx += -SPRING_K * (n.x - n.bx) - DAMP * n.vx;
        fy += -SPRING_K * (n.y - n.by) - DAMP * n.vy;
        n.vx += fx * dt; n.vy += fy * dt;
        n.x += n.vx * dt; n.y += n.vy * dt;

        if (n.label) { n.label.position.x = n.x; n.label.position.y = n.y + n.labelDy; }
      }
      mVelX *= 0.82; mVelY *= 0.82; // disturbance fades when the mouse rests

      // Lay the beads along each (swayed, curved) branch.
      var idx = 0;
      for (var b = 0; b < branches.length; b++) {
        var br = branches[b], a = br.a, c = br.b;
        var mx = (a.x + c.x) * 0.5, my = (a.y + c.y) * 0.5;
        var ex = c.x - a.x, ey = c.y - a.y;
        var len = Math.sqrt(ex * ex + ey * ey) || 1;
        // perpendicular control offset = organic curve + a wind-driven bow
        var px = -ey / len, py = ex / len;
        var bow = br.curve + (reduceMotion ? 0 : (wx * py - wy * px) * 0.18);
        var ctrl = { x: mx + px * bow * len, y: my + py * bow * len };
        var p0 = { x: a.x, y: a.y }, p1 = { x: c.x, y: c.y };
        for (var q = 0; q < br.beads.length; q++) {
          var bd = br.beads[q];
          bez(p0, ctrl, p1, bd.t, pt);
          dummy.position.set(pt.x, pt.y, br.z);
          dummy.scale.set(bd.r, bd.r, 1);
          dummy.rotation.z = 0;
          dummy.updateMatrix();
          beadMesh.setMatrixAt(idx++, dummy.matrix);
        }
      }
      beadMesh.instanceMatrix.needsUpdate = true;

      // Image tips: follow their node, lean into motion, lift when hovered.
      for (var p = 0; p < imagePlanes.length; p++) {
        var pl = imagePlanes[p], nd = pl.userData.node;
        pl.position.x = nd.x; pl.position.y = nd.y;
        pl.rotation.z = reduceMotion ? 0 : Math.max(-0.4, Math.min(0.4, -nd.vx * TIP_LEAN));
        var target = pl === hovered ? 1.55 : 1;
        pl.scale.x += (target - pl.scale.x) * 0.18;
        pl.scale.y = pl.scale.x;
        pl.position.z = pl === hovered ? 1.6 : 0.5;
      }

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
