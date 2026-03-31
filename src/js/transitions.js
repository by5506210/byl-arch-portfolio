// ============================================
// PAGE TRANSITIONS — Barba.js + GSAP
// ============================================

(function () {
  if (typeof barba === 'undefined' || typeof gsap === 'undefined') return;

  barba.init({
    preventRunning: true,
    // Don't intercept links back to index.html (full reload needed for landing skip)
    prevent: function (data) {
      var href = data.href || '';
      if (href.indexOf('index.html') !== -1) return true;
      return false;
    },
    transitions: [{
      name: 'fade',

      leave: function (data) {
        return gsap.to(data.current.container, {
          opacity: 0,
          duration: 0.35,
          ease: 'power2.inOut'
        });
      },

      enter: function (data) {
        window.scrollTo(0, 0);

        // Set body background to match incoming page BEFORE fade-in
        if (data.next.namespace === 'contact') {
          document.body.style.background = '#0a0a0a';
        } else {
          document.body.style.background = '#e8e4df';
        }

        return gsap.from(data.next.container, {
          opacity: 0,
          duration: 0.35,
          ease: 'power2.inOut'
        });
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

        // Reinitialize vector field — delay to let DOM settle after transition
        setTimeout(function () {
          if (typeof initVectorField === 'function') {
            initVectorField();
          }
        }, 50);

        // Update cursor
        var cursorEl = document.querySelector('.cursor');
        if (cursorEl) cursorEl.classList.add('cursor--dark');
      }
    }]
  });
})();
