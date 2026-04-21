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
  var activeTransitionMode = 'default';
  var activeTransitionPoint = null;
  var lastPointerPoint = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };

  function setOverlayDefaults() {
    overlay.style.background = DEFAULT_PAGE_BG;
    overlay.style.opacity = '0';
    overlay.style.clipPath = 'none';
    overlay.style.transform = 'none';
    overlay.style.filter = 'none';
    overlay.style.mixBlendMode = 'normal';
    overlay.style.transformOrigin = '50% 50%';
  }

  function capturePointerPoint(evt) {
    if (!evt || typeof evt.clientX !== 'number' || typeof evt.clientY !== 'number') return;
    lastPointerPoint = { x: evt.clientX, y: evt.clientY };
  }

  document.addEventListener('pointerdown', capturePointerPoint, true);

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

  function isAboutOrContactPath(path) {
    return /\/pages\/(about|contact)\.html$/i.test(path || '');
  }

  function isProjectsPath(path) {
    return /\/pages\/projects\.html$/i.test(path || '');
  }

  function isBackNavigation(nextHref) {
    var prev = sessionStorage.getItem('bylPreviousPage');
    if (!prev || !nextHref) return false;
    return samePath(prev, nextHref);
  }

  function getViewportPoint() {
    return {
      x: lastPointerPoint && typeof lastPointerPoint.x === 'number' ? lastPointerPoint.x : window.innerWidth * 0.5,
      y: lastPointerPoint && typeof lastPointerPoint.y === 'number' ? lastPointerPoint.y : window.innerHeight * 0.5
    };
  }

  function getCircleCoverRadius(point) {
    var x = point.x;
    var y = point.y;
    var dx = Math.max(x, window.innerWidth - x);
    var dy = Math.max(y, window.innerHeight - y);
    return Math.ceil(Math.sqrt(dx * dx + dy * dy)) + 24;
  }

  function createPortalPulseLayer(point) {
    var layer = document.createElement('div');
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '12020';

    var ring = document.createElement('div');
    ring.style.position = 'fixed';
    ring.style.left = point.x + 'px';
    ring.style.top = point.y + 'px';
    ring.style.width = '14px';
    ring.style.height = '14px';
    ring.style.borderRadius = '999px';
    ring.style.border = '1px solid rgba(26, 26, 26, 0.42)';
    ring.style.boxShadow = '0 0 0 1px rgba(26, 26, 26, 0.06), 0 0 24px rgba(26, 26, 26, 0.14)';
    ring.style.transform = 'translate(-50%, -50%) scale(0.3)';
    ring.style.opacity = '1';
    ring.style.pointerEvents = 'none';

    layer.appendChild(ring);
    document.body.appendChild(layer);
    return { layer: layer, ring: ring };
  }

  function buildHelixThreadPath(width, height) {
    var cx = width * 0.55;
    var cy = height * 0.52;
    var startRadius = Math.max(width, height) * 0.46;
    var turns = 2.15;
    var points = 130;
    var pullX = width * 0.23;
    var pullY = -height * 0.16;
    var d = '';

    for (var i = 0; i <= points; i++) {
      var t = i / points;
      var angle = -Math.PI * 0.52 + t * turns * Math.PI * 2;
      var radius = startRadius * (1 - t * 0.9);
      var x = cx + Math.cos(angle) * radius + pullX * (1 - t);
      var y = cy + Math.sin(angle) * radius * (0.86 - t * 0.28) + pullY * (1 - t);
      d += (i === 0 ? 'M' : ' L') + x.toFixed(2) + ' ' + y.toFixed(2);
    }

    return d;
  }

  function createHelixThreadLayer() {
    var layer = document.createElement('div');
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '12010';
    layer.style.opacity = '1';

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(window.innerWidth));
    svg.setAttribute('height', String(window.innerHeight));
    svg.setAttribute('viewBox', '0 0 ' + window.innerWidth + ' ' + window.innerHeight);
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.overflow = 'visible';

    var pathValue = buildHelixThreadPath(window.innerWidth, window.innerHeight);
    var glow = document.createElementNS(ns, 'path');
    glow.setAttribute('d', pathValue);
    glow.setAttribute('fill', 'none');
    glow.setAttribute('stroke', 'rgba(26, 26, 26, 0.16)');
    glow.setAttribute('stroke-width', '4.4');
    glow.setAttribute('stroke-linecap', 'round');
    glow.style.filter = 'blur(1.2px)';

    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pathValue);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgba(26, 26, 26, 0.64)');
    path.setAttribute('stroke-width', '1.3');
    path.setAttribute('stroke-linecap', 'round');

    svg.appendChild(glow);
    svg.appendChild(path);
    layer.appendChild(svg);
    document.body.appendChild(layer);

    var len = path.getTotalLength();
    return {
      layer: layer,
      path: path,
      glow: glow,
      length: len
    };
  }

  function runHelixThreadPullLeave(container) {
    var thread = createHelixThreadLayer();
    gsap.set(thread.path, { strokeDasharray: thread.length, strokeDashoffset: thread.length, opacity: 0.92 });
    gsap.set(thread.glow, { strokeDasharray: thread.length, strokeDashoffset: thread.length, opacity: 0.58 });
    setOverlayDefaults();

    return gsap.timeline({
      onComplete: function () {
        if (thread.layer && thread.layer.parentNode) thread.layer.parentNode.removeChild(thread.layer);
      }
    })
      .to(container, {
        opacity: 0.2,
        scale: 0.965,
        duration: 0.58,
        ease: 'power2.inOut'
      }, 0)
      .to(thread.path, {
        strokeDashoffset: 0,
        duration: 0.62,
        ease: 'power2.out'
      }, 0.02)
      .to(thread.glow, {
        strokeDashoffset: 0,
        duration: 0.66,
        ease: 'power2.out'
      }, 0.06)
      .to(overlay, {
        opacity: 1,
        duration: 0.25,
        ease: 'power1.in'
      }, 0.4);
  }

  function runPortalPulseLeave(container, point) {
    var pulsePoint = point || getViewportPoint();
    var pulseLayer = createPortalPulseLayer(pulsePoint);
    var coverRadius = getCircleCoverRadius(pulsePoint);
    setOverlayDefaults();
    overlay.style.clipPath = 'circle(0px at ' + pulsePoint.x + 'px ' + pulsePoint.y + 'px)';
    overlay.style.opacity = '1';

    return gsap.timeline({
      onComplete: function () {
        if (pulseLayer.layer && pulseLayer.layer.parentNode) pulseLayer.layer.parentNode.removeChild(pulseLayer.layer);
      }
    })
      .to(container, {
        opacity: 0.26,
        scale: 0.985,
        duration: 0.3,
        ease: 'power2.inOut'
      }, 0)
      .to(overlay, {
        clipPath: 'circle(' + coverRadius + 'px at ' + pulsePoint.x + 'px ' + pulsePoint.y + 'px)',
        duration: 0.54,
        ease: 'power3.inOut'
      }, 0)
      .to(pulseLayer.ring, {
        scale: 17.5,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.out'
      }, 0.02);
  }

  function runArchitecturalWipeLeave(container) {
    setOverlayDefaults();
    overlay.style.background = 'linear-gradient(180deg, rgba(244, 242, 236, 1) 0%, rgba(244, 242, 236, 1) 48.8%, rgba(192, 185, 174, 0.9) 49.8%, rgba(244, 242, 236, 1) 51.2%, rgba(244, 242, 236, 1) 100%)';
    overlay.style.opacity = '1';
    overlay.style.transform = 'scaleY(0.025)';
    overlay.style.transformOrigin = '50% 50%';

    return gsap.timeline()
      .to(container, {
        opacity: 0.34,
        y: -8,
        duration: 0.18,
        ease: 'power1.inOut'
      }, 0)
      .to(overlay, {
        scaleY: 1,
        duration: 0.24,
        ease: 'power2.in'
      }, 0);
  }

  function runDefaultLeave(container) {
    setOverlayDefaults();
    return gsap.timeline()
      .to(container, {
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
    gsap.set(container, { opacity: 0.82, y: 10, scale: 1.01 });

    return waitForIncomingVisual(container).then(function () {
      return new Promise(function (resolve) {
        gsap.timeline({
          onComplete: function () {
            clearHelixZoomState(visualState);
            helixZoomState = null;
            resolve();
          }
        })
          .to(container, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.48,
            ease: 'power2.out'
          }, 0)
          .to(visualState.cloneEl, {
            opacity: 0,
            duration: 0.52,
            ease: 'power2.out'
          }, 0.02);
      });
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
    var mode = opts.mode || 'default';

    function completeNavigation() {
      var shouldHardReload = href.indexOf('index.html') !== -1;
      if (!shouldHardReload && window.barba && typeof window.barba.go === 'function') {
        window.barba.go(href);
        return;
      }
      window.location.href = href;
    }

    var tl;
    if (mode === 'architectural-back') {
      tl = runArchitecturalWipeLeave(target);
      tl.eventCallback('onComplete', completeNavigation);
      return;
    }

    if (mode === 'portal-pulse') {
      tl = runPortalPulseLeave(target, opts.point || getViewportPoint());
      tl.eventCallback('onComplete', completeNavigation);
      return;
    }

    setOverlayDefaults();
    overlay.style.background = opts.background || DEFAULT_PAGE_BG;

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
        onComplete: completeNavigation
      }, '-=0.1');
  }

  function resolveTransitionMode(data, nextHref) {
    var currentNs = (data.current && data.current.namespace) || '';
    var nextPath = extractPathFromHref(nextHref || '');

    helixZoomState = resolveHelixZoomState(nextHref || '');
    if (helixZoomState) return 'project-image-morph';
    if (currentNs === 'home' && isProjectsPath(nextPath)) return 'home-projects-thread';
    if (isAboutOrContactPath(nextPath)) return 'portal-pulse';
    if (isBackNavigation(nextHref || '')) return 'architectural-back';
    return 'default';
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
	        var nextHref = (data.next && data.next.url && (data.next.url.href || data.next.url.path)) || '';
	        activeTransitionPoint = getViewportPoint();
	        activeTransitionMode = resolveTransitionMode(data, nextHref);

	        if (activeTransitionMode === 'project-image-morph') {
	          setOverlayDefaults();
	          return gsap.timeline()
	            .to(data.current.container, {
	              opacity: 0,
	              duration: 0.22,
	              ease: 'power1.inOut'
	            });
	        }

	        if (activeTransitionMode === 'home-projects-thread') {
	          return runHelixThreadPullLeave(data.current.container);
	        }

	        if (activeTransitionMode === 'portal-pulse') {
	          return runPortalPulseLeave(data.current.container, activeTransitionPoint);
	        }

	        if (activeTransitionMode === 'architectural-back') {
	          return runArchitecturalWipeLeave(data.current.container);
	        }

	        return runDefaultLeave(data.current.container);
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
	        if (activeTransitionMode === 'home-projects-thread') {
	          gsap.set(data.next.container, { opacity: 0, y: 18, scale: 1.012 });
	          return gsap.timeline()
	            .to(overlay, {
	              opacity: 0,
	              duration: 0.26,
	              ease: 'power1.out'
	            })
	            .to(data.next.container, {
	              opacity: 1,
	              y: 0,
	              scale: 1,
	              duration: 0.52,
	              ease: 'power2.out'
	            }, '-=0.12');
	        }

	        if (activeTransitionMode === 'portal-pulse') {
	          gsap.set(data.next.container, { opacity: 0, y: 10, scale: 1.01 });
	          return gsap.timeline()
	            .to(data.next.container, {
	              opacity: 1,
	              y: 0,
	              scale: 1,
	              duration: 0.44,
	              ease: 'power2.out'
	            }, 0.06)
	            .to(overlay, {
	              opacity: 0,
	              duration: 0.34,
	              ease: 'power1.out'
	            }, 0);
	        }

	        if (activeTransitionMode === 'architectural-back') {
	          gsap.set(data.next.container, { opacity: 0, y: 6 });
	          return gsap.timeline()
	            .to(overlay, {
	              scaleY: 0.03,
	              opacity: 0,
	              duration: 0.22,
	              ease: 'power2.out'
	            })
	            .to(data.next.container, {
	              opacity: 1,
	              y: 0,
	              duration: 0.26,
	              ease: 'power2.out'
	            }, '-=0.12');
	        }

	        // Default
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
	        setOverlayDefaults();
	        activeTransitionMode = 'default';
	        activeTransitionPoint = null;
	        manualNavigationInProgress = false;
	        rememberCurrentPage();
	      }
    }]
  });

  // Smooth transition for links going back to index.html
  // (Barba prevents these, so we handle manually with a fade-out)
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href*="index.html"]');
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    if (link.target === '_blank') return;
    capturePointerPoint(e);

    e.preventDefault();
    var href = link.getAttribute('href');
    navigateWithOverlay(href, {
      mode: 'architectural-back'
    });
  });
})();
