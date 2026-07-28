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
    if (imgEl && !imgEl.hasAttribute('loading')) imgEl.loading = 'lazy';
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
  var isMoodboard = !!scope.querySelector('.moodboard-page');
  var isProjectDetail = !!scope.querySelector('.project-page, .coming-soon-page') || isMoodboard;

  // Build the unified bar
  var bar = document.createElement('div');
  bar.classList.add('project-nav-bar');
  if (isProjectsHelix) {
    bar.classList.add('project-nav-bar--projects-helix');
    document.body.classList.add('is-projects-spiral');
  }
  if (isMoodboard) bar.classList.add('project-nav-bar--moodboard');
  if (isProjectDetail) bar.classList.add('project-nav-bar--has-back');

  if (isProjectDetail) {
    var backLink = document.createElement('a');
    backLink.href = 'projects.html';
    backLink.classList.add('project-nav-bar__back');
    backLink.setAttribute('aria-label', 'Back to Projects');
    backLink.textContent = 'Back';
    bar.appendChild(backLink);
  }

  // Center: site mark.
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
    '<a href="about.html" class="project-nav-bar__link nav-qmark" aria-label="About">?</a>';
  bar.appendChild(links);

  document.body.appendChild(bar);
  registerProjectPageCleanup(function () {
    if (bar.parentNode) bar.parentNode.removeChild(bar);
    document.body.classList.remove('is-projects-spiral');
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
    if (el.dataset.counter === 'false') return;

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
  var moodboardStripLink = helix.querySelector('.projects-helix__moodboard-strip');
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
  var moodboardThreadHitCache = [];
  var moodboardRibbonHitCache = [];
  var pointerClientX = 0;
  var pointerClientY = 0;
  var pointerHoverNode = null;
  var pointerEventTarget = null;
  var pointerFrame = null;
  var touchHoverNode = null;
  var touchStartX = 0;
  var touchStartY = 0;
  var touchInteractionMoved = false;
  var touchHoverMoodboard = false;
  var suppressNextCoarseClickNode = null;
  var suppressNextMoodboardClick = false;
  var lastTouchInteractionTime = 0;
  var touchSelectedNode = null;
  var proximityTarget = new WeakMap();
  var proximityCurrent = new WeakMap();
  var proximityFrame = null;
  var proximityLast = 0;
  var exclusiveProximityNode = null;
  var cursorSnapNode = null;
  var HELIX_ZOOM_KEY = 'bylHelixThumbZoom';
  var MOODBOARD_REWIND_KEY = 'bylMoodboardRewind';
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
  var lastPointerEventTarget = null;
  var lastPointerEventHoverNode = null;
  var pointerFrameMode = '';
  var pointerFrameMoved = false;
  var readyRectTimer = null;
  var entryReadyTimer = null;
  var entryReadyReleaseHandler = null;
  var entryReadyScheduled = false;
  var moodboardStripClickHandler = null;
  var moodboardStripMouseEnterHandler = null;
  var moodboardStripMouseMoveHandler = null;
  var moodboardStripMouseLeaveHandler = null;
  var moodboardHoverActive = false;
  var proximityNeedsStep = true;
  var PROXIMITY_TARGET_STEPS = 80;
  var HELIX_SYNC_POSITION_EPSILON = 0.28;
  var HELIX_SYNC_LENGTH_EPSILON = 0.28;
  var HELIX_SYNC_ANGLE_EPSILON = 0.08;
  var HELIX_SYNC_DEPTH_EPSILON = 0.0025;
  var HELIX_SYNC_PROXIMITY_EPSILON = 0.001;
  var scaleProfileCache = null;
  var fallbackNodeGeometry = [];
  var fallbackNodeGeometryTotal = 0;
  var fallbackNodeGeometryStartAngle = 0;
  var fallbackThreadSamples = null;
  var fallbackThreadSampleCount = 0;
  var fallbackThreadSampleStartAngle = 0;
  var fallbackThreadProjection = { x: 0, depth: 0 };
  var fallbackNodeProjection = { x: 0, depth: 0 };
  var fallbackRibbon = null;
  var fallbackRibbonSlices = [];
  var fallbackRibbonProjection = { x: 0, depth: 0 };
  var fallbackRibbonTangentProjection = { x: 0, depth: 0 };
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
    var isWindows = /Windows/i.test(navigator.userAgent || '');
    var likelyLowEnd = reducedMotion || cores <= 4 || (memory > 0 && memory <= 4);
    var likelyHighEnd = !reducedMotion && cores >= 8 && (memory === 0 || memory >= 8);

    if (likelyLowEnd) {
      return {
        webglMinFrameMs: 0,
        nodeSyncMinMs: isWindows ? 1000 / 20 : 1000 / 24,
        fallbackMinFrameMs: 0,
        ribbonDepthUpdateMs: 360,
        mobilePixelMax: 1.5,
        desktopPixelMax: 0.9,
        ringSegments: 30,
        threadSegmentsMin: 64,
        threadSegmentsMult: 9,
        ribbonSegmentsMobile: 24,
        ribbonSegmentsDesktop: 32,
        anisotropyCap: 4
      };
    }

    if (likelyHighEnd) {
      return {
        webglMinFrameMs: 0,
        nodeSyncMinMs: isWindows ? 1000 / 28 : 1000 / 32,
        fallbackMinFrameMs: 0,
        ribbonDepthUpdateMs: 220,
        mobilePixelMax: 2.25,
        desktopPixelMax: 1.05,
        ringSegments: 44,
        threadSegmentsMin: 88,
        threadSegmentsMult: 12,
        ribbonSegmentsMobile: 36,
        ribbonSegmentsDesktop: 48,
        anisotropyCap: 8
      };
    }

    return {
      webglMinFrameMs: 0,
      nodeSyncMinMs: isWindows ? 1000 / 24 : 1000 / 28,
      fallbackMinFrameMs: 0,
      ribbonDepthUpdateMs: 280,
      mobilePixelMax: 2,
      desktopPixelMax: 0.98,
      ringSegments: 36,
      threadSegmentsMin: 76,
      threadSegmentsMult: 10,
      ribbonSegmentsMobile: 30,
      ribbonSegmentsDesktop: 40,
      anisotropyCap: 8
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  var coarsePointerQuery = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
  var finePointerQuery = window.matchMedia ? window.matchMedia('(any-pointer: fine)') : null;
  var hoverPointerQuery = window.matchMedia ? window.matchMedia('(any-hover: hover)') : null;
  var lastFinePointerInputTime = 0;

  function hasFinePointerAvailable() {
    return !!((finePointerQuery && finePointerQuery.matches) || (hoverPointerQuery && hoverPointerQuery.matches));
  }

  function noteFinePointerInput(evt) {
    if (evt && evt.pointerType && evt.pointerType !== 'mouse' && evt.pointerType !== 'pen') return false;
    if (hasTouchInput && Date.now() - lastTouchInteractionTime < 420 && !hasFinePointerAvailable()) return false;
    lastFinePointerInputTime = Date.now();
    return true;
  }

  function isCoarsePointer() {
    if (Date.now() - lastFinePointerInputTime < 1800) return false;
    if (hasFinePointerAvailable()) return false;
    return coarsePointerQuery ? coarsePointerQuery.matches : false;
  }

  function shouldUseTouchTunedHelix() {
    return (window.innerWidth || 0) <= 900 ||
      (hasTouchInput && !hasFinePointerAvailable() && Date.now() - lastFinePointerInputTime >= 1800);
  }

  function isTouchNavigationClick() {
    return (hasTouchInput && Date.now() - lastTouchInteractionTime < 1200) || isCoarsePointer();
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

  function storeMoodboardRewindState(payload) {
    try {
      sessionStorage.setItem(MOODBOARD_REWIND_KEY, JSON.stringify(payload));
    } catch (err) {
      // Session storage can fail in strict privacy modes; the transition still runs in-page.
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
    var src = thumbImg.dataset.transitionSrc || thumbImg.currentSrc || thumbImg.src || '';
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
        // aphelion-field hard-loads so its field scripts always run
        if (href && href.indexOf('aphelion-field') === -1 &&
            window.barba && typeof window.barba.go === 'function') {
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

  function beginMoodboardRewindNavigation(evt) {
    if (helixNavigationInProgress) {
      if (evt) evt.preventDefault();
      return true;
    }
    if (evt && (evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.altKey || evt.button === 1)) {
      return false;
    }

    var href = 'moodboard.html';
    var absoluteHref = resolveAbsoluteHref(href);
    var payload = {
      active: true,
      source: 'projects-helix-ribbon',
      href: absoluteHref,
      path: resolvePathname(absoluteHref),
      timestamp: Date.now()
    };

    if (evt) evt.preventDefault();
    helixNavigationInProgress = true;
    helix.classList.add('projects-helix--moodboard-rewinding');
    clearVisualState();

    var layer = document.createElement('div');
    layer.className = 'moodboard-rewind-layer moodboard-swirl-layer';
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.zIndex = '11980';
    layer.style.pointerEvents = 'none';
    layer.style.background = 'linear-gradient(180deg, rgba(251, 250, 247, 0.1) 0%, rgba(241, 238, 231, 0.92) 100%)';
    layer.style.opacity = '0';
    layer.style.transform = 'translate3d(0, 0, 0)';
    layer.style.willChange = 'transform, opacity';
    document.body.appendChild(layer);

    payload.layerEl = layer;
    window.bylMoodboardRewind = payload;
    storeMoodboardRewindState({
      href: payload.href,
      path: payload.path,
      timestamp: payload.timestamp
    });

    function continueNavigation() {
      try {
        // aphelion-field hard-loads so its field scripts always run
        if (href && href.indexOf('aphelion-field') === -1 &&
            window.barba && typeof window.barba.go === 'function') {
          window.barba.go(href);
          return;
        }
        window.location.href = href;
      } catch (err) {
        helixNavigationInProgress = false;
        helix.classList.remove('projects-helix--moodboard-rewinding');
        stage.style.opacity = '';
        stage.style.transform = '';
        stage.style.removeProperty('--moodboard-node-shrink');
        stage.style.removeProperty('--moodboard-node-fade');
        if (webglMount) webglMount.style.filter = '';
        if (layer.parentNode) layer.remove();
        window.bylMoodboardRewind = null;
        try {
          sessionStorage.removeItem(MOODBOARD_REWIND_KEY);
        } catch (removeErr) {}
      }
    }

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof gsap === 'undefined' || reduceMotion) {
      layer.style.opacity = '1';
      continueNavigation();
      return true;
    }

    if (webglHelix && typeof webglHelix.startMoodboardTransition === 'function') {
      webglHelix.startMoodboardTransition(820);
    }

    gsap.timeline({
      defaults: { overwrite: true },
      onComplete: continueNavigation
    })
      .set(stage, {
        '--moodboard-node-shrink': 1,
        '--moodboard-node-fade': 1,
        willChange: 'transform, opacity'
      }, 0)
      .to(stage, {
        '--moodboard-node-shrink': 0.02,
        '--moodboard-node-fade': 0,
        duration: 0.5,
        ease: 'power2.in'
      }, 0.04)
      .to(webglMount, {
        filter: 'contrast(1.14) brightness(1.05) saturate(1.06)',
        duration: 0.18,
        ease: 'power1.out'
      }, 0)
      .to(layer, {
        opacity: 1,
        duration: 0.34,
        ease: 'power2.in'
      }, 0.46);

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

  function setHelixCursorSnapNode(node) {
    var nextNode = node || null;
    if (cursorSnapNode === nextNode) return;
    cursorSnapNode = nextNode;

    document.dispatchEvent(new CustomEvent(nextNode ? 'byl:helix-cursor-snap' : 'byl:helix-cursor-clear', {
      detail: {
        node: nextNode
      }
    }));
  }

  function getRibbonSourceImages() {
    var ribbonSources = Array.prototype.slice.call(stage.querySelectorAll('.projects-helix__ribbon-source img'));
    if (ribbonSources.length) return ribbonSources;

    return nodes
      .map(function (node) {
        var thumbImg = node.querySelector('.projects-helix__thumb img');
        return thumbImg || null;
      })
      .filter(function (img) {
        return !!img;
      });
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
    lastPointerEventTarget = null;
    lastPointerEventHoverNode = null;
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
    if (
      Math.abs(hit.x - x) < HELIX_SYNC_POSITION_EPSILON &&
      Math.abs(hit.y - y) < HELIX_SYNC_POSITION_EPSILON &&
      Math.abs((hit.threshold || 0) - threshold) < HELIX_SYNC_LENGTH_EPSILON
    ) {
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

  function getScaleProfiles() {
    var width = window.innerWidth || 0;
    var band = width <= 640 ? 'small' : width <= 900 ? 'medium' : 'large';
    var touchTuned = band === 'large' && shouldUseTouchTunedHelix();
    var cacheKey = band + ':' + touchTuned;
    if (scaleProfileCache && scaleProfileCache.key === cacheKey) return scaleProfileCache;

    var thumb;
    var node;
    if (width <= 640) {
      thumb = {
        base: 0.76,
        responsive: 0.94,
        depth: 0.09,
        proximity: 0.48
      };
      node = {
        base: 0.78,
        depth: 0.27,
        proximity: 0.34
      };
    } else if (width <= 900) {
      thumb = {
        base: 0.82,
        responsive: 1,
        depth: 0.11,
        proximity: 0.54
      };
      node = {
        base: 0.8,
        depth: 0.3,
        proximity: 0.38
      };
    } else {
      thumb = {
        base: 0.88,
        responsive: 1,
        depth: 0.15,
        proximity: touchTuned ? 0.54 : 0.74
      };
      node = {
        base: 0.82,
        depth: 0.34,
        proximity: 0.48
      };
    }

    scaleProfileCache = {
      key: cacheKey,
      thumb: thumb,
      node: node
    };
    return scaleProfileCache;
  }

  function getThumbScaleProfile() {
    return getScaleProfiles().thumb;
  }

  function getNodeScaleProfile() {
    return getScaleProfiles().node;
  }

  function cacheCursorSnapRect(node, centerX, centerY, depth, proximity) {
    var thumb = node.__helixThumbEl;
    if (!thumb) return;

    var scaleProfile = getThumbScaleProfile();
    var nodeScaleProfile = getNodeScaleProfile();
    var depthValue = clamp(depth || 0, 0, 1);
    var proximityValue = clamp(proximity || 0, 0, 1);
    var visualScale = 1 + depthValue * scaleProfile.depth + proximityValue * scaleProfile.proximity;
    var nodeScale = nodeScaleProfile.base + depthValue * nodeScaleProfile.depth + proximityValue * nodeScaleProfile.proximity;
    var width = node.__helixThumbW * scaleProfile.base * scaleProfile.responsive * visualScale * nodeScale;
    var height = node.__helixThumbH * scaleProfile.base * scaleProfile.responsive * visualScale * nodeScale;
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
    var localHitScale = Math.max(0.2, nodeScale);
    var localHitWidth = width / localHitScale + 28;
    var localHitHeight = (height + skewExtra) / localHitScale + 28;

    node.__helixAnchorViewportX = centerX;
    node.__helixAnchorViewportY = centerY;
    node.__cursorSnapRect = rect;
    thumb.__cursorSnapRect = rect;
    setNodeStyleValue(node, '--hit-w', localHitWidth.toFixed(2) + 'px');
    setNodeStyleValue(node, '--hit-h', localHitHeight.toFixed(2) + 'px');
  }

  function applyNodeHelixGeometry(node, index, stageLeft, stageTop, geometry, force) {
    var proximity = proximityCurrent.get(node) || 0;
    var viewportX = stageLeft + geometry.anchorX;
    var viewportY = stageTop + geometry.anchorY;
    var previous = node.__helixGeometryState;
    var positionChanged = force || !previous ||
      Math.abs(previous.anchorX - geometry.anchorX) >= HELIX_SYNC_POSITION_EPSILON ||
      Math.abs(previous.anchorY - geometry.anchorY) >= HELIX_SYNC_POSITION_EPSILON ||
      Math.abs(previous.viewportX - viewportX) >= HELIX_SYNC_POSITION_EPSILON ||
      Math.abs(previous.viewportY - viewportY) >= HELIX_SYNC_POSITION_EPSILON;
    var depthChanged = force || !previous ||
      Math.abs(previous.depth - geometry.depth) >= HELIX_SYNC_DEPTH_EPSILON ||
      Math.abs(previous.fog - geometry.fog) >= HELIX_SYNC_DEPTH_EPSILON;
    var connectorChanged = force || !previous ||
      Math.abs(previous.connectorDx - geometry.connectorDx) >= HELIX_SYNC_POSITION_EPSILON ||
      Math.abs(previous.connectorDy - geometry.connectorDy) >= HELIX_SYNC_POSITION_EPSILON ||
      Math.abs(previous.connectorLength - geometry.connectorLength) >= HELIX_SYNC_LENGTH_EPSILON ||
      Math.abs(previous.connectorAngle - geometry.connectorAngle) >= HELIX_SYNC_ANGLE_EPSILON;
    var hitChanged = force || !previous ||
      Math.abs(previous.hitThreshold - geometry.hitThreshold) >= HELIX_SYNC_LENGTH_EPSILON;
    var proximityChanged = force || !previous ||
      Math.abs(previous.proximity - proximity) >= HELIX_SYNC_PROXIMITY_EPSILON;

    if (!positionChanged && !depthChanged && !connectorChanged && !hitChanged && !proximityChanged) {
      return false;
    }

    if (positionChanged) {
      setNodeStyleValue(node, '--x', geometry.anchorX.toFixed(2) + 'px');
      setNodeStyleValue(node, '--y', geometry.anchorY.toFixed(2) + 'px');
    }

    if (depthChanged) {
      setNodeStyleValue(node, '--depth', geometry.depth.toFixed(3));
      setNodeStyleValue(node, '--fog', geometry.fog.toFixed(3));
      node.__helixDepth = geometry.depth;
    }

    if (connectorChanged) {
      setNodeStyleValue(node, '--arm-length', geometry.connectorLength.toFixed(2) + 'px');
      setNodeStyleValue(node, '--arm-angle', geometry.connectorAngle.toFixed(2));
      setNodeStyleValue(node, '--helix-dx', geometry.connectorDx.toFixed(2) + 'px');
      setNodeStyleValue(node, '--helix-dy', geometry.connectorDy.toFixed(2) + 'px');
    }

    if (depthChanged || proximityChanged) {
      updateThumbAxonBase(node, geometry.connectorDx, geometry.depth, proximity);
    }

    if (positionChanged || depthChanged || proximityChanged) {
      cacheCursorSnapRect(node, viewportX, viewportY, geometry.depth, proximity);
    }

    if (positionChanged || depthChanged || hitChanged) {
      setHitCache(index, geometry.anchorX, geometry.anchorY, geometry.hitThreshold);
    }

    if (depthChanged || proximityChanged) {
      setNodeLayer(node, proximity);
    }

    var nextState = previous || {};
    nextState.anchorX = geometry.anchorX;
    nextState.anchorY = geometry.anchorY;
    nextState.viewportX = viewportX;
    nextState.viewportY = viewportY;
    nextState.depth = geometry.depth;
    nextState.fog = geometry.fog;
    nextState.connectorDx = geometry.connectorDx;
    nextState.connectorDy = geometry.connectorDy;
    nextState.connectorLength = geometry.connectorLength;
    nextState.connectorAngle = geometry.connectorAngle;
    nextState.hitThreshold = geometry.hitThreshold;
    nextState.proximity = proximity;
    node.__helixGeometryState = nextState;
    return true;
  }

  function resetNodeHelixGeometryState() {
    nodeHitCache = [];
    nodes.forEach(function (node) {
      node.__helixGeometryState = null;
    });
  }

  function getNodeComputedGeometry(node) {
    if (!node.__helixComputedGeometry) {
      node.__helixComputedGeometry = {
        anchorX: 0,
        anchorY: 0,
        depth: 0,
        fog: 0,
        connectorDx: 0,
        connectorDy: 0,
        connectorLength: 0,
        connectorAngle: 0,
        hitThreshold: 0
      };
    }
    return node.__helixComputedGeometry;
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

    // While the cursor is locked onto a project, the moodboard ribbon
    // recedes with everything else so only the project holds focus.
    helix.classList.toggle('projects-helix--node-focus', !!nextCenter);

    if (!nextCenter) {
      setFocusMode('off');
      nodes.forEach(function (node) {
        node.__helixFocusDim = 1;
        setNodeStyleValue(node, '--focus-dim', '1');
      });
      return;
    }

    setFocusMode('on');
    var centerIndex = parseInt(nextCenter.dataset.nodeIndex || '-1', 10);
    nodes.forEach(function (node, index) {
      var distance = Math.abs(index - centerIndex);
      var dim = distance === 0 ? 1 : distance === 1 ? 0.72 : 0.28;
      node.__helixFocusDim = dim;
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

  function setExclusiveProximityNode(activeNode) {
    if (
      exclusiveProximityNode === activeNode &&
      (!activeNode || (proximityTarget.get(activeNode) || 0) === 1)
    ) {
      return false;
    }

    var changed = false;
    nodes.forEach(function (node) {
      if (setTargetProximity(node, node === activeNode ? 1 : 0)) changed = true;
    });
    exclusiveProximityNode = activeNode || null;
    return changed;
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
    if (node.__helixGeometryState) {
      node.__helixGeometryState.proximity = clamped;
    }
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

  function ensureFallbackRibbon() {
    if (fallbackRibbon || !stage) return;

    fallbackRibbon = document.createElement('div');
    fallbackRibbon.className = 'projects-helix__fallback-ribbon';
    fallbackRibbon.setAttribute('aria-hidden', 'true');

    var ribbonSources = getRibbonSourceImages();
    var sliceCount = Math.max(24, (ribbonSources.length || nodes.length) * 2);
    for (var i = 0; i < sliceCount; i++) {
      var sourceImg = ribbonSources.length ? ribbonSources[i % ribbonSources.length] : null;
      var slice = document.createElement('span');
      slice.className = 'projects-helix__fallback-ribbon-slice';

      if (sourceImg) {
        var img = document.createElement('img');
        img.src = sourceImg.currentSrc || sourceImg.getAttribute('src') || sourceImg.src;
        img.alt = '';
        img.decoding = 'async';
        slice.appendChild(img);
      }

      fallbackRibbon.appendChild(slice);
      fallbackRibbonSlices.push(slice);
    }

    stage.appendChild(fallbackRibbon);
  }

  function clearVisualState(immediate) {
    selectedNode = null;
    touchSelectedNode = null;
    exclusiveProximityNode = null;
    nodes.forEach(function (node) {
      setTargetProximity(node, 0);
      if (immediate) {
        proximityCurrent.set(node, 0);
        applyNodeProximity(node, 0);
      }
    });
    setActiveFocusNode(null);
    setHelixCursorSnapNode(null);
    if (!immediate) ensureProximityAnimation();
  }

  function activateSelection(node) {
    selectedNode = node;
    setExclusiveProximityNode(node);
    setActiveFocusNode(node);
    setHelixCursorSnapNode(node);
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
    renderer.autoClear = false;
    renderer.setPixelRatio(1);

    while (webglMount.firstChild) {
      webglMount.removeChild(webglMount.firstChild);
    }
    webglMount.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    var thumbScene = new THREE.Scene();
    var thumbCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
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
    var thumbGeometry = new THREE.PlaneGeometry(1, 1);
    var nodeData = [];
    var nodeScreenState = [];
    var viewportWidth = 1;
    var viewportHeight = 1;
    // The 3D canvas renders this many px TALLER than the stage and is shifted up over the nav,
    // so the ribbon can spiral out and bleed over the top navigation bar. Projected thumbnails
    // and hit areas subtract this so they stay aligned to the stage. Must match the
    // `.projects-helix__webgl { top: -130px }` rule in the CSS.
    var canvasTopBleed = 130;
    var frameId = 0;
    var lastFrameTime = 0;
    var lastNodeSyncTime = 0;
    var lastRibbonDepthUpdate = 0;
    var ribbonTextureRefreshFrame = 0;
    var webglDestroyed = false;
    var ribbonReadyNotified = false;
    var tempNodeProjectionMatrix = new THREE.Matrix4();
    var tempDotMatrix = new THREE.Matrix4();
    var tempProjectedPoint = { x: 0, y: 0, z: 0 };
    var tempProjectedAnchor = { x: 0, y: 0, z: 0 };
    var tempRibbonWorld = new THREE.Vector3();
    var tempRibbonWorldB = new THREE.Vector3();
    var tempRibbonCenter = new THREE.Vector3();
    var tempProjectedRibbon = new THREE.Vector3();
    var ribbonTexture = null;
    var ribbonMeshRef = null;
    var threadHitSourcePoints = [];
    var tempProjectedThread = { x: 0, y: 0, z: 0 };
    var useWebglThumbLayer = false;
    var webglThumbsReady = 0;
    var webglThumbReadyTotal = 0;
    var projectionSmoothing = isIPhoneDevice ? 0.28 : 0.34;
    var moodboardTransition = {
      active: false,
      start: 0,
      duration: 820,
      progress: 0
    };
    // Cached helix dimensions so the moodboard transition can lift the ribbon fully out of frame.
    var transitionHelixHeight = 10.2;
    var transitionIsMobile = false;
    // Moodboard transition: the ribbon detaches from the spiral group and flies up on its own
    // while the spiral/dots shrink and fade in place. These hold the ribbon's pre-transition
    // transform and the spiral materials we fade out.
    var transitionSpiralMats = [];
    var moodboardTransitionWasActive = false;
    var ribbonBaseY = 0;
    var ribbonBaseRotY = 0;
    var ribbonBaseScale = 1;

    function disposeMaterial(material) {
      if (material && material.dispose) material.dispose();
    }

    function clearGroup() {
      while (group.children.length) {
        var child = group.children[0];
        group.remove(child);
        if (
          child.geometry &&
          child.geometry !== dotGeometry &&
          child.geometry !== thumbGeometry &&
          child.geometry.dispose
        ) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(disposeMaterial);
          } else {
            disposeMaterial(child.material);
          }
        }
      }
    }

    function clearThumbScene() {
      while (thumbScene.children.length) {
        var child = thumbScene.children[0];
        thumbScene.remove(child);
        if (child.userData && child.userData.thumbTexture && child.userData.thumbTexture.dispose) {
          child.userData.thumbTexture.dispose();
        }
        if (child.material) disposeMaterial(child.material);
      }
    }

    function addLine(points, material, dashed) {
      var geometry = new THREE.BufferGeometry().setFromPoints(points);
      var line = new THREE.Line(geometry, material);
      if (dashed && line.computeLineDistances) line.computeLineDistances();
      line.matrixAutoUpdate = false;
      line.frustumCulled = false;
      line.updateMatrix();
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
      var sourceImages = getRibbonSourceImages();
      // ~1.3 cells per source image so the thinner strip stays densely packed with small
      // frames (more photos visible at once). With the full set (~90 photos) the repeats are
      // sparse and spread far along the long spiral, so they don't read as obvious cycling.
      var frameCount = Math.max(64, Math.round(sourceImages.length * 1.3));
      var isTouchSizedTexture = shouldUseTouchTunedHelix();
      // Use the GPU's full texture budget so the dense cells stay reasonably crisp.
      var maxTextureSize = (renderer.capabilities && renderer.capabilities.maxTextureSize) || 4096;
      var maxCanvasWidth = Math.min(8192, maxTextureSize);
      // Landscape cell aspect (~1.5:1) matches each strip segment, so images aren't stretched.
      var frameW = Math.max(24, Math.floor(maxCanvasWidth / frameCount));
      var frameH = Math.max(16, Math.round(frameW / 1.5));
      var canvas = document.createElement('canvas');
      canvas.width = frameCount * frameW;
      canvas.height = frameH;
      var ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
      var texture = new THREE.CanvasTexture(canvas);
      var pendingDecodeRefresh = false;

      function drawRibbonFallbackFrames() {
        var grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        grad.addColorStop(0, '#d1c9bb');
        grad.addColorStop(0.25, '#e3ddd2');
        grad.addColorStop(0.5, '#c6bdaf');
        grad.addColorStop(0.75, '#e8e1d6');
        grad.addColorStop(1, '#b9b1a4');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (var i = 0; i < frameCount; i++) {
          var x = i * frameW;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(26,26,26,0.05)';
          ctx.fillRect(x, 0, Math.max(2, frameW * 0.14), frameH);
        }
      }

      function redrawFromThumbs() {
        var anyDrawn = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        if (!anyDrawn) {
          drawRibbonFallbackFrames();
        }
        texture.needsUpdate = true;
        markRibbonReady();
        return anyDrawn;
      }

      function scheduleRibbonRefresh() {
        if (webglDestroyed || disposed) return;
        if (ribbonTextureRefreshFrame) return;
        ribbonTextureRefreshFrame = requestAnimationFrame(function () {
          ribbonTextureRefreshFrame = 0;
          redrawFromThumbs();
        });
      }

      function scheduleRibbonDecodeRefresh() {
        if (pendingDecodeRefresh) return;
        pendingDecodeRefresh = true;
        var decodePromises = sourceImages.map(function (img) {
          if (!img || !img.decode) return Promise.resolve();
          return img.decode().catch(function () {});
        });
        Promise.all(decodePromises).then(function () {
          pendingDecodeRefresh = false;
          scheduleRibbonRefresh();
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
        var drewInitialRibbonImages = redrawFromThumbs();
        if (!drewInitialRibbonImages) {
          window.setTimeout(scheduleRibbonRefresh, 220);
          window.setTimeout(scheduleRibbonRefresh, 900);
        }
        scheduleRibbonDecodeRefresh();
      }

      // Mipmaps (WebGL2) + full anisotropy keep the angled, minified ribbon strip anti-aliased
      // instead of shimmering. Falls back to plain linear on WebGL1.
      var canMipmap = !!(renderer.capabilities && renderer.capabilities.isWebGL2);
      texture.generateMipmaps = canMipmap;
      texture.minFilter = canMipmap ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      if (renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
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
        // Opaque + depth-write so the ribbon occludes itself correctly (near wrap over far wrap)
        // and sorts properly against the thread/dots — kills the ambiguous-figure overlaps.
        transparent: false,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: true,
        depthTest: true,
        alphaTest: 0.06,
        vertexColors: true
      });

      return new THREE.Mesh(geometry, material);
    }

    function enableWebglThumbLayerWhenReady() {
      if (!useWebglThumbLayer || webglThumbReadyTotal <= 0) return;
      if (webglThumbsReady < webglThumbReadyTotal) return;
      requestAnimationFrame(function () {
        if (!webglDestroyed && !disposed && helix.isConnected && webglThumbsReady >= webglThumbReadyTotal) {
          helix.classList.add('projects-helix--webgl-thumbs');
        }
      });
    }

    function configureImageTexture(texture) {
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
    }

    function markWebglThumbReady(data) {
      if (!data || data.thumbTextureReady) return;
      data.thumbTextureReady = true;
      webglThumbsReady++;
      enableWebglThumbLayerWhenReady();
    }

    function createThumbPlaneForNode(node, data, baseWidth, baseHeight) {
      if (!useWebglThumbLayer) return null;

      var sourceImg = node.querySelector('.projects-helix__thumb img');
      if (!sourceImg) return null;

      var targetAspect = baseWidth / baseHeight;
      var maxTextureEdge = isIPhoneDevice ? 448 : 512;
      var textureCanvas = document.createElement('canvas');
      textureCanvas.width = Math.max(128, targetAspect >= 1
        ? maxTextureEdge
        : Math.round(maxTextureEdge * targetAspect));
      textureCanvas.height = Math.max(96, targetAspect >= 1
        ? Math.round(maxTextureEdge / targetAspect)
        : maxTextureEdge);
      var texture = new THREE.CanvasTexture(textureCanvas);
      configureImageTexture(texture);

      var material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false
      });

      var mesh = new THREE.Mesh(thumbGeometry, material);
      mesh.position.set(-9999, -9999, 0);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 30;
      mesh.userData.thumbTexture = texture;

      data.thumbMesh = mesh;
      data.thumbMaterial = material;
      data.thumbBaseWorldWidth = baseWidth;
      data.thumbBaseWorldHeight = baseHeight;
      data.thumbTextureCanvas = textureCanvas;
      data.thumbTextureReady = false;
      data.thumbCropKey = '';
      data.thumbCropProximity = -1;
      webglThumbReadyTotal++;

      function redrawTextureCanvas() {
        var sourceWidth = sourceImg.naturalWidth || 0;
        var sourceHeight = sourceImg.naturalHeight || 0;
        if (!sourceWidth || !sourceHeight) return false;

        var canvasAspect = textureCanvas.width / textureCanvas.height;
        var sourceAspect = sourceWidth / sourceHeight;
        var sx = 0;
        var sy = 0;
        var sw = sourceWidth;
        var sh = sourceHeight;
        if (sourceAspect > canvasAspect) {
          sw = sourceHeight * canvasAspect;
          sx = (sourceWidth - sw) * 0.5;
        } else if (sourceAspect < canvasAspect) {
          sh = sourceWidth / canvasAspect;
          sy = (sourceHeight - sh) * 0.5;
        }

        var ctx = textureCanvas.getContext('2d');
        if (!ctx) return false;
        ctx.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          sourceImg,
          sx,
          sy,
          sw,
          sh,
          0,
          0,
          textureCanvas.width,
          textureCanvas.height
        );
        return true;
      }

      function refreshTexture() {
        if (webglDestroyed || disposed) return;
        if (!redrawTextureCanvas()) return;
        texture.needsUpdate = true;
        markWebglThumbReady(data);
      }

      if (sourceImg.complete && sourceImg.naturalWidth && sourceImg.naturalHeight) {
        refreshTexture();
      } else {
        sourceImg.addEventListener('load', refreshTexture, { once: true });
        sourceImg.addEventListener('error', function () {
          markWebglThumbReady(data);
        }, { once: true });
        if (sourceImg.decode) {
          sourceImg.decode().then(refreshTexture).catch(function () {});
        }
      }

      thumbScene.add(mesh);
      return mesh;
    }

    function updateRibbonDepthVisual() {
      if (!ribbonMeshRef || !ribbonMeshRef.geometry) return;
      var geometry = ribbonMeshRef.geometry;
      var positionAttr = geometry.getAttribute('position');
      var colorAttr = geometry.getAttribute('color');
      if (!positionAttr || !colorAttr) return;

      ribbonMeshRef.updateMatrixWorld(true);
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

    function syncMoodboardRibbonHitCache(width, height) {
      if (!ribbonMeshRef || !ribbonMeshRef.geometry) {
        moodboardRibbonHitCache = [];
        return;
      }

      var positionAttr = ribbonMeshRef.geometry.getAttribute('position');
      if (!positionAttr || positionAttr.count < 4) {
        moodboardRibbonHitCache = [];
        return;
      }

      ribbonMeshRef.updateMatrixWorld(true);
      var nextHits = [];
      for (var i = 0; i < positionAttr.count - 1; i += 2) {
        tempRibbonWorld.fromBufferAttribute(positionAttr, i).applyMatrix4(ribbonMeshRef.matrixWorld);
        tempRibbonWorldB.fromBufferAttribute(positionAttr, i + 1).applyMatrix4(ribbonMeshRef.matrixWorld);
        tempRibbonCenter.copy(tempRibbonWorld).add(tempRibbonWorldB).multiplyScalar(0.5);
        tempProjectedRibbon.copy(tempRibbonCenter).project(camera);
        if (!isFinite(tempProjectedRibbon.x) || !isFinite(tempProjectedRibbon.y)) continue;
        nextHits.push({
          x: snapToDevicePixel((tempProjectedRibbon.x * 0.5 + 0.5) * width),
          y: snapToDevicePixel((-tempProjectedRibbon.y * 0.5 + 0.5) * height - canvasTopBleed),
          depth: clamp(1 - (tempProjectedRibbon.z + 1) * 0.5, 0, 1)
        });
      }
      moodboardRibbonHitCache = nextHits;
    }

    function buildWorld(width, height, frustumSize) {
      clearGroup();
      clearThumbScene();
      nodeData = [];
      nodeScreenState = [];
      resetNodeHelixGeometryState();
      ribbonMeshRef = null;
      webglThumbsReady = 0;
      webglThumbReadyTotal = 0;
      helix.classList.remove('projects-helix--webgl-thumbs');

      var total = nodes.length;
      var startAngle = -Math.PI * 0.5;
      var isMobile = width <= 820;
      var helixRadius = isMobile
        ? Math.max(2.45, Math.min(3.35, 2.85 + (width - 390) / 380))
        : Math.max(4.6, Math.min(6.8, 5.2 + (width - 980) / 380));
      var ribbonRadius = helixRadius * (isMobile ? 0.78 : 0.72);
      var helixHeight = isMobile ? 6.7 : 10.2;
      transitionHelixHeight = helixHeight;
      transitionIsMobile = isMobile;
      var ringSegments = performanceProfile.ringSegments;
      var threadSegments = Math.max(performanceProfile.threadSegmentsMin, total * performanceProfile.threadSegmentsMult);
      var threadPoints = [];
      var axisTop = helixHeight * 0.61;
      var axisBottom = -helixHeight * 0.61;
      var ribbonPhaseShift = 0;
      var ribbonEndT = 1;

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
      threadHitSourcePoints = threadPoints;

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
        // Spiral the ribbon's top well past the helix so its top edge sits off-screen (an extra
        // turn up, and more on mobile where the viewport is taller). Black thread is unchanged.
        startT: isMobile ? -2.4 : -1.6,
        endT: ribbonEndT,
        width: isMobile ? 0.21 : 0.26,
        tilt: isMobile ? 0.026 : 0.04,
        // Dense segmentation so the long strip's facets/polygons are not visible.
        segments: isMobile ? 240 : 200
      });
      if (ribbonMesh) {
        ribbonMeshRef = ribbonMesh;
        ribbonMesh.frustumCulled = false;
        group.add(ribbonMesh);
      }

      var dotMaterial = new THREE.MeshBasicMaterial({
        color: 0x0f0f0d,
        transparent: true,
        opacity: 0.9
      });
      var dotMesh = THREE.InstancedMesh ? new THREE.InstancedMesh(dotGeometry, dotMaterial, total) : null;
      if (dotMesh) {
        dotMesh.matrixAutoUpdate = false;
        dotMesh.frustumCulled = false;
        dotMesh.updateMatrix();
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

        if (dotMesh) {
          tempDotMatrix.makeTranslation(point.x, point.y, point.z);
          dotMesh.setMatrixAt(index, tempDotMatrix);
        } else {
          var dot = new THREE.Mesh(dotGeometry, dotMaterial);
          dot.position.copy(point);
          dot.updateMatrix();
          dot.matrixAutoUpdate = false;
          dot.frustumCulled = false;
          group.add(dot);
        }

        var data = {
          point: point,
          anchor: anchor,
          geometry: getNodeComputedGeometry(nodes[index])
        };

        if (useWebglThumbLayer) {
          createThumbPlaneForNode(
            nodes[index],
            data,
            nodes[index].__helixThumbW,
            nodes[index].__helixThumbH
          );
        }

        nodeData.push(data);
      }

      if (dotMesh) {
        dotMesh.instanceMatrix.needsUpdate = true;
        group.add(dotMesh);
      }
      enableWebglThumbLayerWhenReady();
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

    function projectNodePoint(point, matrix, width, height, target) {
      var x = point.x;
      var y = point.y;
      var z = point.z;
      var w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
      var invW = w ? 1 / w : 1;
      var projectedX = (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) * invW;
      var projectedY = (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) * invW;
      var projectedZ = (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) * invW;

      target.x = (projectedX * 0.5 + 0.5) * width;
      // Subtract the canvas top-bleed so DOM thumbnails/hits land in stage-local coords even
      // though the WebGL canvas extends above the stage.
      target.y = (-projectedY * 0.5 + 0.5) * height - canvasTopBleed;
      target.z = projectedZ;
      return target;
    }

    function syncMoodboardThreadHitCache(width, height, projectionMatrix) {
      if (!threadHitSourcePoints.length) {
        moodboardThreadHitCache = [];
        return;
      }

      var nextHits = [];
      for (var i = 0; i < threadHitSourcePoints.length; i++) {
        projectNodePoint(threadHitSourcePoints[i], projectionMatrix, width, height, tempProjectedThread);
        if (!isFinite(tempProjectedThread.x) || !isFinite(tempProjectedThread.y)) continue;
        nextHits.push({
          x: snapToDevicePixel(tempProjectedThread.x),
          y: snapToDevicePixel(tempProjectedThread.y),
          depth: clamp(1 - (tempProjectedThread.z + 1) * 0.5, 0, 1)
        });
      }
      moodboardThreadHitCache = nextHits;
    }

    function updateThumbTextureCrop(data, planeWidth, planeHeight, proximity) {
      if (!data || !data.thumbMesh || !data.thumbMesh.userData) return;
      var texture = data.thumbMesh.userData.thumbTexture;
      if (!texture) return;
      if (
        data.thumbCropProximity >= 0 &&
        Math.abs(data.thumbCropProximity - proximity) < 0.006
      ) {
        return;
      }
      data.thumbCropProximity = proximity;

      var imageZoom = 1.12 * (1.03 + proximity * 0.2) * 0.92;
      var repeatX = 1 / imageZoom;
      var repeatY = 1 / imageZoom;
      var offsetX = (1 - repeatX) * 0.5;
      var offsetY = (1 - repeatY) * 0.5;
      var cropKey = [
        repeatX.toFixed(4),
        repeatY.toFixed(4),
        offsetX.toFixed(4),
        offsetY.toFixed(4)
      ].join(',');
      if (data.thumbCropKey === cropKey) return;

      data.thumbCropKey = cropKey;
      texture.repeat.set(repeatX, repeatY);
      texture.offset.set(offsetX, offsetY);
    }

    function syncWebglThumbs(width, height) {
      if (!useWebglThumbLayer || !nodeData.length) return;

      group.updateMatrix();
      group.matrixWorld.copy(group.matrix);
      tempNodeProjectionMatrix
        .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        .multiply(group.matrixWorld);
      var projectionMatrix = tempNodeProjectionMatrix.elements;
      var nodeScaleProfile = getNodeScaleProfile();
      var thumbScaleProfile = getThumbScaleProfile();

      nodes.forEach(function (node, index) {
        var data = nodeData[index];
        if (!data || !data.thumbMesh || !data.thumbMaterial) return;

        if (!data.thumbTextureReady) {
          data.thumbMaterial.opacity = 0;
          return;
        }

        projectNodePoint(data.point, projectionMatrix, width, height, tempProjectedPoint);
        projectNodePoint(data.anchor, projectionMatrix, width, height, tempProjectedAnchor);

        var proximity = proximityCurrent.get(node) || 0;
        var depth = clamp(1 - (tempProjectedPoint.z + 1) * 0.5, 0, 1);
        var fog = clamp(1 - depth, 0, 1);
        var focusDim = typeof node.__helixFocusDim === 'number' ? node.__helixFocusDim : 1;
        var nodeScale = nodeScaleProfile.base + depth * nodeScaleProfile.depth + proximity * nodeScaleProfile.proximity;
        var thumbScale = 1 + depth * thumbScaleProfile.depth + proximity * thumbScaleProfile.proximity;
        var finalScale = nodeScale * thumbScale;
        var opacity = (0.34 + depth * 0.62 + proximity * 0.38) * (1 - fog * 0.22) * focusDim;
        opacity *= 0.42 + focusDim * 0.58;

        var planeWidth = data.thumbBaseWorldWidth * thumbScaleProfile.base * thumbScaleProfile.responsive;
        var planeHeight = data.thumbBaseWorldHeight * thumbScaleProfile.base * thumbScaleProfile.responsive;
        var scaleX = planeWidth * finalScale;
        var scaleY = planeHeight * finalScale;
        var skewY = Math.tan((-30 * (1 - proximity) * Math.PI) / 180);
        updateThumbTextureCrop(data, planeWidth, planeHeight, proximity);

        data.thumbMesh.matrix.set(
          scaleX, 0, 0, tempProjectedAnchor.x,
          skewY * scaleX, scaleY, 0, tempProjectedAnchor.y,
          0, 0, 1, 0,
          0, 0, 0, 1
        );
        data.thumbMesh.matrixWorldNeedsUpdate = true;
        data.thumbMaterial.opacity = clamp(opacity, 0, 1);
        data.thumbMesh.renderOrder = Math.round(30 + depth * 12 + proximity * 18);
      });
    }

    function renderSceneWithThumbs() {
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      if (useWebglThumbLayer && webglThumbReadyTotal > 0) {
        renderer.clearDepth();
        renderer.render(thumbScene, thumbCamera);
      }
    }

    function syncNodes(width, height, now) {
      group.updateMatrix();
      group.matrixWorld.copy(group.matrix);
      if (!lastRibbonDepthUpdate || (now - lastRibbonDepthUpdate) >= RIBBON_DEPTH_UPDATE_MS) {
        updateRibbonDepthVisual();
        lastRibbonDepthUpdate = now;
      }
      var cachedStageRect = stageRectCache || getStageRect();
      var stageLeft = cachedStageRect ? cachedStageRect.left : 0;
      var stageTop = cachedStageRect ? cachedStageRect.top : 0;
      tempNodeProjectionMatrix
        .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        .multiply(group.matrixWorld);
      var projectionMatrix = tempNodeProjectionMatrix.elements;

      syncMoodboardThreadHitCache(width, height, projectionMatrix);
      syncMoodboardRibbonHitCache(width, height);

      nodes.forEach(function (node, index) {
        var data = nodeData[index];
        if (!data) return;

        projectNodePoint(data.point, projectionMatrix, width, height, tempProjectedPoint);
        projectNodePoint(data.anchor, projectionMatrix, width, height, tempProjectedAnchor);

        var pointX = tempProjectedPoint.x;
        var pointY = tempProjectedPoint.y;
        var anchorX = tempProjectedAnchor.x;
        var anchorY = tempProjectedAnchor.y;
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
        var hitThreshold = (width <= 820 ? 90 : 148) * (0.9 + depth * 0.7);
        var geometry = data.geometry || getNodeComputedGeometry(node);
        geometry.anchorX = anchorX;
        geometry.anchorY = anchorY;
        geometry.depth = depth;
        geometry.fog = fog;
        geometry.connectorDx = connectorDx;
        geometry.connectorDy = connectorDy;
        geometry.connectorLength = connectorLength;
        geometry.connectorAngle = connectorAngle;
        geometry.hitThreshold = hitThreshold;

        applyNodeHelixGeometry(node, index, stageLeft, stageTop, geometry, false);
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

      if (moodboardTransition.active) {
        var rawTransitionProgress = (now - moodboardTransition.start) / Math.max(1, moodboardTransition.duration);
        moodboardTransition.progress = clamp(rawTransitionProgress, 0, 1);
        var p = moodboardTransition.progress;
        var shrinkEase = Math.pow(p, 0.6);
        var fadeEase = Math.pow(p, 0.85);
        var spinRamp = p * p;

        // The black spiral, dots and thumbnails stay where they are: no upward lift. They
        // shrink toward the centre and fade away in place.
        group.position.y = 0;
        group.rotation.y += delta * (0.001 + spinRamp * 0.004);
        group.scale.setScalar(Math.max(0.05, 1 - shrinkEase * 0.62));
        for (var sm = 0; sm < transitionSpiralMats.length; sm++) {
          transitionSpiralMats[sm].mat.opacity = transitionSpiralMats[sm].base * (1 - fadeEase);
        }

        // Ribbon only: detached from the spiral, it whips upward out of frame and shrinks to
        // a point (accelerating) — the dramatic spaghetti slurp.
        if (ribbonMeshRef) {
          var suck = Math.pow(p, 1.85);
          ribbonMeshRef.rotation.y = ribbonBaseRotY + spinRamp * 1.6 + suck * 11;
          ribbonMeshRef.position.y = ribbonBaseY + suck * transitionHelixHeight * 2.6;
          ribbonMeshRef.scale.setScalar(Math.max(0.001, ribbonBaseScale * (1 - suck * 0.94)));
          if (ribbonMeshRef.material) {
            ribbonMeshRef.material.opacity = clamp(1 - Math.pow(p, 5) * 0.9, 0.04, 1);
          }
        }
        moodboardTransitionWasActive = true;
      } else if (moodboardTransitionWasActive) {
        // Restore if the transition was interrupted (the normal path navigates away).
        group.position.y = 0;
        group.scale.setScalar(1);
        for (var rm = 0; rm < transitionSpiralMats.length; rm++) {
          transitionSpiralMats[rm].mat.opacity = transitionSpiralMats[rm].base;
        }
        if (ribbonMeshRef) {
          if (ribbonMeshRef.parent !== group) group.attach(ribbonMeshRef);
          ribbonMeshRef.position.y = 0;
          ribbonMeshRef.rotation.y = 0;
          ribbonMeshRef.scale.setScalar(1);
          if (ribbonMeshRef.material) ribbonMeshRef.material.opacity = 0.92;
        }
        moodboardTransitionWasActive = false;
      }

      if (proximityNeedsStep) {
        proximityNeedsStep = stepProximity(delta || 16);
      }
      syncWebglThumbs(viewportWidth, viewportHeight);
      renderSceneWithThumbs();
      if (moodboardTransition.active || !lastNodeSyncTime || (now - lastNodeSyncTime) >= performanceProfile.nodeSyncMinMs) {
        // Sync the DOM thumbnails every frame during the moodboard transition so the
        // shrink-and-lift stays smooth instead of stepping at the throttled sync rate.
        syncNodes(viewportWidth, viewportHeight, now);
        lastNodeSyncTime = now;
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
      // Render the canvas taller than the stage by canvasTopBleed px (it extends up over the
      // nav). Keep the helix scale referenced to the stage height and add the extra room at the
      // top of the frustum, so the helix stays put and only the upper ribbon fills the new space.
      var canvasHeight = height + canvasTopBleed;
      var worldPerPixel = frustumSize / height;
      viewportWidth = width;
      viewportHeight = canvasHeight;

      renderer.setPixelRatio(targetPixelRatio);
      renderer.setSize(width, canvasHeight, false);
      thumbCamera.left = 0;
      thumbCamera.right = width;
      thumbCamera.top = 0;
      thumbCamera.bottom = canvasHeight;
      thumbCamera.updateProjectionMatrix();

      // Orthographic top-corner (architectural axonometric) with upright axis.
      setCornerCamera(cameraDistance, cameraElevation);

      camera.left = (-frustumSize * aspect) * 0.5;
      camera.right = (frustumSize * aspect) * 0.5;
      camera.top = frustumSize * 0.5 + canvasTopBleed * worldPerPixel;
      camera.bottom = -frustumSize * 0.5;
      camera.updateProjectionMatrix();

      useWebglThumbLayer = false;
      buildWorld(width, canvasHeight, frustumSize);
      renderSceneWithThumbs();
      lastNodeSyncTime = performance.now();
      syncNodes(width, canvasHeight, lastNodeSyncTime);
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

      // If a moodboard transition detached the ribbon onto the scene, put it back so clearGroup
      // disposes its geometry/material with the rest of the spiral.
      if (ribbonMeshRef && ribbonMeshRef.parent && ribbonMeshRef.parent !== group) {
        group.add(ribbonMeshRef);
      }

      clearGroup();
      clearThumbScene();
      nodeScreenState = [];
      threadHitSourcePoints = [];
      moodboardThreadHitCache = [];
      moodboardRibbonHitCache = [];
      if (ribbonTexture && ribbonTexture.dispose) ribbonTexture.dispose();
      ribbonTexture = null;
      ribbonMeshRef = null;
      if (dotGeometry && dotGeometry.dispose) dotGeometry.dispose();
      if (thumbGeometry && thumbGeometry.dispose) thumbGeometry.dispose();
      helix.classList.remove('projects-helix--webgl-thumbs');

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }

    webglFailureReason = '';
    return {
      layout: layout,
      destroy: destroy,
      resume: ensureAnimation,
      startMoodboardTransition: function (duration) {
        moodboardTransition.active = true;
        moodboardTransition.start = performance.now();
        moodboardTransition.duration = duration || 820;
        moodboardTransition.progress = 0;
        // Lift the ribbon out of the spiral group so it can fly away independently while the
        // spiral shrinks and fades in place. scene.attach preserves its current world transform
        // (its pivot is the helix axis, so it does not jump).
        if (ribbonMeshRef && scene && ribbonMeshRef.parent !== scene) {
          scene.attach(ribbonMeshRef);
        }
        ribbonBaseY = ribbonMeshRef ? ribbonMeshRef.position.y : 0;
        ribbonBaseRotY = ribbonMeshRef ? ribbonMeshRef.rotation.y : 0;
        ribbonBaseScale = ribbonMeshRef ? ribbonMeshRef.scale.x : 1;
        // Snapshot the spiral/dot material opacities so we can fade them to nothing.
        transitionSpiralMats = [];
        group.traverse(function (obj) {
          if (obj.material && typeof obj.material.opacity === 'number') {
            obj.material.transparent = true;
            transitionSpiralMats.push({ mat: obj.material, base: obj.material.opacity });
          }
        });
        moodboardTransitionWasActive = false;
        ensureAnimation();
      }
    };
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

  function getFallbackNodeGeometry(total, startAngle) {
    if (
      fallbackNodeGeometry.length === total &&
      fallbackNodeGeometryTotal === total &&
      fallbackNodeGeometryStartAngle === startAngle
    ) {
      return fallbackNodeGeometry;
    }

    fallbackNodeGeometry = [];
    fallbackNodeGeometryTotal = total;
    fallbackNodeGeometryStartAngle = startAngle;
    for (var index = 0; index < total; index++) {
      var progress = total === 1 ? 0.5 : index / (total - 1);
      var theta = startAngle + progress * Math.PI * 2;
      fallbackNodeGeometry.push({
        progress: progress,
        sinTheta: Math.sin(theta),
        cosTheta: Math.cos(theta)
      });
    }
    return fallbackNodeGeometry;
  }

  function getFallbackThreadSamples(segments, startAngle) {
    if (
      fallbackThreadSamples &&
      fallbackThreadSampleCount === segments &&
      fallbackThreadSampleStartAngle === startAngle
    ) {
      return fallbackThreadSamples;
    }

    fallbackThreadSamples = [];
    fallbackThreadSampleCount = segments;
    fallbackThreadSampleStartAngle = startAngle;
    for (var i = 0; i <= segments; i++) {
      var progress = i / segments;
      var theta = startAngle + progress * Math.PI * 2;
      fallbackThreadSamples.push({
        progress: progress,
        sinTheta: Math.sin(theta),
        cosTheta: Math.cos(theta)
      });
    }
    return fallbackThreadSamples;
  }

  function projectOffsetFromTrig(sinTheta, cosTheta, radius, sinViewAngle, cosViewAngle, target) {
    var spatialX = sinTheta * radius;
    var spatialZ = cosTheta * radius;
    var projectedX = spatialX * cosViewAngle + spatialZ * sinViewAngle;
    var projectedDepth = (-spatialX * sinViewAngle) + (spatialZ * cosViewAngle);
    var nextTarget = target || { x: 0, depth: 0 };
    nextTarget.x = projectedX;
    nextTarget.depth = projectedDepth;
    return nextTarget;
  }

  function buildThreadPath(centerX, topY, loopHeight, radius, startAngle, sinViewAngle, cosViewAngle) {
    var segments = Math.max(72, nodes.length * 14);
    var samples = getFallbackThreadSamples(segments, startAngle);
    var d = '';

    for (var i = 0; i < samples.length; i++) {
      var sample = samples[i];
      var projected = projectOffsetFromTrig(sample.sinTheta, sample.cosTheta, radius, sinViewAngle, cosViewAngle, fallbackThreadProjection);
      var x = centerX + projected.x;
      var y = topY + sample.progress * loopHeight;
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

  function layoutFallbackRibbon(centerX, topY, loopHeight, radius, startAngle, sinViewAngle, cosViewAngle, isMobile) {
    ensureFallbackRibbon();
    moodboardRibbonHitCache = [];
    if (!fallbackRibbonSlices.length) return;

    var count = fallbackRibbonSlices.length;
    var step = count <= 1 ? 1 : 1 / (count - 1);
    var sliceWidth = isMobile ? 50 : 72;
    var sliceHeight = isMobile ? 20 : 28;

    for (var i = 0; i < count; i++) {
      var progress = count === 1 ? 0.5 : i * step;
      var theta = startAngle + progress * Math.PI * 2;
      var projected = projectOffsetFromTrig(Math.sin(theta), Math.cos(theta), radius, sinViewAngle, cosViewAngle, fallbackRibbonProjection);
      var x = centerX + projected.x;
      var y = topY + progress * loopHeight;
      var depth = Math.max(0, Math.min(1, (projected.depth / radius + 1) * 0.5));
      var tangentProgress = i < count - 1 ? Math.min(1, progress + step) : Math.max(0, progress - step);
      var tangentTheta = startAngle + tangentProgress * Math.PI * 2;
      var tangentProjected = projectOffsetFromTrig(Math.sin(tangentTheta), Math.cos(tangentTheta), radius, sinViewAngle, cosViewAngle, fallbackRibbonTangentProjection);
      var tangentX = centerX + tangentProjected.x;
      var tangentY = topY + tangentProgress * loopHeight;
      var angle = i < count - 1
        ? Math.atan2(tangentY - y, tangentX - x)
        : Math.atan2(y - tangentY, x - tangentX);
      var scale = 0.72 + depth * 0.4;
      var opacity = 0.42 + depth * 0.48;
      var slice = fallbackRibbonSlices[i];

      slice.style.setProperty('--x', x.toFixed(2) + 'px');
      slice.style.setProperty('--y', y.toFixed(2) + 'px');
      slice.style.setProperty('--angle', angle.toFixed(4) + 'rad');
      slice.style.setProperty('--scale', scale.toFixed(3));
      slice.style.setProperty('--opacity', opacity.toFixed(3));
      slice.style.setProperty('--ribbon-w', sliceWidth + 'px');
      slice.style.setProperty('--ribbon-h', sliceHeight + 'px');
      slice.style.zIndex = String(Math.round(2 + depth * 8));
      moodboardRibbonHitCache.push({
        x: x,
        y: y,
        depth: depth
      });
    }
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
    var sinViewAngle = Math.sin(viewAngle);
    var cosViewAngle = Math.cos(viewAngle);
    var cachedNodeGeometry = getFallbackNodeGeometry(total, startAngle);

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
      setElementAttribute(threadPath, 'd', buildThreadPath(centerX, topY, loopHeight, radiusX, startAngle, sinViewAngle, cosViewAngle));
    }

    layoutFallbackRibbon(centerX, topY, loopHeight, radiusX, startAngle, sinViewAngle, cosViewAngle, isMobile);

    nodes.forEach(function (node, index) {
      var cachedGeometry = cachedNodeGeometry[index];
      var projected = projectOffsetFromTrig(cachedGeometry.sinTheta, cachedGeometry.cosTheta, radiusX, sinViewAngle, cosViewAngle, fallbackNodeProjection);
      var helixX = centerX + projected.x;
      var y = topY + cachedGeometry.progress * loopHeight;
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
      var geometry = getNodeComputedGeometry(node);
      geometry.anchorX = anchorX;
      geometry.anchorY = anchorY;
      geometry.depth = depth;
      geometry.fog = fog;
      geometry.connectorDx = connectorDx;
      geometry.connectorDy = connectorDy;
      geometry.connectorLength = connectorLength;
      geometry.connectorAngle = connectorAngle;
      geometry.hitThreshold = hitThreshold;

      applyNodeHelixGeometry(node, index, rect.left, rect.top, geometry, false);
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

  function findNodeBySnapRect(clientX, clientY, pad) {
    var bestNode = null;
    var bestScore = -Infinity;
    var hitPad = typeof pad === 'number' ? pad : 0;

    nodes.forEach(function (node) {
      var rect = node.__cursorSnapRect;
      if (!rect) return;

      var left = rect.left - hitPad;
      var right = rect.left + rect.width + hitPad;
      var top = rect.top - hitPad;
      var bottom = rect.top + rect.height + hitPad;
      if (clientX < left || clientX > right || clientY < top || clientY > bottom) return;

      var centerX = rect.left + rect.width * 0.5;
      var centerY = rect.top + rect.height * 0.5;
      var normX = rect.width ? Math.abs(clientX - centerX) / rect.width : 1;
      var normY = rect.height ? Math.abs(clientY - centerY) / rect.height : 1;
      var depth = typeof node.__helixDepth === 'number' ? node.__helixDepth : 0.5;
      var score = depth * 2 - normX - normY + (node.classList.contains('is-active') ? 1 : 0);

      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    });

    return bestNode;
  }

  function updateProximity(clientX, clientY, hoveredNode) {
    if (disposed || !stage.isConnected) return;
    var stageRect = getStageRect();
    var localX = clientX - stageRect.left;
    var localY = clientY - stageRect.top;
    var nextHoverNode = hoveredNode || findNodeBySnapRect(clientX, clientY, 12);
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
      setHelixCursorSnapNode(nextHoverNode);
      targetChanged = setExclusiveProximityNode(nextHoverNode);
      if (targetChanged) ensureProximityAnimation();
      return;
    }

    exclusiveProximityNode = null;
    setHelixCursorSnapNode(null);
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
      var threshold = (hit.threshold || 140) * 0.78;
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

    return bestValue > 0.08 ? bestNode : null;
  }

  function getPointSegmentProjection(px, py, ax, ay, bx, by) {
    var dx = bx - ax;
    var dy = by - ay;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
      return {
        x: ax,
        y: ay,
        angle: 0
      };
    }

    var t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    t = clamp(t, 0, 1);
    var cx = ax + dx * t;
    var cy = ay + dy * t;
    return {
      x: cx,
      y: cy,
      angle: Math.atan2(dy, dx)
    };
  }

  function getMoodboardStripHit(clientX, clientY) {
    if (!isFinite(clientX) || !isFinite(clientY)) return null;
    var rect = getStageRect();
    var localX = clientX - rect.left;
    var localY = clientY - rect.top;
    if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return null;

    var isTouchTuned = shouldUseTouchTunedHelix();
    var sources = [];
    var validRibbonHits = moodboardRibbonHitCache.filter(function (hit) {
      return hit && isFinite(hit.x) && isFinite(hit.y);
    });
    // Bind the magnet to the front-facing arc of the inspo ribbon so the cursor hugs the
    // visible image strip rather than drifting onto the spiral / the faint back of the wrap.
    var frontRibbonHits = validRibbonHits.filter(function (hit) {
      return (hit.depth || 0) >= 0.46;
    });
    if (frontRibbonHits.length >= 2) {
      validRibbonHits = frontRibbonHits;
    }
    if (validRibbonHits.length >= 2) {
      sources.push({
        hits: validRibbonHits,
        preserveOrder: true
      });
    } else {
      var validHits = nodeHitCache.filter(function (hit) {
        return hit && isFinite(hit.x) && isFinite(hit.y);
      });
      if (validHits.length >= 2) {
        sources.push({
          hits: validHits,
          preserveOrder: false
        });
      }

      sources.push({
        hits: nodes
          .map(function (node) {
            var style = window.getComputedStyle ? window.getComputedStyle(node) : null;
            var x = style ? parseFloat(style.getPropertyValue('--x')) : NaN;
            var y = style ? parseFloat(style.getPropertyValue('--y')) : NaN;
            return isFinite(x) && isFinite(y) ? { x: x, y: y } : null;
          })
          .filter(function (hit) {
            return !!hit;
          })
          .sort(function (a, b) {
            return a.y - b.y;
          }),
        preserveOrder: true
      });
    }

    var best = null;
    var yPad = isTouchTuned ? 56 : 46;
    var tolerance = Math.max(
      isTouchTuned ? 58 : 34,
      Math.min(isTouchTuned ? 104 : 58, rect.width * (isTouchTuned ? 0.13 : 0.042))
    );

    sources.forEach(function (source) {
      var hits = source ? source.hits : null;
      if (!hits || hits.length < 2) return;
      var sorted = source.preserveOrder ? hits : hits.slice().sort(function (a, b) {
        return a.y - b.y;
      });
      var minY = Infinity;
      var maxY = -Infinity;
      for (var rangeIndex = 0; rangeIndex < sorted.length; rangeIndex++) {
        minY = Math.min(minY, sorted[rangeIndex].y);
        maxY = Math.max(maxY, sorted[rangeIndex].y);
      }
      if (localY < minY - yPad || localY > maxY + yPad) return;

      for (var i = 0; i < sorted.length - 1; i++) {
        var a = sorted[i];
        var b = sorted[i + 1];
        var projection = getPointSegmentProjection(localX, localY, a.x, a.y, b.x, b.y);
        var dx = localX - projection.x;
        var dy = localY - projection.y;
        var distSq = dx * dx + dy * dy;
        if (!best || distSq < best.distSq) {
          best = {
            distSq: distSq,
            x: projection.x,
            y: projection.y,
            angle: projection.angle
          };
        }
      }
    });

    // Extend the snappable strip straight up to the top of the stage ("through the roof")
    // so it stays a tall, easy target to click — especially for touch.
    var topHit = null;
    for (var si = 0; si < sources.length; si++) {
      var shits = sources[si] && sources[si].hits;
      if (!shits) continue;
      for (var hi = 0; hi < shits.length; hi++) {
        if (shits[hi] && (!topHit || shits[hi].y < topHit.y)) topHit = shits[hi];
      }
    }
    if (topHit) {
      var colProj = getPointSegmentProjection(localX, localY, topHit.x, topHit.y, topHit.x, 0);
      var cdx = localX - colProj.x;
      var cdy = localY - colProj.y;
      var cDistSq = cdx * cdx + cdy * cdy;
      if (!best || cDistSq < best.distSq) {
        best = { distSq: cDistSq, x: colProj.x, y: colProj.y, angle: colProj.angle };
      }
    }

    if (!best || best.distSq > tolerance * tolerance) return null;

    var snapWidth = isTouchTuned ? 118 : 78;
    var snapHeight = isTouchTuned ? 50 : 34;
    return {
      localX: best.x,
      localY: best.y,
      angle: best.angle,
      snapWidth: snapWidth,
      snapHeight: snapHeight,
      snapRect: {
        left: rect.left + best.x - snapWidth * 0.5,
        top: rect.top + best.y - snapHeight * 0.5,
        width: snapWidth,
        height: snapHeight
      }
    };
  }

  function isMoodboardStripHit(clientX, clientY) {
    return !!getMoodboardStripHit(clientX, clientY);
  }

  function setMoodboardHover(active, hit) {
    var nextActive = !!active && !!moodboardStripLink;
    if (nextActive && hit) {
      moodboardStripLink.__cursorSnapRect = hit.snapRect;
      stage.style.setProperty('--moodboard-snap-x', hit.localX.toFixed(2) + 'px');
      stage.style.setProperty('--moodboard-snap-y', hit.localY.toFixed(2) + 'px');
      stage.style.setProperty('--moodboard-snap-w', hit.snapWidth.toFixed(2) + 'px');
      stage.style.setProperty('--moodboard-snap-h', hit.snapHeight.toFixed(2) + 'px');
      stage.style.setProperty('--moodboard-snap-angle', hit.angle.toFixed(4) + 'rad');
    }
    if (moodboardHoverActive === nextActive && !nextActive) return;
    moodboardHoverActive = nextActive;
    helix.classList.toggle('projects-helix--moodboard-hover', nextActive);

    if (nextActive) {
      document.dispatchEvent(new CustomEvent('byl:helix-strip-cursor-snap', {
        detail: {
          target: moodboardStripLink,
          rect: moodboardStripLink.__cursorSnapRect
        }
      }));
      return;
    }

    stage.style.removeProperty('--moodboard-snap-x');
    stage.style.removeProperty('--moodboard-snap-y');
    stage.style.removeProperty('--moodboard-snap-w');
    stage.style.removeProperty('--moodboard-snap-h');
    stage.style.removeProperty('--moodboard-snap-angle');
    document.dispatchEvent(new CustomEvent('byl:helix-cursor-clear', {
      detail: {
        target: moodboardStripLink,
        source: 'moodboard-strip'
      }
    }));
  }

  function updateMoodboardHover(clientX, clientY, target) {
    if (disposed || helixNavigationInProgress) return;
    if (findNodeBySnapRect(clientX, clientY, 12)) {
      setMoodboardHover(false);
      return;
    }
    var hit = getMoodboardStripHit(clientX, clientY);
    setMoodboardHover(!!hit, hit);
  }

  function updateTouchHover(clientX, clientY, moved) {
    // The inspo ribbon renders in front of the spiral, so prefer it whenever the
    // finger is on the strip and not directly on a thumbnail's snap rect. Leading
    // with findTouchNode's generous radius (the old behavior) let a nearby — or
    // just-snapped — thumbnail mask the ribbon, which swallowed taps after swiping.
    var snapNode = findNodeBySnapRect(clientX, clientY, 12);
    var moodboardHit = !snapNode ? getMoodboardStripHit(clientX, clientY) : null;
    var nextNode = moodboardHit ? null : (snapNode || findTouchNode(clientX, clientY));
    pointerClientX = clientX;
    pointerClientY = clientY;
    pointerHoverNode = nextNode;
    touchHoverNode = nextNode;
    touchHoverMoodboard = !!moodboardHit;

    if (nextNode) {
      setMoodboardHover(false);
      var alreadyTouchSelected = selectedNode === nextNode && touchSelectedNode === nextNode;
      if (moved || !alreadyTouchSelected) {
        suppressNextCoarseClickNode = nextNode;
      } else if (suppressNextCoarseClickNode === nextNode) {
        suppressNextCoarseClickNode = null;
      }
      if (!alreadyTouchSelected) {
        touchSelectedNode = nextNode;
        activateSelection(nextNode);
      }
      return;
    }

    if (moodboardHit) {
      selectedNode = null;
      touchSelectedNode = null;
      exclusiveProximityNode = null;
      nodes.forEach(function (node) {
        setTargetProximity(node, 0);
      });
      setActiveFocusNode(null);
      setMoodboardHover(true, moodboardHit);
      ensureProximityAnimation();
      return;
    }

    setMoodboardHover(false);
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
    helix.classList.remove('projects-helix--webgl-thumbs');
    if (fallbackRibbon && fallbackRibbon.parentNode) fallbackRibbon.remove();
    fallbackRibbon = null;
    fallbackRibbonSlices = [];
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
          helix.classList.remove('projects-helix--webgl-thumbs');
          layoutHelix();
          ensureFallbackAnimation();
          setRibbonReadyState();
          setRenderMode('fallback', webglFailureReason || 'webgl unavailable');
          scheduleHelixReadyState();
        }
      });
    } else {
      ensureSvgFallbackGuides();
      helix.classList.remove('projects-helix--webgl-thumbs');
      ensureFallbackAnimation();
      setRibbonReadyState();
      setRenderMode('fallback', webglFailureReason || 'webgl unavailable');
      scheduleHelixReadyState();
    }
  }

  if (moodboardStripLink) {
    moodboardStripClickHandler = function (evt) {
      if (evt) {
        evt.stopPropagation();
        if (typeof evt.stopImmediatePropagation === 'function') evt.stopImmediatePropagation();
      }
      beginMoodboardRewindNavigation(evt);
    };
    moodboardStripMouseEnterHandler = function () {
      setMoodboardHover(true);
    };
    moodboardStripMouseMoveHandler = function () {
      setMoodboardHover(true);
    };
    moodboardStripMouseLeaveHandler = function () {
      setMoodboardHover(false);
    };
    moodboardStripLink.addEventListener('click', moodboardStripClickHandler);
    moodboardStripLink.addEventListener('mouseenter', moodboardStripMouseEnterHandler);
    moodboardStripLink.addEventListener('mousemove', moodboardStripMouseMoveHandler, { passive: true });
    moodboardStripLink.addEventListener('mouseleave', moodboardStripMouseLeaveHandler);
  }

  var nodeHandlers = [];
  nodes.forEach(function (node) {
    var onMouseEnter = function (evt) {
      noteFinePointerInput(evt);
      if (disposed || isCoarsePointer()) return;
      pointerClientX = evt.clientX;
      pointerClientY = evt.clientY;
      pointerHoverNode = node;
      setTargetProximity(node, 1);
      ensureProximityAnimation();
    };
    var onMouseLeave = function (evt) {
      noteFinePointerInput(evt);
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
      if (isMoodboardStripHit(evt.clientX, evt.clientY) && findNodeBySnapRect(evt.clientX, evt.clientY, 4) !== node) {
        evt.preventDefault();
        beginMoodboardRewindNavigation(evt);
        return;
      }
      if (isTouchNavigationClick() || helix.classList.contains('projects-helix--webgl-thumbs')) {
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

  function runPointerInputFrame() {
    var mode = pointerFrameMode;
    var moved = pointerFrameMoved;
    var target = pointerEventTarget;
    pointerFrame = null;
    pointerFrameMode = '';
    pointerFrameMoved = false;
    pointerEventTarget = null;

    if (disposed) return;

    if (mode === 'touch') {
      updateTouchHover(pointerClientX, pointerClientY, moved);
      return;
    }

    selectedNode = null;
    touchSelectedNode = null;
    if (target !== lastPointerEventTarget) {
      lastPointerEventTarget = target || null;
      lastPointerEventHoverNode = target && target.closest ? target.closest('.projects-helix__node') : null;
    }
    if (moodboardHoverActive && !findNodeBySnapRect(pointerClientX, pointerClientY, 12)) {
      lastPointerEventHoverNode = null;
    }
    pointerHoverNode = lastPointerEventHoverNode;
    updateProximity(pointerClientX, pointerClientY, pointerHoverNode);
  }

  function schedulePointerInputFrame(mode, target, moved) {
    pointerFrameMode = mode;
    pointerEventTarget = target || null;
    if (mode === 'touch') pointerFrameMoved = !!moved;
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(runPointerInputFrame);
  }

  function handleStageMouseMove(evt) {
    if (disposed) return;
    noteFinePointerInput(evt);
    if (isCoarsePointer()) return;
    pointerClientX = evt.clientX;
    pointerClientY = evt.clientY;
    updateMoodboardHover(evt.clientX, evt.clientY, evt.target);
    schedulePointerInputFrame('mouse', evt.target, false);
  }

  function handleStageMouseLeave() {
    if (disposed) return;
    if (pointerFrame) {
      cancelAnimationFrame(pointerFrame);
      pointerFrame = null;
    }
    pointerHoverNode = null;
    pointerFrameMode = '';
    pointerFrameMoved = false;
    pointerEventTarget = null;
    lastPointerEventTarget = null;
    lastPointerEventHoverNode = null;
    setMoodboardHover(false);
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
    suppressNextMoodboardClick = false;
    touchHoverMoodboard = false;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchInteractionMoved = false;
    pointerClientX = touch.clientX;
    pointerClientY = touch.clientY;
    schedulePointerInputFrame('touch', null, false);
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
    pointerClientX = touch.clientX;
    pointerClientY = touch.clientY;
    schedulePointerInputFrame('touch', null, touchInteractionMoved);
  }

  function handleStageTouchEnd(evt) {
    if (disposed || !hasTouchInput) return;
    lastTouchInteractionTime = Date.now();
    // Lifting off on the ribbon must always reach the click handler that opens the
    // moodboard — never get suppressed as a drag that happened to end near a thumbnail.
    if (!helixNavigationInProgress && getMoodboardStripHit(pointerClientX, pointerClientY)) {
      touchInteractionMoved = false;
      suppressNextCoarseClickNode = null;
      suppressNextMoodboardClick = false;
      return;
    }
    if (touchInteractionMoved && touchHoverNode) {
      suppressNextCoarseClickNode = touchHoverNode;
    }
    if (touchInteractionMoved && !touchHoverNode && !touchHoverMoodboard) {
      suppressNextMoodboardClick = true;
    }
    if (suppressNextCoarseClickNode && evt && evt.cancelable) {
      evt.preventDefault();
    }
    touchInteractionMoved = false;
  }

  function handleStageClick(evt) {
    if (disposed || helixNavigationInProgress || !evt) return;
    if (evt.defaultPrevented) return;
    var targetNode = evt.target && evt.target.closest ? evt.target.closest('.projects-helix__node') : null;
    var snapRectNode = findNodeBySnapRect(evt.clientX, evt.clientY, 16);
    if (evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.altKey || evt.button === 1) return;
    if (suppressNextMoodboardClick) {
      suppressNextMoodboardClick = false;
      return;
    }
    // The ribbon sits in front of the spiral: a tap on it opens the moodboard even
    // when a snapped/selected thumbnail's hit area overlaps the strip. That overlap
    // used to shadow the ribbon and drop the tap on touch after swiping/snapping.
    if (isMoodboardStripHit(evt.clientX, evt.clientY)) {
      evt.preventDefault();
      beginMoodboardRewindNavigation(evt);
      return;
    }
    if (targetNode && snapRectNode === targetNode) return;

    var nextNode = snapRectNode;

    if (!nextNode) {
      nextNode = findTouchNode(evt.clientX, evt.clientY);
    }
    if (!nextNode) {
      return;
    }

    evt.preventDefault();
    if (
      (isTouchNavigationClick() || helix.classList.contains('projects-helix--webgl-thumbs')) &&
      selectedNode !== nextNode
    ) {
      touchSelectedNode = nextNode;
      suppressNextCoarseClickNode = nextNode;
      activateSelection(nextNode);
      return;
    }

    beginHelixThumbNavigation(nextNode, evt);
  }

  stage.addEventListener('mousemove', handleStageMouseMove, { passive: true });
  stage.addEventListener('mouseleave', handleStageMouseLeave);
  stage.addEventListener('touchstart', handleStageTouchStart, { passive: true });
  stage.addEventListener('touchmove', handleStageTouchMove, { passive: false });
  stage.addEventListener('touchend', handleStageTouchEnd, { passive: false });
  stage.addEventListener('touchcancel', handleStageTouchEnd, { passive: true });
  stage.addEventListener('click', handleStageClick);
  window.addEventListener('resize', handleResize);
  window.addEventListener('scroll', handleScroll, { passive: true });
  document.addEventListener('visibilitychange', handleVisibilityChange);

  function cleanupAtlas() {
    if (disposed) return;
    disposed = true;
    if (moodboardHoverActive && moodboardStripLink) {
      document.dispatchEvent(new CustomEvent('byl:helix-cursor-clear', {
        detail: {
          target: moodboardStripLink,
          source: 'moodboard-strip'
        }
      }));
    }
    stage.style.removeProperty('--moodboard-snap-x');
    stage.style.removeProperty('--moodboard-snap-y');
    stage.style.removeProperty('--moodboard-snap-w');
    stage.style.removeProperty('--moodboard-snap-h');
    stage.style.removeProperty('--moodboard-snap-angle');
    stage.style.removeProperty('--moodboard-node-shrink');
    stage.style.removeProperty('--moodboard-node-fade');
    moodboardHoverActive = false;
    helix.classList.remove('projects-helix--is-ready');
    helix.classList.remove('projects-helix--is-entering');
    helix.classList.remove('projects-helix--webgl-thumbs');
    helix.classList.remove('projects-helix--moodboard-hover');
    helix.classList.remove('projects-helix--moodboard-rewinding');

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
    stage.removeEventListener('click', handleStageClick);
    if (moodboardStripLink && moodboardStripClickHandler) {
      moodboardStripLink.removeEventListener('click', moodboardStripClickHandler);
    }
    if (moodboardStripLink && moodboardStripMouseEnterHandler) {
      moodboardStripLink.removeEventListener('mouseenter', moodboardStripMouseEnterHandler);
    }
    if (moodboardStripLink && moodboardStripMouseMoveHandler) {
      moodboardStripLink.removeEventListener('mousemove', moodboardStripMouseMoveHandler);
    }
    if (moodboardStripLink && moodboardStripMouseLeaveHandler) {
      moodboardStripLink.removeEventListener('mouseleave', moodboardStripMouseLeaveHandler);
    }

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
    if (fallbackRibbon && fallbackRibbon.parentNode) fallbackRibbon.remove();
    fallbackRibbon = null;
    fallbackRibbonSlices = [];
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

// Eden Art Museum — scroll-scrubbed spatial sequence. A tall track pins the stage; scroll
// progress drives (1) the section-plan video's currentTime, (2) the active sequence plate,
// and (3) the final garden-reveal clip-path expansion into a full-bleed "main view".
function initEdenSequence() {
  var seq = document.querySelector('[data-eden-seq]');
  if (!seq) return;
  var video = seq.querySelector('.eden-seq__video');
  var platesEl = seq.querySelector('[data-seq-plates]');
  var reveal = seq.querySelector('[data-seq-reveal]');
  var revealImg = reveal && reveal.querySelector('img');
  var bar = seq.querySelector('[data-seq-bar]');
  var cue = seq.querySelector('[data-seq-cue]');
  var track = seq.querySelector('.eden-seq__track');
  if (!video || !platesEl || !reveal || !track) return;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function clampN(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  var base = (revealImg && revealImg.getAttribute('src') || '../assets/images/eden-museum/hero.webp').replace(/hero\.(webp|jpg)(\?.*)?$/, '');

  var SEQ = [
    ['sequence/sequence-01.webp', 'Reception', 'A low hall of stone and concrete holds the reception desk, set beneath a single cut of light.'],
    ['sequence/sequence-02.webp', 'Gallery Entry', 'The gallery route begins outdoors, along a long water court lined with elevated trees.'],
    ['sequence/sequence-03.webp', 'Water Crossing', 'A platform crosses between the pools as the sequence turns downward toward the galleries.'],
    ['sequence/sequence-04.webp', 'Stone Descent', 'A darker passage uses rough stone and a luminous seam to pull movement into the earth.'],
    ['sequence/sequence-05.webp', 'Gallery', 'A gallery gathers around a sunken centre, with daylight arriving from the opening above.'],
    ['sequence/sequence-06.webp', 'Sculpture Hall', 'A taller room of the permanent gallery pairs sculpture with a stair carrying the route deeper.'],
    ['sequence/sequence-07.webp', 'Slit Passage', 'A tall, narrow aperture sharpens the contrast between enclosure and the next room.'],
    ['sequence/sequence-08.webp', 'Dark Gallery', 'A darkened gallery holds a floating island platform, its edges drawn in light.'],
    ['sequence/sequence-09.webp', 'Curved Descent', 'A curved wall softens the route while keeping the visitor moving through the permanent gallery.'],
    ['sequence/sequence-10.webp', 'Lower Gallery', 'The gallery bends again, letting the next aperture become the visitor’s guide.'],
    ['sequence/sequence-11.webp', 'Chamber', 'A sculptural room becomes a pause in the sequence before the building folds inward again.'],
    ['sequence/sequence-12.webp', 'Vertical Cut', 'A tall stone hall is crossed overhead, while a low slot of light marks the way onward.'],
    ['sequence/sequence-13.webp', 'Earth Passage', 'The permanent gallery closes in a deep stone corridor, opening toward the main garden.']
  ];

  var plates = [];
  var frag = document.createDocumentFragment();
  for (var i = 0; i < SEQ.length; i++) {
    var f = document.createElement('figure'); f.className = 'eden-seq__frame';
    var num = document.createElement('span'); num.className = 'eden-seq__num'; num.textContent = ('0' + (i + 1)).slice(-2);
    var media = document.createElement('span'); media.className = 'eden-seq__media';
    var img = document.createElement('img'); img.src = base + SEQ[i][0]; img.alt = SEQ[i][1]; img.decoding = 'async'; img.loading = i < 2 ? 'eager' : 'lazy';
    media.appendChild(img);
    var cap = document.createElement('figcaption'); cap.className = 'eden-seq__cap';
    var ct = document.createElement('span'); ct.className = 'eden-seq__cap-title'; ct.textContent = SEQ[i][1];
    var cd = document.createElement('span'); cd.className = 'eden-seq__cap-desc'; cd.textContent = SEQ[i][2];
    cap.appendChild(ct); cap.appendChild(cd);
    f.appendChild(num); f.appendChild(media); f.appendChild(cap);
    frag.appendChild(f); plates.push(f);
  }
  platesEl.appendChild(frag);
  seq.classList.add('is-scrub');

  var PLATE_END = 0.8;
  var duration = 0, ready = false, lastIdx = -1, lastSeek = -1, raf = 0, phase2 = false, primed = false;

  function onMeta() { duration = video.duration || 0; ready = duration > 0.1; if (!raf) raf = requestAnimationFrame(update); }
  video.addEventListener('loadedmetadata', onMeta);
  // Pick the device-appropriate clip; fall back to the bundled walkthrough if it is missing
  // (e.g. the new desktop/mobile mp4s have not been added yet) so the section never breaks.
  var srcFallback = video.getAttribute('data-fallback');
  var triedFallback = false;
  function loadSrc(s) { if (!s) return; ready = false; lastSeek = -1; video.setAttribute('src', s); try { video.load(); } catch (e) {} }
  video.addEventListener('error', function () {
    if (!triedFallback && srcFallback && video.getAttribute('src') !== srcFallback) { triedFallback = true; loadSrc(srcFallback); }
  });
  var wantMobile = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
  loadSrc(video.getAttribute(wantMobile ? 'data-mobile' : 'data-desktop') || srcFallback);

  function setIdx(i) {
    if (i === lastIdx) return;
    if (lastIdx >= 0 && plates[lastIdx]) plates[lastIdx].classList.remove('is-active');
    if (plates[i]) plates[i].classList.add('is-active');
    lastIdx = i;
  }
  function seek(t) {
    if (!ready || Math.abs(t - lastSeek) < 0.033) return;
    lastSeek = t;
    // Always seek by exact currentTime (frame-accurate). With the dense keyframes in the
    // re-encoded clips this decodes cheaply, and it avoids fastSeek's keyframe-snapping
    // (which looks jumpy in Firefox/Safari).
    try { video.currentTime = t; } catch (e) {}
  }
  setIdx(0);

  function update() {
    raf = 0;
    var rect = track.getBoundingClientRect();
    var range = rect.height - window.innerHeight;
    var p = range > 0 ? clampN(-rect.top / range, 0, 1) : 0;

    if (cue) cue.style.opacity = p > 0.015 ? '0' : '';
    if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';

    if (p <= PLATE_END) {
      var vp = p / PLATE_END;
      seek(vp * duration);
      setIdx(clampN(Math.floor(vp * plates.length), 0, plates.length - 1));
      if (phase2) { reveal.classList.remove('is-revealing'); reveal.classList.remove('is-captioned'); phase2 = false; }
    } else {
      seek(duration - 0.05);
      setIdx(plates.length - 1);
      var ep = clampN((p - PLATE_END) / (1 - PLATE_END), 0, 1);
      reveal.style.clipPath = 'inset(' + ((1 - ep) * 21).toFixed(2) + '% ' + ((1 - ep) * 22).toFixed(2) + '% round 2px)';
      if (revealImg) revealImg.style.transform = 'scale(' + (1.06 - ep * 0.06).toFixed(3) + ')';
      if (!phase2) { reveal.classList.add('is-revealing'); phase2 = true; }
      reveal.classList.toggle('is-captioned', ep > 0.5);
    }
  }

  function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
  function prime() { if (primed) return; primed = true; var pr = video.play(); if (pr && pr.then) pr.then(function () { video.pause(); }).catch(function () {}); }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('touchstart', prime, { passive: true, once: true });
  update();

  registerProjectPageCleanup(function () {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    window.removeEventListener('touchstart', prime);
    video.removeEventListener('loadedmetadata', onMeta);
    if (raf) cancelAnimationFrame(raf);
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
  initEdenSequence();
}

initProjectPage();

