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
      portal.classList.add('landing__portal--handoff');
    }

    document.body.style.background = '#e8e4df';
    var morph = document.createElement('div');
    morph.className = 'landing__field-morph';
    for (var i = 0; i < 15; i++) {
      var band = document.createElement('div');
      band.className = 'landing__field-band';
      band.style.transitionDelay = (Math.abs(i - 7) * 0.035) + 's';
      morph.appendChild(band);
    }
    document.body.appendChild(morph);

    var site = document.getElementById('site');
    site.style.display = 'block';
    site.classList.add('site--morphing');

    var nav = document.getElementById('nav');
    if (nav) nav.style.opacity = '0';

    requestAnimationFrame(function () {
      morph.classList.add('is-active');
      site.classList.add('site--morphing-active');
    });

    setTimeout(function () {
      var cursorEl = document.querySelector('.cursor');
      if (cursorEl) cursorEl.classList.add('cursor--dark');

      if (nav) {
        nav.style.transition = 'opacity 0.6s';
        nav.style.opacity = '1';
      }

      site.classList.remove('site--morphing');
      site.classList.remove('site--morphing-active');
      landing.style.display = 'none';
      document.body.style.overflow = '';
      document.body.style.background = '#e8e4df';

      var hint = document.getElementById('scroll-hint');
      if (hint) {
        hint.style.transition = 'opacity 0.6s';
        hint.style.opacity = '1';
      }

      if (typeof initSlideshow === 'function') {
        initSlideshow();
      }

      morph.classList.add('is-exit');
      setTimeout(function () {
        morph.remove();
      }, 500);
    }, 980);
  }

  window.triggerLandingTransition = triggerTransition;
})();
