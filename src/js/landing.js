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

  function drawTrackedText(ctx, text, centerX, centerY, letterSpacingPx, fitWidth) {
    if (!text) return;

    if (!letterSpacingPx || Math.abs(letterSpacingPx) < 0.01) {
      if (fitWidth && fitWidth > 0) {
        var simpleWidth = ctx.measureText(text).width;
        if (simpleWidth > 0) {
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.scale(fitWidth / simpleWidth, 1);
          ctx.fillText(text, 0, 0);
          ctx.restore();
          return;
        }
      }

      ctx.fillText(text, centerX, centerY);
      return;
    }

    var chars = text.split('');
    var totalWidth = 0;
    for (var i = 0; i < chars.length; i++) {
      totalWidth += ctx.measureText(chars[i]).width;
      if (i < chars.length - 1) totalWidth += letterSpacingPx;
    }

    var trackedScale = fitWidth && fitWidth > 0 && totalWidth > 0 ? fitWidth / totalWidth : 1;
    var x = centerX - (totalWidth * trackedScale) * 0.5;
    for (var j = 0; j < chars.length; j++) {
      var ch = chars[j];
      var w = ctx.measureText(ch).width;
      ctx.save();
      ctx.translate(x + (w * trackedScale) * 0.5, centerY);
      ctx.scale(trackedScale, 1);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      x += (w + letterSpacingPx) * trackedScale;
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

    var textScale = Math.min(scaleX, scaleY);
    ctx.fillStyle = '#e8e4df';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = fontWeight + ' ' + Math.max(10, fontSize * textScale) + 'px ' + fontFamily;
    drawTrackedText(
      ctx,
      text,
      (rect.left + rect.width * 0.5) * scaleX,
      (rect.top + rect.height * 0.5) * scaleY,
      isNaN(letterSpacing) ? 0 : letterSpacing * textScale,
      rect.width * scaleX
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
    var stepX = options.stepX || options.step || 1;
    var stepY = options.stepY || options.step || 1;

    for (var y = 0; y < regionH; y += stepY) {
      for (var x = 0; x < regionW; x += stepX) {
        var idx = (y * regionW + x) * 4 + 3;
        var alpha = image[idx] / 255;
        if (alpha < (options.alphaThreshold || 0.14)) continue;

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
    var sampleScale = width < 768 ? 0.24 : 0.28;
    var sampleWidth = Math.max(120, Math.round(width * sampleScale));
    var sampleHeight = Math.max(90, Math.round(height * sampleScale));
    var scaleX = sampleWidth / width;
    var scaleY = sampleHeight / height;
    var targets = [];
    var nav = document.getElementById('nav');

    if (nav) {
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
        stepX: 1,
        stepY: 1,
        alphaThreshold: 0.16
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
          stepX: 1,
          stepY: 1,
          alphaThreshold: 0.16
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
      stepX: 1,
      stepY: 1,
      alphaThreshold: 0.12
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
      stepX: 1,
      stepY: 1,
      alphaThreshold: 0.1
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
      stepX: 1,
      stepY: 1,
      alphaThreshold: 0.12
    }));

    return targets;
  }

  function preparePortfolio() {
    if (!site) return;
    site.style.display = 'block';
    site.classList.add('site--revealing');
    site.style.setProperty('--site-handoff', '0');

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

  function shapeRevealRadius(t) {
    return Math.pow(t, 1.38);
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
      site.style.removeProperty('--site-handoff');
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

    if (nav) nav.style.opacity = '1';
    if (hint) hint.style.opacity = '1';
    if (cursorEl) cursorEl.classList.add('cursor--dark');
  }

  function triggerTransition() {
    if (isTransitioning) return;
    isTransitioning = true;

    var nav = document.getElementById('nav');
    var hint = document.getElementById('scroll-hint');
    var maxRadius = getMaxRevealRadius();
    var startTime = 0;
    var handoffStart = 0.7;
    var handoffEnd = 0.96;

    document.body.style.overflow = 'hidden';
    document.body.classList.add('portfolio-transition-active');
    landing.classList.add('landing--transitioning');

    if (portal) {
      portal.classList.add('landing__portal--handoff');
    }

    preparePortfolio();
    setRevealState(0, 0);

    if (typeof window.startVectorFieldAssemble === 'function') {
      window.startVectorFieldAssemble({
        targets: buildAssemblyTargets(),
        duration: 1.6
      });
    }

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
      var radius = maxRadius * shapeRevealRadius(eased);
      var handoffProgress = rawProgress <= handoffStart ? 0 : Math.min(1, (rawProgress - handoffStart) / Math.max(0.001, handoffEnd - handoffStart));
      var hintProgress = rawProgress <= 0.82 ? 0 : Math.min(1, (rawProgress - 0.82) / 0.14);

      setRevealState(radius, eased);

      if (site) {
        site.style.setProperty('--site-handoff', handoffProgress.toFixed(4));
      }

      if (nav) {
        nav.style.opacity = String(handoffProgress);
      }

      if (hint) {
        hint.style.opacity = String(hintProgress);
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
