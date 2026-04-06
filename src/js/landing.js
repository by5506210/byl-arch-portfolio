// ============================================
// LANDING PAGE — Circular reveal transition
// ============================================

(function () {
  var landing = document.getElementById('landing');
  if (!landing) return;

  var site = document.getElementById('site');
  var portal = document.getElementById('landing-portal');
  var isTransitioning = false;
  var revealDuration = 1320;
  var revealHold = 110;

  function preparePortfolio() {
    if (!site) return;
    site.style.display = 'block';
    site.classList.add('site--revealing');

    if (typeof initSlideshow === 'function') {
      initSlideshow();
    }
  }

  function setRevealState(radius, progress) {
    landing.style.setProperty('--landing-reveal-x', '50%');
    landing.style.setProperty('--landing-reveal-y', '50%');
    landing.style.setProperty('--landing-reveal-radius', radius.toFixed(2) + 'px');
    landing.style.setProperty('--landing-reveal-progress', progress.toFixed(4));

    if (typeof window.setVectorFieldTransition === 'function') {
      window.setVectorFieldTransition({
        active: true,
        radius: radius,
        progress: progress
      });
    }
  }

  function clearRevealState() {
    landing.style.removeProperty('--landing-reveal-x');
    landing.style.removeProperty('--landing-reveal-y');
    landing.style.removeProperty('--landing-reveal-radius');
    landing.style.removeProperty('--landing-reveal-progress');
  }

  function getMaxRevealRadius() {
    var halfW = window.innerWidth * 0.5;
    var halfH = window.innerHeight * 0.5;
    return Math.sqrt(halfW * halfW + halfH * halfH) + 120;
  }

  function easeReveal(t) {
    var inv = 1 - t;
    return 1 - inv * inv * inv;
  }

  function finalizeTransition() {
    var nav = document.getElementById('nav');
    var hint = document.getElementById('scroll-hint');
    var cursorEl = document.querySelector('.cursor');

    landing.style.display = 'none';
    landing.classList.remove('landing--transitioning');
    clearRevealState();

    if (site) {
      site.classList.remove('site--revealing');
    }

    if (typeof window.setVectorFieldTransition === 'function') {
      window.setVectorFieldTransition({
        active: false,
        radius: 0,
        progress: 1
      });
    }

    document.body.style.overflow = '';
    document.body.style.background = '#f4f2ec';
    document.body.classList.remove('portfolio-transition-active');

    if (nav) {
      nav.style.opacity = '1';
    }

    if (hint) {
      hint.style.opacity = '1';
    }

    if (cursorEl) {
      cursorEl.classList.add('cursor--dark');
    }
  }

  function triggerTransition() {
    if (isTransitioning) return;
    isTransitioning = true;

    var nav = document.getElementById('nav');
    var hint = document.getElementById('scroll-hint');
    var maxRadius = getMaxRevealRadius();
    var startTime = 0;

    document.body.style.overflow = 'hidden';
    document.body.classList.add('portfolio-transition-active');
    landing.classList.add('landing--transitioning');

    if (portal) {
      portal.classList.add('landing__portal--handoff');
    }

    preparePortfolio();
    setRevealState(0, 0);

    if (nav) {
      nav.style.transition = 'opacity 0.45s ease';
      nav.style.opacity = '0';
    }

    if (hint) {
      hint.style.transition = 'opacity 0.45s ease';
      hint.style.opacity = '0';
    }

    function step(now) {
      if (!startTime) startTime = now;
      var rawProgress = Math.min(1, (now - startTime) / revealDuration);
      var eased = easeReveal(rawProgress);
      var radius = maxRadius * eased;

      setRevealState(radius, eased);

      if (nav) {
        nav.style.opacity = String(Math.max(0.08, Math.min(1, (eased - 0.18) / 0.46)));
      }

      if (hint) {
        hint.style.opacity = String(Math.max(0, Math.min(1, (eased - 0.46) / 0.26)));
      }

      if (rawProgress < 1) {
        requestAnimationFrame(step);
        return;
      }

      setTimeout(finalizeTransition, revealHold);
    }

    requestAnimationFrame(step);
  }

  if (window.location.hash === '#portfolio') {
    landing.style.display = 'none';
    document.body.style.background = '#f4f2ec';
    clearRevealState();

    if (site) {
      site.style.display = 'block';
      site.classList.remove('site--revealing');
    }

    var nav = document.querySelector('#nav');
    if (nav) nav.style.opacity = '1';

    var hint = document.querySelector('#scroll-hint');
    if (hint) hint.style.opacity = '1';

    setTimeout(function () {
      if (typeof initSlideshow === 'function') initSlideshow();
    }, 50);
    return;
  }

  document.body.style.overflow = 'hidden';

  if (portal) {
    portal.addEventListener('click', function () {
      triggerTransition();
    });
  }

  window.triggerLandingTransition = triggerTransition;
})();
