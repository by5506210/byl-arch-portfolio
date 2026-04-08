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
  var ribbonLayer = helix.querySelector('.projects-helix__ribbon');
  var guides = helix.querySelector('.projects-helix__guides');
  var axisPath = helix.querySelector('.projects-helix__axis');
  var threadPath = helix.querySelector('.projects-helix__thread');
  var orbitTop = helix.querySelector('.projects-helix__orbit--top');
  var orbitMid = helix.querySelector('.projects-helix__orbit--mid');
  var orbitBottom = helix.querySelector('.projects-helix__orbit--bottom');
  var ribbonFrames = [];
  var ribbonItems = [];
  var selectedNode = null;
  var resizeFrame = null;
  var webglHelix = null;
  var webglFailureReason = '';
  var modeBadge = null;
  var fallbackCenterBias = 0.5;
  var baseViewAngle = Math.PI * 0.24;
  var fallbackRotation = 0;
  var fallbackFrame = null;
  var fallbackLast = 0;
  var primaryNode = null;
  var helixNavigationInProgress = false;
  var nodeHitCache = [];
  var pointerClientX = 0;
  var pointerClientY = 0;
  var pointerFrame = null;
  var proximityTarget = new WeakMap();
  var proximityCurrent = new WeakMap();
  var proximityFrame = null;
  var proximityLast = 0;
  var HELIX_ZOOM_KEY = 'bylHelixThumbZoom';

  if (!stage || nodes.length === 0) return;
  nodes.forEach(function (node, index) {
    node.dataset.nodeIndex = String(index);
  });

  function collectRibbonImagePool() {
    return nodes
      .map(function (node) {
        var img = node.querySelector('.projects-helix__thumb img');
        if (!img) return null;
        var src = img.currentSrc || img.src || '';
        if (!src) return null;
        return {
          src: src,
          alt: img.alt || node.dataset.title || ''
        };
      })
      .filter(function (item) {
        return !!item;
      });
  }

  function ensureRibbonLayer() {
    if (ribbonLayer) return ribbonLayer;
    if (!stage) return null;
    ribbonLayer = document.createElement('div');
    ribbonLayer.className = 'projects-helix__ribbon';
    ribbonLayer.setAttribute('aria-hidden', 'true');
    stage.appendChild(ribbonLayer);
    return ribbonLayer;
  }

  function rebuildRibbonFrames() {
    var layer = ensureRibbonLayer();
    if (!layer) return;

    while (layer.firstChild) layer.removeChild(layer.firstChild);
    ribbonFrames = [];
    ribbonItems = [];

    var imagePool = collectRibbonImagePool();
    if (imagePool.length === 0) return;

    var frameCount = Math.max(10, Math.min(14, nodes.length + 3));
    for (var i = 0; i < frameCount; i++) {
      var pick = imagePool[Math.floor(Math.random() * imagePool.length)];
      if (!pick) continue;

      var frame = document.createElement('span');
      frame.className = 'projects-helix__ribbon-frame';
      frame.style.setProperty('--x', '50%');
      frame.style.setProperty('--y', '50%');
      frame.style.setProperty('--depth', '0.5');
      frame.style.setProperty('--fog', '0.3');

      var image = document.createElement('img');
      image.src = pick.src;
      image.alt = pick.alt;
      image.loading = 'lazy';
      image.decoding = 'async';

      frame.appendChild(image);
      layer.appendChild(frame);
      ribbonFrames.push(frame);
      ribbonItems.push({
        progress: frameCount === 1 ? 0.5 : i / (frameCount - 1),
        twist: ((i % 5) - 2) * 0.035
      });
    }
  }

  rebuildRibbonFrames();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isCoarsePointer() {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  function resolveAbsoluteHref(href) {
    try {
      return new URL(href, window.location.href).href;
    } catch (err) {
      return href || '';
    }
  }

  function resolvePathname(href) {
    try {
      return new URL(href, window.location.href).pathname;
    } catch (err) {
      return '';
    }
  }

  function storeHelixZoomState(payload) {
    try {
      sessionStorage.setItem(HELIX_ZOOM_KEY, JSON.stringify(payload));
    } catch (err) {
      // Session storage can fail in strict privacy modes; fallback remains graceful.
    }
  }

  function beginHelixThumbNavigation(node, evt) {
    if (!node || helixNavigationInProgress) {
      if (evt) evt.preventDefault();
      return true;
    }
    if (evt && (evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.altKey || evt.button === 1)) {
      return false;
    }

    var href = node.getAttribute('href');
    if (!href) return false;

    var thumb = node.querySelector('.projects-helix__thumb');
    var thumbImg = thumb && thumb.querySelector('img');
    if (!thumb || !thumbImg || typeof gsap === 'undefined') return false;

    if (evt) evt.preventDefault();
    helixNavigationInProgress = true;

    var rect = thumb.getBoundingClientRect();
    var src = thumbImg.currentSrc || thumbImg.src || '';
    if (!src) return false;
    var alt = thumbImg.alt || node.dataset.title || '';
    var absoluteHref = resolveAbsoluteHref(href);
    var payload = {
      active: true,
      source: 'projects-helix',
      href: absoluteHref,
      path: resolvePathname(absoluteHref),
      src: src,
      alt: alt,
      timestamp: Date.now()
    };

    var layer = document.createElement('div');
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.overflow = 'hidden';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '12000';

    var clone = document.createElement('img');
    clone.src = src;
    clone.alt = alt;
    clone.style.position = 'fixed';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    clone.style.width = Math.max(1, rect.width) + 'px';
    clone.style.height = Math.max(1, rect.height) + 'px';
    clone.style.objectFit = 'cover';
    clone.style.borderRadius = '2px';
    clone.style.transformOrigin = 'center center';
    clone.style.willChange = 'left, top, width, height, opacity, border-radius';
    clone.style.zIndex = '12001';

    layer.appendChild(clone);
    document.body.appendChild(layer);

    payload.layerEl = layer;
    payload.cloneEl = clone;
    window.bylHelixThumbZoom = payload;
    storeHelixZoomState({
      href: payload.href,
      path: payload.path,
      src: payload.src,
      alt: payload.alt,
      timestamp: payload.timestamp
    });

    function continueNavigation() {
      try {
        if (window.barba && typeof window.barba.go === 'function') {
          window.barba.go(href);
          return;
        }
        window.location.href = href;
      } catch (err) {
        helixNavigationInProgress = false;
        stage.style.opacity = '';
        if (layer.parentNode) layer.remove();
        window.bylHelixThumbZoom = null;
        try {
          sessionStorage.removeItem(HELIX_ZOOM_KEY);
        } catch (removeErr) {}
      }
    }

    gsap.timeline({
      defaults: { overwrite: true },
      onComplete: continueNavigation
    })
      .to(clone, {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        borderRadius: 0,
        duration: 0.58,
        ease: 'power3.inOut'
      }, 0)
      .to(stage, {
        opacity: 0.25,
        duration: 0.38,
        ease: 'power2.out'
      }, 0.02);

    return true;
  }

  function ensureModeBadge() {
    if (modeBadge) return modeBadge;
    modeBadge = document.createElement('div');
    modeBadge.className = 'projects-helix__mode-badge';
    stage.appendChild(modeBadge);
    return modeBadge;
  }

  function setRenderMode(mode, reason) {
    helix.dataset.renderMode = mode;
    var badge = ensureModeBadge();
    var details = reason ? ' - ' + reason : '';
    badge.textContent = (mode === 'webgl' ? 'WEBGL' : 'FALLBACK') + details;
    if (mode === 'webgl') {
      console.info('[Projects Helix] WEBGL active' + details);
    } else {
      console.warn('[Projects Helix] FALLBACK active' + details);
    }
  }

  function setNodeLayer(node, proximity) {
    var depth = parseFloat(node.dataset.depth || '0.5');
    var strength = isNaN(proximity) ? 0 : proximity;
    var layer = 2 + Math.round(depth * 24 + strength * 26);
    node.style.zIndex = String(layer);
  }

  function setPrimaryNode(node) {
    if (primaryNode === node) return;
    primaryNode = node || null;
    nodes.forEach(function (item) {
      item.classList.toggle('is-primary', item === primaryNode);
    });
  }

  function applyFocusContext(centerNode) {
    if (!centerNode) {
      stage.dataset.focusMode = 'off';
      nodes.forEach(function (node) {
        node.style.setProperty('--focus-dim', '1');
      });
      return;
    }

    stage.dataset.focusMode = 'on';
    var centerIndex = parseInt(centerNode.dataset.nodeIndex || '-1', 10);
    nodes.forEach(function (node, index) {
      var distance = Math.abs(index - centerIndex);
      var dim = distance === 0 ? 1 : distance === 1 ? 0.72 : 0.28;
      node.style.setProperty('--focus-dim', dim.toFixed(3));
    });
  }

  function setTargetProximity(node, value) {
    proximityTarget.set(node, clamp(value, 0, 1));
  }

  function applyNodeProximity(node, value) {
    var clamped = clamp(value, 0, 1);
    node.style.setProperty('--proximity', clamped.toFixed(3));
    node.classList.toggle('is-active', clamped > 0.22);
    setNodeLayer(node, clamped);
  }

  function stepProximity(deltaMs) {
    var ease = 1 - Math.exp(-Math.max(1, deltaMs) / 88);
    var bestNode = null;
    var bestValue = 0;
    var moving = false;

    nodes.forEach(function (node) {
      var current = proximityCurrent.get(node) || 0;
      var target = proximityTarget.get(node) || 0;
      var next = current + (target - current) * ease;

      if (Math.abs(target - next) < 0.001) next = target;
      if (Math.abs(next - current) > 0.0008) moving = true;

      proximityCurrent.set(node, next);
      applyNodeProximity(node, next);

      if (next > bestValue) {
        bestValue = next;
        bestNode = node;
      }
    });

    if (selectedNode) {
      setPrimaryNode(selectedNode);
      stage.setAttribute('data-active-series', selectedNode.dataset.series || '');
      applyFocusContext(selectedNode);
    } else if (bestNode && bestValue > 0.14) {
      setPrimaryNode(bestNode);
      stage.setAttribute('data-active-series', bestNode.dataset.series || '');
      applyFocusContext(bestNode);
    } else if (primaryNode && (proximityCurrent.get(primaryNode) || 0) > 0.09) {
      setPrimaryNode(primaryNode);
      stage.setAttribute('data-active-series', primaryNode.dataset.series || '');
      applyFocusContext(primaryNode);
    } else {
      setPrimaryNode(null);
      stage.setAttribute('data-active-series', '');
      applyFocusContext(null);
    }

    return moving;
  }

  function runProximityAnimation(now) {
    if (!proximityLast) proximityLast = now;
    var delta = Math.min(48, now - proximityLast);
    proximityLast = now;
    var moving = stepProximity(delta || 16);

    if (moving) {
      proximityFrame = requestAnimationFrame(runProximityAnimation);
    } else {
      proximityFrame = null;
    }
  }

  function ensureProximityAnimation() {
    if (webglHelix || fallbackFrame) return;
    if (proximityFrame) return;
    proximityLast = 0;
    proximityFrame = requestAnimationFrame(runProximityAnimation);
  }

  function ensureSvgFallbackGuides() {
    if (guides) return;
    if (!stage) return;

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.classList.add('projects-helix__guides');
    svg.setAttribute('viewBox', '0 0 1200 520');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<path class="projects-helix__axis" d="" fill="none" stroke-linecap="round"></path>' +
      '<ellipse class="projects-helix__orbit projects-helix__orbit--top" cx="600" cy="108" rx="270" ry="28" fill="none"></ellipse>' +
      '<ellipse class="projects-helix__orbit projects-helix__orbit--mid" cx="600" cy="264" rx="270" ry="28" fill="none"></ellipse>' +
      '<ellipse class="projects-helix__orbit projects-helix__orbit--bottom" cx="600" cy="420" rx="270" ry="28" fill="none"></ellipse>' +
      '<path class="projects-helix__thread" d="" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>';

    stage.appendChild(svg);
    guides = svg;
    axisPath = svg.querySelector('.projects-helix__axis');
    threadPath = svg.querySelector('.projects-helix__thread');
    orbitTop = svg.querySelector('.projects-helix__orbit--top');
    orbitMid = svg.querySelector('.projects-helix__orbit--mid');
    orbitBottom = svg.querySelector('.projects-helix__orbit--bottom');
  }

  function clearVisualState(immediate) {
    selectedNode = null;
    nodes.forEach(function (node) {
      setTargetProximity(node, 0);
      if (immediate) {
        proximityCurrent.set(node, 0);
        applyNodeProximity(node, 0);
      }
    });
    setPrimaryNode(null);
    applyFocusContext(null);
    stage.setAttribute('data-active-series', '');
    if (!immediate) ensureProximityAnimation();
  }

  function activateSelection(node) {
    selectedNode = node;
    nodes.forEach(function (item) {
      var isActive = item === node;
      setTargetProximity(item, isActive ? 1 : 0);
    });
    setPrimaryNode(node);
    applyFocusContext(node);
    stage.setAttribute('data-active-series', node ? node.dataset.series : '');
    ensureProximityAnimation();
  }

  function createWebglHelix() {
    if (!window.THREE) {
      webglFailureReason = 'three.js missing';
      return null;
    }
    if (!webglMount) {
      webglFailureReason = 'webgl mount missing';
      return null;
    }
    var THREE = window.THREE;
    var renderer;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch (err) {
      webglFailureReason = 'renderer init failed' + (err && err.message ? ': ' + err.message : '');
      return null;
    }

    var gl = renderer.getContext && renderer.getContext();
    if (!gl) {
      webglFailureReason = 'no GL context returned';
      return null;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);

    while (webglMount.firstChild) {
      webglMount.removeChild(webglMount.firstChild);
    }
    webglMount.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    var cornerAzimuth = Math.PI * 0.25;

    function setCornerCamera(distance, elevation) {
      var planarDistance = Math.cos(elevation) * distance;
      camera.position.set(
        Math.cos(cornerAzimuth) * planarDistance,
        Math.sin(elevation) * distance,
        Math.sin(cornerAzimuth) * planarDistance
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
    }

    setCornerCamera(13.2, Math.PI * 0.2);

    var group = new THREE.Group();
    scene.add(group);
    group.rotation.x = 0;
    group.position.x = 0;

    var dotGeometry = new THREE.SphereGeometry(0.08, 10, 10);
    var nodeData = [];
    var ribbonData = [];
    var viewportWidth = 1;
    var viewportHeight = 1;
    var frameId = 0;
    var lastFrameTime = 0;
    var tempPointWorld = new THREE.Vector3();
    var tempAnchorWorld = new THREE.Vector3();
    var tempProjectedPoint = new THREE.Vector3();
    var tempProjectedAnchor = new THREE.Vector3();
    var tempRibbonWorld = new THREE.Vector3();
    var tempProjectedRibbon = new THREE.Vector3();

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

    function buildWorld(width) {
      clearGroup();
      nodeData = [];

      var total = nodes.length;
      var startAngle = -Math.PI * 0.5;
      var isMobile = width <= 820;
      var helixRadius = isMobile
        ? Math.max(2.8, Math.min(3.8, 3.2 + (width - 390) / 360))
        : Math.max(4.6, Math.min(6.8, 5.2 + (width - 980) / 380));
      var ribbonRadius = helixRadius * (isMobile ? 1.28 : 1.22);
      var helixHeight = isMobile ? 7.2 : 10.2;
      var ringSegments = 72;
      var threadSegments = Math.max(160, total * 24);
      var threadPoints = [];
      var ribbonPoints = [];
      var axisTop = helixHeight * 0.61;
      var axisBottom = -helixHeight * 0.61;
      var ribbonPhaseShift = Math.PI * 0.72;

      addLine(
        [new THREE.Vector3(0, axisTop, 0), new THREE.Vector3(0, axisBottom, 0)],
        new THREE.LineDashedMaterial({
          color: 0x11110f,
          transparent: true,
          opacity: 0.34,
          dashSize: 0.14,
          gapSize: 0.11
        }),
        true
      );

      addLine(
        ringPoints(helixRadius, helixHeight * 0.5, ringSegments),
        new THREE.LineBasicMaterial({ color: 0x11110f, transparent: true, opacity: 0.045 }),
        false
      );
      addLine(
        ringPoints(helixRadius, 0, ringSegments),
        new THREE.LineBasicMaterial({ color: 0x11110f, transparent: true, opacity: 0.025 }),
        false
      );
      addLine(
        ringPoints(helixRadius, -helixHeight * 0.5, ringSegments),
        new THREE.LineBasicMaterial({ color: 0x11110f, transparent: true, opacity: 0.045 }),
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
        new THREE.LineBasicMaterial({ color: 0x11110f, transparent: true, opacity: 0.86 }),
        false
      );

      for (var j = 0; j <= threadSegments; j++) {
        var ribbonProgress = j / threadSegments;
        var ribbonTheta = startAngle + ribbonProgress * Math.PI * 2 + ribbonPhaseShift;
        ribbonPoints.push(new THREE.Vector3(
          Math.sin(ribbonTheta) * ribbonRadius,
          (0.5 - ribbonProgress) * helixHeight,
          Math.cos(ribbonTheta) * ribbonRadius
        ));
      }

      addLine(
        ribbonPoints,
        new THREE.LineDashedMaterial({
          color: 0x11110f,
          transparent: true,
          opacity: 0.14,
          dashSize: 0.14,
          gapSize: 0.2
        }),
        true
      );

      for (var index = 0; index < total; index++) {
        var progress = total === 1 ? 0.5 : index / (total - 1);
        var angle = startAngle + progress * Math.PI * 2;
        var point = new THREE.Vector3(
          Math.sin(angle) * helixRadius,
          (0.5 - progress) * helixHeight,
          Math.cos(angle) * helixRadius
        );
        var radial = new THREE.Vector3(point.x, 0, point.z);
        if (radial.lengthSq() < 0.0001) {
          radial.set(1, 0, 0);
        } else {
          radial.normalize();
        }
        var anchor = point.clone().add(radial.multiplyScalar(1.58));

        var dot = new THREE.Mesh(dotGeometry, new THREE.MeshBasicMaterial({
          color: 0x0f0f0d,
          transparent: true,
          opacity: 0.9
        }));
        dot.position.copy(point);
        group.add(dot);

        nodeData.push({ point: point, anchor: anchor });
      }

      ribbonData = ribbonItems.map(function (item) {
        var ribbonTheta = startAngle + item.progress * Math.PI * 2 + ribbonPhaseShift + item.twist;
        return new THREE.Vector3(
          Math.sin(ribbonTheta) * ribbonRadius,
          (0.5 - item.progress) * helixHeight,
          Math.cos(ribbonTheta) * ribbonRadius
        );
      });
    }

    function syncNodes(width, height) {
      group.updateMatrixWorld(true);
      nodes.forEach(function (node, index) {
        var data = nodeData[index];
        if (!data) return;

        tempPointWorld.copy(data.point).applyMatrix4(group.matrixWorld);
        tempAnchorWorld.copy(data.anchor).applyMatrix4(group.matrixWorld);
        tempProjectedPoint.copy(tempPointWorld).project(camera);
        tempProjectedAnchor.copy(tempAnchorWorld).project(camera);

        var pointX = (tempProjectedPoint.x * 0.5 + 0.5) * width;
        var pointY = (-tempProjectedPoint.y * 0.5 + 0.5) * height;
        var anchorX = (tempProjectedAnchor.x * 0.5 + 0.5) * width;
        var anchorY = (-tempProjectedAnchor.y * 0.5 + 0.5) * height;
        var connectorDx = pointX - anchorX;
        var connectorDy = pointY - anchorY;
        var connectorLength = Math.sqrt(connectorDx * connectorDx + connectorDy * connectorDy);
        var connectorAngle = (Math.atan2(connectorDy, connectorDx) * 180) / Math.PI;
        var depth = clamp(1 - (tempProjectedPoint.z + 1) * 0.5, 0, 1);
        var fog = clamp(1 - depth, 0, 1);
        var hitThreshold = (width <= 820 ? 126 : 148) * (0.9 + depth * 0.7);

        node.style.setProperty('--x', anchorX.toFixed(2) + 'px');
        node.style.setProperty('--y', anchorY.toFixed(2) + 'px');
        node.style.setProperty('--depth', depth.toFixed(3));
        node.style.setProperty('--fog', fog.toFixed(3));
        node.style.setProperty('--arm-length', connectorLength.toFixed(2) + 'px');
        node.style.setProperty('--arm-angle', connectorAngle.toFixed(2));
        node.style.setProperty('--helix-dx', connectorDx.toFixed(2) + 'px');
        node.style.setProperty('--helix-dy', connectorDy.toFixed(2) + 'px');
        node.dataset.depth = depth.toFixed(3);
        nodeHitCache[index] = { x: anchorX, y: anchorY, threshold: hitThreshold };
      });

      var ribbonCount = Math.min(ribbonFrames.length, ribbonData.length);
      for (var ribbonIndex = 0; ribbonIndex < ribbonCount; ribbonIndex++) {
        var frame = ribbonFrames[ribbonIndex];
        var ribbonPoint = ribbonData[ribbonIndex];
        if (!frame || !ribbonPoint) continue;

        tempRibbonWorld.copy(ribbonPoint).applyMatrix4(group.matrixWorld);
        tempProjectedRibbon.copy(tempRibbonWorld).project(camera);

        var ribbonX = (tempProjectedRibbon.x * 0.5 + 0.5) * width;
        var ribbonY = (-tempProjectedRibbon.y * 0.5 + 0.5) * height;
        var ribbonDepth = clamp(1 - (tempProjectedRibbon.z + 1) * 0.5, 0, 1);
        var ribbonFog = clamp(1 - ribbonDepth, 0, 1);

        frame.style.setProperty('--x', ribbonX.toFixed(2) + 'px');
        frame.style.setProperty('--y', ribbonY.toFixed(2) + 'px');
        frame.style.setProperty('--depth', ribbonDepth.toFixed(3));
        frame.style.setProperty('--fog', ribbonFog.toFixed(3));
      }
    }

    function renderFrame(now) {
      if (!lastFrameTime) lastFrameTime = now;
      var delta = Math.min(64, now - lastFrameTime);
      lastFrameTime = now;

      // Slow, clearly visible rotation.
      group.rotation.y += delta * 0.00006;

      renderer.render(scene, camera);
      syncNodes(viewportWidth, viewportHeight);
      stepProximity(delta || 16);
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
      var isMobile = width <= 820;
      var frustumSize = isMobile ? 12.8 : 15.8;
      var cameraDistance = isMobile ? 11 : 13.6;
      var cameraElevation = isMobile ? Math.PI * 0.19 : Math.PI * 0.2;
      viewportWidth = width;
      viewportHeight = height;

      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);

      // Orthographic top-corner (architectural axonometric) with upright axis.
      setCornerCamera(cameraDistance, cameraElevation);

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

    webglFailureReason = '';
    return { layout: layout };
  }

  function loadThreeFromCdn(onReady) {
    var urls = [
      'https://unpkg.com/three@0.152.2/build/three.min.js',
      'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js'
    ];
    var i = 0;

    function loadNext() {
      if (window.THREE) {
        onReady(true);
        return;
      }
      if (i >= urls.length) {
        onReady(false);
        return;
      }

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
        onReady(true);
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
    var isMobile = width <= 820;
    var centerX = width * (isMobile ? 0.5 : fallbackCenterBias);
    var topY = height * (isMobile ? 0.17 : 0.14);
    var loopHeight = height * (isMobile ? 0.66 : 0.72);
    var radiusX = isMobile ? Math.min(width * 0.34, 250) : Math.min(width * 0.47, 560);
    var ribbonRadiusX = radiusX * (isMobile ? 1.28 : 1.22);
    var orbitRadiusY = isMobile
      ? Math.max(10, Math.min(height * 0.045, 20))
      : Math.max(14, Math.min(height * 0.07, 34));
    var viewAngle = (isMobile ? Math.PI * 0.2 : baseViewAngle) + fallbackRotation;
    var startAngle = -Math.PI * 0.5;
    var ribbonPhaseShift = Math.PI * 0.72;
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
      var fog = clamp(1 - depth, 0, 1);
      var side = projected.x >= 0 ? 1 : -1;
      var offset = (isMobile ? 44 : 62) + depth * (isMobile ? 14 : 22);
      var anchorX = helixX + side * offset;
      var anchorY = y - (1 - depth) * (isMobile ? 3 : 5);
      var connectorDx = helixX - anchorX;
      var connectorDy = y - anchorY;
      var connectorLength = Math.sqrt(connectorDx * connectorDx + connectorDy * connectorDy);
      var connectorAngle = (Math.atan2(connectorDy, connectorDx) * 180) / Math.PI;
      var hitThreshold = (isMobile ? 126 : 148) * (0.9 + depth * 0.7);

      node.style.setProperty('--x', anchorX.toFixed(2) + 'px');
      node.style.setProperty('--y', anchorY.toFixed(2) + 'px');
      node.style.setProperty('--depth', depth.toFixed(3));
      node.style.setProperty('--fog', fog.toFixed(3));
      node.style.setProperty('--arm-length', connectorLength.toFixed(2) + 'px');
      node.style.setProperty('--arm-angle', connectorAngle.toFixed(2));
      node.style.setProperty('--helix-dx', connectorDx.toFixed(2) + 'px');
      node.style.setProperty('--helix-dy', connectorDy.toFixed(2) + 'px');
      node.dataset.depth = depth.toFixed(3);
      nodeHitCache[index] = { x: anchorX, y: anchorY, threshold: hitThreshold };
    });

    var ribbonCount = Math.min(ribbonFrames.length, ribbonItems.length);
    for (var ribbonIndex = 0; ribbonIndex < ribbonCount; ribbonIndex++) {
      var frame = ribbonFrames[ribbonIndex];
      var item = ribbonItems[ribbonIndex];
      if (!frame || !item) continue;

      var ribbonTheta = startAngle + item.progress * Math.PI * 2 + ribbonPhaseShift + item.twist;
      var ribbonProjected = projectOffset(ribbonTheta, ribbonRadiusX, viewAngle);
      var ribbonX = centerX + ribbonProjected.x;
      var ribbonY = topY + item.progress * loopHeight;
      var ribbonDepth = Math.max(0, Math.min(1, (ribbonProjected.depth / ribbonRadiusX + 1) * 0.5));
      var ribbonFog = clamp(1 - ribbonDepth, 0, 1);

      frame.style.setProperty('--x', ribbonX.toFixed(2) + 'px');
      frame.style.setProperty('--y', ribbonY.toFixed(2) + 'px');
      frame.style.setProperty('--depth', ribbonDepth.toFixed(3));
      frame.style.setProperty('--fog', ribbonFog.toFixed(3));
    }
  }

  function layoutHelix() {
    if (webglHelix) {
      webglHelix.layout();
      return;
    }
    layoutHelixFallback();
  }

  function runFallbackFrame(now) {
    if (webglHelix) {
      fallbackFrame = null;
      return;
    }
    if (!fallbackLast) fallbackLast = now;
    var delta = Math.min(80, now - fallbackLast);
    fallbackLast = now;

    fallbackRotation += delta * 0.00006;
    layoutHelixFallback();
    stepProximity(delta || 16);

    fallbackFrame = requestAnimationFrame(runFallbackFrame);
  }

  function ensureFallbackAnimation() {
    if (webglHelix) return;
    if (fallbackFrame) return;
    fallbackLast = 0;
    fallbackFrame = requestAnimationFrame(runFallbackFrame);
  }

  function updateProximity(clientX, clientY) {
    var stageRect = stage.getBoundingClientRect();
    var localX = clientX - stageRect.left;
    var localY = clientY - stageRect.top;

    nodes.forEach(function (node, index) {
      var hit = nodeHitCache[index];
      if (!hit) return;

      var dx = localX - hit.x;
      var dy = localY - hit.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var threshold = hit.threshold || 140;
      var proximity = Math.max(0, 1 - dist / threshold);
      proximity = proximity * proximity;

      setTargetProximity(node, proximity);
    });

    ensureProximityAnimation();
  }

  function enableWebglIfPossible() {
    if (!webglMount || webglHelix || !window.THREE) return false;
    webglHelix = createWebglHelix();
    if (!webglHelix) return false;

    if (fallbackFrame) {
      cancelAnimationFrame(fallbackFrame);
      fallbackFrame = null;
    }
    helix.classList.add('projects-helix--webgl-enabled');
    if (guides) {
      guides.remove();
      guides = null;
      axisPath = null;
      threadPath = null;
      orbitTop = null;
      orbitMid = null;
      orbitBottom = null;
    }
    layoutHelix();
    setRenderMode('webgl', 'three.js renderer active');
    return true;
  }

  if (!enableWebglIfPossible()) {
    if (webglMount && !window.THREE) {
      loadThreeFromCdn(function (loaded) {
        if (!loaded || !enableWebglIfPossible()) {
          if (!loaded) webglFailureReason = 'three.js failed to load from CDNs';
          ensureSvgFallbackGuides();
          layoutHelix();
          ensureFallbackAnimation();
          setRenderMode('fallback', webglFailureReason || 'webgl unavailable');
        }
      });
    } else {
      ensureSvgFallbackGuides();
      ensureFallbackAnimation();
      setRenderMode('fallback', webglFailureReason || 'webgl unavailable');
    }
  }

  nodes.forEach(function (node) {
    node.addEventListener('focus', function () {
      activateSelection(node);
    });

    node.addEventListener('click', function (evt) {
      if (isCoarsePointer() && selectedNode !== node) {
        evt.preventDefault();
        activateSelection(node);
        return;
      }
      beginHelixThumbNavigation(node, evt);
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
    pointerClientX = evt.clientX;
    pointerClientY = evt.clientY;
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(function () {
      pointerFrame = null;
      selectedNode = null;
      updateProximity(pointerClientX, pointerClientY);
    });
  });

  stage.addEventListener('mouseleave', function () {
    if (pointerFrame) {
      cancelAnimationFrame(pointerFrame);
      pointerFrame = null;
    }
    if (selectedNode) {
      activateSelection(selectedNode);
      return;
    }
    clearVisualState();
  });

  window.addEventListener('resize', handleResize);

  layoutHelix();
  clearVisualState(true);
  ensureFallbackAnimation();
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
