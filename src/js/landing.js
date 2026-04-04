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

  function drawTrackedText(ctx, text, centerX, centerY, letterSpacingPx) {
    if (!text) return;
    if (!letterSpacingPx || Math.abs(letterSpacingPx) < 0.01) {
      ctx.fillText(text, centerX, centerY);
      return;
    }

    var chars = text.split('');
    var totalWidth = 0;
    for (var i = 0; i < chars.length; i++) {
      totalWidth += ctx.measureText(chars[i]).width;
      if (i < chars.length - 1) totalWidth += letterSpacingPx;
    }

    var x = centerX - totalWidth * 0.5;
    for (var j = 0; j < chars.length; j++) {
      var ch = chars[j];
      var w = ctx.measureText(ch).width;
      ctx.fillText(ch, x + w * 0.5, centerY);
      x += w + letterSpacingPx;
    }
  }

  function paintElementText(ctx, el, scaleX, scaleY) {
    if (!el) return;
    var rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var styles = window.getComputedStyle(el);
    var fontSize = parseFloat(styles.fontSize) || 16;
    var fontWeight = styles.fontWeight || '400';
    var fontFamily = styles.fontFamily || 'Inter, Arial, sans-serif';
    var letterSpacing = parseFloat(styles.letterSpacing);
    var text = (el.textContent || '').trim();
    if (!text) return;

    ctx.fillStyle = '#e8e4df';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = fontWeight + ' ' + Math.max(10, fontSize * scaleY) + 'px ' + fontFamily;
    drawTrackedText(
      ctx,
      text,
      (rect.left + rect.width * 0.5) * scaleX,
      (rect.top + rect.height * 0.5) * scaleY,
      isNaN(letterSpacing) ? 0 : letterSpacing * scaleX
    );
  }

  function buildAssemblyTargets() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    var sampleScale = width < 768 ? 0.16 : 0.18;
    var sampleCanvas = document.createElement('canvas');
    var sampleWidth = Math.max(120, Math.round(width * sampleScale));
    var sampleHeight = Math.max(90, Math.round(height * sampleScale));
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    var ctx = sampleCanvas.getContext('2d');
    var scaleX = sampleWidth / width;
    var scaleY = sampleHeight / height;

    ctx.clearRect(0, 0, sampleWidth, sampleHeight);
    var nav = document.getElementById('nav');
    if (nav) {
      paintElementText(ctx, nav.querySelector('.slideshow-nav-bar__back'), scaleX, scaleY);
      paintElementText(ctx, nav.querySelector('.slideshow-nav-bar__logo'), scaleX, scaleY);
      var navLinks = nav.querySelectorAll('.slideshow-nav-bar__link');
      navLinks.forEach(function (link) {
        paintElementText(ctx, link, scaleX, scaleY);
      });
    }

    var dividerLabel = document.querySelector('.slideshow__slide--divider.is-active .slideshow__divider-label') ||
      document.querySelector('.slideshow__slide--divider .slideshow__divider-label');
    var dividerTitle = document.querySelector('.slideshow__slide--divider.is-active .slideshow__divider-title') ||
      document.querySelector('.slideshow__slide--divider .slideshow__divider-title');
    paintElementText(ctx, dividerLabel, scaleX, scaleY);
    paintElementText(ctx, dividerTitle, scaleX, scaleY);

    var scrollHint = document.querySelector('#scroll-hint span');
    paintElementText(ctx, scrollHint, scaleX, scaleY);

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
          opacity: 0.96,
          len: width < 768 ? 4.6 : 5.4,
          width: 0.62,
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

    if (typeof initSlideshow === 'function') {
      initSlideshow();
    }

    if (typeof window.startVectorFieldAssemble === 'function') {
      window.startVectorFieldAssemble({
        targets: buildAssemblyTargets(),
        duration: 0.96,
        maxParticles: window.innerWidth < 768 ? 1000 : 1650
      });
    }

    setTimeout(function () {
      var cursorEl = document.querySelector('.cursor');
      if (cursorEl) cursorEl.classList.add('cursor--dark');

      requestAnimationFrame(function () {
        site.classList.add('site--morphing-active');
        site.classList.remove('site--morphing');

        requestAnimationFrame(function () {
          landing.style.display = 'none';
          document.body.style.overflow = '';
          document.body.style.background = '#0a0a0a';
        });
      });

      if (nav) {
        nav.style.transition = 'opacity 0.6s';
        nav.style.opacity = '1';
      }

      var hint = document.getElementById('scroll-hint');
      if (hint) {
        hint.style.transition = 'opacity 0.6s';
        hint.style.opacity = '1';
      }
    }, 880);
  }

  window.triggerLandingTransition = triggerTransition;
})();
