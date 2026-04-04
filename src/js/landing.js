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

  function buildAssemblyTargets() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    var sampleScale = width < 768 ? 0.17 : 0.2;
    var sampleCanvas = document.createElement('canvas');
    var sampleWidth = Math.max(120, Math.round(width * sampleScale));
    var sampleHeight = Math.max(90, Math.round(height * sampleScale));
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    var ctx = sampleCanvas.getContext('2d');
    var sx = sampleWidth / width;
    var sy = sampleHeight / height;

    ctx.clearRect(0, 0, sampleWidth, sampleHeight);
    ctx.fillStyle = '#e8e4df';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = Math.round(12 * sy) + 'px Inter, Arial, sans-serif';
    ctx.fillText('BYL', sampleWidth * 0.5, 18 * sy);
    ctx.font = Math.round(10 * sy) + 'px Inter, Arial, sans-serif';
    ctx.fillText('The Aphelion', 50 * sx, 18 * sy);
    ctx.fillText('Projects', sampleWidth - 120 * sx, 18 * sy);
    ctx.fillText('About', sampleWidth - 72 * sx, 18 * sy);
    ctx.fillText('Contact', sampleWidth - 26 * sx, 18 * sy);

    ctx.font = Math.round(13 * sy) + 'px Inter, Arial, sans-serif';
    ctx.fillText('01', sampleWidth * 0.5, sampleHeight * 0.43);
    ctx.font = Math.round(48 * sy) + 'px Inter, Arial, sans-serif';
    ctx.fillText('ARCHITECTURE', sampleWidth * 0.5, sampleHeight * 0.53);

    ctx.font = Math.round(11 * sy) + 'px Inter, Arial, sans-serif';
    ctx.fillText('SCROLL TO EXPLORE', sampleWidth * 0.5, sampleHeight - 22 * sy);
    ctx.fillRect(sampleWidth * 0.5 - 1, sampleHeight - 14 * sy, 2, 10 * sy);
    ctx.beginPath();
    ctx.moveTo(sampleWidth * 0.5 - 5 * sx, sampleHeight - 7 * sy);
    ctx.lineTo(sampleWidth * 0.5, sampleHeight - 2 * sy);
    ctx.lineTo(sampleWidth * 0.5 + 5 * sx, sampleHeight - 7 * sy);
    ctx.strokeStyle = '#e8e4df';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    var data = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    var targets = [];
    for (var y = 0; y < sampleHeight; y++) {
      for (var x = 0; x < sampleWidth; x++) {
        var idx = (y * sampleWidth + x) * 4 + 3;
        if (data[idx] < 40) continue;
        targets.push({
          x: ((x + 0.5) / sampleWidth) * width,
          y: ((y + 0.5) / sampleHeight) * height,
          angle: Math.PI * 0.5,
          opacity: 0.92,
          len: width < 768 ? 7 : 9,
          width: 1.2,
          priority: Math.abs(x - sampleWidth * 0.5) + Math.abs(y - sampleHeight * 0.5) * 0.75
        });
      }
    }

    return targets;
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
    var site = document.getElementById('site');
    site.style.display = 'block';
    site.classList.add('site--morphing');

    var nav = document.getElementById('nav');
    if (nav) nav.style.opacity = '0';

    if (typeof window.startVectorFieldAssemble === 'function') {
      window.startVectorFieldAssemble({
        targets: buildAssemblyTargets(),
        duration: 0.82
      });
    }

    setTimeout(function () {
      var cursorEl = document.querySelector('.cursor');
      if (cursorEl) cursorEl.classList.add('cursor--dark');

      if (typeof initSlideshow === 'function') {
        initSlideshow();
      }

      requestAnimationFrame(function () {
        site.classList.add('site--morphing-active');
        site.classList.remove('site--morphing');
      });

      if (nav) {
        nav.style.transition = 'opacity 0.6s';
        nav.style.opacity = '1';
      }

      landing.style.display = 'none';
      document.body.style.overflow = '';
      document.body.style.background = '#e8e4df';

      var hint = document.getElementById('scroll-hint');
      if (hint) {
        hint.style.transition = 'opacity 0.6s';
        hint.style.opacity = '1';
      }
    }, 980);
  }

  window.triggerLandingTransition = triggerTransition;
})();
