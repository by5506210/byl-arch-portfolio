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
        return gsap.from(data.next.container, {
          opacity: 0,
          duration: 0.35,
          ease: 'power2.inOut'
        });
      },

      after: function (data) {
        // Clean up old sticky title bar
        var oldBar = document.querySelector('.project-title-bar');
        if (oldBar) oldBar.remove();

        // Reinitialize project page features
        if (typeof initProjectPage === 'function') {
          initProjectPage();
        }

        // Update cursor
        var cursorEl = document.querySelector('.cursor');
        if (cursorEl) cursorEl.classList.add('cursor--dark');
      }
    }]
  });
})();
