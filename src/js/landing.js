// ============================================
// LANDING PAGE — Portal transition
// ============================================

(function () {
  var landing = document.getElementById('landing');
  if (!landing) return;
  var isTransitioning = false;

  // Always attach "The Aphelion" back button (even if landing is skipped)
  var backBtn = document.getElementById('back-to-landing');
  if (backBtn) {
    backBtn.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = window.location.pathname;
    });
  }

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
    if (isTransitioning) return;
    isTransitioning = true;
    landing.classList.add('landing--transitioning');

    if (portal) {
      portal.style.transition = 'none';
      portal.style.opacity = '1';
    }

    var ring = document.createElement('div');
    ring.style.cssText = 'position:fixed;top:50%;left:50%;width:0;height:0;' +
      'border-radius:50%;background:#e8e4df;' +
      'transform:translate(-50%,-50%);z-index:101;' +
      'transition:width 1s cubic-bezier(0.76,0,0.24,1),height 1s cubic-bezier(0.76,0,0.24,1);';
    document.body.appendChild(ring);

    document.body.style.background = '#e8e4df';

    var diag = Math.sqrt(window.innerWidth * window.innerWidth + window.innerHeight * window.innerHeight) * 2;

    requestAnimationFrame(function () {
      ring.style.width = diag + 'px';
      ring.style.height = diag + 'px';
    });

    setTimeout(function () {
      var site = document.getElementById('site');
      site.style.display = 'block';
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

      ring.style.transition = 'opacity 0.5s ease';
      ring.style.opacity = '0';

      setTimeout(function () {
        ring.remove();

        var hint = document.getElementById('scroll-hint');
        if (hint) {
          hint.style.transition = 'opacity 0.6s';
          hint.style.opacity = '1';
        }

        if (typeof initSlideshow === 'function') {
          initSlideshow();
        }
      }, 500);
    }, 900);
  }

  window.triggerLandingTransition = triggerTransition;
})();
