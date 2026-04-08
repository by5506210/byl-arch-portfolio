// ============================================
// PROJECT PAGE — All interactive features
// ============================================

function rememberPageForBackNav() {
  var current = window.location.pathname + window.location.search + window.location.hash;
  var last = sessionStorage.getItem('bylCurrentPage');

  if (last && last !== current) {
    sessionStorage.setItem('bylPreviousPage', last);
  }

  sessionStorage.setItem('bylCurrentPage', current);
}

// Gallery reveal with stagger
function initGalleryReveals() {
  var images = document.querySelectorAll('.project-gallery__image');
  if (images.length === 0) return;

  var revealIndex = 0;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var delay = revealIndex * 0.12;
        entry.target.style.transitionDelay = delay + 's';
        var img = entry.target.querySelector('img');
        if (img) img.style.transitionDelay = delay + 's';
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
        revealIndex++;
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -8% 0px'
  });

  images.forEach(function (img) {
    // Add native lazy loading to gallery images below the fold
    var imgEl = img.querySelector('img');
    if (imgEl) imgEl.loading = 'lazy';
    observer.observe(img);
  });
}

// Parallax hero image
function initParallaxHero() {
  if (window.innerWidth <= 768) return;
  var heroImg = document.querySelector('.project-hero img');
  if (!heroImg) return;

  var hero = document.querySelector('.project-hero');
  var ticking = false;

  function updateParallax() {
    var scrollY = window.scrollY;
    var heroH = hero.offsetHeight;
    if (scrollY < heroH) {
      heroImg.style.transform = 'translateY(' + (scrollY * 0.3) + 'px)';
    }
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }, { passive: true });
}

// Integrated nav bar — contains back, project name, and nav links
function initNavBar() {
  // Skip on slideshow page — it has its own nav bar
  if (document.querySelector('.slideshow-nav-bar')) return;
  rememberPageForBackNav();

  var hero = document.querySelector('.project-hero');

  // Build the unified bar
  var bar = document.createElement('div');
  bar.classList.add('project-nav-bar');

  // Left: back arrow — goes to previous page
  var logo = document.createElement('a');
  logo.href = '../index.html';
  logo.classList.add('project-nav-bar__logo');
  logo.textContent = 'BYL';
  bar.appendChild(logo);

  // Right: nav links
  var links = document.createElement('div');
  links.classList.add('project-nav-bar__links');
  links.innerHTML =
    '<a href="projects.html" class="project-nav-bar__link">Projects</a>' +
    '<a href="about.html" class="project-nav-bar__link">About</a>' +
    '<a href="contact.html" class="project-nav-bar__link">Contact</a>';
  bar.appendChild(links);

  document.body.appendChild(bar);

  // If hero exists, show/hide bar style on scroll
  if (hero) {
    // Bar starts transparent over the hero, becomes solid when scrolled past
    bar.classList.add('project-nav-bar--over-hero');

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          bar.classList.add('project-nav-bar--over-hero');
          bar.classList.remove('project-nav-bar--solid');
        } else {
          bar.classList.remove('project-nav-bar--over-hero');
          bar.classList.add('project-nav-bar--solid');
        }
      });
    }, { threshold: 0 });

    observer.observe(hero);
  } else {
    // No hero — always solid
    bar.classList.add('project-nav-bar--solid');
  }
}

// Animated spec counters
function initSpecCounters() {
  var values = document.querySelectorAll('.project-details__meta-value');
  if (values.length === 0) return;

  values.forEach(function (el) {
    var text = el.textContent.trim();
    var match = text.match(/^([\d,]+\.?\d*)/);
    if (!match) return;

    var numStr = match[1];
    var target = parseFloat(numStr.replace(/,/g, ''));
    var suffix = text.substring(match[0].length);
    var hasCommas = numStr.indexOf(',') !== -1;
    var decimals = numStr.indexOf('.') !== -1 ? numStr.split('.')[1].length : 0;

    el.dataset.target = target;
    el.dataset.suffix = suffix;
    el.dataset.hasCommas = hasCommas;
    el.dataset.decimals = decimals;
    el.textContent = '0' + suffix;
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && entry.target.dataset.target) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  values.forEach(function (el) {
    if (el.dataset.target) observer.observe(el);
  });
}

function animateCounter(el) {
  var target = parseFloat(el.dataset.target);
  var suffix = el.dataset.suffix;
  var hasCommas = el.dataset.hasCommas === 'true';
  var decimals = parseInt(el.dataset.decimals);
  var duration = 1500;
  var start = performance.now();

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function formatNumber(n) {
    var fixed = n.toFixed(decimals);
    if (!hasCommas) return fixed;
    var parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  function tick(now) {
    var elapsed = now - start;
    var progress = Math.min(elapsed / duration, 1);
    var eased = easeOutExpo(progress);
    var current = target * eased;
    el.textContent = formatNumber(current) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

// Filmstrip drag scroll + slider controls
function initFilmstrip() {
  var filmstrip = document.querySelector('.project-filmstrip');
  if (!filmstrip) return;

  var track = filmstrip.querySelector('.project-filmstrip__track');
  var frames = filmstrip.querySelectorAll('.project-filmstrip__frame');
  var prevBtn = filmstrip.querySelector('.project-filmstrip__arrow--prev');
  var nextBtn = filmstrip.querySelector('.project-filmstrip__arrow--next');
  var dots = filmstrip.querySelectorAll('.project-filmstrip__dot');
  var isDragging = false;
  var startX = 0;
  var currentX = 0;
  var velocity = 0;
  var animFrame;
  var currentSlide = 0;
  var totalSlides = frames.length;

  // Cache layout values to avoid reflow in hot paths
  var cachedMaxScroll = 0;
  var cachedFrameOffsets = [];
  var cachedFilmstripWidth = 0;

  function cacheLayout() {
    cachedFilmstripWidth = filmstrip.offsetWidth;
    cachedMaxScroll = -(track.scrollWidth - cachedFilmstripWidth);
    cachedFrameOffsets = [];
    for (var i = 0; i < totalSlides; i++) {
      cachedFrameOffsets.push(frames[i].offsetLeft);
    }
  }
  cacheLayout();

  window.addEventListener('resize', cacheLayout);

  function getMaxScroll() {
    return cachedMaxScroll;
  }

  function clamp(val) {
    return Math.max(getMaxScroll(), Math.min(0, val));
  }

  function setPosition(x) {
    currentX = clamp(x);
    track.style.transform = 'translateX(' + currentX + 'px)';
  }

  function goToSlide(index) {
    if (index < 0) index = 0;
    if (index >= totalSlides) index = totalSlides - 1;
    currentSlide = index;

    // Calculate target position based on cached frame offset
    var targetX = -(cachedFrameOffsets[index] - cachedFilmstripWidth * 0.08);
    targetX = clamp(targetX);

    // Smooth animate
    cancelAnimationFrame(animFrame);
    var startPos = currentX;
    var dist = targetX - startPos;
    var startTime = null;
    var duration = 400;

    function slideAnim(ts) {
      if (!startTime) startTime = ts;
      var elapsed = ts - startTime;
      var t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      t = 1 - Math.pow(1 - t, 3);
      setPosition(startPos + dist * t);
      if (elapsed < duration) {
        animFrame = requestAnimationFrame(slideAnim);
      } else {
        updateControls();
      }
    }
    animFrame = requestAnimationFrame(slideAnim);
    updateControls();
  }

  function updateControls() {
    // Update dots
    if (dots.length) {
      dots.forEach(function (dot, i) {
        dot.classList.toggle('project-filmstrip__dot--active', i === currentSlide);
      });
    }
    // Update arrows
    if (prevBtn) prevBtn.classList.toggle('project-filmstrip__arrow--disabled', currentSlide === 0);
    if (nextBtn) nextBtn.classList.toggle('project-filmstrip__arrow--disabled', currentSlide >= totalSlides - 1);
  }

  // Detect which slide is closest after drag (uses cached offsets)
  function snapToNearest() {
    var closest = 0;
    var closestDist = Infinity;
    for (var i = 0; i < totalSlides; i++) {
      var frameTarget = -(cachedFrameOffsets[i] - cachedFilmstripWidth * 0.08);
      var d = Math.abs(currentX - frameTarget);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    }
    currentSlide = closest;
    updateControls();
  }

  // Arrow click handlers
  if (prevBtn) prevBtn.addEventListener('click', function () { goToSlide(currentSlide - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { goToSlide(currentSlide + 1); });

  // Dot click handlers
  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { goToSlide(i); });
  });

  filmstrip.addEventListener('mousedown', function (e) {
    isDragging = true;
    startX = e.clientX - currentX;
    velocity = 0;
    cancelAnimationFrame(animFrame);
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    var newX = e.clientX - startX;
    velocity = newX - currentX;
    setPosition(newX);
  });

  document.addEventListener('mouseup', function () {
    if (!isDragging) return;
    isDragging = false;
    applyMomentum();
  });

  filmstrip.addEventListener('touchstart', function (e) {
    isDragging = true;
    startX = e.touches[0].clientX - currentX;
    velocity = 0;
    cancelAnimationFrame(animFrame);
  }, { passive: true });

  filmstrip.addEventListener('touchmove', function (e) {
    if (!isDragging) return;
    var newX = e.touches[0].clientX - startX;
    velocity = newX - currentX;
    setPosition(newX);
  }, { passive: true });

  filmstrip.addEventListener('touchend', function () {
    isDragging = false;
    applyMomentum();
  });

  function applyMomentum() {
    function drift() {
      if (Math.abs(velocity) < 0.5) {
        snapToNearest();
        return;
      }
      velocity *= 0.92;
      setPosition(currentX + velocity);
      animFrame = requestAnimationFrame(drift);
    }
    drift();
  }

  updateControls();
}

function initProjectsAtlas() {
  var helix = document.querySelector('.projects-helix');
  if (!helix) return;
  if (helix.dataset.helixInit === 'true') return;
  helix.dataset.helixInit = 'true';

  var stage = helix.querySelector('.projects-helix__stage');
  var nodes = Array.prototype.slice.call(helix.querySelectorAll('.projects-helix__node'));
  var webglMount = helix.querySelector('.projects-helix__webgl');
  var guides = helix.querySelector('.projects-helix__guides');
  var axisPath = helix.querySelector('.projects-helix__axis');
  var threadPath = helix.querySelector('.projects-helix__thread');
  var orbitTop = helix.querySelector('.projects-helix__orbit--top');
  var orbitMid = helix.querySelector('.projects-helix__orbit--mid');
  var orbitBottom = helix.querySelector('.projects-helix__orbit--bottom');
  var selectedNode = null;
  var resizeFrame = null;
  var webglHelix = null;

  if (!stage || nodes.length === 0) return;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isCoarsePointer() {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  function setNodeLayer(node, proximity) {
    var depth = parseFloat(node.dataset.depth || '0.5');
    var strength = isNaN(proximity) ? 0 : proximity;
    var layer = 2 + Math.round(depth * 24 + strength * 26);
    node.style.zIndex = String(layer);
  }

  function clearVisualState() {
    nodes.forEach(function (node) {
      node.classList.remove('is-active');
      node.style.setProperty('--proximity', '0');
      setNodeLayer(node, 0);
    });
    stage.setAttribute('data-active-series', '');
  }

  function activateSelection(node) {
    selectedNode = node;
    nodes.forEach(function (item) {
      var isActive = item === node;
      item.classList.toggle('is-active', isActive);
      item.style.setProperty('--proximity', isActive ? '1' : '0');
      setNodeLayer(item, isActive ? 1 : 0);
    });
    stage.setAttribute('data-active-series', node ? node.dataset.series : '');
  }

  function createWebglHelix() {
    if (!window.THREE || !webglMount) return null;
    var THREE = window.THREE;
    var renderer;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      return null;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    while (webglMount.firstChild) {
      webglMount.removeChild(webglMount.firstChild);
    }
    webglMount.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(10.4, 2.7, 9.8);
    camera.lookAt(0, 0, 0);

    var group = new THREE.Group();
    scene.add(group);
    group.rotation.x = -0.08;

    var dotGeometry = new THREE.SphereGeometry(0.08, 14, 14);
    var nodeData = [];
    var viewportWidth = 1;
    var viewportHeight = 1;
    var frameId = 0;
    var lastFrameTime = 0;

    function disposeMaterial(material) {
      if (material && material.dispose) material.dispose();
    }

    function clearGroup() {
      while (group.children.length) {
        var child = group.children[0];
        group.remove(child);
        if (child.geometry && child.geometry.dispose) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(disposeMaterial);
          } else {
            disposeMaterial(child.material);
          }
        }
      }
    }

    function addLine(points, material, dashed) {
      var geometry = new THREE.BufferGeometry().setFromPoints(points);
      var line = new THREE.Line(geometry, material);
      if (dashed && line.computeLineDistances) line.computeLineDistances();
      group.add(line);
      return line;
    }

    function ringPoints(radius, y, segments) {
      var points = [];
      for (var i = 0; i <= segments; i++) {
        var angle = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
      }
      return points;
    }

    function worldToScreen(vector, width, height) {
      var world = vector.clone().applyMatrix4(group.matrixWorld);
      var projected = world.project(camera);
      return {
        x: (projected.x * 0.5 + 0.5) * width,
        y: (-projected.y * 0.5 + 0.5) * height,
        z: projected.z
      };
    }

    function buildWorld(width) {
      clearGroup();
      nodeData = [];

      var total = nodes.length;
      var startAngle = -Math.PI * 0.5;
      var helixRadius = Math.max(4.6, Math.min(6.8, 5.2 + (width - 980) / 380));
      var helixHeight = 10.2;
      var threadSegments = Math.max(220, total * 36);
      var threadPoints = [];
      var axisTop = helixHeight * 0.61;
      var axisBottom = -helixHeight * 0.61;

      addLine(
        [new THREE.Vector3(0, axisTop, 0), new THREE.Vector3(0, axisBottom, 0)],
        new THREE.LineDashedMaterial({
          color: 0x11110f,
          transparent: true,
          opacity: 0.2,
          dashSize: 0.18,
          gapSize: 0.16
        }),
        true
      );

      addLine(
        ringPoints(helixRadius, helixHeight * 0.5, 108),
        new THREE.LineBasicMaterial({ color: 0x11110f, transparent: true, opacity: 0.2 }),
        false
      );
      addLine(
        ringPoints(helixRadius, 0, 108),
        new THREE.LineBasicMaterial({ color: 0x11110f, transparent: true, opacity: 0.1 }),
        false
      );
      addLine(
        ringPoints(helixRadius, -helixHeight * 0.5, 108),
        new THREE.LineBasicMaterial({ color: 0x11110f, transparent: true, opacity: 0.2 }),
        false
      );

      for (var i = 0; i <= threadSegments; i++) {
        var t = i / threadSegments;
        var theta = startAngle + t * Math.PI * 2;
        threadPoints.push(new THREE.Vector3(
          Math.sin(theta) * helixRadius,
          (0.5 - t) * helixHeight,
          Math.cos(theta) * helixRadius
        ));
      }

      addLine(
        threadPoints,
        new THREE.LineBasicMaterial({ color: 0x11110f, transparent: true, opacity: 0.33 }),
        false
      );

      for (var index = 0; index < total; index++) {
        var progress = total === 1 ? 0.5 : index / (total - 1);
        var angle = startAngle + progress * Math.PI * 2;
        var point = new THREE.Vector3(
          Math.sin(angle) * helixRadius,
          (0.5 - progress) * helixHeight,
          Math.cos(angle) * helixRadius
        );
        var anchor = point.clone();

        var dot = new THREE.Mesh(dotGeometry, new THREE.MeshBasicMaterial({
          color: 0xf9f8f5,
          transparent: true,
          opacity: 0.95
        }));
        dot.position.copy(point);
        group.add(dot);

        nodeData.push({ point: point, anchor: anchor });
      }
    }

    function syncNodes(width, height) {
      group.updateMatrixWorld(true);
      nodes.forEach(function (node, index) {
        var data = nodeData[index];
        if (!data) return;

        var pointScreen = worldToScreen(data.point, width, height);
        var depth = clamp(1 - (pointScreen.z + 1) * 0.5, 0, 1);
        var side = data.point.x >= 0 ? 1 : -1;
        var currentProximity = parseFloat(node.style.getPropertyValue('--proximity'));

        node.style.setProperty('--x', pointScreen.x.toFixed(2) + 'px');
        node.style.setProperty('--y', pointScreen.y.toFixed(2) + 'px');
        node.style.setProperty('--depth', depth.toFixed(3));
        node.style.setProperty('--arm-length', '0px');
        node.style.setProperty('--arm-shift', '0px');
        node.style.setProperty('--helix-shift', '0px');
        node.style.setProperty('--panel-yaw', (side > 0 ? -24 : 24).toFixed(2));
        node.dataset.depth = depth.toFixed(3);

        setNodeLayer(node, isNaN(currentProximity) ? 0 : currentProximity);
      });
    }

    function renderFrame(now) {
      if (!lastFrameTime) lastFrameTime = now;
      var delta = Math.min(80, now - lastFrameTime);
      lastFrameTime = now;

      // Slow, clearly visible rotation.
      group.rotation.y += delta * 0.00006;

      renderer.render(scene, camera);
      syncNodes(viewportWidth, viewportHeight);
      frameId = requestAnimationFrame(renderFrame);
    }

    function ensureAnimation() {
      if (frameId) return;
      lastFrameTime = 0;
      frameId = requestAnimationFrame(renderFrame);
    }

    function layout() {
      var rect = stage.getBoundingClientRect();
      var width = Math.max(1, Math.round(rect.width));
      var height = Math.max(1, Math.round(rect.height));
      var aspect = width / height;
      var frustumSize = 14.1;
      viewportWidth = width;
      viewportHeight = height;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);

      camera.left = (-frustumSize * aspect) * 0.5;
      camera.right = (frustumSize * aspect) * 0.5;
      camera.top = frustumSize * 0.5;
      camera.bottom = -frustumSize * 0.5;
      camera.updateProjectionMatrix();

      buildWorld(width);
      renderer.render(scene, camera);
      syncNodes(width, height);
      ensureAnimation();
    }

    return { layout: layout };
  }

  function loadThreeFromCdn(onReady) {
    var urls = [
      'https://unpkg.com/three@0.164.1/build/three.min.js',
      'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.min.js'
    ];
    var i = 0;

    function loadNext() {
      if (window.THREE) {
        onReady();
        return;
      }
      if (i >= urls.length) return;

      var existing = document.querySelector('script[data-three-loader="' + i + '"]');
      if (existing) {
        i++;
        loadNext();
        return;
      }

      var script = document.createElement('script');
      script.src = urls[i];
      script.async = true;
      script.defer = true;
      script.dataset.threeLoader = String(i);
      script.onload = function () {
        onReady();
      };
      script.onerror = function () {
        i++;
        loadNext();
      };
      document.head.appendChild(script);
    }

    loadNext();
  }

  function projectOffset(theta, radius, viewAngle) {
    var spatialX = Math.sin(theta) * radius;
    var spatialZ = Math.cos(theta) * radius;
    var projectedX = spatialX * Math.cos(viewAngle) + spatialZ * Math.sin(viewAngle);
    var projectedDepth = (-spatialX * Math.sin(viewAngle)) + (spatialZ * Math.cos(viewAngle));
    return {
      x: projectedX,
      depth: projectedDepth
    };
  }

  function buildThreadPath(centerX, topY, loopHeight, radius, startAngle, viewAngle) {
    var segments = Math.max(72, nodes.length * 14);
    var d = '';

    for (var i = 0; i <= segments; i++) {
      var progress = i / segments;
      var theta = startAngle + progress * Math.PI * 2;
      var projected = projectOffset(theta, radius, viewAngle);
      var x = centerX + projected.x;
      var y = topY + progress * loopHeight;
      d += (i === 0 ? 'M' : ' L') + x.toFixed(2) + ' ' + y.toFixed(2);
    }

    return d;
  }

  function setOrbitGeometry(orbit, cx, cy, rx, ry) {
    if (!orbit) return;
    orbit.setAttribute('cx', cx.toFixed(2));
    orbit.setAttribute('cy', cy.toFixed(2));
    orbit.setAttribute('rx', rx.toFixed(2));
    orbit.setAttribute('ry', ry.toFixed(2));
  }

  function layoutHelixFallback() {
    var rect = stage.getBoundingClientRect();
    var width = rect.width;
    var height = rect.height;
    var centerX = width * 0.5;
    var topY = height * 0.14;
    var loopHeight = height * 0.72;
    var radiusX = Math.min(width * 0.47, 560);
    var orbitRadiusY = Math.max(14, Math.min(height * 0.07, 34));
    var viewAngle = Math.PI * 0.24;
    var startAngle = -Math.PI * 0.5;
    var total = nodes.length;

    if (axisPath) {
      axisPath.setAttribute(
        'd',
        'M' + centerX.toFixed(2) + ' ' + (topY - orbitRadiusY * 1.35).toFixed(2) +
        ' L' + centerX.toFixed(2) + ' ' + (topY + loopHeight + orbitRadiusY * 1.35).toFixed(2)
      );
    }

    setOrbitGeometry(orbitTop, centerX, topY, radiusX, orbitRadiusY);
    setOrbitGeometry(orbitMid, centerX, topY + loopHeight * 0.5, radiusX, orbitRadiusY);
    setOrbitGeometry(orbitBottom, centerX, topY + loopHeight, radiusX, orbitRadiusY);

    if (threadPath) {
      threadPath.setAttribute('d', buildThreadPath(centerX, topY, loopHeight, radiusX, startAngle, viewAngle));
    }

    nodes.forEach(function (node, index) {
      var progress = total === 1 ? 0.5 : index / (total - 1);
      var theta = startAngle + progress * Math.PI * 2;
      var projected = projectOffset(theta, radiusX, viewAngle);
      var helixX = centerX + projected.x;
      var y = topY + progress * loopHeight;
      var depth = Math.max(0, Math.min(1, (projected.depth / radiusX + 1) * 0.5));
      var side = projected.x >= 0 ? 1 : -1;
      var panelYaw = side > 0 ? -28 : 28;
      var currentProximity = parseFloat(node.style.getPropertyValue('--proximity'));

      node.style.setProperty('--x', helixX.toFixed(2) + 'px');
      node.style.setProperty('--y', y.toFixed(2) + 'px');
      node.style.setProperty('--depth', depth.toFixed(3));
      node.style.setProperty('--arm-length', '0px');
      node.style.setProperty('--arm-shift', '0px');
      node.style.setProperty('--helix-shift', '0px');
      node.style.setProperty('--panel-yaw', panelYaw.toFixed(2));
      node.dataset.depth = depth.toFixed(3);

      setNodeLayer(node, isNaN(currentProximity) ? 0 : currentProximity);
    });
  }

  function layoutHelix() {
    if (webglHelix) {
      webglHelix.layout();
      return;
    }
    layoutHelixFallback();
  }

  function updateProximity(clientX, clientY) {
    var bestNode = null;
    var bestValue = 0;

    nodes.forEach(function (node) {
      var thumb = node.querySelector('.projects-helix__thumb');
      if (!thumb) return;

      var rect = thumb.getBoundingClientRect();
      var centerThumbX = rect.left + rect.width * 0.5;
      var centerThumbY = rect.top + rect.height * 0.5;
      var dist = Math.sqrt(Math.pow(clientX - centerThumbX, 2) + Math.pow(clientY - centerThumbY, 2));
      var threshold = Math.max(132, rect.width * 2.25);
      var proximity = Math.max(0, 1 - dist / threshold);
      proximity = proximity * proximity;

      node.style.setProperty('--proximity', proximity.toFixed(3));
      node.classList.toggle('is-active', proximity > 0.22);
      setNodeLayer(node, proximity);

      if (proximity > bestValue) {
        bestValue = proximity;
        bestNode = node;
      }
    });

    if (bestNode && bestValue > 0.08) {
      stage.setAttribute('data-active-series', bestNode.dataset.series || '');
    } else {
      stage.setAttribute('data-active-series', '');
      nodes.forEach(function (node) {
        node.classList.remove('is-active');
        setNodeLayer(node, 0);
      });
    }
  }

  function enableWebglIfPossible() {
    if (!webglMount || webglHelix || !window.THREE) return false;
    webglHelix = createWebglHelix();
    if (!webglHelix) return false;

    helix.classList.add('projects-helix--webgl-enabled');
    if (guides) guides.remove();
    layoutHelix();
    return true;
  }

  if (!enableWebglIfPossible() && webglMount && !window.THREE) {
    loadThreeFromCdn(function () {
      enableWebglIfPossible();
    });
  }

  nodes.forEach(function (node) {
    node.addEventListener('focus', function () {
      activateSelection(node);
    });

    node.addEventListener('click', function (evt) {
      if (isCoarsePointer() && selectedNode !== node) {
        evt.preventDefault();
        activateSelection(node);
      }
    });
  });

  function handleResize() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(function () {
      layoutHelix();
      if (selectedNode) {
        activateSelection(selectedNode);
      } else {
        clearVisualState();
      }
    });
  }

  stage.addEventListener('mousemove', function (evt) {
    if (isCoarsePointer()) return;
    selectedNode = null;
    updateProximity(evt.clientX, evt.clientY);
  });

  stage.addEventListener('mouseleave', function () {
    if (selectedNode) {
      activateSelection(selectedNode);
      return;
    }
    clearVisualState();
  });

  window.addEventListener('resize', handleResize);

  layoutHelix();
  clearVisualState();
}

function initProjectsIndexPreview() {
  var index = document.querySelector('.projects-index');
  if (!index) return;
  if (index.dataset.previewInit === 'true') return;
  index.dataset.previewInit = 'true';

  var layout = index.querySelector('.projects-index__layout');
  var preview = index.querySelector('.projects-preview');
  var screen = preview && preview.querySelector('.projects-preview__screen');
  var image = preview && preview.querySelector('.projects-preview__image');
  var title = preview && preview.querySelector('.projects-preview__meta-title');
  var cards = Array.prototype.slice.call(index.querySelectorAll('.projects-index__card:not(.projects-index__card--coming-soon)'));
  if (!layout || !preview || !screen || !image || !title || cards.length === 0) return;

  var activeCard = null;
  var beamTimer = null;
  var clearTimer = null;

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function setProjectionOrigin(card) {
    var cardFrame = card.querySelector('.projects-index__card-img') || card;
    var cardRect = cardFrame.getBoundingClientRect();
    var screenRect = screen.getBoundingClientRect();
    var deltaX = (cardRect.left + cardRect.width * 0.5) - (screenRect.left + screenRect.width * 0.5);
    var deltaY = (cardRect.top + cardRect.height * 0.5) - (screenRect.top + screenRect.height * 0.5);

    screen.style.setProperty('--preview-origin-x', clamp(deltaX * 0.38, -180, 180) + 'px');
    screen.style.setProperty('--preview-origin-y', clamp(deltaY * 0.28, -120, 120) + 'px');
  }

  function updateProjectionPan(card, evt) {
    if (!evt) return;
    var cardFrame = card.querySelector('.projects-index__card-img') || card;
    var rect = cardFrame.getBoundingClientRect();
    var normX = ((evt.clientX - rect.left) / rect.width) - 0.5;
    var normY = ((evt.clientY - rect.top) / rect.height) - 0.5;
    screen.style.setProperty('--preview-pan-x', clamp(normX * 28, -24, 24) + 'px');
    screen.style.setProperty('--preview-pan-y', clamp(normY * 22, -18, 18) + 'px');
  }

  function triggerProjectionBeam() {
    preview.classList.remove('is-projecting');
    void preview.offsetWidth;
    preview.classList.add('is-projecting');
    clearTimeout(beamTimer);
    beamTimer = setTimeout(function () {
      preview.classList.remove('is-projecting');
    }, 520);
  }

  function activatePreview(card, evt) {
    if (!card) return;
    clearTimeout(clearTimer);
    setProjectionOrigin(card);
    updateProjectionPan(card, evt);

    var imgEl = card.querySelector('.projects-index__card-img img');
    if (!imgEl) return;

    var nextSrc = imgEl.currentSrc || imgEl.src;
    var nextTitle = '';
    var titleEl = card.querySelector('.projects-index__card-name');
    if (titleEl) nextTitle = titleEl.textContent.trim();

    if (activeCard !== card || image.src !== nextSrc) {
      activeCard = card;
      preview.classList.remove('is-active');
      image.src = nextSrc;
      image.alt = imgEl.alt || nextTitle;
      title.textContent = nextTitle;
      triggerProjectionBeam();
      requestAnimationFrame(function () {
        preview.classList.add('is-active');
      });
      return;
    }

    preview.classList.add('is-active');
  }

  function clearPreview() {
    activeCard = null;
    preview.classList.remove('is-active', 'is-projecting');
    screen.style.setProperty('--preview-pan-x', '0px');
    screen.style.setProperty('--preview-pan-y', '0px');
    clearTimeout(clearTimer);
    clearTimer = setTimeout(function () {
      if (!activeCard) {
        title.textContent = '';
        image.src = '';
        image.alt = '';
      }
    }, 220);
  }

  cards.forEach(function (card) {
    card.addEventListener('mouseenter', function (evt) {
      activatePreview(card, evt);
    });

    card.addEventListener('mousemove', function (evt) {
      activatePreview(card, evt);
    });

    card.addEventListener('focus', function () {
      activatePreview(card);
    });
  });

  layout.addEventListener('mouseleave', function () {
    clearPreview();
  });

  window.addEventListener('resize', function () {
    if (activeCard) setProjectionOrigin(activeCard);
  });
}

// Initialize all features
function initProjectPage() {
  // Clean up previous bar if exists
  var oldBar = document.querySelector('.project-nav-bar');
  if (oldBar) oldBar.remove();

  initProjectsAtlas();
  initProjectsIndexPreview();
  initGalleryReveals();
  initParallaxHero();
  initNavBar();
  initSpecCounters();
  initFilmstrip();
}

initProjectPage();
