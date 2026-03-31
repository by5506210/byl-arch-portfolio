// ============================================
// LANDING PAGE — Portal transition (no text)
// ============================================

(function () {
  var landing = document.getElementById('landing');
  if (!landing) return;

  // Skip landing if returning from a project page
  if (window.location.hash === '#portfolio') {
    landing.style.display = 'none';
    document.body.style.background = '#e8e4df';
    var site = document.getElementById('site');
    site.style.display = 'block';
    var nav = document.querySelector('#nav');
    if (nav) nav.style.opacity = '1';
    var hint = document.querySelector('#scroll-hint');
    if (hint) hint.style.opacity = '1';
    setTimeout(function () { if (typeof initSlideshow === 'function') initSlideshow(); }, 50);
    return;
  }

  document.body.style.overflow = 'hidden';

  // Portal click triggers transition
  var portal = document.getElementById('landing-portal');
  if (portal) {
    portal.addEventListener('click', function () {
      triggerTransition();
    });
  }

  function triggerTransition() {
    landing.classList.add('landing--transitioning');

    // Flash the portal bright before transitioning
    if (portal) {
      portal.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      portal.style.opacity = '1';
      portal.style.transform = 'translate(-50%, -50%) scale(2)';
    }

    setTimeout(function () {
      var site = document.getElementById('site');
      site.style.display = 'block';

      // Fade landing out
      landing.style.transition = 'opacity 0.8s cubic-bezier(0.76, 0, 0.24, 1)';
      landing.style.opacity = '0';

      setTimeout(function () {
        landing.style.display = 'none';
        document.body.style.overflow = '';
        document.body.style.background = '#e8e4df';

        var cursorEl = document.querySelector('.cursor');
        if (cursorEl) cursorEl.classList.add('cursor--dark');

        var nav = document.getElementById('nav');
        if (nav) {
          nav.style.transition = 'opacity 0.6s';
          nav.style.opacity = '1';
        }

        setTimeout(function () {
          var hint = document.getElementById('scroll-hint');
          if (hint) {
            hint.style.transition = 'opacity 0.6s';
            hint.style.opacity = '1';
          }
        }, 300);

        if (typeof initSlideshow === 'function') {
          initSlideshow();
        }
      }, 800);
    }, 300);
  }
})();
