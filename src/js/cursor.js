// ============================================
// CUSTOM CURSOR - iPad-style with magnetic nav
// ============================================

(function () {
  var cursorStarted = false;
  var lastBootstrapTouchTime = 0;

  function isCursorViewport() {
    return window.innerWidth >= 768;
  }

  function queryMatches(query) {
    return !!(window.matchMedia && window.matchMedia(query).matches);
  }

  function hasMouseLikePointer() {
    return queryMatches('(hover: hover) and (pointer: fine)') ||
      queryMatches('(any-hover: hover) and (any-pointer: fine)');
  }

  function startCursor() {
    if (cursorStarted || !isCursorViewport()) return;
    cursorStarted = true;
    document.body.classList.add('custom-cursor-enabled');
    window.removeEventListener('pointermove', handleMouseLikeInput);
    window.removeEventListener('mousemove', handleMouseLikeInput);
    window.removeEventListener('touchstart', noteBootstrapTouch);
    window.removeEventListener('resize', handleCursorCapabilityChange);

  var cursor = document.createElement('div');
  cursor.classList.add('cursor');
  var isLanding = document.getElementById('landing');
  var onLandingPage = isLanding && isLanding.style.display !== 'none' && window.location.hash !== '#portfolio';
  if (!onLandingPage) {
    cursor.classList.add('cursor--dark');
  }
  document.body.appendChild(cursor);

  var navPreview = document.createElement('div');
  navPreview.classList.add('nav-hover-preview');
  navPreview.setAttribute('aria-hidden', 'true');
  var navPreviewImg = document.createElement('img');
  navPreviewImg.decoding = 'async';
  navPreviewImg.loading = 'eager';
  navPreview.appendChild(navPreviewImg);
  document.body.appendChild(navPreview);

  var mouseX = -100;
  var mouseY = -100;
  var cursorX = -100;
  var cursorY = -100;
  var navPreviewX = -140;
  var navPreviewY = -160;
  var navPreviewVisible = false;
  var navPreviewAnchor = null;
  var navPreviewSrc = '';
  var lastNavPreviewTransform = '';
  var snapping = false;
  var snapTarget = null;
  var snapPadX = 0;
  var snapPadY = 0;
  var snapRadiusCap = 8;
  var snapRadiusFactor = 0.2;
  var snapActiveUntil = 0;
  var snapDirty = true;
  var snapFollowTarget = false;
  var frameRequested = false;
  var hasInlineSize = false;
  var currentState = 'default';
  var lastTransform = '';
  var lastSnapLeft = null;
  var lastSnapTop = null;
  var lastSnapWidth = null;
  var lastSnapHeight = null;
  var lastSnapRadius = null;
  var lastSnapKey = '';

  var _abs = Math.abs;
  var _min = Math.min;
  var _max = Math.max;
  var _sqrt = Math.sqrt;

  function isLandingVisible() {
    return isLanding && isLanding.style.display !== 'none' && window.location.hash !== '#portfolio';
  }

  function getAssetPath(path) {
    var prefix = window.location.pathname.indexOf('/pages/') !== -1 ? '../' : '';
    return prefix + path;
  }

  function getNavPreviewData(link) {
    if (!link) return null;
    var label = (link.textContent || '').trim().toLowerCase();
    var href = ((link.getAttribute('href') || link.href || '') + '').toLowerCase();

    if (href.indexOf('projects') !== -1 || label.indexOf('project') !== -1) {
      return {
        src: getAssetPath('assets/images/eden-museum/hero.jpg'),
        alt: 'Projects preview'
      };
    }

    if (href.indexOf('about') !== -1 || label.indexOf('about') !== -1) {
      return {
        src: getAssetPath('assets/images/profile/bryan.jpg'),
        alt: 'About preview'
      };
    }

    if (href.indexOf('contact') !== -1 || label.indexOf('contact') !== -1) {
      return {
        src: getAssetPath('assets/images/act-before-it-burns/hero.png'),
        alt: 'Contact preview',
        objectPosition: '50% 50%'
      };
    }

    return null;
  }

  function requestCursorFrame() {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(updateCursor);
  }

  function setTransform(value) {
    if (lastTransform === value) return;
    lastTransform = value;
    cursor.style.transform = value;
  }

  function snapToDevicePixel(value) {
    var ratio = Math.max(1, window.devicePixelRatio || 1);
    return Math.round(value * ratio) / ratio;
  }

  function resetSnapCache() {
    lastSnapLeft = null;
    lastSnapTop = null;
    lastSnapWidth = null;
    lastSnapHeight = null;
    lastSnapRadius = null;
  }

  function resetInlineSize() {
    if (!hasInlineSize) return;
    hasInlineSize = false;
    cursor.style.width = '';
    cursor.style.height = '';
    cursor.style.borderRadius = '';
    resetSnapCache();
  }

  function enterSnapState() {
    if (currentState !== 'snap') {
      cursor.classList.remove('cursor--hover-image');
      cursor.classList.add('cursor--snap');
      cursor.classList.toggle('cursor--dark', !isLandingVisible());
      currentState = 'snap';
    }
    cursor.classList.toggle('cursor--follow-target', snapFollowTarget);
    hideNavPreview();
  }

  function applySnapRect(rect) {
    var width = snapToDevicePixel(rect.width + snapPadX);
    var height = snapToDevicePixel(rect.height + snapPadY);
    var radius = snapToDevicePixel(_min(snapRadiusCap, height * snapRadiusFactor));
    var left = snapToDevicePixel(rect.left + rect.width * 0.5 - width * 0.5);
    var top = snapToDevicePixel(rect.top + rect.height * 0.5 - height * 0.5);

    cursorX = rect.left + rect.width * 0.5;
    cursorY = rect.top + rect.height * 0.5;

    if (
      lastSnapLeft !== null &&
      _abs(left - lastSnapLeft) < 0.1 &&
      _abs(top - lastSnapTop) < 0.1 &&
      _abs(width - lastSnapWidth) < 0.1 &&
      _abs(height - lastSnapHeight) < 0.1 &&
      _abs(radius - lastSnapRadius) < 0.1
    ) {
      return;
    }

    lastSnapLeft = left;
    lastSnapTop = top;
    lastSnapWidth = width;
    lastSnapHeight = height;
    lastSnapRadius = radius;
    hasInlineSize = true;
    cursor.style.width = width.toFixed(2) + 'px';
    cursor.style.height = height.toFixed(2) + 'px';
    cursor.style.borderRadius = radius.toFixed(2) + 'px';
    setTransform('translate3d(' + left.toFixed(2) + 'px,' + top.toFixed(2) + 'px,0)');
  }

  function getCachedSnapRect() {
    if (!snapTarget) return null;
    var rect = snapTarget.__cursorSnapRect || null;
    if (!rect && snapTarget.closest) {
      var helixNode = snapTarget.closest('.projects-helix__node');
      rect = helixNode ? helixNode.__cursorSnapRect : null;
    }
    if (!rect || rect.width < 0.5 || rect.height < 0.5) return null;
    return rect;
  }

  function updateSnapTargetRect(force) {
    if (!snapping || !snapTarget || !snapTarget.isConnected) return false;
    if (!force && !snapDirty && !snapFollowTarget) return true;
    snapDirty = false;
    var rect = getCachedSnapRect() || snapTarget.getBoundingClientRect();
    if (!rect || rect.width < 0.5 || rect.height < 0.5) return false;
    applySnapRect(rect);
    return true;
  }

  function beginSnap(targetEl, config) {
    if (!targetEl) return;

    var shouldFollowTarget = !!config.followTarget;
    var nextKey = config.padX + ':' + config.padY + ':' + config.radiusCap + ':' + config.radiusFactor + ':' + shouldFollowTarget;
    if (snapping && snapTarget === targetEl && lastSnapKey === nextKey) {
      snapDirty = true;
      snapFollowTarget = shouldFollowTarget;
      enterSnapState();
      snapActiveUntil = performance.now() + 320;
      requestCursorFrame();
      return;
    }

    snapping = true;
    snapTarget = targetEl;
    snapPadX = config.padX;
    snapPadY = config.padY;
    snapRadiusCap = config.radiusCap;
    snapRadiusFactor = config.radiusFactor;
    snapFollowTarget = shouldFollowTarget;
    snapActiveUntil = performance.now() + 320;
    snapDirty = true;
    lastSnapKey = nextKey;
    resetSnapCache();
    enterSnapState();

    if (!updateSnapTargetRect(true)) {
      endSnap();
    }
    requestCursorFrame();
  }

  function endSnap() {
    snapping = false;
    snapTarget = null;
    snapFollowTarget = false;
    lastSnapKey = '';
    snapDirty = true;
    cursor.classList.remove('cursor--follow-target');
  }

  function setDefaultState() {
    endSnap();
    hideNavPreview();
    if (currentState !== 'default') {
      cursor.classList.remove('cursor--snap', 'cursor--hover-image', 'cursor--follow-target');
      cursor.classList.toggle('cursor--dark', !isLandingVisible());
      currentState = 'default';
    }
    resetInlineSize();
    requestCursorFrame();
  }

  function setHoverImageState() {
    endSnap();
    hideNavPreview();
    if (currentState !== 'hover-image') {
      cursor.classList.remove('cursor--snap', 'cursor--follow-target');
      cursor.classList.add('cursor--hover-image');
      cursor.classList.remove('cursor--dark');
      currentState = 'hover-image';
    }
    resetInlineSize();
    requestCursorFrame();
  }

  function setNavPreviewTransform(value) {
    if (lastNavPreviewTransform === value) return;
    lastNavPreviewTransform = value;
    navPreview.style.transform = value;
  }

  function getNavPreviewPosition(link) {
    if (!link || !link.isConnected) return null;

    var rect = link.getBoundingClientRect();
    if (!rect || rect.width < 0.5 || rect.height < 0.5) return null;

    var width = navPreview.offsetWidth || 112;
    var height = navPreview.offsetHeight || 140;
    var margin = 10;
    var gap = 12;
    var x = rect.left + rect.width * 0.5 - width * 0.5;
    var y = rect.bottom + gap;

    if (y + height > window.innerHeight - margin) {
      y = Math.max(margin, rect.top - height - gap);
    }

    return {
      x: x,
      y: y
    };
  }

  function setNavPreviewPositionFromLink(link) {
    var position = getNavPreviewPosition(link);
    if (!position) return false;

    navPreviewX = position.x;
    navPreviewY = position.y;
    setNavPreviewTransform('translate3d(' + navPreviewX + 'px,' + navPreviewY + 'px,0)');
    return true;
  }

  function showNavPreview(link, data) {
    if (!data || !data.src) return;
    endSnap();
    navPreviewAnchor = link || null;
    navPreviewImg.style.objectPosition = data.objectPosition || '50% 50%';
    if (navPreviewSrc !== data.src) {
      navPreviewSrc = data.src;
      navPreviewImg.style.opacity = '0';
      navPreviewImg.onload = function () {
        if (navPreviewSrc === data.src) {
          navPreviewImg.style.opacity = '1';
        }
      };
      navPreviewImg.src = data.src;
      navPreviewImg.alt = data.alt || '';
      if (navPreviewImg.complete) {
        navPreviewImg.style.opacity = '1';
      }
    } else {
      navPreviewImg.style.opacity = '1';
    }
    if (!setNavPreviewPositionFromLink(navPreviewAnchor)) {
      navPreviewAnchor = null;
      return;
    }
    navPreviewVisible = true;
    navPreview.classList.add('is-visible');
    if (currentState !== 'nav-preview') {
      cursor.classList.remove('cursor--snap', 'cursor--hover-image', 'cursor--follow-target');
      cursor.classList.toggle('cursor--dark', !isLandingVisible());
      currentState = 'nav-preview';
    }
    resetInlineSize();
    requestCursorFrame();
  }

  function hideNavPreview() {
    if (!navPreviewVisible) return;
    navPreviewVisible = false;
    navPreviewAnchor = null;
    navPreview.classList.remove('is-visible');
  }

  function updateNavPreviewPosition() {
    if (!navPreviewVisible) return false;
    if (!navPreviewAnchor || !navPreviewAnchor.isConnected) {
      hideNavPreview();
      return false;
    }

    setNavPreviewPositionFromLink(navPreviewAnchor);
    return false;
  }

  function updateCursor(now) {
    frameRequested = false;
    var keepAnimating = false;

    if (snapping) {
      var forceSnapMeasure = snapDirty || snapFollowTarget || now < snapActiveUntil;
      if (!updateSnapTargetRect(forceSnapMeasure)) {
        setDefaultState();
      } else {
        keepAnimating = snapFollowTarget || now < snapActiveUntil;
      }
    }

    if (!snapping) {
      var pullX = mouseX;
      var pullY = mouseY;
      var landingVisible = isLandingVisible();

      if (landingVisible) {
        var cx = window.innerWidth / 2;
        var cy = window.innerHeight / 2;
        var dx = cx - mouseX;
        var dy = cy - mouseY;
        var distSq = dx * dx + dy * dy;
        var pullRadius = 250;

        if (distSq < pullRadius * pullRadius && distSq > 9) {
          var dist = _sqrt(distSq);
          var strength = (1 - dist / pullRadius);
          strength = strength * strength * 0.45;
          pullX = mouseX + dx * strength;
          pullY = mouseY + dy * strength;
        }

        cursorX = pullX;
        cursorY = pullY;
      } else {
        cursorX += (pullX - cursorX) * 0.35;
        cursorY += (pullY - cursorY) * 0.35;
        keepAnimating = _abs(pullX - cursorX) > 0.15 || _abs(pullY - cursorY) > 0.15;
      }

      setTransform('translate3d(' + (cursorX - 7) + 'px,' + (cursorY - 7) + 'px,0)');
    }

    if (updateNavPreviewPosition()) {
      keepAnimating = true;
    }

    if (keepAnimating) {
      requestCursorFrame();
    }
  }

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    requestCursorFrame();
  }, { passive: true });

  function getHelixSnapTarget(node) {
    if (!node || !node.querySelector) return null;
    return node.querySelector('.projects-helix__thumb') || node;
  }

  function snapToHelixNode(node) {
    var target = getHelixSnapTarget(node);
    if (!target) return;

    beginSnap(target, {
      padX: 18,
      padY: 18,
      radiusCap: 8,
      radiusFactor: 0.06,
      followTarget: true
    });
  }

  function setMoodboardStripSnapRect(target) {
    if (!target || !target.getBoundingClientRect) return null;
    var rect = target.getBoundingClientRect();
    if (!rect || rect.width < 0.5 || rect.height < 0.5) return null;

    var width = _min(86, _max(46, rect.width * 0.34));
    var height = _max(96, rect.height - 18);
    var top = rect.top + (rect.height - height) * 0.5;
    var left = rect.left + rect.width * 0.5 - width * 0.5;
    target.__cursorSnapRect = {
      left: left,
      top: top,
      width: width,
      height: height
    };
    return target.__cursorSnapRect;
  }

  function snapToMoodboardStrip(target, rectOverride) {
    if (!target) return;
    if (rectOverride && rectOverride.width > 0.5 && rectOverride.height > 0.5) {
      // Snap as a clean circle centred on the ribbon point rather than stretching the
      // cursor across the strip (which produced the oval pill shape).
      var cx = rectOverride.left + rectOverride.width * 0.5;
      var cy = rectOverride.top + rectOverride.height * 0.5;
      var diameter = 30;
      target.__cursorSnapRect = {
        left: cx - diameter * 0.5,
        top: cy - diameter * 0.5,
        width: diameter,
        height: diameter
      };
    } else if (!setMoodboardStripSnapRect(target)) {
      return;
    }

    beginSnap(target, {
      padX: 0,
      padY: 0,
      radiusCap: 999,
      radiusFactor: 0.5,
      followTarget: true
    });
  }

  document.addEventListener('byl:helix-cursor-snap', function (e) {
    var node = e && e.detail ? e.detail.node : null;
    snapToHelixNode(node);
  });

  document.addEventListener('byl:helix-strip-cursor-snap', function (e) {
    var target = e && e.detail ? e.detail.target : null;
    var rect = e && e.detail ? e.detail.rect : null;
    snapToMoodboardStrip(target, rect);
  });

  document.addEventListener('byl:helix-cursor-clear', function (e) {
    var helixNode = snapTarget && snapTarget.closest ? snapTarget.closest('.projects-helix__node') : null;
    var moodboardStrip = snapTarget && snapTarget.closest ? snapTarget.closest('.projects-helix__moodboard-strip') : null;
    var target = e && e.detail ? e.detail.target : null;
    var source = e && e.detail ? e.detail.source : '';
    if (moodboardStrip) {
      if (target === snapTarget || source === 'moodboard-strip') setDefaultState();
      return;
    }
    if (helixNode || target === snapTarget) setDefaultState();
  });

  document.addEventListener('mouseover', function (e) {
    var target = e.target;
    if (!target || !target.closest) return;

    var navPreviewLink = target.closest('.slideshow-nav-bar__link, .project-nav-bar__link, .nav__link');
    var navPreviewData = getNavPreviewData(navPreviewLink);
    if (navPreviewData) {
      showNavPreview(navPreviewLink, navPreviewData);
      return;
    }

    var moodboardStrip = target.closest('.projects-helix__moodboard-strip');
    if (moodboardStrip) {
      snapToMoodboardStrip(moodboardStrip);
      return;
    }

    var projectCard = target.closest('.projects-index__card, .projects-atlas__node, .projects-helix__node');
    if (projectCard && !projectCard.classList.contains('projects-index__card--coming-soon')) {
      var projectSnapTarget =
        projectCard.querySelector('.projects-helix__thumb') ||
        projectCard.querySelector('.projects-atlas__node-thumb') ||
        projectCard.querySelector('.projects-index__card-img') ||
        projectCard;
      beginSnap(projectSnapTarget, {
        padX: 18,
        padY: 18,
        radiusCap: 8,
        radiusFactor: 0.06,
        followTarget: projectCard.classList.contains('projects-helix__node')
      });
      return;
    }

    var link = target.closest('a, button, .project-back');
    if (link && !target.closest('.slideshow__slide')) {
      beginSnap(link, {
        padX: 20,
        padY: 12,
        radiusCap: 7,
        radiusFactor: 0.25
      });
      return;
    }

    if (target.closest('.slideshow__slide:not(.slideshow__slide--coming-soon)')) {
      setHoverImageState();
      return;
    }

    setDefaultState();
  }, { passive: true });

  window.addEventListener('scroll', function () {
    if (navPreviewVisible) hideNavPreview();
    if (snapping) snapDirty = true;
    requestCursorFrame();
  }, { passive: true });

  window.addEventListener('resize', function () {
    if (navPreviewVisible) hideNavPreview();
    if (snapping) {
      snapDirty = true;
      snapActiveUntil = performance.now() + 220;
    }
    requestCursorFrame();
  }, { passive: true });

  var navLinks = document.querySelectorAll('.nav__link');
  navLinks.forEach(function (link) {
    var rect = null;
    var pendingX = 0;
    var pendingY = 0;
    var magnetFrame = false;

    function updateMagnet() {
      magnetFrame = false;
      if (!rect) return;
      var x = pendingX - rect.left - rect.width / 2;
      var y = pendingY - rect.top - rect.height / 2;
      link.style.transform = 'translate3d(' + x * 0.2 + 'px,' + y * 0.2 + 'px,0)';
    }

    link.addEventListener('mouseenter', function () {
      rect = link.getBoundingClientRect();
    }, { passive: true });

    link.addEventListener('mousemove', function (e) {
      if (!rect) rect = link.getBoundingClientRect();
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (!magnetFrame) {
        magnetFrame = true;
        requestAnimationFrame(updateMagnet);
      }
    }, { passive: true });

    link.addEventListener('mouseleave', function () {
      rect = null;
      link.style.transform = 'translate3d(0,0,0)';
    }, { passive: true });
  });

  document.addEventListener('mouseleave', function () {
    cursor.classList.add('cursor--hidden');
    hideNavPreview();
  });

  document.addEventListener('click', function () {
    hideNavPreview();
  });

  document.addEventListener('mouseenter', function () {
    cursor.classList.remove('cursor--hidden');
    requestCursorFrame();
  });

  }

  function handleMouseLikeInput(evt) {
    if (evt && evt.pointerType && evt.pointerType !== 'mouse' && evt.pointerType !== 'pen') return;
    if (evt && !evt.pointerType && navigator.maxTouchPoints > 0 && !hasMouseLikePointer()) {
      if (Date.now() - lastBootstrapTouchTime < 900) return;
      if (evt.movementX === 0 && evt.movementY === 0) return;
    }
    startCursor();
  }

  function noteBootstrapTouch() {
    lastBootstrapTouchTime = Date.now();
  }

  function handleCursorCapabilityChange() {
    if (hasMouseLikePointer()) {
      startCursor();
    }
  }

  if (isCursorViewport() && hasMouseLikePointer()) {
    startCursor();
  } else {
    document.body.classList.remove('custom-cursor-enabled');
    window.addEventListener('pointermove', handleMouseLikeInput, { passive: true });
    window.addEventListener('mousemove', handleMouseLikeInput, { passive: true });
    window.addEventListener('touchstart', noteBootstrapTouch, { passive: true });
    window.addEventListener('resize', handleCursorCapabilityChange, { passive: true });
  }
})();
