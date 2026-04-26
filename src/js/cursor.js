// ============================================
// CUSTOM CURSOR - iPad-style with magnetic nav
// ============================================

(function () {
  if (window.innerWidth < 768) {
    return;
  }

  if (window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return;
  }

  var cursor = document.createElement('div');
  cursor.classList.add('cursor');
  var isLanding = document.getElementById('landing');
  var onLandingPage = isLanding && isLanding.style.display !== 'none' && window.location.hash !== '#portfolio';
  if (!onLandingPage) {
    cursor.classList.add('cursor--dark');
  }
  document.body.appendChild(cursor);

  var mouseX = -100;
  var mouseY = -100;
  var cursorX = -100;
  var cursorY = -100;
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
  var _sqrt = Math.sqrt;

  function isLandingVisible() {
    return isLanding && isLanding.style.display !== 'none' && window.location.hash !== '#portfolio';
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
  }

  function applySnapRect(rect) {
    var width = rect.width + snapPadX;
    var height = rect.height + snapPadY;
    var radius = _min(snapRadiusCap, height * snapRadiusFactor);
    var left = rect.left + rect.width * 0.5 - width * 0.5;
    var top = rect.top + rect.height * 0.5 - height * 0.5;

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
    cursor.style.width = width + 'px';
    cursor.style.height = height + 'px';
    cursor.style.borderRadius = radius + 'px';
    setTransform('translate3d(' + left + 'px,' + top + 'px,0)');
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
      enterSnapState();
      snapDirty = true;
      snapFollowTarget = shouldFollowTarget;
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
  }

  function setDefaultState() {
    endSnap();
    if (currentState !== 'default') {
      cursor.classList.remove('cursor--snap', 'cursor--hover-image');
      cursor.classList.toggle('cursor--dark', !isLandingVisible());
      currentState = 'default';
    }
    resetInlineSize();
    requestCursorFrame();
  }

  function setHoverImageState() {
    endSnap();
    if (currentState !== 'hover-image') {
      cursor.classList.remove('cursor--snap');
      cursor.classList.add('cursor--hover-image');
      cursor.classList.remove('cursor--dark');
      currentState = 'hover-image';
    }
    resetInlineSize();
    requestCursorFrame();
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

    if (keepAnimating) {
      requestCursorFrame();
    }
  }

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    requestCursorFrame();
  }, { passive: true });

  document.addEventListener('mouseover', function (e) {
    var target = e.target;
    if (!target || !target.closest) return;

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
    if (!snapping) return;
    snapDirty = true;
    requestCursorFrame();
  }, { passive: true });

  window.addEventListener('resize', function () {
    if (!snapping) return;
    snapDirty = true;
    snapActiveUntil = performance.now() + 220;
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
  });

  document.addEventListener('mouseenter', function () {
    cursor.classList.remove('cursor--hidden');
    requestCursorFrame();
  });
})();
