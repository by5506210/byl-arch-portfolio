// ============================================
// MOODBOARD MIND-MAP  (WebGL radial tree)
// A fixed center grows theme boughs that fork progressively outward (like a real
// branching tree / dendrogram). Branches are stiff straight segments; the sway
// comes from each joint rotating subtly — wind plus a velocity push wherever the
// cursor brushes through — so the rigid branches swing and the tips travel most.
// Every branch ends in a dot that stands for one inspo photo; hover (or tap) a
// dot to show that photo large on the display side. Falls back to the plain image
// grid without WebGL; prefers-reduced-motion stills it.
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

  // ---- Layout ----
  var LEAF_RADIUS = 5.2;        // where the photo dots sit
  var LEAF_JITTER = 0.55;
  var INNER_SPAN = 0.92;        // internal forks fill this fraction of the radius
  var SECTOR_PAD = 0.12;        // gap between theme sectors
  var VIEW_HALF = 6.6;
  var INK_HEX = 0x141310;
  var INK = '#141310';

  // ---- Branch weight (tapers thick trunk -> fine twig by subtree size) ----
  var BW_MIN = 0.012;
  var BW_SCALE = 0.019;
  var DOT_R = 0.07;
  var DOT_R_HOVER = 0.15;
  var DOT_PICK = 0.42;          // world-space hover radius around a dot

  // ---- Sway (joint rotation) ----
  var WIND_SWAY = 0.085;        // rad of bend a joint takes in a full crosswind
  var FLUTTER = 0.022;          // small per-joint shimmer
  var JOINT_K = 34;             // dynamic joint spring stiffness (cursor response)
  var JOINT_C = 5.0;            // joint damping
  var MOUSE_RADIUS = 2.1;       // world reach of the cursor
  var MOUSE_TORQUE = 9.0;       // how hard a fast cursor twists nearby joints

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
        caption: (figs[i].querySelector('figcaption') || {}).textContent || '',
        theme: figs[i].getAttribute('data-theme') || THEME_NAMES[i % THEME_NAMES.length],
        index: i
      });
    }
    return items;
  }

  function makeLabelSprite(THREE, text) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var pad = 10 * dpr, fontPx = 24 * dpr;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    ctx.font = '500 ' + fontPx + 'px Inter, system-ui, sans-serif';
    var w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    var h = Math.ceil(fontPx * 1.5);
    canvas.width = w; canvas.height = h;
    ctx.font = '500 ' + fontPx + 'px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
    ctx.fillText(text, pad, h / 2);
    var tex = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.72, depthWrite: false }));
    sprite.scale.set(w * 0.004, h * 0.004, 1);
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

    var seed = 9;
    function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    // ---- Build the hierarchy: center -> theme trunk -> recursive forks -> leaves
    var nodes = [];   // creation order = parents before children (good for forward FK)
    var leaves = [];
    function node(parent, angle, depth, isLeaf) {
      var n = {
        parent: parent, angle: angle, depth: depth, isLeaf: !!isLeaf,
        leafCount: 0, item: null, phase: rand() * 6.283,
        rx: 0, ry: 0, restLen: 0, restRel: 0, restWorld: 0,
        x: 0, y: 0, worldAngle: 0, swayOff: 0, swayVel: 0
      };
      nodes.push(n);
      return n;
    }

    var center = node(null, 0, 0, false);
    var maxDepth = 1;
    var themeCount = themeOrder.length;

    // Recursively split a theme's leaf-angle range into a binary fork tree.
    function fork(parent, list, lo, hi, angles, depth) {
      if (depth > maxDepth) maxDepth = depth;
      if (hi - lo === 1) {
        var leaf = node(parent, angles[lo], depth, true);
        leaf.item = list[lo];
        leaves.push(leaf);
        return;
      }
      var mid = (lo + hi) >> 1;
      var nodeAngle = (angles[lo] + angles[hi - 1]) * 0.5;
      var inner = node(parent, nodeAngle, depth, false);
      fork(inner, list, lo, mid, angles, depth + 1);
      fork(inner, list, mid, hi, angles, depth + 1);
    }

    themeOrder.forEach(function (themeName, ti) {
      var mid = (ti / themeCount) * Math.PI * 2 - Math.PI / 2;
      var half = (Math.PI / themeCount) * (1 - SECTOR_PAD);
      var list = byTheme[themeName];
      var n = list.length;
      var angles = [];
      for (var j = 0; j < n; j++) angles.push(mid - half + ((j + 0.5) / n) * (2 * half));

      // Trunk: a short bough from center before the first fork (carries the label).
      var trunk = node(center, mid, 1, false);
      trunk.isTrunk = true;
      trunk.themeName = themeName;
      if (n === 1) { var lf = node(trunk, angles[0], 2, true); lf.item = list[0]; leaves.push(lf); }
      else fork(trunk, list, 0, n, angles, 2);
    });

    // ---- Rest geometry: radius by depth (leaves on the rim), then FK basis ----
    for (var i = 0; i < nodes.length; i++) {
      var nd = nodes[i];
      if (nd === center) { nd.rx = 0; nd.ry = 0; continue; }
      var r = nd.isLeaf ? (LEAF_RADIUS + (rand() - 0.5) * LEAF_JITTER)
                        : (nd.depth / (maxDepth + 0.5)) * (LEAF_RADIUS * INNER_SPAN);
      nd.rx = Math.cos(nd.angle) * r;
      nd.ry = Math.sin(nd.angle) * r;
    }
    // leafCount (post-order: children come after parents, so walk backwards)
    for (var b = nodes.length - 1; b >= 0; b--) {
      var nb = nodes[b];
      if (nb.isLeaf) nb.leafCount = 1;
      if (nb.parent) nb.parent.leafCount += nb.leafCount;
    }
    // restWorld angle of each segment, and the relative angle at each joint
    center.restWorld = 0;
    for (var c = 0; c < nodes.length; c++) {
      var nc = nodes[c];
      if (!nc.parent) continue;
      nc.restWorld = Math.atan2(nc.ry - nc.parent.ry, nc.rx - nc.parent.rx);
      nc.restLen = Math.hypot(nc.rx - nc.parent.rx, nc.ry - nc.parent.ry);
      nc.restRel = nc.restWorld - nc.parent.restWorld;
    }

    function widthOf(n) { return BW_MIN + BW_SCALE * Math.sqrt(n.leafCount); }

    // ---- Center anchor ----
    group.add(new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 64),
      new THREE.MeshBasicMaterial({ color: INK_HEX, transparent: true, opacity: 0.92 })));
    group.add(new THREE.Mesh(new THREE.CircleGeometry(0.11, 32),
      new THREE.MeshBasicMaterial({ color: INK_HEX, transparent: true, opacity: 0.9 })));

    // ---- Theme labels (static, just outside the rim) ----
    themeOrder.forEach(function (themeName, ti) {
      var mid = (ti / themeCount) * Math.PI * 2 - Math.PI / 2;
      var label = makeLabelSprite(THREE, themeName);
      label.position.set(Math.cos(mid) * (LEAF_RADIUS + 0.95), Math.sin(mid) * (LEAF_RADIUS + 0.95), 2);
      group.add(label);
    });

    // ---- Branch mesh (stiff tapered segments, rebuilt each frame) ----
    var segNodes = nodes.filter(function (n) { return !!n.parent; });
    var branchPos = new Float32Array(segNodes.length * 6 * 3);
    var branchGeo = new THREE.BufferGeometry();
    branchGeo.setAttribute('position', new THREE.BufferAttribute(branchPos, 3));
    var branchMesh = new THREE.Mesh(branchGeo, new THREE.MeshBasicMaterial({
      color: INK_HEX, transparent: true, opacity: 0.82, side: THREE.DoubleSide
    }));
    branchMesh.frustumCulled = false;
    group.add(branchMesh);

    // ---- Leaf dots (one instanced mesh; hover by nearest in world space) ----
    var dotMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20),
      new THREE.MeshBasicMaterial({ color: INK_HEX }), leaves.length);
    dotMesh.frustumCulled = false;
    group.add(dotMesh);
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

    // ---- Pointer ----
    var hovered = null;
    var hasFine = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var mWorldX = 0, mWorldY = 0, mVelX = 0, mVelY = 0, mInside = false, mHave = false;

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
        if (cap) cap.textContent = item.theme + (item.caption ? '  ·  ' + item.caption : '');
        display.classList.add('is-active'); page.classList.add('is-display-active');
      } else {
        display.classList.remove('is-active'); page.classList.remove('is-display-active');
      }
    }
    function nearestLeaf(wx, wy) {
      var best = null, bestD = DOT_PICK * DOT_PICK;
      for (var k = 0; k < leaves.length; k++) {
        var dx = leaves[k].x - wx, dy = leaves[k].y - wy;
        var d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = leaves[k]; }
      }
      return best;
    }
    function onMove(e) {
      var w = toWorld(e.clientX, e.clientY);
      if (mHave) { mVelX = w.x - mWorldX; mVelY = w.y - mWorldY; }
      mWorldX = w.x; mWorldY = w.y; mInside = true; mHave = true;
      if (hasFine) {
        var hit = nearestLeaf(w.x, w.y);
        if (hit !== hovered) {
          hovered = hit;
          setDisplay(hit ? hit.item : null);
          mount.classList.toggle('is-hovering', !!hit);
        }
      }
    }
    function onClick(e) { var w = toWorld(e.clientX, e.clientY); var hit = nearestLeaf(w.x, w.y); if (hit) { hovered = hit; setDisplay(hit.item); } }
    function onLeave() { mInside = false; if (hasFine) { hovered = null; setDisplay(null); mount.classList.remove('is-hovering'); } }

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

      // Directional wind: a slowly turning gust. A joint bends most when its
      // branch faces across the wind; tips compound every ancestor's bend.
      var windDir = 0.6 + Math.sin(t * 0.13) * 1.4 + Math.sin(t * 0.31 + 1.0) * 0.5;
      var gust = 0.55 + 0.45 * Math.sin(t * 0.5) + 0.18 * Math.sin(t * 1.3 + 2.0);
      var mSpeed = Math.sqrt(mVelX * mVelX + mVelY * mVelY);

      // Forward kinematics: center pinned, every joint rotates by wind + spring.
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (!n.parent) { n.x = 0; n.y = 0; n.worldAngle = 0; continue; }

        var sway = 0;
        if (!reduceMotion) {
          var wind = WIND_SWAY * Math.sin(windDir - n.restWorld) * gust
                   + FLUTTER * Math.sin(t * 1.7 + n.phase);

          // Cursor torque: a fast pass near a joint twists it; it springs back.
          var torque = 0;
          if (mInside && mSpeed > 0.0002) {
            var dx = n.x - mWorldX, dy = n.y - mWorldY;
            var d2 = dx * dx + dy * dy, R2 = MOUSE_RADIUS * MOUSE_RADIUS;
            if (d2 < R2) {
              var prox = 1 - Math.sqrt(d2) / MOUSE_RADIUS;
              var bx = Math.cos(n.restWorld), by = Math.sin(n.restWorld);
              torque = MOUSE_TORQUE * prox * prox * (bx * mVelY - by * mVelX);
            }
          }
          n.swayVel += (torque - JOINT_K * n.swayOff - JOINT_C * n.swayVel) * dt;
          n.swayOff += n.swayVel * dt;
          sway = wind + n.swayOff;
        }

        n.worldAngle = n.parent.worldAngle + n.restRel + sway;
        n.x = n.parent.x + Math.cos(n.worldAngle) * n.restLen;
        n.y = n.parent.y + Math.sin(n.worldAngle) * n.restLen;
      }
      mVelX *= 0.8; mVelY *= 0.8;

      // Rebuild branch quads from the swayed joints (thick trunk -> fine twig).
      var o = 0;
      for (var s = 0; s < segNodes.length; s++) {
        var nd = segNodes[s], pa = nd.parent;
        var ex = nd.x - pa.x, ey = nd.y - pa.y;
        var len = Math.hypot(ex, ey) || 1;
        var px = -ey / len, py = ex / len;
        var wa = widthOf(pa) * 0.5, wb = widthOf(nd) * 0.5;
        var ax1 = pa.x + px * wa, ay1 = pa.y + py * wa;
        var ax2 = pa.x - px * wa, ay2 = pa.y - py * wa;
        var bx1 = nd.x + px * wb, by1 = nd.y + py * wb;
        var bx2 = nd.x - px * wb, by2 = nd.y - py * wb;
        branchPos[o++] = ax1; branchPos[o++] = ay1; branchPos[o++] = 0;
        branchPos[o++] = ax2; branchPos[o++] = ay2; branchPos[o++] = 0;
        branchPos[o++] = bx1; branchPos[o++] = by1; branchPos[o++] = 0;
        branchPos[o++] = ax2; branchPos[o++] = ay2; branchPos[o++] = 0;
        branchPos[o++] = bx2; branchPos[o++] = by2; branchPos[o++] = 0;
        branchPos[o++] = bx1; branchPos[o++] = by1; branchPos[o++] = 0;
      }
      branchGeo.attributes.position.needsUpdate = true;

      // Photo dots at the tips.
      for (var d = 0; d < leaves.length; d++) {
        var lf = leaves[d];
        var rr = lf === hovered ? DOT_R_HOVER : DOT_R;
        dummy.position.set(lf.x, lf.y, lf === hovered ? 1.4 : 0.2);
        dummy.scale.set(rr, rr, 1);
        dummy.rotation.z = 0; dummy.updateMatrix();
        dotMesh.setMatrixAt(d, dummy.matrix);
      }
      dotMesh.instanceMatrix.needsUpdate = true;

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
