// ============================================
// PROJECT PAGE — All interactive features
// ============================================

function registerProjectPageCleanup(fn) {
  if (typeof fn !== 'function') return;
  if (!window.__bylProjectPageCleanupFns) {
    window.__bylProjectPageCleanupFns = [];
  }
  window.__bylProjectPageCleanupFns.push(fn);
}

function runProjectPageCleanup() {
  var cleanups = window.__bylProjectPageCleanupFns;
  if (!cleanups || !cleanups.length) return;

  while (cleanups.length) {
    var cleanup = cleanups.pop();
    try {
      cleanup();
    } catch (err) {
      // Continue cleanup chain even when one teardown fails.
    }
  }
}

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

  registerProjectPageCleanup(function () {
    observer.disconnect();
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

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  registerProjectPageCleanup(function () {
    window.removeEventListener('scroll', onScroll);
  });
}

// Integrated nav bar — contains back, project name, and nav links
function initNavBar(rootContainer) {
  var scope = rootContainer && rootContainer.querySelector
    ? rootContainer
    : (document.querySelector('[data-barba="container"]') || document);
  // Skip on slideshow page — it has its own nav bar
  if (scope.querySelector('.slideshow-nav-bar')) return;
  rememberPageForBackNav();

  var hero = scope.querySelector('.project-hero');
  var isProjectsHelix = !!scope.querySelector('.projects-helix');

  // Build the unified bar
  var bar = document.createElement('div');
  bar.classList.add('project-nav-bar');
  if (isProjectsHelix) bar.classList.add('project-nav-bar--projects-helix');

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
  registerProjectPageCleanup(function () {
    if (bar.parentNode) bar.parentNode.removeChild(bar);
  });

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
    registerProjectPageCleanup(function () {
      observer.disconnect();
    });
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

  registerProjectPageCleanup(function () {
    observer.disconnect();
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
  var pointerHoverNode = null;
  var pointerEventTarget = null;
  var pointerFrame = null;
  var touchHoverNode = null;
  var touchStartX = 0;
  var touchStartY = 0;
  var touchInteractionMoved = false;
  var suppressNextCoarseClickNode = null;
  var lastTouchInteractionTime = 0;
  var touchSelectedNode = null;
  var proximityTarget = new WeakMap();
  var proximityCurrent = new WeakMap();
  var proximityFrame = null;
  var proximityLast = 0;
  var HELIX_ZOOM_KEY = 'bylHelixThumbZoom';
  var performanceProfile = getHelixPerformanceProfile();
  var isIPhoneDevice = detectIPhoneDevice();
  var WEBGL_MIN_FRAME_MS = performanceProfile.webglMinFrameMs;
  var FALLBACK_MIN_FRAME_MS = performanceProfile.fallbackMinFrameMs;
  var RIBBON_DEPTH_UPDATE_MS = performanceProfile.ribbonDepthUpdateMs;
  var disposed = false;
  var pendingThreeLoader = null;
  var activeSeriesValue = null;
  var focusContextNode;
  var stageRectCache = null;
  var lastPointerLocalX = null;
  var lastPointerLocalY = null;
  var lastPointerHoverNode = null;
  var readyRectTimer = null;
  var entryReadyTimer = null;
  var entryReadyReleaseHandler = null;
  var entryReadyScheduled = false;
  var proximityNeedsStep = true;
  var PROXIMITY_TARGET_STEPS = 80;
  var hasTouchInput = 'ontouchstart' in window || !!(navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

  if (!stage || nodes.length === 0) return;
  helix.classList.remove('projects-helix--ribbon-ready');
  helix.classList.remove('projects-helix--is-ready');
  helix.classList.add('projects-helix--is-entering');
  nodes.forEach(function (node, index) {
    node.dataset.nodeIndex = String(index);
    node.__helixThumbEl = node.querySelector('.projects-helix__thumb');
    node.__helixThumbW = parseFloat(node.style.getPropertyValue('--thumb-w')) || 72;
    node.__helixThumbH = parseFloat(node.style.getPropertyValue('--thumb-h')) || 52;
  });

  function setHelixReadyState() {
    if (disposed || !helix.isConnected) return;
    helix.classList.add('projects-helix--is-ready');
    helix.classList.remove('projects-helix--is-entering');
    invalidateStageRect();
    if (readyRectTimer) window.clearTimeout(readyRectTimer);
    readyRectTimer = window.setTimeout(function () {
      readyRectTimer = null;
      if (!disposed) invalidateStageRect();
    }, 1040);
  }

  function scheduleHelixReadyState() {
    if (disposed || entryReadyScheduled) return;
    entryReadyScheduled = true;

    function releaseReady() {
      if (disposed || entryReadyTimer) return;
      if (entryReadyReleaseHandler) {
        window.removeEventListener('byl:projects-helix-release', entryReadyReleaseHandler);
        if (window.bylReleaseProjectsHelixEntry === entryReadyReleaseHandler) {
          window.bylReleaseProjectsHelixEntry = null;
        }
        entryReadyReleaseHandler = null;
      }
      window.bylProjectsHelixDeferReady = false;
      entryReadyTimer = window.setTimeout(function () {
        entryReadyTimer = null;
        if (disposed || !helix.isConnected) return;
        requestAnimationFrame(function () {
          requestAnimationFrame(setHelixReadyState);
        });
      }, 70);
    }

    if (window.bylProjectsHelixDeferReady) {
      entryReadyReleaseHandler = releaseReady;
      window.bylReleaseProjectsHelixEntry = releaseReady;
      window.addEventListener('byl:projects-helix-release', releaseReady, { once: true });
      return;
    }

    entryReadyTimer = window.setTimeout(function () {
      entryReadyTimer = null;
      if (disposed || !helix.isConnected) return;
      requestAnimationFrame(function () {
        requestAnimationFrame(setHelixReadyState);
      });
    }, 70);
  }

  function getHelixPerformanceProfile() {
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cores = navigator.hardwareConcurrency || 4;
    var memory = navigator.deviceMemory || 0;
    var likelyLowEnd = reducedMotion || cores <= 4 || (memory > 0 && memory <= 4);
    var likelyHighEnd = !reducedMotion && cores >= 8 && (memory === 0 || memory >= 8);

    if (likelyLowEnd) {
      return {
        webglMinFrameMs: 1000 / 52,
        nodeSyncMinMs: 1000 / 40,
        fallbackMinFrameMs: 1000 / 42,
        ribbonDepthUpdateMs: 220,
        mobilePixelMax: 1.25,
        desktopPixelMax: 1.05,
        ringSegments: 40,
        threadSegmentsMin: 84,
        threadSegmentsMult: 12,
        ribbonSegmentsMobile: 34,
        ribbonSegmentsDesktop: 46,
        anisotropyCap: 2
      };
    }

    if (likelyHighEnd) {
      return {
        webglMinFrameMs: 1000 / 60,
        nodeSyncMinMs: 1000 / 50,
        fallbackMinFrameMs: 1000 / 56,
        ribbonDepthUpdateMs: 120,
        mobilePixelMax: 1.65,
        desktopPixelMax: 1.28,
        ringSegments: 56,
        threadSegmentsMin: 112,
        threadSegmentsMult: 16,
        ribbonSegmentsMobile: 48,
        ribbonSegmentsDesktop: 64,
        anisotropyCap: 4
      };
    }

    return {
      webglMinFrameMs: 1000 / 58,
      nodeSyncMinMs: 1000 / 45,
      fallbackMinFrameMs: 1000 / 50,
      ribbonDepthUpdateMs: 160,
      mobilePixelMax: 1.45,
      desktopPixelMax: 1.16,
      ringSegments: 48,
      threadSegmentsMin: 96,
      threadSegmentsMult: 14,
      ribbonSegmentsMobile: 40,
      ribbonSegmentsDesktop: 56,
      anisotropyCap: 3
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  var coarsePointerQuery = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;

  function isCoarsePointer() {
    return coarsePointerQuery ? coarsePointerQuery.matches : false;
  }

  function isTouchNavigationClick() {
    return isCoarsePointer() || (hasTouchInput && Date.now() - lastTouchInteractionTime < 1200);
  }

  function detectIPhoneDevice() {
    var ua = navigator.userAgent || '';
    return /iPhone/i.test(ua);
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

  function setRibbonReadyState() {
    if (disposed || !helix.isConnected) return;
    helix.classList.add('projects-helix--ribbon-ready');
  }

  function getStageRect() {
    if (!stageRectCache) stageRectCache = stage.getBoundingClientRect();
    return stageRectCache;
  }

  function invalidateStageRect() {
    stageRectCache = null;
    lastPointerLocalX = null;
    lastPointerLocalY = null;
    lastPointerHoverNode = null;
  }

  function setElementAttribute(element, name, value) {
    if (!element) return;
    if (!element.__helixAttrCache) element.__helixAttrCache = Object.create(null);
    if (element.__helixAttrCache[name] === value) return;
    element.__helixAttrCache[name] = value;
    element.setAttribute(name, value);
  }

  function setNodeStyleValue(node, name, value) {
    if (!node.__helixStyleCache) node.__helixStyleCache = Object.create(null);
    if (node.__helixStyleCache[name] === value) return false;
    node.__helixStyleCache[name] = value;
    node.style.setProperty(name, value);
    return true;
  }

  function setHitCache(index, x, y, threshold) {
    var hit = nodeHitCache[index];
    if (!hit) {
      nodeHitCache[index] = { x: x, y: y, threshold: threshold };
      return;
    }
    hit.x = x;
    hit.y = y;
    hit.threshold = threshold;
  }

  function setActiveSeries(value) {
    var nextValue = webglHelix ? '' : (value || '');
    if (activeSeriesValue === nextValue) return;
    activeSeriesValue = nextValue;
    if (nextValue) {
      stage.setAttribute('data-active-series', nextValue);
    } else {
      stage.removeAttribute('data-active-series');
    }
  }

  function setFocusMode(value) {
    // Focus is now driven by CSS variables; avoid attribute selector invalidation on hover.
  }

  function setNodeLayer(node, proximity) {
    var depth = typeof node.__helixDepth === 'number' ? node.__helixDepth : 0.5;
    var strength = isNaN(proximity) ? 0 : proximity;
    var activeBoost = strength > 0.22 ? 24 : 0;
    var layer;

    // Keep back-side thumbnails under the WebGL strip, front-side over it.
    // WebGL mount is z-index:2 in CSS.
    if (depth < 0.5 && activeBoost === 0) {
      layer = 1;
    } else {
      layer = 6 + Math.round(clamp(depth, 0, 1) * 18) + activeBoost;
    }

    layer = String(layer);
    if (node.__helixZIndex === layer) return;
    node.__helixZIndex = layer;
    node.style.zIndex = layer;
  }

  function applyThumbAxon(node, proximity) {
    var faceAmount = 1 - clamp(proximity || 0, 0, 1);
    var baseSkewY = typeof node.__thumbAxonSkewY === 'number' ? node.__thumbAxonSkewY : -30;
    var skewY = baseSkewY * faceAmount;

    node.__thumbCurrentSkewY = skewY;
    setNodeStyleValue(node, '--thumb-skew-y', skewY.toFixed(2) + 'deg');
  }

  function updateThumbAxonBase(node, connectorDx, depth, proximity) {
    node.__thumbAxonSkewY = -30;
    applyThumbAxon(node, proximity || 0);
  }

  function getThumbScaleProfile() {
    var width = window.innerWidth || 0;
    if (width <= 640) {
      return {
        base: 0.76,
        responsive: 0.94,
        depth: 0.09,
        proximity: 0.48
      };
    }
    if (width <= 900) {
      return {
        base: 0.82,
        responsive: 1,
        depth: 0.11,
        proximity: 0.54
      };
    }
    return {
      base: 0.88,
      responsive: 1,
      depth: 0.15,
      proximity: 0.74
    };
  }

  function cacheCursorSnapRect(node, centerX, centerY, depth, proximity) {
    var thumb = node.__helixThumbEl;
    if (!thumb) return;

    var scaleProfile = getThumbScaleProfile();
    var proximityValue = clamp(proximity || 0, 0, 1);
    var visualScale = 1 + clamp(depth || 0, 0, 1) * scaleProfile.depth + proximityValue * scaleProfile.proximity;
    var width = node.__helixThumbW * scaleProfile.base * scaleProfile.responsive * visualScale;
    var height = node.__helixThumbH * scaleProfile.base * scaleProfile.responsive * visualScale;
    var skewY = typeof node.__thumbCurrentSkewY === 'number'
      ? node.__thumbCurrentSkewY
      : -30 * (1 - proximityValue);
    var skewExtra = Math.abs(Math.tan((skewY * Math.PI) / 180)) * width;
    var rect = {
      left: centerX - width * 0.5,
      top: centerY - (height + skewExtra) * 0.5,
      width: width,
      height: height + skewExtra
    };

    node.__helixAnchorViewportX = centerX;
    node.__helixAnchorViewportY = centerY;
    node.__cursorSnapRect = rect;
    thumb.__cursorSnapRect = rect;
  }

  function setPrimaryNode(node) {
    var nextNode = node || null;
    if (primaryNode === nextNode) return;
    if (primaryNode) primaryNode.classList.remove('is-primary');
    primaryNode = nextNode;
    if (primaryNode) primaryNode.classList.add('is-primary');
  }

  function applyFocusContext(centerNode) {
    var nextCenter = centerNode || null;
    if (focusContextNode === nextCenter) return;
    focusContextNode = nextCenter;

    if (!nextCenter) {
      setFocusMode('off');
      nodes.forEach(function (node) {
        setNodeStyleValue(node, '--focus-dim', '1');
      });
      return;
    }

    setFocusMode('on');
    var centerIndex = parseInt(nextCenter.dataset.nodeIndex || '-1', 10);
    nodes.forEach(function (node, index) {
      var distance = Math.abs(index - centerIndex);
      var dim = distance === 0 ? 1 : distance === 1 ? 0.72 : 0.28;
      setNodeStyleValue(node, '--focus-dim', dim.toFixed(3));
    });
  }

  function setTargetProximity(node, value) {
    var nextValue = clamp(value, 0, 1);
    if (nextValue > 0 && nextValue < 1) {
      nextValue = Math.round(nextValue * PROXIMITY_TARGET_STEPS) / PROXIMITY_TARGET_STEPS;
    }
    if ((proximityTarget.get(node) || 0) === nextValue) return false;
    proximityTarget.set(node, nextValue);
    proximityNeedsStep = true;
    return true;
  }

  function applyNodeProximity(node, value) {
    var clamped = clamp(value, 0, 1);
    var isActive = clamped > 0.22;
    setNodeStyleValue(node, '--proximity', clamped.toFixed(3));
    applyThumbAxon(node, clamped);
    if (
      typeof node.__helixAnchorViewportX === 'number' &&
      typeof node.__helixAnchorViewportY === 'number'
    ) {
      cacheCursorSnapRect(
        node,
        node.__helixAnchorViewportX,
        node.__helixAnchorViewportY,
        typeof node.__helixDepth === 'number' ? node.__helixDepth : 0.5,
        clamped
      );
    }
    if (node.__helixIsActive !== isActive) {
      node.__helixIsActive = isActive;
      node.classList.toggle('is-active', isActive);
    }
    setNodeLayer(node, clamped);
  }

  function setActiveFocusNode(node) {
    setPrimaryNode(node || null);
    setActiveSeries(node ? node.dataset.series || '' : '');
    applyFocusContext(node || null);
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

      var changed = Math.abs(next - current) > 0.0008;
      if (Math.abs(target - next) < 0.001) {
        next = target;
        changed = changed || next !== current;
      }
      if (changed) moving = true;

      if (changed) {
        proximityCurrent.set(node, next);
        applyNodeProximity(node, next);
      }

      if (next > bestValue) {
        bestValue = next;
        bestNode = node;
      }
    });

    if (selectedNode) {
      setActiveFocusNode(selectedNode);
    } else if (pointerHoverNode && pointerHoverNode.isConnected) {
      setActiveFocusNode(pointerHoverNode);
    } else if (bestNode && bestValue > 0.28) {
      setActiveFocusNode(bestNode);
    } else if (primaryNode && (proximityCurrent.get(primaryNode) || 0) > 0.16) {
      setActiveFocusNode(primaryNode);
    } else {
      setActiveFocusNode(null);
    }

    return moving;
  }

  function runProximityAnimation(now) {
    if (disposed || !stage.isConnected) {
      proximityFrame = null;
      return;
    }
    if (!proximityLast) proximityLast = now;
    var delta = Math.min(48, now - proximityLast);
    proximityLast = now;
    var moving = stepProximity(delta || 16);
    proximityNeedsStep = moving;

    if (moving) {
      proximityFrame = requestAnimationFrame(runProximityAnimation);
    } else {
      proximityFrame = null;
    }
  }

  function ensureProximityAnimation() {
    if (disposed || !stage.isConnected) return;
    if (document.hidden) return;
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
    touchSelectedNode = null;
    nodes.forEach(function (node) {
      setTargetProximity(node, 0);
      if (immediate) {
        proximityCurrent.set(node, 0);
        applyNodeProximity(node, 0);
      }
    });
    setActiveFocusNode(null);
    if (!immediate) ensureProximityAnimation();
  }

  function activateSelection(node) {
    selectedNode = node;
    nodes.forEach(function (item) {
      var isActive = item === node;
      setTargetProximity(item, isActive ? 1 : 0);
    });
    setActiveFocusNode(node);
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
    var useAntialias = true;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: useAntialias,
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

    var dotGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    var nodeData = [];
    var nodeScreenState = [];
    var viewportWidth = 1;
    var viewportHeight = 1;
    var frameId = 0;
    var lastFrameTime = 0;
    var lastNodeSyncTime = 0;
    var lastRibbonDepthUpdate = 0;
    var ribbonTextureRefreshFrame = 0;
    var webglDestroyed = false;
    var ribbonReadyNotified = false;
    var tempPointWorld = new THREE.Vector3();
    var tempAnchorWorld = new THREE.Vector3();
    var tempProjectedPoint = new THREE.Vector3();
    var tempProjectedAnchor = new THREE.Vector3();
    var tempRibbonWorld = new THREE.Vector3();
    var tempProjectedRibbon = new THREE.Vector3();
    var ribbonTexture = null;
    var ribbonMeshRef = null;
    var projectionSmoothing = isIPhoneDevice ? 0.28 : 0.34;

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

    function markRibbonReady() {
      if (ribbonReadyNotified) return;
      ribbonReadyNotified = true;
      requestAnimationFrame(setRibbonReadyState);
    }

    function createRibbonFallbackCanvas() {
      var canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 28;
      var ctx = canvas.getContext('2d');
      if (!ctx) return null;

      var grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      grad.addColorStop(0, '#d1c9bb');
      grad.addColorStop(0.25, '#e3ddd2');
      grad.addColorStop(0.5, '#c6bdaf');
      grad.addColorStop(0.75, '#e8e1d6');
      grad.addColorStop(1, '#b9b1a4');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (var i = 0; i < 56; i++) {
        var x = (i / 56) * canvas.width;
        var alpha = i % 2 === 0 ? 0.13 : 0.06;
        ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha + ')';
        ctx.fillRect(x, 0, 3, canvas.height);
      }

      return canvas;
    }

    function drawRibbonImageFrame(ctx, img, x, y, w, h) {
      if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return false;
      var scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      var srcW = w / scale;
      var srcH = h / scale;
      var srcX = (img.naturalWidth - srcW) * 0.5;
      var srcY = (img.naturalHeight - srcH) * 0.5;
      try {
        ctx.drawImage(img, srcX, srcY, srcW, srcH, x, y, w, h);
        return true;
      } catch (err) {
        return false;
      }
    }

    function createRibbonTexture() {
      var sourceImages = nodes
        .map(function (node) {
          var thumbImg = node.querySelector('.projects-helix__thumb img');
          return thumbImg || null;
        })
        .filter(function (img) {
          return !!img;
        });

      var frameCount = Math.max(12, sourceImages.length * 2);
      var frameW = 28;
      var frameH = 18;
      var canvas = document.createElement('canvas');
      canvas.width = frameCount * frameW;
      canvas.height = frameH;
      var ctx = canvas.getContext('2d');
      if (!ctx) return null;
      var texture = new THREE.CanvasTexture(canvas);

      function redrawFromThumbs() {
        var anyDrawn = false;
        for (var i = 0; i < frameCount; i++) {
          var x = i * frameW;
          var source = sourceImages.length ? sourceImages[i % sourceImages.length] : null;
          var drawn = drawRibbonImageFrame(ctx, source, x, 0, frameW, frameH);
          if (!drawn) {
            ctx.fillStyle = 'rgba(214, 208, 198, 0.7)';
            ctx.fillRect(x, 0, frameW, frameH);
          } else {
            anyDrawn = true;
          }
        }
        texture.needsUpdate = true;
        if (anyDrawn) markRibbonReady();
      }

      function scheduleRibbonRefresh() {
        if (ribbonTextureRefreshFrame) return;
        ribbonTextureRefreshFrame = requestAnimationFrame(function () {
          ribbonTextureRefreshFrame = 0;
          redrawFromThumbs();
        });
      }

      sourceImages.forEach(function (img) {
        if (img.complete && img.naturalWidth && img.naturalHeight) return;
        img.addEventListener('load', scheduleRibbonRefresh, { once: true });
        img.addEventListener('error', scheduleRibbonRefresh, { once: true });
      });

      if (!sourceImages.length) {
        var fallbackCanvas = createRibbonFallbackCanvas();
        if (fallbackCanvas) {
          texture.image = fallbackCanvas;
          texture.needsUpdate = true;
          markRibbonReady();
        }
      } else {
        redrawFromThumbs();
      }

      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      if (renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
        texture.anisotropy = Math.min(
          performanceProfile.anisotropyCap,
          renderer.capabilities.getMaxAnisotropy()
        );
      }
      if ('colorSpace' in texture && THREE.SRGBColorSpace) {
        texture.colorSpace = THREE.SRGBColorSpace;
      }

      return texture;
    }

    function createRibbonStripMesh(config) {
      if (!ribbonTexture) ribbonTexture = createRibbonTexture();
      if (!ribbonTexture) return null;

      var stripSegments = config.segments;
      var stripWidth = config.width;
      var vertexCount = (stripSegments + 1) * 2;
      var positions = new Float32Array(vertexCount * 3);
      var uvs = new Float32Array(vertexCount * 2);
      var colors = new Float32Array(vertexCount * 3);
      var indices = [];

      for (var i = 0; i <= stripSegments; i++) {
        var u = i / stripSegments;
        var t = config.startT + (config.endT - config.startT) * u;
        var theta = config.startAngle + t * Math.PI * 2 + config.phaseShift;
        var centerX = Math.sin(theta) * config.radius;
        var centerY = (0.5 - t) * config.height;
        var centerZ = Math.cos(theta) * config.radius;
        var radialX = Math.sin(theta);
        var radialZ = Math.cos(theta);
        var edgeTilt = Math.sin(theta * 1.35) * config.tilt;

        var leftIndex = i * 2;
        var rightIndex = leftIndex + 1;
        var leftBase = leftIndex * 3;
        var rightBase = rightIndex * 3;
        var leftUvBase = leftIndex * 2;
        var rightUvBase = rightIndex * 2;

        positions[leftBase] = centerX - radialX * stripWidth * 0.5;
        positions[leftBase + 1] = centerY - edgeTilt;
        positions[leftBase + 2] = centerZ - radialZ * stripWidth * 0.5;

        positions[rightBase] = centerX + radialX * stripWidth * 0.5;
        positions[rightBase + 1] = centerY + edgeTilt;
        positions[rightBase + 2] = centerZ + radialZ * stripWidth * 0.5;

        uvs[leftUvBase] = u;
        uvs[leftUvBase + 1] = 0;
        uvs[rightUvBase] = u;
        uvs[rightUvBase + 1] = 1;

        colors[leftBase] = 1;
        colors[leftBase + 1] = 1;
        colors[leftBase + 2] = 1;
        colors[rightBase] = 1;
        colors[rightBase + 1] = 1;
        colors[rightBase + 2] = 1;
      }

      for (var seg = 0; seg < stripSegments; seg++) {
        var a = seg * 2;
        var b = a + 1;
        var c = a + 2;
        var d = a + 3;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }

      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(indices);

      var material = new THREE.MeshBasicMaterial({
        map: ribbonTexture,
        transparent: true,
        opacity: 0.74,
        side: THREE.DoubleSide,
        depthWrite: true,
        alphaTest: 0.02,
        vertexColors: true
      });

      return new THREE.Mesh(geometry, material);
    }

    function updateRibbonDepthVisual() {
      if (!ribbonMeshRef || !ribbonMeshRef.geometry) return;
      var geometry = ribbonMeshRef.geometry;
      var positionAttr = geometry.getAttribute('position');
      var colorAttr = geometry.getAttribute('color');
      if (!positionAttr || !colorAttr) return;

      for (var i = 0; i < positionAttr.count; i++) {
        tempRibbonWorld.fromBufferAttribute(positionAttr, i).applyMatrix4(ribbonMeshRef.matrixWorld);
        tempProjectedRibbon.copy(tempRibbonWorld).project(camera);
        var depth = clamp(1 - (tempProjectedRibbon.z + 1) * 0.5, 0, 1);
        var back = depth < 0.5 ? (0.5 - depth) / 0.5 : 0;
        var tone = clamp(0.62 + depth * 0.48, 0, 1);
        var r = clamp(tone - back * 0.08, 0, 1);
        var g = clamp(tone - back * 0.03, 0, 1);
        var b = clamp(tone + back * 0.01, 0, 1);
        colorAttr.setXYZ(i, r, g, b);
      }
      colorAttr.needsUpdate = true;
    }

    function buildWorld(width) {
      clearGroup();
      nodeData = [];
      nodeScreenState = [];
      ribbonMeshRef = null;

      var total = nodes.length;
      var startAngle = -Math.PI * 0.5;
      var isMobile = width <= 820;
      var helixRadius = isMobile
        ? Math.max(2.45, Math.min(3.35, 2.85 + (width - 390) / 380))
        : Math.max(4.6, Math.min(6.8, 5.2 + (width - 980) / 380));
      var ribbonRadius = helixRadius * (isMobile ? 0.78 : 0.72);
      var helixHeight = isMobile ? 6.7 : 10.2;
      var ringSegments = performanceProfile.ringSegments;
      var threadSegments = Math.max(performanceProfile.threadSegmentsMin, total * performanceProfile.threadSegmentsMult);
      var threadPoints = [];
      var axisTop = helixHeight * 0.61;
      var axisBottom = -helixHeight * 0.61;
      var ribbonPhaseShift = 0;
      var ribbonEndT = Math.min(0.7, 0.4 + total * 0.035);

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

      var ribbonMesh = createRibbonStripMesh({
        radius: ribbonRadius,
        height: helixHeight,
        startAngle: startAngle,
        phaseShift: ribbonPhaseShift,
        startT: 0,
        endT: ribbonEndT,
        width: isMobile ? 0.38 : 0.46,
        tilt: isMobile ? 0.045 : 0.068,
        segments: isMobile ? performanceProfile.ribbonSegmentsMobile : performanceProfile.ribbonSegmentsDesktop
      });
      if (ribbonMesh) {
        ribbonMeshRef = ribbonMesh;
        group.add(ribbonMesh);
      }

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
    }

    function snapToDevicePixel(value) {
      var dpr = Math.max(1, window.devicePixelRatio || 1);
      return Math.round(value * dpr) / dpr;
    }

    function smoothProjectedNode(index, pointX, pointY, anchorX, anchorY) {
      var state = nodeScreenState[index];
      if (!state) {
        state = {
          pointX: pointX,
          pointY: pointY,
          anchorX: anchorX,
          anchorY: anchorY
        };
        nodeScreenState[index] = state;
      } else {
        state.pointX += (pointX - state.pointX) * projectionSmoothing;
        state.pointY += (pointY - state.pointY) * projectionSmoothing;
        state.anchorX += (anchorX - state.anchorX) * projectionSmoothing;
        state.anchorY += (anchorY - state.anchorY) * projectionSmoothing;
      }

      state.pointX = snapToDevicePixel(state.pointX);
      state.pointY = snapToDevicePixel(state.pointY);
      state.anchorX = snapToDevicePixel(state.anchorX);
      state.anchorY = snapToDevicePixel(state.anchorY);
      return state;
    }

    function syncNodes(width, height, now) {
      group.updateMatrixWorld(true);
      if (!lastRibbonDepthUpdate || (now - lastRibbonDepthUpdate) >= RIBBON_DEPTH_UPDATE_MS) {
        updateRibbonDepthVisual();
        lastRibbonDepthUpdate = now;
      }
      var cachedStageRect = stageRectCache || getStageRect();
      var stageLeft = cachedStageRect ? cachedStageRect.left : 0;
      var stageTop = cachedStageRect ? cachedStageRect.top : 0;
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
        var smoothedNode = smoothProjectedNode(index, pointX, pointY, anchorX, anchorY);
        pointX = smoothedNode.pointX;
        pointY = smoothedNode.pointY;
        anchorX = smoothedNode.anchorX;
        anchorY = smoothedNode.anchorY;
        var connectorDx = pointX - anchorX;
        var connectorDy = pointY - anchorY;
        var connectorLength = Math.sqrt(connectorDx * connectorDx + connectorDy * connectorDy);
        var connectorAngle = (Math.atan2(connectorDy, connectorDx) * 180) / Math.PI;
        var depth = clamp(1 - (tempProjectedPoint.z + 1) * 0.5, 0, 1);
        var fog = clamp(1 - depth, 0, 1);
        var hitThreshold = (width <= 820 ? 126 : 148) * (0.9 + depth * 0.7);

        var depthValue = depth.toFixed(3);
        setNodeStyleValue(node, '--x', anchorX.toFixed(2) + 'px');
        setNodeStyleValue(node, '--y', anchorY.toFixed(2) + 'px');
        setNodeStyleValue(node, '--depth', depthValue);
        setNodeStyleValue(node, '--fog', fog.toFixed(3));
        setNodeStyleValue(node, '--arm-length', connectorLength.toFixed(2) + 'px');
        setNodeStyleValue(node, '--arm-angle', connectorAngle.toFixed(2));
        setNodeStyleValue(node, '--helix-dx', connectorDx.toFixed(2) + 'px');
        setNodeStyleValue(node, '--helix-dy', connectorDy.toFixed(2) + 'px');
        node.__helixDepth = depth;
        updateThumbAxonBase(node, connectorDx, depth, proximityCurrent.get(node) || 0);
        cacheCursorSnapRect(node, stageLeft + anchorX, stageTop + anchorY, depth, proximityCurrent.get(node) || 0);
        setHitCache(index, anchorX, anchorY, hitThreshold);
        setNodeLayer(node, proximityCurrent.get(node) || 0);
      });
    }

    function renderFrame(now) {
      if (webglDestroyed || disposed || !stage.isConnected || !helix.isConnected) {
        frameId = 0;
        return;
      }
      if (document.hidden) {
        frameId = 0;
        lastFrameTime = 0;
        lastNodeSyncTime = 0;
        return;
      }
      if (!lastFrameTime) lastFrameTime = now - WEBGL_MIN_FRAME_MS;
      var elapsed = now - lastFrameTime;
      if (WEBGL_MIN_FRAME_MS > 0 && elapsed < WEBGL_MIN_FRAME_MS) {
        frameId = requestAnimationFrame(renderFrame);
        return;
      }
      var delta = Math.min(64, elapsed);
      lastFrameTime = WEBGL_MIN_FRAME_MS > 0 ? now - (elapsed % WEBGL_MIN_FRAME_MS) : now;

      // Slow, clearly visible rotation.
      group.rotation.y += delta * 0.00006;

      renderer.render(scene, camera);
      if (!lastNodeSyncTime || (now - lastNodeSyncTime) >= performanceProfile.nodeSyncMinMs) {
        syncNodes(viewportWidth, viewportHeight, now);
        lastNodeSyncTime = now;
      }
      if (proximityNeedsStep) {
        proximityNeedsStep = stepProximity(delta || 16);
      }
      frameId = requestAnimationFrame(renderFrame);
    }

    function ensureAnimation() {
      if (document.hidden) return;
      if (frameId) return;
      lastFrameTime = 0;
      lastNodeSyncTime = 0;
      frameId = requestAnimationFrame(renderFrame);
    }

    function layout() {
      if (webglDestroyed || disposed || !stage.isConnected) return;
      var rect = getStageRect();
      var width = Math.max(1, Math.round(rect.width));
      var height = Math.max(1, Math.round(rect.height));
      var aspect = width / height;
      var isMobile = width <= 820;
      var frustumSize = isMobile ? 14.6 : 15.8;
      var cameraDistance = isMobile ? 11.8 : 13.6;
      var cameraElevation = isMobile ? Math.PI * 0.185 : Math.PI * 0.2;
      var deviceRatio = window.devicePixelRatio || 1;
      var mobilePixelCap = performanceProfile.mobilePixelMax;
      if (isIPhoneDevice) {
        mobilePixelCap = Math.min(2, mobilePixelCap + 0.35);
      }
      var useMobilePixelCap = isMobile || isIPhoneDevice;
      var targetPixelRatio = useMobilePixelCap
        ? Math.min(mobilePixelCap, Math.max(1, deviceRatio))
        : Math.min(performanceProfile.desktopPixelMax, deviceRatio);
      var viewportPixels = width * height;
      if (!useMobilePixelCap && viewportPixels > 1100000) {
        targetPixelRatio = Math.min(targetPixelRatio, 1);
      }
      if (!useMobilePixelCap && viewportPixels > 1800000) {
        targetPixelRatio = Math.min(targetPixelRatio, 0.9);
      }
      viewportWidth = width;
      viewportHeight = height;

      renderer.setPixelRatio(targetPixelRatio);
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
      lastNodeSyncTime = performance.now();
      syncNodes(width, height, lastNodeSyncTime);
      ensureAnimation();
    }

    function destroy() {
      if (webglDestroyed) return;
      webglDestroyed = true;

      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
      if (ribbonTextureRefreshFrame) {
        cancelAnimationFrame(ribbonTextureRefreshFrame);
        ribbonTextureRefreshFrame = 0;
      }

      clearGroup();
      nodeScreenState = [];
      if (ribbonTexture && ribbonTexture.dispose) ribbonTexture.dispose();
      ribbonTexture = null;
      ribbonMeshRef = null;
      if (dotGeometry && dotGeometry.dispose) dotGeometry.dispose();

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }

    webglFailureReason = '';
    return { layout: layout, destroy: destroy, resume: ensureAnimation };
  }

  function loadThreeFromCdn(onReady) {
    var urls = [
      '../src/js/vendor/three.min.js',
      'https://unpkg.com/three@0.152.2/build/three.min.js',
      'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js'
    ];
    var i = 0;
    var loadState = { cancelled: false };
    pendingThreeLoader = loadState;

    function finish(result) {
      if (loadState.cancelled || disposed) return;
      if (pendingThreeLoader === loadState) pendingThreeLoader = null;
      onReady(result);
    }

    function loadNext() {
      if (loadState.cancelled || disposed) return;
      if (window.THREE) {
        finish(true);
        return;
      }
      if (i >= urls.length) {
        finish(false);
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
        finish(true);
      };
      script.onerror = function () {
        if (loadState.cancelled || disposed) return;
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
    setElementAttribute(orbit, 'cx', cx.toFixed(2));
    setElementAttribute(orbit, 'cy', cy.toFixed(2));
    setElementAttribute(orbit, 'rx', rx.toFixed(2));
    setElementAttribute(orbit, 'ry', ry.toFixed(2));
  }

  function layoutHelixFallback() {
    var rect = getStageRect();
    var width = rect.width;
    var height = rect.height;
    var isMobile = width <= 820;
    var centerX = width * (isMobile ? 0.5 : fallbackCenterBias);
    var topY = height * (isMobile ? 0.19 : 0.14);
    var loopHeight = height * (isMobile ? 0.62 : 0.72);
    var radiusX = isMobile ? Math.min(width * 0.3, 220) : Math.min(width * 0.47, 560);
    var orbitRadiusY = isMobile
      ? Math.max(10, Math.min(height * 0.045, 20))
      : Math.max(14, Math.min(height * 0.07, 34));
    var viewAngle = (isMobile ? Math.PI * 0.2 : baseViewAngle) + fallbackRotation;
    var startAngle = -Math.PI * 0.5;
    var total = nodes.length;

    if (axisPath) {
      setElementAttribute(
        axisPath,
        'd',
        'M' + centerX.toFixed(2) + ' ' + (topY - orbitRadiusY * 1.35).toFixed(2) +
        ' L' + centerX.toFixed(2) + ' ' + (topY + loopHeight + orbitRadiusY * 1.35).toFixed(2)
      );
    }

    setOrbitGeometry(orbitTop, centerX, topY, radiusX, orbitRadiusY);
    setOrbitGeometry(orbitMid, centerX, topY + loopHeight * 0.5, radiusX, orbitRadiusY);
    setOrbitGeometry(orbitBottom, centerX, topY + loopHeight, radiusX, orbitRadiusY);

    if (threadPath) {
      setElementAttribute(threadPath, 'd', buildThreadPath(centerX, topY, loopHeight, radiusX, startAngle, viewAngle));
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

      var depthValue = depth.toFixed(3);
      setNodeStyleValue(node, '--x', anchorX.toFixed(2) + 'px');
      setNodeStyleValue(node, '--y', anchorY.toFixed(2) + 'px');
      setNodeStyleValue(node, '--depth', depthValue);
      setNodeStyleValue(node, '--fog', fog.toFixed(3));
      setNodeStyleValue(node, '--arm-length', connectorLength.toFixed(2) + 'px');
      setNodeStyleValue(node, '--arm-angle', connectorAngle.toFixed(2));
      setNodeStyleValue(node, '--helix-dx', connectorDx.toFixed(2) + 'px');
      setNodeStyleValue(node, '--helix-dy', connectorDy.toFixed(2) + 'px');
      node.__helixDepth = depth;
      updateThumbAxonBase(node, connectorDx, depth, proximityCurrent.get(node) || 0);
      cacheCursorSnapRect(node, rect.left + anchorX, rect.top + anchorY, depth, proximityCurrent.get(node) || 0);
      setHitCache(index, anchorX, anchorY, hitThreshold);
      setNodeLayer(node, proximityCurrent.get(node) || 0);
    });
  }

  function layoutHelix() {
    if (disposed || !stage.isConnected) return;
    if (webglHelix) {
      webglHelix.layout();
      return;
    }
    layoutHelixFallback();
  }

  function runFallbackFrame(now) {
    if (disposed || !stage.isConnected || !helix.isConnected || webglHelix) {
      fallbackFrame = null;
      return;
    }
    if (document.hidden) {
      fallbackFrame = null;
      fallbackLast = 0;
      return;
    }
    if (!fallbackLast) fallbackLast = now - FALLBACK_MIN_FRAME_MS;
    var elapsed = now - fallbackLast;
    if (FALLBACK_MIN_FRAME_MS > 0 && elapsed < FALLBACK_MIN_FRAME_MS) {
      fallbackFrame = requestAnimationFrame(runFallbackFrame);
      return;
    }
    var delta = Math.min(80, elapsed);
    fallbackLast = FALLBACK_MIN_FRAME_MS > 0 ? now - (elapsed % FALLBACK_MIN_FRAME_MS) : now;

    fallbackRotation += delta * 0.00006;
    layoutHelixFallback();
    if (proximityNeedsStep) {
      proximityNeedsStep = stepProximity(delta || 16);
    }

    fallbackFrame = requestAnimationFrame(runFallbackFrame);
  }

  function ensureFallbackAnimation() {
    if (disposed || !stage.isConnected) return;
    if (document.hidden) return;
    if (webglHelix) return;
    if (fallbackFrame) return;
    fallbackLast = 0;
    fallbackFrame = requestAnimationFrame(runFallbackFrame);
  }

  function updateProximity(clientX, clientY, hoveredNode) {
    if (disposed || !stage.isConnected) return;
    var stageRect = getStageRect();
    var localX = clientX - stageRect.left;
    var localY = clientY - stageRect.top;
    var nextHoverNode = hoveredNode || null;
    var targetChanged = false;

    if (
      lastPointerLocalX !== null &&
      lastPointerLocalY !== null &&
      lastPointerHoverNode === nextHoverNode &&
      Math.abs(localX - lastPointerLocalX) < 1.4 &&
      Math.abs(localY - lastPointerLocalY) < 1.4
    ) {
      return;
    }

    lastPointerLocalX = localX;
    lastPointerLocalY = localY;
    lastPointerHoverNode = nextHoverNode;

    if (nextHoverNode) {
      nodes.forEach(function (node) {
        if (setTargetProximity(node, node === nextHoverNode ? 1 : 0)) targetChanged = true;
      });
      if (targetChanged) ensureProximityAnimation();
      return;
    }

    nodes.forEach(function (node, index) {
      var hit = nodeHitCache[index];
      if (!hit) return;

      var dx = localX - hit.x;
      var dy = localY - hit.y;
      var threshold = hit.threshold || 140;
      var thresholdSq = threshold * threshold;
      var distSq = dx * dx + dy * dy;
      var proximity = 0;

      if (distSq < thresholdSq) {
        var dist = Math.sqrt(distSq);
        proximity = Math.max(0, 1 - dist / threshold);
        proximity = proximity * proximity;
      }
      if (proximity < 0.02) proximity = 0;

      if (setTargetProximity(node, proximity)) targetChanged = true;
    });

    if (targetChanged) ensureProximityAnimation();
  }

  function findTouchNode(clientX, clientY) {
    var stageRect = getStageRect();
    var localX = clientX - stageRect.left;
    var localY = clientY - stageRect.top;
    var bestNode = null;
    var bestValue = 0;

    nodes.forEach(function (node, index) {
      var hit = nodeHitCache[index];
      if (!hit) return;

      var dx = localX - hit.x;
      var dy = localY - hit.y;
      var threshold = (hit.threshold || 140) * 1.06;
      var distSq = dx * dx + dy * dy;
      var thresholdSq = threshold * threshold;
      if (distSq >= thresholdSq) return;

      var dist = Math.sqrt(distSq);
      var proximity = Math.max(0, 1 - dist / threshold);
      proximity = proximity * proximity;
      if (proximity > bestValue) {
        bestValue = proximity;
        bestNode = node;
      }
    });

    return bestValue > 0.045 ? bestNode : null;
  }

  function updateTouchHover(clientX, clientY, moved) {
    var nextNode = findTouchNode(clientX, clientY);
    pointerClientX = clientX;
    pointerClientY = clientY;
    pointerHoverNode = nextNode;
    touchHoverNode = nextNode;

    if (nextNode) {
      var alreadyTouchSelected = selectedNode === nextNode && touchSelectedNode === nextNode;
      if (moved || !alreadyTouchSelected) {
        suppressNextCoarseClickNode = nextNode;
      } else if (suppressNextCoarseClickNode === nextNode) {
        suppressNextCoarseClickNode = null;
      }
      touchSelectedNode = nextNode;
      activateSelection(nextNode);
      return;
    }

    selectedNode = null;
    touchSelectedNode = null;
    updateProximity(clientX, clientY);
  }

  function enableWebglIfPossible() {
    if (disposed || !stage.isConnected) return false;
    if (!webglMount || webglHelix || !window.THREE) return false;
    webglHelix = createWebglHelix();
    if (!webglHelix) return false;

    if (fallbackFrame) {
      cancelAnimationFrame(fallbackFrame);
      fallbackFrame = null;
    }
    helix.classList.add('projects-helix--webgl-enabled');
    helix.classList.remove('projects-helix--ribbon-ready');
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
    scheduleHelixReadyState();
    return true;
  }

  if (!enableWebglIfPossible()) {
    if (webglMount && !window.THREE) {
      loadThreeFromCdn(function (loaded) {
        if (disposed || !stage.isConnected) return;
        if (!loaded || !enableWebglIfPossible()) {
          if (!loaded) webglFailureReason = 'three.js failed to load from CDNs';
          ensureSvgFallbackGuides();
          layoutHelix();
          ensureFallbackAnimation();
          setRibbonReadyState();
          setRenderMode('fallback', webglFailureReason || 'webgl unavailable');
          scheduleHelixReadyState();
        }
      });
    } else {
      ensureSvgFallbackGuides();
      ensureFallbackAnimation();
      setRibbonReadyState();
      setRenderMode('fallback', webglFailureReason || 'webgl unavailable');
      scheduleHelixReadyState();
    }
  }

  var nodeHandlers = [];
  nodes.forEach(function (node) {
    var onMouseEnter = function (evt) {
      if (disposed || isCoarsePointer()) return;
      pointerClientX = evt.clientX;
      pointerClientY = evt.clientY;
      pointerHoverNode = node;
      setTargetProximity(node, 1);
      ensureProximityAnimation();
    };
    var onMouseLeave = function (evt) {
      if (disposed || isCoarsePointer()) return;
      pointerClientX = evt.clientX;
      pointerClientY = evt.clientY;
      if (pointerHoverNode === node) pointerHoverNode = null;
      updateProximity(pointerClientX, pointerClientY);
      ensureProximityAnimation();
    };
    var onFocus = function () {
      if (disposed) return;
      if (hasTouchInput && Date.now() - lastTouchInteractionTime < 800) return;
      touchSelectedNode = null;
      activateSelection(node);
    };
    var onClick = function (evt) {
      if (disposed) return;
      if (isTouchNavigationClick()) {
        if (suppressNextCoarseClickNode === node) {
          evt.preventDefault();
          suppressNextCoarseClickNode = null;
          return;
        }
        if (selectedNode !== node) {
          evt.preventDefault();
          touchSelectedNode = node;
          activateSelection(node);
          return;
        }
      }
      beginHelixThumbNavigation(node, evt);
    };

    node.addEventListener('mouseenter', onMouseEnter);
    node.addEventListener('mouseleave', onMouseLeave);
    node.addEventListener('focus', onFocus);
    node.addEventListener('click', onClick);
    nodeHandlers.push({
      node: node,
      onMouseEnter: onMouseEnter,
      onMouseLeave: onMouseLeave,
      onFocus: onFocus,
      onClick: onClick
    });
  });

  function handleResize() {
    if (disposed) return;
    invalidateStageRect();
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(function () {
      if (disposed) return;
      layoutHelix();
      if (selectedNode) {
        activateSelection(selectedNode);
      } else {
        clearVisualState();
      }
    });
  }

  function handleScroll() {
    if (disposed) return;
    invalidateStageRect();
  }

  function handleVisibilityChange() {
    if (disposed) return;
    if (document.hidden) {
      if (fallbackFrame) {
        cancelAnimationFrame(fallbackFrame);
        fallbackFrame = null;
      }
      if (proximityFrame) {
        cancelAnimationFrame(proximityFrame);
        proximityFrame = null;
      }
      fallbackLast = 0;
      proximityLast = 0;
      return;
    }

    invalidateStageRect();
    if (webglHelix && typeof webglHelix.resume === 'function') {
      webglHelix.resume();
      return;
    }
    ensureFallbackAnimation();
  }

  function handleStageMouseMove(evt) {
    if (disposed) return;
    if (isCoarsePointer()) return;
    pointerClientX = evt.clientX;
    pointerClientY = evt.clientY;
    pointerEventTarget = evt.target;
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(function () {
      var target = pointerEventTarget;
      pointerFrame = null;
      pointerEventTarget = null;
      selectedNode = null;
      touchSelectedNode = null;
      pointerHoverNode = target && target.closest ? target.closest('.projects-helix__node') : null;
      updateProximity(pointerClientX, pointerClientY, pointerHoverNode);
    });
  }

  function handleStageMouseLeave() {
    if (disposed) return;
    if (pointerFrame) {
      cancelAnimationFrame(pointerFrame);
      pointerFrame = null;
    }
    pointerHoverNode = null;
    if (selectedNode) {
      activateSelection(selectedNode);
      return;
    }
    clearVisualState();
  }

  function getPrimaryTouch(evt) {
    if (evt.touches && evt.touches.length) return evt.touches[0];
    if (evt.changedTouches && evt.changedTouches.length) return evt.changedTouches[0];
    return null;
  }

  function handleStageTouchStart(evt) {
    if (disposed || !hasTouchInput) return;
    var touch = getPrimaryTouch(evt);
    if (!touch) return;
    lastTouchInteractionTime = Date.now();
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchInteractionMoved = false;
    updateTouchHover(touch.clientX, touch.clientY, false);
  }

  function handleStageTouchMove(evt) {
    if (disposed || !hasTouchInput) return;
    var touch = getPrimaryTouch(evt);
    if (!touch) return;
    if (evt.cancelable) evt.preventDefault();
    lastTouchInteractionTime = Date.now();
    var dx = touch.clientX - touchStartX;
    var dy = touch.clientY - touchStartY;
    touchInteractionMoved = touchInteractionMoved || (dx * dx + dy * dy > 36);
    updateTouchHover(touch.clientX, touch.clientY, touchInteractionMoved);
  }

  function handleStageTouchEnd(evt) {
    if (disposed || !hasTouchInput) return;
    lastTouchInteractionTime = Date.now();
    if (touchInteractionMoved && touchHoverNode) {
      suppressNextCoarseClickNode = touchHoverNode;
    }
    if (suppressNextCoarseClickNode && evt && evt.cancelable) {
      evt.preventDefault();
    }
    touchInteractionMoved = false;
  }

  stage.addEventListener('mousemove', handleStageMouseMove, { passive: true });
  stage.addEventListener('mouseleave', handleStageMouseLeave);
  stage.addEventListener('touchstart', handleStageTouchStart, { passive: true });
  stage.addEventListener('touchmove', handleStageTouchMove, { passive: false });
  stage.addEventListener('touchend', handleStageTouchEnd, { passive: false });
  stage.addEventListener('touchcancel', handleStageTouchEnd, { passive: true });
  window.addEventListener('resize', handleResize);
  window.addEventListener('scroll', handleScroll, { passive: true });
  document.addEventListener('visibilitychange', handleVisibilityChange);

  function cleanupAtlas() {
    if (disposed) return;
    disposed = true;
    helix.classList.remove('projects-helix--is-ready');
    helix.classList.remove('projects-helix--is-entering');

    if (pendingThreeLoader) pendingThreeLoader.cancelled = true;
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    if (readyRectTimer) window.clearTimeout(readyRectTimer);
    if (entryReadyTimer) window.clearTimeout(entryReadyTimer);
    if (entryReadyReleaseHandler) {
      window.removeEventListener('byl:projects-helix-release', entryReadyReleaseHandler);
      if (window.bylReleaseProjectsHelixEntry === entryReadyReleaseHandler) {
        window.bylReleaseProjectsHelixEntry = null;
      }
    }
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    if (proximityFrame) cancelAnimationFrame(proximityFrame);
    if (fallbackFrame) cancelAnimationFrame(fallbackFrame);

    resizeFrame = null;
    readyRectTimer = null;
    entryReadyTimer = null;
    entryReadyReleaseHandler = null;
    pointerFrame = null;
    proximityFrame = null;
    fallbackFrame = null;

    window.removeEventListener('resize', handleResize);
    window.removeEventListener('scroll', handleScroll);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    stage.removeEventListener('mousemove', handleStageMouseMove);
    stage.removeEventListener('mouseleave', handleStageMouseLeave);
    stage.removeEventListener('touchstart', handleStageTouchStart);
    stage.removeEventListener('touchmove', handleStageTouchMove);
    stage.removeEventListener('touchend', handleStageTouchEnd);
    stage.removeEventListener('touchcancel', handleStageTouchEnd);

    nodeHandlers.forEach(function (entry) {
      entry.node.removeEventListener('mouseenter', entry.onMouseEnter);
      entry.node.removeEventListener('mouseleave', entry.onMouseLeave);
      entry.node.removeEventListener('focus', entry.onFocus);
      entry.node.removeEventListener('click', entry.onClick);
    });
    nodeHandlers = [];

    if (webglHelix && typeof webglHelix.destroy === 'function') {
      webglHelix.destroy();
    }
    webglHelix = null;
  }

  registerProjectPageCleanup(cleanupAtlas);

  layoutHelix();
  clearVisualState(true);
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

  var cardHandlers = [];
  cards.forEach(function (card) {
    var onEnter = function (evt) {
      activatePreview(card, evt);
    };
    var onMove = function (evt) {
      activatePreview(card, evt);
    };
    var onFocus = function () {
      activatePreview(card);
    };

    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mousemove', onMove);
    card.addEventListener('focus', onFocus);
    cardHandlers.push({ card: card, onEnter: onEnter, onMove: onMove, onFocus: onFocus });
  });

  function onLayoutLeave() {
    clearPreview();
  }

  function onWindowResize() {
    if (activeCard) setProjectionOrigin(activeCard);
  }

  layout.addEventListener('mouseleave', onLayoutLeave);
  window.addEventListener('resize', onWindowResize);

  registerProjectPageCleanup(function () {
    clearTimeout(beamTimer);
    clearTimeout(clearTimer);
    layout.removeEventListener('mouseleave', onLayoutLeave);
    window.removeEventListener('resize', onWindowResize);

    cardHandlers.forEach(function (entry) {
      entry.card.removeEventListener('mouseenter', entry.onEnter);
      entry.card.removeEventListener('mousemove', entry.onMove);
      entry.card.removeEventListener('focus', entry.onFocus);
    });
  });
}

// Initialize all features
function initProjectPage(rootContainer) {
  runProjectPageCleanup();

  // Clean up previous bar if exists
  var oldBar = document.querySelector('.project-nav-bar');
  if (oldBar) oldBar.remove();

  initProjectsAtlas();
  initProjectsIndexPreview();
  initGalleryReveals();
  initParallaxHero();
  initNavBar(rootContainer);
  initSpecCounters();
  initFilmstrip();
}

initProjectPage();

