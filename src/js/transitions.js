// ============================================
// PAGE TRANSITIONS — Barba.js + GSAP
// ============================================

(function () {
  if (typeof barba === 'undefined' || typeof gsap === 'undefined') return;

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
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#e8e4df;z-index:9999;pointer-events:none;opacity:0;';
  document.body.appendChild(overlay);
  var manualNavigationInProgress = false;

  function navigateWithOverlay(href, options) {
    if (!href || manualNavigationInProgress) return;
    manualNavigationInProgress = true;

    var opts = options || {};
    var target = opts.container || document.querySelector('[data-barba="container"]') || document.body;

    overlay.style.background = opts.background || '#e8e4df';
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
        // Match overlay to destination page background
        var nextNs = data.next.url.path || '';
        var isContactPage = nextNs.indexOf('contact') !== -1;
        overlay.style.background = isContactPage ? '#0a0a0a' : '#e8e4df';

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

        if (data.next.namespace === 'contact') {
          document.body.style.background = '#0a0a0a';
        } else {
          document.body.style.background = '#e8e4df';
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
      background: '#0a0a0a'
    });
  });
})();
