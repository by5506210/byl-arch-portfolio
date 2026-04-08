// ============================================
// PAGE TRANSITIONS — Barba.js + GSAP
// ============================================

(function () {
  if (typeof barba === 'undefined' || typeof gsap === 'undefined') return;
  var DEFAULT_PAGE_BG = '#f4f2ec';

  function rememberCurrentPage() {
    var current = window.location.pathname + window.location.search + window.location.hash;
    var last = sessionStorage.getItem('bylCurrentPage');

    if (last && last !== current) {
      sessionStorage.setItem('bylPreviousPage', last);
    }

    sessionStorage.setItem('bylCurrentPage', current);
  }

  rememberCurrentPage();

  // Create shared overlay for seamless transitions
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:' + DEFAULT_PAGE_BG + ';z-index:9999;pointer-events:none;opacity:0;';
  document.body.appendChild(overlay);
  var manualNavigationInProgress = false;
  var HELIX_ZOOM_KEY = 'bylHelixThumbZoom';
  var helixZoomState = null;

  function extractPathFromHref(href) {
    try {
      return new URL(href, window.location.href).pathname;
    } catch (err) {
      return '';
    }
  }

  function isFreshTimestamp(timestamp) {
    var ts = Number(timestamp || 0);
    if (!ts) return false;
    return Date.now() - ts < 16000;
  }

  function samePath(a, b) {
    var pathA = extractPathFromHref(a);
    var pathB = extractPathFromHref(b);
    return !!pathA && !!pathB && pathA === pathB;
  }

  function readStoredHelixZoom() {
    var raw = null;
    try {
      raw = sessionStorage.getItem(HELIX_ZOOM_KEY);
    } catch (err) {
      return null;
    }
    if (!raw) return null;

    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      try {
        sessionStorage.removeItem(HELIX_ZOOM_KEY);
      } catch (removeErr) {}
      return null;
    }
    if (!parsed || !parsed.src || !isFreshTimestamp(parsed.timestamp)) {
      try {
        sessionStorage.removeItem(HELIX_ZOOM_KEY);
      } catch (clearErr) {}
      return null;
    }
    return parsed;
  }

  function clearStoredHelixZoom() {
    try {
      sessionStorage.removeItem(HELIX_ZOOM_KEY);
    } catch (err) {}
  }

  function ensureHelixClone(state) {
    if (!state || !state.src) return null;

    if (state.cloneEl && state.cloneEl.parentNode) {
      gsap.set(state.cloneEl, {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        borderRadius: 0,
        opacity: 1
      });
      return state;
    }

    var layer = document.createElement('div');
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.overflow = 'hidden';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '12000';

    var clone = document.createElement('img');
    clone.src = state.src;
    clone.alt = state.alt || '';
    clone.style.position = 'fixed';
    clone.style.left = '0px';
    clone.style.top = '0px';
    clone.style.width = window.innerWidth + 'px';
    clone.style.height = window.innerHeight + 'px';
    clone.style.objectFit = 'cover';
    clone.style.borderRadius = '0px';
    clone.style.zIndex = '12001';
    clone.style.pointerEvents = 'none';

    layer.appendChild(clone);
    document.body.appendChild(layer);
    state.layerEl = layer;
    state.cloneEl = clone;
    return state;
  }

  function clearHelixZoomState(stateOverride) {
    var state = stateOverride || window.bylHelixThumbZoom || helixZoomState;
    if (state && state.cloneEl && state.cloneEl.parentNode) state.cloneEl.remove();
    if (state && state.layerEl && state.layerEl.parentNode) state.layerEl.remove();
    window.bylHelixThumbZoom = null;
    clearStoredHelixZoom();
  }

  function resolveHelixZoomState(nextHref) {
    var globalState = window.bylHelixThumbZoom;
    if (globalState && globalState.active && globalState.src && isFreshTimestamp(globalState.timestamp)) {
      if (samePath(globalState.path || globalState.href, nextHref)) return globalState;
    }

    var storedState = readStoredHelixZoom();
    if (storedState && samePath(storedState.path || storedState.href, nextHref)) {
      return storedState;
    }

    return null;
  }

  function playHelixArrival(container, state) {
    var visualState = ensureHelixClone(state);
    if (!visualState || !visualState.cloneEl) return null;

    gsap.set(overlay, { opacity: 0 });
    gsap.set(container, { opacity: 1, y: 0 });

    return gsap.timeline({
      onComplete: function () {
        clearHelixZoomState(visualState);
        helixZoomState = null;
      }
    })
      .to(visualState.cloneEl, {
        opacity: 0,
        duration: 0.48,
        ease: 'power2.out'
      }, 0.08);
  }

  function playInitialHelixArrivalIfNeeded() {
    var container = document.querySelector('[data-barba="container"]');
    if (!container) return;
    var state = resolveHelixZoomState(window.location.href);
    if (!state) return;
    playHelixArrival(container, state);
  }

  function navigateWithOverlay(href, options) {
    if (!href || manualNavigationInProgress) return;
    manualNavigationInProgress = true;

    var opts = options || {};
    var target = opts.container || document.querySelector('[data-barba="container"]') || document.body;

    overlay.style.background = opts.background || DEFAULT_PAGE_BG;
    overlay.style.opacity = '0';

    gsap.timeline()
      .to(target, {
        opacity: 0,
        y: typeof opts.y === 'number' ? opts.y : -20,
        duration: opts.duration || 0.35,
        ease: 'power2.in'
      })
      .to(overlay, {
        opacity: 1,
        duration: opts.overlayDuration || 0.25,
        ease: 'power1.in',
        onComplete: function () {
          window.location.href = href;
        }
      }, '-=0.1');
  }

  window.bylNavigateWithOverlay = navigateWithOverlay;
  playInitialHelixArrivalIfNeeded();

  barba.init({
    preventRunning: true,
    // Don't intercept links back to index.html (full reload needed for landing skip)
    prevent: function (data) {
      var href = data.href || '';
      if (href.indexOf('index.html') !== -1) return true;
      return false;
    },
    transitions: [{
      name: 'wipe',

      leave: function (data) {
        helixZoomState = resolveHelixZoomState((data.next && data.next.url && (data.next.url.href || data.next.url.path)) || '');
        if (helixZoomState) {
          overlay.style.opacity = '0';
          return gsap.timeline()
            .to(data.current.container, {
              opacity: 0,
              duration: 0.22,
              ease: 'power1.inOut'
            });
        }

        overlay.style.background = DEFAULT_PAGE_BG;

        return gsap.timeline()
          .to(data.current.container, {
            opacity: 0,
            y: -20,
            duration: 0.4,
            ease: 'power2.in'
          })
          .to(overlay, {
            opacity: 1,
            duration: 0.2,
            ease: 'power1.in'
          }, '-=0.15');
      },

      enter: function (data) {
        window.scrollTo(0, 0);

        document.body.style.background = DEFAULT_PAGE_BG;

        if (helixZoomState) {
          var helixTl = playHelixArrival(data.next.container, helixZoomState);
          if (helixTl) return helixTl;
          clearHelixZoomState();
          helixZoomState = null;
        }

        // Set initial state
        gsap.set(data.next.container, { opacity: 0, y: 20 });

        return gsap.timeline()
          .to(overlay, {
            opacity: 0,
            duration: 0.3,
            ease: 'power1.out'
          })
          .to(data.next.container, {
            opacity: 1,
            y: 0,
            duration: 0.45,
            ease: 'power2.out'
          }, '-=0.2');
      },

      after: function (data) {
        // Clean up leftover elements from slideshow/project pages
        var oldBar = document.querySelector('.project-nav-bar');
        if (oldBar) oldBar.remove();
        var oldSlideBar = document.querySelector('.slideshow-nav-bar');
        if (oldSlideBar) oldSlideBar.remove();
        var oldTitle = document.querySelector('.slideshow__current-title');
        if (oldTitle) oldTitle.remove();
        var oldProgress = document.querySelector('.slideshow__progress');
        if (oldProgress) oldProgress.remove();

        // Reinitialize all page features
        if (typeof initProjectPage === 'function') {
          initProjectPage();
        }

        // Reinitialize vector field
        setTimeout(function () {
          if (typeof initVectorField === 'function') {
            initVectorField();
          }
        }, 50);

        // Update cursor
        var cursorEl = document.querySelector('.cursor');
        if (cursorEl) cursorEl.classList.add('cursor--dark');

        helixZoomState = null;
        rememberCurrentPage();
      }
    }]
  });

  // Smooth transition for links going back to index.html
  // (Barba prevents these, so we handle manually with a fade-out)
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href*="index.html"]');
    if (!link) return;

    e.preventDefault();
    var href = link.getAttribute('href');
    navigateWithOverlay(href, {
      background: DEFAULT_PAGE_BG
    });
  });
})();
