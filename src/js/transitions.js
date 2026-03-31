// ============================================
// PAGE TRANSITIONS — Barba.js + GSAP
// ============================================

(function () {
  // Don't init if barba is not loaded
  if (typeof barba === 'undefined' || typeof gsap === 'undefined') return;

  barba.init({
    preventRunning: true,
    transitions: [{
      name: 'fade',

      leave: function (data) {
        return gsap.to(data.current.container, {
          opacity: 0,
          duration: 0.4,
          ease: 'power2.inOut'
        });
      },

      enter: function (data) {
        // Scroll to top for the new page
        window.scrollTo(0, 0);

        return gsap.from(data.next.container, {
          opacity: 0,
          duration: 0.4,
          ease: 'power2.inOut'
        });
      },

      after: function (data) {
        // Reinitialize project page features
        if (typeof initProjectPage === 'function') {
          initProjectPage();
        }

        // Reinitialize slideshow if on index page
        if (typeof initSlideshow === 'function' &&
            data.next.namespace === 'home') {
          initSlideshow();
        }

        // Rebind magnetic nav links
        var navLinks = document.querySelectorAll('.nav__link');
        navLinks.forEach(function (link) {
          link.addEventListener('mousemove', function (e) {
            var rect = link.getBoundingClientRect();
            var x = e.clientX - rect.left - rect.width / 2;
            var y = e.clientY - rect.top - rect.height / 2;
            link.style.transform = 'translate(' + x * 0.2 + 'px, ' + y * 0.2 + 'px)';
          });
          link.addEventListener('mouseleave', function () {
            link.style.transform = 'translate(0, 0)';
          });
        });

        // Update cursor dark/light state
        var cursorEl = document.querySelector('.cursor');
        if (cursorEl) {
          if (data.next.namespace === 'home' && !window.location.hash) {
            cursorEl.classList.remove('cursor--dark');
          } else {
            cursorEl.classList.add('cursor--dark');
          }
        }

        // Clean up old sticky title bar if exists
        var oldBar = document.querySelector('.project-title-bar');
        if (oldBar) oldBar.remove();

        // Re-run init for new page
        if (typeof initProjectPage === 'function') {
          initProjectPage();
        }
      }
    }]
  });
})();
