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

  function collectTargetsFromElement(el, scaleX, scaleY, sampleWidth, sampleHeight, options) {
    if (!el) return [];
    var rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];

    var padX = options.padX || 16;
    var padY = options.padY || 12;
    var left = Math.max(0, Math.floor(rect.left * scaleX) - padX);
    var top = Math.max(0, Math.floor(rect.top * scaleY) - padY);
    var right = Math.min(sampleWidth, Math.ceil((rect.left + rect.width) * scaleX) + padX);
    var bottom = Math.min(sampleHeight, Math.ceil((rect.top + rect.height) * scaleY) + padY);
    var regionW = Math.max(1, right - left);
    var regionH = Math.max(1, bottom - top);

    var canvas = document.createElement('canvas');
    canvas.width = regionW;
    canvas.height = regionH;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, regionW, regionH);
    ctx.save();
    ctx.translate(-left, -top);
    paintElementText(ctx, el, scaleX, scaleY);
    ctx.restore();

    var image = ctx.getImageData(0, 0, regionW, regionH).data;
    var targets = [];
    var stage = options.stage || 0;
    var opacity = options.opacity || 0.95;
    var lenMin = options.lenMin || 3.2;
    var lenMax = options.lenMax || 6.2;
    var widthMin = options.widthMin || 0.42;
    var widthMax = options.widthMax || 0.8;
    var priorityWeight = options.priorityWeight || 1;
    var step = options.step || 1;

    for (var y = 0; y < regionH; y += step) {
      for (var x = 0; x < regionW; x += step) {
        var idx = (y * regionW + x) * 4 + 3;
        var alpha = image[idx] / 255;
        if (alpha < 0.22) continue;

        var gx = left + x;
        var gy = top + y;
        var mod = ((gx * 17 + gy * 13) % 11) / 10;
        var len = lenMin + (lenMax - lenMin) * mod;
        var width = widthMin + (widthMax - widthMin) * (1 - mod * 0.85);
        var centerBias = Math.abs(gx - sampleWidth * 0.5) + Math.abs(gy - sampleHeight * 0.5) * 0.75;

        targets.push({
          x: ((gx + 0.5) / sampleWidth) * window.innerWidth,
          y: ((gy + 0.5) / sampleHeight) * window.innerHeight,
          angle: Math.PI * 0.5,
          opacity: opacity * alpha,
          len: len,
          width: width,
          stage: stage,
          priority: centerBias * priorityWeight + stage * 320
        });
      }
    }

    return targets;
  }

  function buildAssemblyTargets() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    var sampleScale = width < 768 ? 0.18 : 0.2;
    var sampleCanvas = document.createElement('canvas');
    var sampleWidth = Math.max(120, Math.round(width * sampleScale));
    var sampleHeight = Math.max(90, Math.round(height * sampleScale));
    var scaleX = sampleWidth / width;
    var scaleY = sampleHeight / height;
    var targets = [];
    var nav = document.getElementById('nav');
    if (nav) {
      targets = targets.concat(collectTargetsFromElement(nav.querySelector('.slideshow-nav-bar__back'), scaleX, scaleY, sampleWidth, sampleHeight, {
        stage: 0.08,
        lenMin: 2.2,
        lenMax: 4.2,
        widthMin: 0.28,
        widthMax: 0.56,
        opacity: 0.74,
        padX: 10,
        padY: 8,
        priorityWeight: 0.9,
        step: 2
      }));
      targets = targets.concat(collectTargetsFromElement(nav.querySelector('.slideshow-nav-bar__logo'), scaleX, scaleY, sampleWidth, sampleHeight, {
        stage: 0.12,
        lenMin: 2.4,
        lenMax: 4.8,
        widthMin: 0.32,
        widthMax: 0.6,
        opacity: 0.82,
        padX: 10,
        padY: 8,
        priorityWeight: 0.9,
        step: 2
      }));
      var navLinks = nav.querySelectorAll('.slideshow-nav-bar__link');
      Array.prototype.forEach.call(navLinks, function (link) {
        targets = targets.concat(collectTargetsFromElement(link, scaleX, scaleY, sampleWidth, sampleHeight, {
          stage: 0.18,
          lenMin: 2.1,
          lenMax: 3.9,
          widthMin: 0.26,
          widthMax: 0.5,
          opacity: 0.7,
          padX: 10,
          padY: 8,
          priorityWeight: 0.95,
          step: 2
        }));
      });
    }

    var dividerLabel = document.querySelector('.slideshow__slide--divider.is-active .slideshow__divider-label') ||
      document.querySelector('.slideshow__slide--divider .slideshow__divider-label');
    var dividerTitle = document.querySelector('.slideshow__slide--divider.is-active .slideshow__divider-title') ||
      document.querySelector('.slideshow__slide--divider .slideshow__divider-title');
    targets = targets.concat(collectTargetsFromElement(dividerLabel, scaleX, scaleY, sampleWidth, sampleHeight, {
      stage: 0.34,
      lenMin: 2.8,
      lenMax: 5.2,
      widthMin: 0.3,
      widthMax: 0.65,
      opacity: 0.86,
      padX: 12,
      padY: 10,
      priorityWeight: 0.8,
      step: 2
    }));
    targets = targets.concat(collectTargetsFromElement(dividerTitle, scaleX, scaleY, sampleWidth, sampleHeight, {
      stage: 0.48,
      lenMin: 2.6,
      lenMax: 6.1,
      widthMin: 0.26,
      widthMax: 0.72,
      opacity: 0.98,
      padX: 18,
      padY: 14,
      priorityWeight: 0.72,
      step: 1
    }));

    var scrollHint = document.querySelector('#scroll-hint span');
    targets = targets.concat(collectTargetsFromElement(scrollHint, scaleX, scaleY, sampleWidth, sampleHeight, {
      stage: 0.72,
      lenMin: 1.7,
      lenMax: 3.1,
      widthMin: 0.18,
      widthMax: 0.34,
      opacity: 0.52,
      padX: 8,
      padY: 8,
      priorityWeight: 1.15,
      step: 2
    }));

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
        duration: 1.14,
        maxParticles: window.innerWidth < 768 ? 850 : 1450
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
    }, 1020);
  }

  window.triggerLandingTransition = triggerTransition;
})();
