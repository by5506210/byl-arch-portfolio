// ============================================
// PAGE TRANSITIONS - Barba.js + GSAP
// ============================================

(function () {
  if (typeof barba === 'undefined' || typeof gsap === 'undefined') return;
  var DEFAULT_PAGE_BG = '#f4f2ec';
  var PROJECTS_PAGE_BG = '#ffffff';
  var MOODBOARD_PAGE_BG = '#f4f2ec';

  function getPageBackground(namespace) {
    if (namespace === 'projects') return PROJECTS_PAGE_BG;
    if (namespace === 'moodboard') return MOODBOARD_PAGE_BG;
    if (namespace === 'blackjack') return '#080806';
    return DEFAULT_PAGE_BG;
  }

  function rememberCurrentPage() {
    var current = window.location.pathname + window.location.search + window.location.hash;
    var last = sessionStorage.getItem('bylCurrentPage');

    if (last && last !== current) {
      sessionStorage.setItem('bylPreviousPage', last);
    }

    sessionStorage.setItem('bylCurrentPage', current);
  }

  rememberCurrentPage();

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:' + DEFAULT_PAGE_BG + ';z-index:9999;pointer-events:none;opacity:0;';
  document.body.appendChild(overlay);

  var manualNavigationInProgress = false;
  var HELIX_ZOOM_KEY = 'bylHelixThumbZoom';
  var MOODBOARD_REWIND_KEY = 'bylMoodboardRewind';
  var helixZoomState = null;
  var moodboardRewindState = null;

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

  function readStoredMoodboardRewind() {
    var raw = null;
    try {
      raw = sessionStorage.getItem(MOODBOARD_REWIND_KEY);
    } catch (err) {
      return null;
    }
    if (!raw) return null;

    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      try {
        sessionStorage.removeItem(MOODBOARD_REWIND_KEY);
      } catch (removeErr) {}
      return null;
    }

    if (!parsed || !isFreshTimestamp(parsed.timestamp)) {
      try {
        sessionStorage.removeItem(MOODBOARD_REWIND_KEY);
      } catch (clearErr) {}
      return null;
    }

    return parsed;
  }

  function clearStoredMoodboardRewind() {
    try {
      sessionStorage.removeItem(MOODBOARD_REWIND_KEY);
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

  function ensureMoodboardRewindLayer(state) {
    if (!state) return null;
    if (state.layerEl && state.layerEl.parentNode) return state;

    var layer = document.createElement('div');
    layer.className = 'moodboard-rewind-layer moodboard-swirl-layer';
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.zIndex = '11980';
    layer.style.pointerEvents = 'none';
    layer.style.background = 'linear-gradient(180deg, rgba(251, 250, 247, 0.1) 0%, rgba(241, 238, 231, 0.92) 100%)';
    layer.style.transform = 'translate3d(0, 0, 0)';
    layer.style.willChange = 'transform, opacity';
    document.body.appendChild(layer);
    state.layerEl = layer;
    return state;
  }

  function clearMoodboardRewindState(stateOverride) {
    var state = stateOverride || window.bylMoodboardRewind || moodboardRewindState;
    if (state && state.layerEl && state.layerEl.parentNode) state.layerEl.remove();
    document.querySelectorAll('.moodboard-rewind-layer').forEach(function (layer) {
      if (!state || layer !== state.layerEl) layer.remove();
    });
    window.bylMoodboardRewind = null;
    clearStoredMoodboardRewind();
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

  function resolveMoodboardRewindState(nextHref) {
    var globalState = window.bylMoodboardRewind;
    if (globalState && globalState.active && isFreshTimestamp(globalState.timestamp)) {
      if (samePath(globalState.path || globalState.href, nextHref)) return globalState;
    }

    var storedState = readStoredMoodboardRewind();
    if (storedState && samePath(storedState.path || storedState.href, nextHref)) {
      return storedState;
    }

    return null;
  }

  function playHelixArrival(container, state) {
    var visualState = ensureHelixClone(state);
    if (!visualState || !visualState.cloneEl) return null;

    function waitForIncomingVisual(target) {
      return new Promise(function (resolve) {
        if (!target) {
          resolve();
          return;
        }
        var image = target.querySelector('.project-hero img, .project-gallery__image img, img');
        if (!image) {
          resolve();
          return;
        }
        if (image.complete && image.naturalWidth > 0) {
          resolve();
          return;
        }

        var settled = false;
        function done() {
          if (settled) return;
          settled = true;
          image.removeEventListener('load', done);
          image.removeEventListener('error', done);
          resolve();
        }

        image.addEventListener('load', done, { once: true });
        image.addEventListener('error', done, { once: true });
        setTimeout(done, 950);
      });
    }

    gsap.set(overlay, { opacity: 0 });
    // Keep the real project page fully opaque and static behind the zoom clone.
    // The clone is the same hero image scaled to fill the viewport, so once the
    // hero has loaded we only need to fade the clone out — it reveals an identical
    // hero underneath. Fading the page in from 0.86 over its beige background was
    // what made the page look like it flashed beige / ran a second transition.
    gsap.set(container, { opacity: 1, y: 0 });

    return waitForIncomingVisual(container).then(function () {
      return new Promise(function (resolve) {
        gsap.timeline({
          onComplete: function () {
            clearHelixZoomState(visualState);
            helixZoomState = null;
            resolve();
          }
        })
          .to(visualState.cloneEl, {
            opacity: 0,
            duration: 0.5,
            ease: 'power2.out'
          }, 0);
      });
    });
  }

  // Restart the CSS reveal animation on the moodboard items. CSS auto-plays it on a fresh
  // render (refresh/reload); on a barba SPA insert we re-trigger it explicitly so it always
  // runs. Items have base opacity:0 in CSS, so toggling `animation` never causes a flash.
  function retriggerMoodboardItems(container) {
    if (!container) return;
    var items = container.querySelectorAll('.moodboard-page__item');
    if (!items.length) return;
    for (var i = 0; i < items.length; i++) {
      items[i].style.setProperty('--i', i);
      items[i].style.animation = 'none';
    }
    void container.offsetWidth; // force reflow so the animation restarts
    for (var j = 0; j < items.length; j++) {
      items[j].style.animation = '';
    }
  }

  function playMoodboardArrival(container, state) {
    if (!container || typeof gsap === 'undefined') return null;

    // The image cascade itself is a CSS animation (see .moodboard-page__item) — here we only
    // reveal the container and clear any swirl/rewind layer left over from the spiral
    // transition (it lives on <body> and survives the barba swap, so it must be removed or it
    // covers the cascade). We also re-trigger the CSS reveal for the SPA-insert case.
    var layers = Array.prototype.slice.call(document.querySelectorAll('.moodboard-rewind-layer'));
    gsap.set(overlay, { opacity: 0 });
    gsap.set(container, { opacity: 1, y: 0 });
    retriggerMoodboardItems(container);

    return new Promise(function (resolve) {
      var done = function () {
        layers.forEach(function (el) { if (el.parentNode) el.remove(); });
        window.bylMoodboardRewind = null;
        clearStoredMoodboardRewind();
        moodboardRewindState = null;
        resolve();
      };
      if (layers.length) {
        gsap.to(layers, { opacity: 0, duration: 0.3, ease: 'power2.out', onComplete: done });
      } else {
        done();
      }
    });
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
        y: typeof opts.y === 'number' ? opts.y : -10,
        duration: opts.duration || 0.32,
        ease: 'power2.inOut'
      })
      .to(overlay, {
        opacity: 1,
        duration: opts.overlayDuration || 0.24,
        ease: 'power1.in',
        onComplete: function () {
          var shouldHardReload = href.indexOf('index.html') !== -1 || href.indexOf('aphelion-field') !== -1;
          if (!shouldHardReload && window.barba && typeof window.barba.go === 'function') {
            window.barba.go(href);
            return;
          }
          window.location.href = href;
        }
      }, '-=0.12');
  }

  window.bylNavigateWithOverlay = navigateWithOverlay;
  playInitialHelixArrivalIfNeeded();

  barba.init({
    preventRunning: true,
    prevent: function (data) {
      var href = data.href || '';
      if (href.indexOf('index.html') !== -1) return true;
      if (href.indexOf('aphelion-field') !== -1) return true;
      return false;
    },
    transitions: [{
      name: 'natural',

      leave: function (data) {
        var nextNamespace = data.next && data.next.namespace ? data.next.namespace : '';
        var nextHref = (data.next && data.next.url && (data.next.url.href || data.next.url.path)) || '';
        helixZoomState = resolveHelixZoomState(nextHref);
        moodboardRewindState = resolveMoodboardRewindState(nextHref);
        if (helixZoomState) {
          overlay.style.opacity = '0';
          return gsap.timeline()
            .to(data.current.container, {
              opacity: 0,
              duration: 0.2,
              ease: 'power1.inOut'
            });
        }
        if (moodboardRewindState) {
          overlay.style.opacity = '0';
          return gsap.timeline()
            .to(data.current.container, {
              opacity: 0,
              duration: 0.12,
              ease: 'power1.inOut'
            });
        }

        overlay.style.background = getPageBackground(nextNamespace);

        return gsap.timeline()
          .to(data.current.container, {
            opacity: 0,
            y: -10,
            duration: 0.32,
            ease: 'power2.inOut'
          })
          .to(overlay, {
            opacity: 1,
            duration: 0.2,
            ease: 'power1.in'
          }, '-=0.12');
      },

      beforeEnter: function (data) {
        var nextNamespace = data.next && data.next.namespace ? data.next.namespace : '';
        window.scrollTo(0, 0);
        document.body.style.background = getPageBackground(nextNamespace);
        window.bylProjectsHelixDeferReady = nextNamespace === 'projects';

        // Initialize page interactivity before reveal to avoid layout flashes.
        if (typeof initProjectPage === 'function') {
          initProjectPage(data && data.next ? data.next.container : null);
        }

        // Build the moodboard mind-map up front on the incoming container — the same
        // deterministic, beforeEnter path the projects helix uses — instead of leaning
        // only on the MutationObserver / after-hook timing. The tree's own ready-guard
        // makes the later observer/after calls harmless no-ops.
        if ((nextNamespace === 'moodboard' || nextNamespace === 'memory-tree') && typeof window.initMoodboardMindmap === 'function') {
          window.initMoodboardMindmap(data && data.next ? data.next.container : null);
        }
      },

      enter: function (data) {
        var nextNamespace = data.next && data.next.namespace ? data.next.namespace : '';
        var isProjectsPage = nextNamespace === 'projects';
        var isMoodboard = nextNamespace === 'moodboard';
        if (helixZoomState) {
          var helixTl = playHelixArrival(data.next.container, helixZoomState);
          if (helixTl) return helixTl;
          clearHelixZoomState();
          helixZoomState = null;
        }
        if (isMoodboard) {
          var moodboardTl = playMoodboardArrival(data.next.container, moodboardRewindState);
          if (moodboardTl) return moodboardTl;
          clearMoodboardRewindState();
          moodboardRewindState = null;
        }

        gsap.set(data.next.container, { opacity: isProjectsPage ? 1 : 0, y: 12 });

        var tl = gsap.timeline()
          .to(overlay, {
            opacity: 0,
            duration: 0.26,
            ease: 'power1.out'
          });

        if (isProjectsPage) {
          tl.call(function () {
            if (typeof window.bylReleaseProjectsHelixEntry === 'function') {
              window.bylReleaseProjectsHelixEntry();
            } else {
              window.bylProjectsHelixDeferReady = false;
              window.dispatchEvent(new CustomEvent('byl:projects-helix-release'));
            }
          }, null, '>-0.02');
        }

        return tl
          .to(data.next.container, {
            opacity: 1,
            y: 0,
            duration: 0.38,
            ease: 'power2.out'
          }, '-=0.14');
      },

      after: function () {
        // Drop any transform GSAP left on the container, so it isn't a stacking context that
        // would trap the projects spiral's z-index below the nav (that broke the ribbon bleed
        // on SPA navigation — it only worked on a full refresh).
        var afterContainer = document.querySelector('[data-barba="container"]');
        if (afterContainer && typeof gsap !== 'undefined') {
          gsap.set(afterContainer, { clearProps: 'transform' });
        }
        var oldTitle = document.querySelector('.slideshow__current-title');
        if (oldTitle) oldTitle.remove();
        var oldProgress = document.querySelector('.slideshow__progress');
        if (oldProgress) oldProgress.remove();

        setTimeout(function () {
          if (typeof initVectorField === 'function') {
            initVectorField();
          }
          if (typeof window.initMoodboardMindmap === 'function') {
            window.initMoodboardMindmap();
          }
        }, 50);

        var cursorEl = document.querySelector('.cursor');
        if (cursorEl) cursorEl.classList.add('cursor--dark');

        helixZoomState = null;
        moodboardRewindState = null;
        clearMoodboardRewindState();
        manualNavigationInProgress = false;
        rememberCurrentPage();
      }
    }]
  });

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href*="index.html"]');
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    if (link.target === '_blank') return;

    e.preventDefault();
    var href = link.getAttribute('href');
    navigateWithOverlay(href, {
      background: DEFAULT_PAGE_BG
    });
  });

  // Entering the Blackjack Room is a full page load (the link opts out of barba),
  // so dim the current page to black first — the room itself then raises the lights.
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href$="blackjack.html"]');
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    if (link.target === '_blank') return;

    e.preventDefault();
    var href = link.getAttribute('href');
    var container = document.querySelector('[data-barba="container"]') || document.body;
    overlay.style.background = '#060605';
    overlay.style.opacity = '0';
    gsap.timeline()
      .to(container, { opacity: 0, duration: 0.34, ease: 'power2.in' })
      .to(overlay, {
        opacity: 1,
        duration: 0.3,
        ease: 'power1.in',
        onComplete: function () { window.location.href = href; }
      }, '-=0.16');
  });
})();
