// ============================================
// VECTOR FIELD — Ocean waves with black hole
// ============================================

// Instance ID to kill old animation loops
var _vectorFieldInstanceId = 0;

// Shared mouse state (listeners added only once)
var _vfMouseX = -1000;
var _vfMouseY = -1000;
var _vfListenersAttached = false;
var _vfResizeHandler = null;
var _vfLastScrollY = 0;
var _vfLastTouchY = null;
var _vfScrollVelocity = 0;
var _vfScrollDirection = 0;
var _vfScrollKick = 0;

function _vfRegisterScroll(delta) {
  if (!delta || Math.abs(delta) < 0.5) return;
  _vfScrollVelocity += delta;
  _vfScrollDirection = delta > 0 ? 1 : -1;
  _vfScrollKick = 1;
}

function _vfAttachListeners() {
  if (_vfListenersAttached) return;
  _vfListenersAttached = true;

  document.addEventListener('mousemove', function (e) {
    _vfMouseX = e.clientX;
    _vfMouseY = e.clientY;
  });
  document.addEventListener('mouseleave', function () {
    _vfMouseX = -1000;
    _vfMouseY = -1000;
  });
  document.addEventListener('touchstart', function (e) {
    _vfMouseX = e.touches[0].clientX;
    _vfMouseY = e.touches[0].clientY;
    _vfLastTouchY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    _vfMouseX = e.touches[0].clientX;
    _vfMouseY = e.touches[0].clientY;
    if (_vfLastTouchY !== null) {
      _vfRegisterScroll((_vfLastTouchY - e.touches[0].clientY) * 0.18);
    }
    _vfLastTouchY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function () {
    _vfMouseX = -1000;
    _vfMouseY = -1000;
    _vfLastTouchY = null;
  });
  window.addEventListener('wheel', function (e) {
    _vfRegisterScroll(e.deltaY * 0.05);
  }, { passive: true });
  _vfLastScrollY = window.scrollY || window.pageYOffset || 0;
  window.addEventListener('scroll', function () {
    var scrollY = window.scrollY || window.pageYOffset || 0;
    _vfRegisterScroll((scrollY - _vfLastScrollY) * 0.6);
    _vfLastScrollY = scrollY;
  }, { passive: true });
}

function initVectorFieldCanvas() {
  var canvas = document.getElementById('vector-field');
  if (!canvas) return;
  if (canvas.getAttribute('data-field') === 'dots') return;
  canvas.setAttribute('data-renderer', 'canvas');

  var isLandingPage = !!document.getElementById('landing');
  if (isLandingPage && window.location.hash === '#portfolio') {
    canvas.style.display = 'none';
    return;
  }

  _vectorFieldInstanceId++;
  var myId = _vectorFieldInstanceId;

  if (_vfResizeHandler) {
    window.removeEventListener('resize', _vfResizeHandler);
  }

  _vfAttachListeners();

  var coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var touchCapable = coarsePointer || !!(navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lowPowerDevice = reducedMotion ||
    coarsePointer ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4);
  var ctx = canvas.getContext('2d', { alpha: true, desynchronized: coarsePointer }) ||
    canvas.getContext('2d', { alpha: true }) ||
    canvas.getContext('2d');
  var isContentPage = !isLandingPage;
  var isContactPage = isContentPage && !!document.querySelector('.contact-page');
  var dpr = 1;
  var backingScale = 1;
  var resizeFrame = null;
  var lastCanvasWidth = 0;
  var lastCanvasHeight = 0;
  var lastFieldWidth = 0;
  var lastFieldHeight = 0;
  var lastSpacing = 0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  var isDarkLines = canvas.getAttribute('data-color') === 'dark';
  var lightLineColor = '232, 228, 223';
  var darkLineColor = '26, 26, 26';
  var lineColor = isDarkLines ? darkLineColor : lightLineColor;

  var isLabPage = isContentPage && !!document.querySelector('.field-lab-page');
  var opacityScale = isContentPage
    ? (isLabPage ? 1.15 : (isContactPage ? 0.52 : 0.18))
    : 1.0;

  var isMobile = window.innerWidth < 768;

  function resolveFieldMetrics() {
    if (isContactPage) {
      return {
        spacing: isMobile ? 18 : 24,
        lineLen: isMobile ? 11 : 14,
        lineWidth: isMobile ? 1.15 : 1.35
      };
    }

    if (isContentPage) {
      if (isLabPage) {
        return {
          spacing: isMobile ? 16 : 24,
          lineLen: isMobile ? 11 : 16,
          lineWidth: isMobile ? 1.2 : 1.7
        };
      }
      return {
        spacing: isMobile ? 20 : 30,
        lineLen: 9,
        lineWidth: 0.8
      };
    }

    return {
      spacing: isMobile ? 16 : 24,
      lineLen: isMobile ? 11 : 16,
      lineWidth: isMobile ? 1.2 : 1.7
    };
  }

  var fieldMetrics = resolveFieldMetrics();
  var spacing = fieldMetrics.spacing;
  var lineLen = fieldMetrics.lineLen;
  var lineWidth = fieldMetrics.lineWidth;
  var mouseInfluence = 220;
  var returnSpeed = 0.08;
  var followSpeed = 0.25;
  var blackHoleRadius = 300;

  var centerX = 0;
  var centerY = 0;
  var fieldWidth = 0;
  var fieldHeight = 0;
  var gridCols = 0;
  var gridRows = 0;
  var maxGravityDistance = 0;
  var particles = [];
  var time = 0;
  var lastFrameTime = 0;
  var minFrameMs = resolveFrameInterval();
  var assembleState = null;
  var landingTransition = {
    active: false,
    radius: 0,
    progress: 0
  };

  // --- ENTRY AWAKENING ---
  var awakenDuration = 2.5; // seconds to fully awaken
  var startAngle = 0; // all vectors start pointing right

  var portal = isLandingPage ? document.getElementById('landing-portal') : null;
  var portalRevealDist = 178;
  var portalGlowDist = 390;
  var portalCharge = 0;
  var portalChargeDuration = 1.02;
  var portalHoldRadius = touchCapable ? (isMobile ? 104 : 124) : 96;
  var portalHoldEnabled = touchCapable || isMobile;
  var portalHoldTriggered = false;
  var contactPulseAnchor = isContactPage ? document.querySelector('.contact-page__card') : null;
  // Cached contact-pulse center (page coords); recomputed only on resize so we avoid
  // a per-frame getBoundingClientRect (forced reflow) while the cursor is active.
  var contactPulseCenter = null;
  var contactPulseDirty = true;
  var contactPulseInterval = 2.2;
  var lastContactPulseTime = -10;
  var contactPulseHoverActive = false;

  var easterEggX = 0;
  var easterEggY = 0;
  var easterEggRadius = 200;
  var easterEgg = isLandingPage ? document.getElementById('easter-egg-portal') : null;
  var easterEggVisible = false;
  var easterEggCharge = 0;
  var easterEggChargeDuration = 4;
  var easterEggHoldRadius = touchCapable ? 128 : 108;
  var easterEggHoldTriggered = false;
  var easterEggStyleCache = {};
  var portalStyleCache = {};
  var portalClassState = {};
  var portalStyleElapsed = 0;

  function setPortalVar(name, value) {
    if (!portal || portalStyleCache[name] === value) return;
    portalStyleCache[name] = value;
    portal.style.setProperty(name, value);
  }

  function setPortalClass(name, active) {
    if (!portal || portalClassState[name] === active) return;
    portalClassState[name] = active;
    portal.classList.toggle(name, active);
  }

  function setEasterEggVar(name, value) {
    if (!easterEgg || easterEggStyleCache[name] === value) return;
    easterEggStyleCache[name] = value;
    easterEgg.style.setProperty(name, value);
  }

  function openEasterEgg() {
    if (!easterEgg || easterEggHoldTriggered) return;
    easterEggHoldTriggered = true;
    easterEgg.classList.add('is-opening');
    var href = easterEgg.getAttribute('href');
    if (href) window.location.href = href;
  }

  // --- RIPPLE SYSTEM ---
  var ripples = [];
  var rippleMaxRadius = Math.max(window.innerWidth, window.innerHeight) * 0.8;
  var rippleSpeed = 280;
  var rippleCooldown = 0.35;
  var lastRippleTime = -10;
  var wasNearPortal = false;

  // --- WAKE TRAIL ---
  var wakeTrail = []; // {x, y, time}
  var wakeMaxAge = 0.8; // seconds the wake lingers
  var wakeRadius = 100;
  var wakeMaxPoints = 12;
  var lastWakeX = -1000;
  var lastWakeY = -1000;

  // --- MOBILE: gravitational current + discovery nudges ---
  var hasEverTouched = false;
  var lastInteractionTime = 0;
  var idleNudgeInterval = 3; // seconds before first idle ripple
  var lastIdleNudgeTime = -10;
  var idleNudgeCooldown = 2.5; // seconds between idle ripples
  // Gravitational pull strength (mobile only, subtle)
  var gravityStrength = isMobile && isLandingPage ? 0.25 : 0;

  canvas.style.pointerEvents = 'none';

  if (portal) {
    portal.classList.add('is-visible');
    setPortalVar('--portal-proximity', '0');
    setPortalVar('--portal-charge', '0');
    setPortalVar('--portal-presence', '0');
    setPortalVar('--portal-centered', '0');
    setPortalVar('--portal-pulse', '0');
    setPortalVar('--portal-idle', '1');
    setPortalVar('--portal-breath', '0.5');
    setPortalVar('--portal-idle-glow', '0.08');
    setPortalVar('--portal-sweep', '0deg');
    setPortalVar('--portal-sweep-soft', '0deg');
    setPortalVar('--portal-sweep-reverse', '0deg');
    setPortalVar('--portal-sweep-ring', '0deg');
  }

  if (easterEgg) {
    setEasterEggVar('--easter-charge', '0');
  }

  function applyResponsiveFieldSizing() {
    var baseMetrics = resolveFieldMetrics();
    var baseSpacing = baseMetrics.spacing;
    var baseLineLen = baseMetrics.lineLen;
    var baseLineWidth = baseMetrics.lineWidth;

    spacing = baseSpacing;
    if (!isMobile) {
      var particleBudget = isLandingPage ? 4200 : (isContactPage ? 3600 : 3000);
      var budgetSpacing = Math.sqrt((fieldWidth * fieldHeight) / particleBudget);
      if (budgetSpacing > spacing) spacing = budgetSpacing;
    }

    var spacingScale = spacing / baseSpacing;
    var visualScale = !isMobile ? Math.sqrt(spacingScale) : 1;
    lineLen = baseLineLen * _min(1.18, visualScale);
    lineWidth = baseLineWidth * _min(1.1, visualScale);
  }

  function resize() {
    var parent = canvas.parentElement;
    var nextFieldWidth = window.innerWidth;
    var nextFieldHeight = isLandingPage
      ? window.innerHeight
      : _max(window.innerHeight, parent ? parent.scrollHeight : window.innerHeight);
    var nextIsMobile = nextFieldWidth < 768;
    if (
      !nextIsMobile &&
      lastFieldHeight > 0 &&
      nextFieldWidth === lastFieldWidth &&
      Math.abs(nextFieldHeight - lastFieldHeight) <= 12
    ) {
      nextFieldHeight = lastFieldHeight;
    }

    var rawDpr = window.devicePixelRatio || 1;
    var dprCap = isContentPage
      ? (nextIsMobile ? 1.2 : 1)
      : (nextIsMobile ? 1.5 : 1);
    var nextDpr = rawDpr > dprCap ? dprCap : rawDpr;
    var nextBackingScale = nextDpr;
    if (!nextIsMobile) {
      var pixelBudget = isLandingPage ? 2073600 : 1800000;
      var scaledPixels = nextFieldWidth * nextFieldHeight * nextDpr * nextDpr;
      if (scaledPixels > pixelBudget) {
        nextBackingScale = nextDpr * Math.sqrt(pixelBudget / scaledPixels);
      }
    }

    fieldWidth = nextFieldWidth;
    fieldHeight = nextFieldHeight;
    isMobile = nextIsMobile;
    dpr = nextDpr;
    backingScale = nextBackingScale;
    applyResponsiveFieldSizing();

    var canvasWidth = Math.ceil(fieldWidth * backingScale);
    var canvasHeight = Math.ceil(fieldHeight * backingScale);
    var sizeChanged = canvasWidth !== lastCanvasWidth ||
      canvasHeight !== lastCanvasHeight ||
      fieldWidth !== lastFieldWidth ||
      fieldHeight !== lastFieldHeight;
    var gridChanged = sizeChanged || Math.abs(spacing - lastSpacing) > 0.01;

    if (sizeChanged) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = fieldWidth + 'px';
      canvas.style.height = fieldHeight + 'px';
      lastCanvasWidth = canvasWidth;
      lastCanvasHeight = canvasHeight;
      lastFieldWidth = fieldWidth;
      lastFieldHeight = fieldHeight;
    }

    ctx.setTransform(backingScale, 0, 0, backingScale, 0, 0);
    centerX = fieldWidth / 2;
    centerY = fieldHeight / 2;
    easterEggX = fieldWidth * 0.82;
    easterEggY = isLandingPage ? fieldHeight * 0.78 : window.innerHeight * 0.78;
    gravityStrength = isMobile && isLandingPage ? 0.25 : 0;
    maxGravityDistance = _max(fieldWidth, window.innerHeight) * 0.6;
    rippleMaxRadius = Math.max(fieldWidth, fieldHeight) * 0.8;
    minFrameMs = resolveFrameInterval();
    contactPulseDirty = true;

    if (gridChanged) {
      buildGrid();
      reserveStrokeBuckets(fieldBuckets, particles.length);
      reserveStrokeBuckets(fieldBucketsDark, particles.length);
      lastSpacing = spacing;
    }
  }

  function scheduleResize() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(function () {
      resizeFrame = null;
      resize();
    });
  }

  function buildGrid() {
    particles = [];
    var cols = Math.ceil(fieldWidth / spacing) + 1;
    var rows = Math.ceil(fieldHeight / spacing) + 1;
    gridCols = cols;
    gridRows = rows;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        // --- DEPTH LAYERS: 0=front, 1=mid, 2=back ---
        var layerRand = Math.random();
        var layer = layerRand < 0.6 ? 0 : (layerRand < 0.85 ? 1 : 2);
        var px = col * spacing + spacing * 0.5;
        var py = row * spacing + spacing * 0.5;
        var seed1 = Math.random() * 100;
        var seed2 = Math.random() * 100;
        var seed3 = Math.random() * 100;
        var centerDx = centerX - px;
        var centerDy = centerY - py;
        var centerDistSq = centerDx * centerDx + centerDy * centerDy;
        var centerDist = _sqrt(centerDistSq);
        var centerFalloff = maxGravityDistance > 0 ? _max(0, 1 - centerDist / maxGravityDistance) : 0;
        var centerAngle = _atan2(centerDy, centerDx);
        var blackHoleStrength = 0;
        var blackHoleCoreFade = 1;
        var easterDx = easterEggX - px;
        var easterDy = easterEggY - py;
        var easterDistSq = easterDx * easterDx + easterDy * easterDy;
        var easterDist = _sqrt(easterDistSq);
        var easterLinear = _max(0, 1 - easterDist / easterEggRadius);
        var easterStrength = easterLinear * easterLinear;
        var easterAngle = _atan2(easterDy, easterDx);
        var layerConfigEntry = layerConfig[layer];
        var baseOpacity = (0.24 + Math.random() * 0.12) * opacityScale;

        if (centerDistSq < blackHoleRadius * blackHoleRadius) {
          blackHoleStrength = _max(0, 1 - centerDist / blackHoleRadius);
          blackHoleStrength = blackHoleStrength * blackHoleStrength * blackHoleStrength;
          if (centerDist < 35) blackHoleCoreFade = centerDist / 35;
        }

        particles.push({
          x: px,
          y: py,
          currentAngle: startAngle, // start aligned for awakening
          baseOpacity: baseOpacity,
          baseOpacityLayer: baseOpacity * layerConfigEntry[0],
          seed1: seed1,
          seed2: seed2,
          seed3: seed3,
          waveX: px * 0.006,
          waveXY: px * 0.004 + py * 0.008,
          waveY: py * 0.01,
          waveFastX: px * 0.012,
          waveDiag: (px + py) * 0.003,
          seed2Wave: seed2 * 5,
          seed3Wave: seed3 * 3,
          mouseWaveSeed: seed1 * 5,
          drift: (Math.random() - 0.5) * 1.0,
          mouseRadiusOffset: (Math.random() - 0.5) * 80,
          layer: layer,
          layerOpacity: layerConfigEntry[0],
          layerWidth: layerConfigEntry[1],
          layerSpeed: layerConfigEntry[2],
          layerLen: layerConfigEntry[3],
          centerDistSq: centerDistSq,
          centerDist: centerDist,
          centerAngle: centerAngle,
          centerFalloff: centerFalloff,
          blackHoleStrength: blackHoleStrength,
          blackHoleCoreFade: blackHoleCoreFade,
          easterDistSq: easterDistSq,
          easterLinear: easterLinear,
          easterStrength: easterStrength,
          easterAngle: easterAngle
        });
      }
    }
  }

  // Depth layer config: [opacityMult, widthMult, speedMult, lenMult]
  var layerConfig = [
    [1.0,  1.0,  1.0,  1.0],   // front — full
    [0.7,  0.8,  1.0,  0.9],   // mid — visible, waves still read clearly
    [0.45, 0.6,  1.0,  0.8]    // back — softer but not invisible
  ];

  // --- PRE-CACHED CONSTANTS ---
  var PI = Math.PI;
  var TWO_PI = PI * 2;
  var _sin = Math.sin;
  var _cos = Math.cos;
  var _atan2 = Math.atan2;
  var _sqrt = Math.sqrt;
  var _abs = Math.abs;
  var _max = Math.max;
  var _min = Math.min;

  function angleDiff(from, to) {
    var d = to - from;
    while (d > PI) d -= TWO_PI;
    while (d < -PI) d += TWO_PI;
    return d;
  }

  function spawnRipple(originX, originY, maxRadiusOverride) {
    if (time - lastRippleTime < rippleCooldown) return;
    lastRippleTime = time;
    var rippleX = typeof originX === 'number' ? originX : centerX;
    var rippleY = typeof originY === 'number' ? originY : centerY;
    var rippleRadiusCap = typeof maxRadiusOverride === 'number' ? maxRadiusOverride : rippleMaxRadius;
    ripples.push({
      x: rippleX,
      y: rippleY,
      birthTime: time,
      radius: 0,
      maxRadius: rippleRadiusCap
    });
  }

  function resolveContactPulseCenter(scrollY) {
    if (!contactPulseAnchor) {
      return {
        x: centerX,
        y: (scrollY || 0) + window.innerHeight * 0.5
      };
    }
    if (contactPulseDirty || !contactPulseCenter) {
      var rect = contactPulseAnchor.getBoundingClientRect();
      var pageY = window.scrollY || window.pageYOffset || 0;
      contactPulseCenter = {
        x: rect.left + rect.width * 0.5,
        y: rect.top + pageY + rect.height * 0.5
      };
      contactPulseDirty = false;
    }
    return contactPulseCenter;
  }

  function startAssembleTransition(config) {
    if (!isLandingPage) return;
    var targets = (config && config.targets) ? config.targets.slice() : [];
    var duration = (config && config.duration) ? config.duration : 0.82;
    var maxAssembleParticles = (config && config.maxParticles) ? config.maxParticles : particles.length;
    var targetCount = _min(particles.length, maxAssembleParticles);
    function serpentineSort(a, b) {
      var rowA = (a.y / spacing) | 0;
      var rowB = (b.y / spacing) | 0;
      if (rowA !== rowB) return rowA - rowB;
      return rowA % 2 === 0 ? (a.x - b.x) : (b.x - a.x);
    }

    var spatialParticles = particles.slice().sort(serpentineSort);
    var sortedTargets = targets.sort(function (a, b) {
      var rowA = (a.y / spacing) | 0;
      var rowB = (b.y / spacing) | 0;
      if (rowA !== rowB) return rowA - rowB;
      return rowA % 2 === 0 ? (a.x - b.x) : (b.x - a.x);
    });
    var sortedParticles = spatialParticles.slice(0, targetCount);
    if (sortedParticles.length === 0 || sortedTargets.length === 0) return;
    var targetUsage = new Array(sortedTargets.length);
    for (var tu = 0; tu < sortedTargets.length; tu++) targetUsage[tu] = 0;

    for (var i = 0; i < sortedParticles.length; i++) {
      var p = sortedParticles[i];
      var targetIndex = _min(sortedTargets.length - 1, ((i + 0.5) * sortedTargets.length / sortedParticles.length) | 0);
      var target = sortedTargets[targetIndex];
      var usage = targetUsage[targetIndex]++;
      var ring = (usage / 9) | 0;
      var cell = usage % 9;
      var offsetCol = (cell % 3) - 1;
      var offsetRow = ((cell / 3) | 0) - 1;
      var offsetScale = spacing * (0.055 + ring * 0.03);
      var offsetX = offsetCol * offsetScale * 0.82;
      var offsetY = offsetRow * offsetScale * 0.46;
      var clusterFade = usage === 0 ? 1 : _max(0.1, 0.32 - ring * 0.04 - (_abs(offsetCol) + _abs(offsetRow)) * 0.035);
      p.assembleFromX = p.x;
      p.assembleFromY = p.y;
      p.assembleFromAngle = p.currentAngle;
      p.assembleToX = target.x + offsetX;
      p.assembleToY = target.y + offsetY;
      p.assembleToAngle = target.angle;
      p.assembleOpacity = _min(1, _max(0.08, target.opacity * clusterFade));
      p.assembleLen = target.len * (usage === 0 ? 1.02 : _max(0.36, 0.52 - ring * 0.035));
      p.assembleWidth = target.width * (usage === 0 ? 1 : _max(0.22, 0.34 - ring * 0.025));
      p.assembleOrder = i / _max(1, sortedParticles.length - 1);
    }

    assembleState = {
      active: true,
      startTime: time,
      duration: duration,
      staggerSpan: window.innerWidth < 768 ? 0.22 : 0.28,
      sortedParticles: sortedParticles
    };
  }

  window.startVectorFieldAssemble = startAssembleTransition;

  function setTransitionState(config) {
    if (!isLandingPage) return;
    var wasActive = landingTransition.active;

    landingTransition.active = !!(config && config.active);
    landingTransition.radius = config && typeof config.radius === 'number' ? config.radius : 0;
    landingTransition.progress = config && typeof config.progress === 'number' ? config.progress : 0;

    if (landingTransition.active && !wasActive) {
      lastRippleTime = -10;
      spawnRipple();
    }
  }

  function createBucketStyles(color) {
    var styles = new Array(OPACITY_BUCKETS);
    var rgbaPrefix = 'rgba(' + color + ', ';
    for (var bs = 0; bs < OPACITY_BUCKETS; bs++) {
      var bucketOpacity = OPACITY_BUCKETS <= 1 ? 1 : bs / (OPACITY_BUCKETS - 1);
      styles[bs] = rgbaPrefix + bucketOpacity + ')';
    }
    return styles;
  }

  function strokeBuckets(bucketLines, bucketWidthSums, bucketCounts, bucketStyles) {
    for (var bk = 0; bk < bucketLines.length; bk++) {
      var bLines = bucketLines[bk];
      var bCount = bucketCounts[bk];
      if (bCount === 0) continue;

      ctx.strokeStyle = bucketStyles[bk];
      ctx.lineWidth = bucketWidthSums[bk] / bCount;
      ctx.beginPath();

      for (var bj = 0, bjEnd = bCount * 4; bj < bjEnd; bj += 4) {
        ctx.moveTo(bLines[bj], bLines[bj + 1]);
        ctx.lineTo(bLines[bj + 2], bLines[bj + 3]);
      }

      ctx.stroke();
    }
  }

  function strokeBucketsLegacy(bucketLines, bucketWidthSums, bucketCounts, color) {
    var rgbaPrefix = 'rgba(' + color + ', ';
    for (var bk = 0; bk < bucketLines.length; bk++) {
      var bLines = bucketLines[bk];
      var bCount = bucketCounts[bk];
      if (bCount === 0) continue;

      var bOpacity = bucketLines.length <= 1 ? 1 : bk / (bucketLines.length - 1);
      ctx.strokeStyle = rgbaPrefix + bOpacity + ')';
      ctx.lineWidth = bucketWidthSums[bk] / bCount;
      ctx.beginPath();

      for (var bj = 0; bj < bLines.length; bj += 4) {
        ctx.moveTo(bLines[bj], bLines[bj + 1]);
        ctx.lineTo(bLines[bj + 2], bLines[bj + 3]);
      }

      ctx.stroke();
    }
  }

  var OPACITY_BUCKETS = 64;
  var rippleRingWidth = 120;

  function resolveFrameInterval() {
    if (reducedMotion) return 1000 / 24;
    if (isLandingPage || isContactPage) return 0;
    return lowPowerDevice ? 1000 / 20 : 1000 / 28;
  }

  function createStrokeBuckets(count) {
    var bucketLines = new Array(count);
    var bucketWidthSums = new Array(count);
    var bucketCounts = new Array(count);

    for (var bi = 0; bi < count; bi++) {
      bucketLines[bi] = new Float32Array(256);
      bucketWidthSums[bi] = 0;
      bucketCounts[bi] = 0;
    }

    return {
      lines: bucketLines,
      widthSums: bucketWidthSums,
      counts: bucketCounts
    };
  }

  function createLegacyStrokeBuckets(count) {
    var bucketLines = new Array(count);
    var bucketWidthSums = new Array(count);
    var bucketCounts = new Array(count);

    for (var bi = 0; bi < count; bi++) {
      bucketLines[bi] = [];
      bucketWidthSums[bi] = 0;
      bucketCounts[bi] = 0;
    }

    return {
      lines: bucketLines,
      widthSums: bucketWidthSums,
      counts: bucketCounts
    };
  }

  function addStrokeSegment(buckets, bucketIdx, x1, y1, x2, y2, width) {
    var count = buckets.counts[bucketIdx];
    var offset = count * 4;
    var lines = buckets.lines[bucketIdx];

    if (offset + 4 > lines.length) {
      var nextLength = lines.length * 2;
      while (offset + 4 > nextLength) nextLength *= 2;
      var grownLines = new Float32Array(nextLength);
      grownLines.set(lines);
      lines = grownLines;
      buckets.lines[bucketIdx] = lines;
    }

    lines[offset] = x1;
    lines[offset + 1] = y1;
    lines[offset + 2] = x2;
    lines[offset + 3] = y2;
    buckets.widthSums[bucketIdx] += width;
    buckets.counts[bucketIdx] = count + 1;
  }

  function reserveStrokeBuckets(buckets, segmentCapacity) {
    var requiredLength = _max(256, segmentCapacity * 4);
    var lines = buckets.lines;

    for (var bi = 0; bi < lines.length; bi++) {
      if (lines[bi].length >= requiredLength) continue;
      var reservedLines = new Float32Array(requiredLength);
      reservedLines.set(lines[bi]);
      lines[bi] = reservedLines;
    }
  }

  function resetStrokeBuckets(buckets) {
    var widthSums = buckets.widthSums;
    var counts = buckets.counts;

    for (var bi = 0; bi < counts.length; bi++) {
      widthSums[bi] = 0;
      counts[bi] = 0;
    }
  }

  function resetLegacyStrokeBuckets(buckets) {
    var lines = buckets.lines;
    var widthSums = buckets.widthSums;
    var counts = buckets.counts;

    for (var bi = 0; bi < lines.length; bi++) {
      lines[bi].length = 0;
      widthSums[bi] = 0;
      counts[bi] = 0;
    }
  }

  var fieldBuckets = createStrokeBuckets(OPACITY_BUCKETS);
  var fieldBucketsDark = createStrokeBuckets(OPACITY_BUCKETS);
  var transitionBuckets = createLegacyStrokeBuckets(OPACITY_BUCKETS);
  var transitionBucketsDark = createLegacyStrokeBuckets(OPACITY_BUCKETS);
  var bucketStylesLight = createBucketStyles(lightLineColor);
  var bucketStylesDark = createBucketStyles(darkLineColor);
  var bucketStylesLine = isDarkLines ? bucketStylesDark : bucketStylesLight;

  window.setVectorFieldTransition = setTransitionState;

  function animate(timestamp) {
    if (myId !== _vectorFieldInstanceId) return;

    if (document.hidden) {
      lastFrameTime = 0;
      requestAnimationFrame(animate);
      return;
    }

    var transitionFidelityActive = isLandingPage && ((assembleState && assembleState.active) || landingTransition.active);
    var activeMinFrameMs = transitionFidelityActive ? 0 : minFrameMs;

    if (!lastFrameTime) lastFrameTime = activeMinFrameMs > 0 ? timestamp - activeMinFrameMs : timestamp;
    var elapsedMs = timestamp - lastFrameTime;
    if (activeMinFrameMs > 0 && elapsedMs < activeMinFrameMs) {
      requestAnimationFrame(animate);
      return;
    }
    var dt = elapsedMs / 1000;
    lastFrameTime = activeMinFrameMs > 0 ? timestamp - (elapsedMs % activeMinFrameMs) : timestamp;
    if (dt > 0.1) dt = transitionFidelityActive ? 0.016 : 0.05;
    time += dt;

    var mouseX = _vfMouseX;
    var mouseY = _vfMouseY;
    var pageScrollY = 0;
    if (!isLandingPage) {
      pageScrollY = window.scrollY || window.pageYOffset || 0;
      if (mouseY > 0) mouseY += pageScrollY;
    }
    var mouseActive = mouseX > 0 && mouseY > 0;
    _vfScrollVelocity *= 0.9;
    _vfScrollKick *= 0.9;
    if (isMobile || touchCapable) {
      _vfScrollVelocity = 0;
      _vfScrollKick = 0;
    }
    if (_abs(_vfScrollVelocity) < 0.001) _vfScrollVelocity = 0;
    if (_vfScrollKick < 0.001) _vfScrollKick = 0;
    var scrollTilt = _max(-1, _min(1, _vfScrollVelocity / 10));

    // --- AWAKENING factor: 0 (asleep) → 1 (fully alive) ---
    var awaken = isLandingPage ? _min(1, time / awakenDuration) : 1;
    // Smooth ease-out for organic feel
    var t1 = 1 - awaken;
    var awakenEased = 1 - t1 * t1 * t1;
      var revealActive = isLandingPage && landingTransition.active && landingTransition.radius > 0;
      var revealRadius = revealActive ? landingTransition.radius : 0;
      var revealRadiusSq = revealRadius * revealRadius;
      var portalProximity = 0;
      var portalDist = portalGlowDist;
      var portalCentered = 0;
      var portalPresence = 0;
      var portalPulse = 0;
      var portalBreath = 0.5 + 0.5 * _sin(time * 1.18);
      var portalIdle = 1;
      var portalIdleGlow = 0.08;
      var portalSweep = 0;

      if (isLandingPage && mouseActive) {
        var portalDx = mouseX - centerX;
        var portalDy = mouseY - centerY;
        portalDist = _sqrt(portalDx * portalDx + portalDy * portalDy);
        portalProximity = _max(0, 1 - portalDist / portalGlowDist);
        if (portalProximity < 0.08) portalProximity = 0;
        portalCentered = _max(0, 1 - portalDist / (portalHoldRadius * 1.2));
      }

    var visibleTop = 0;
    var visibleBottom = fieldHeight;
    if (!isLandingPage) {
      var visiblePadding = spacing * 3;
      visibleTop = _max(0, pageScrollY - visiblePadding);
      visibleBottom = _min(fieldHeight, pageScrollY + window.innerHeight + visiblePadding);
      ctx.clearRect(0, visibleTop, fieldWidth, _max(1, visibleBottom - visibleTop));
    } else {
      ctx.clearRect(0, 0, fieldWidth, fieldHeight);
    }

    if (assembleState && assembleState.active) {
      var assembleProgress = _min(1, (time - assembleState.startTime) / assembleState.duration);
      var a1 = 1 - assembleProgress;
      var meltProgress = assembleProgress < 0.78 ? 0 : ((assembleProgress - 0.78) / 0.22);
      resetLegacyStrokeBuckets(transitionBuckets);
      if (revealActive) resetLegacyStrokeBuckets(transitionBucketsDark);

      var assembleCount = assembleState.sortedParticles.length;
      for (var ai = 0; ai < assembleCount; ai++) {
        var ap = assembleState.sortedParticles[ai];
        var alc = layerConfig[ap.layer];
        var startOffset = (ap.assembleOrder || 0) * (assembleState.staggerSpan || 0.25);
        var localProgress = assembleProgress <= startOffset ? 0 : _min(1, (assembleProgress - startOffset) / _max(0.0001, 1 - startOffset));
        var lp = 1 - localProgress;
        var localEase = 1 - lp * lp * lp * lp;
        var travelPresence = 1 - _abs(localProgress - 0.42) / 0.42;
        if (travelPresence < 0) travelPresence = 0;
        var drawX = ap.assembleFromX + (ap.assembleToX - ap.assembleFromX) * localEase;
        var drawY = ap.assembleFromY + (ap.assembleToY - ap.assembleFromY) * localEase;
        var drawAngle = ap.assembleFromAngle + angleDiff(ap.assembleFromAngle, ap.assembleToAngle) * localEase;
        var drawLenAssemble = (lineLen * alc[3]) * (1 - localEase) + ap.assembleLen * localEase;
        var drawOpacityAssemble = (ap.baseOpacity * alc[0] * 0.52) * (1 - localEase) + ap.assembleOpacity * localEase;
        var widthScaleAssemble = (0.55 + alc[1] * 0.4) * (1 - localEase) + ap.assembleWidth * localEase;
        var revealEdgeBoost = 0;

        var travelBoost = 0.32 + travelPresence * 0.48;
        drawOpacityAssemble = _min(1, drawOpacityAssemble + travelBoost);
        drawLenAssemble *= 1 + travelPresence * 0.22;
        widthScaleAssemble *= 1 + travelPresence * 0.34;

        if (revealActive) {
          var assembleDxCenter = centerX - drawX;
          var assembleDyCenter = centerY - drawY;
          var assembleDistCenter = _sqrt(assembleDxCenter * assembleDxCenter + assembleDyCenter * assembleDyCenter);
          revealEdgeBoost = _max(0, 1 - _abs(assembleDistCenter - revealRadius) / 56);
          if (revealEdgeBoost > 0) {
            drawOpacityAssemble = _min(1, drawOpacityAssemble + revealEdgeBoost * 0.08);
            drawLenAssemble *= 1 + revealEdgeBoost * 0.08;
            widthScaleAssemble *= 1 + revealEdgeBoost * 0.08;
          }
        }

        if (meltProgress > 0 && localProgress > 0.02) {
          var localMelt = _min(1, meltProgress * (0.55 + localProgress * 0.25));
          drawOpacityAssemble *= 1 - localMelt * 0.34;
          drawLenAssemble *= 1 - localMelt * 0.12;
          widthScaleAssemble *= 1 - localMelt * 0.08;
        }

        if (drawOpacityAssemble <= 0.002 || drawLenAssemble <= 0.2 || widthScaleAssemble <= 0.02) continue;

        var halfLenAssemble = drawLenAssemble * 0.5;
        var cosAssemble = _cos(drawAngle);
        var sinAssemble = _sin(drawAngle);
        var angleFactorAssemble = sinAssemble < 0 ? -sinAssemble : sinAssemble;
        var lineWidthAssemble = (lineWidth * alc[1]) * (0.65 + angleFactorAssemble * 0.55) * widthScaleAssemble;
        var clampedAssembleOpacity = drawOpacityAssemble < 0 ? 0 : (drawOpacityAssemble > 1 ? 1 : drawOpacityAssemble);
        var assembleBucketIdx = (clampedAssembleOpacity * (OPACITY_BUCKETS - 1) + 0.5) | 0;
        var insideReveal = revealActive && ((centerX - drawX) * (centerX - drawX) + (centerY - drawY) * (centerY - drawY)) <= revealRadiusSq;
        var assembleBucketSet = insideReveal ? transitionBucketsDark : transitionBuckets;
        var assembleBucket = assembleBucketSet.lines[assembleBucketIdx];
        assembleBucket.push(
          drawX - cosAssemble * halfLenAssemble,
          drawY - sinAssemble * halfLenAssemble,
          drawX + cosAssemble * halfLenAssemble,
          drawY + sinAssemble * halfLenAssemble
        );
        assembleBucketSet.widthSums[assembleBucketIdx] += lineWidthAssemble;
        assembleBucketSet.counts[assembleBucketIdx]++;
      }

      strokeBucketsLegacy(transitionBuckets.lines, transitionBuckets.widthSums, transitionBuckets.counts, revealActive ? lightLineColor : lineColor);
      if (revealActive) {
        strokeBucketsLegacy(transitionBucketsDark.lines, transitionBucketsDark.widthSums, transitionBucketsDark.counts, darkLineColor);
        if (revealRadius > 8) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, revealRadius, 0, TWO_PI);
          ctx.strokeStyle = 'rgba(244, 242, 236, ' + _min(0.18, 0.025 + landingTransition.progress * 0.09) + ')';
          ctx.lineWidth = 3 + landingTransition.progress * 3.5;
          ctx.stroke();
        }
      }

      requestAnimationFrame(animate);
      return;
    }

    // --- WAKE TRAIL: record cursor path ---
    if (mouseActive) {
      var wdx = mouseX - lastWakeX;
      var wdy = mouseY - lastWakeY;
      if (wdx * wdx + wdy * wdy > 900) { // 30*30 = 900, skip sqrt
        wakeTrail.push({ x: mouseX, y: mouseY, time: time });
        lastWakeX = mouseX;
        lastWakeY = mouseY;
        // Hard cap
        while (wakeTrail.length > wakeMaxPoints) wakeTrail.shift();
      }
    }
    // Prune old wake points
    while (wakeTrail.length > 0 && time - wakeTrail[0].time > wakeMaxAge) {
      wakeTrail.shift();
    }

    if (isContactPage) {
      if (time - lastContactPulseTime > contactPulseInterval) {
        var pulseCenter = resolveContactPulseCenter(pageScrollY);
        lastRippleTime = -10;
        spawnRipple(pulseCenter.x, pulseCenter.y, _max(window.innerWidth, window.innerHeight) * 0.72);
        lastContactPulseTime = time;
      }

      if (mouseActive) {
        var hoverCenter = resolveContactPulseCenter(pageScrollY);
        var hoverDx = mouseX - hoverCenter.x;
        var hoverDy = mouseY - hoverCenter.y;
        var isNearContactButton = hoverDx * hoverDx + hoverDy * hoverDy < 150 * 150;
        if (isNearContactButton && !contactPulseHoverActive) {
          lastRippleTime = -10;
          spawnRipple(hoverCenter.x, hoverCenter.y, _max(window.innerWidth, window.innerHeight) * 0.62);
          contactPulseHoverActive = true;
        } else if (!isNearContactButton) {
          contactPulseHoverActive = false;
        }
      } else {
        contactPulseHoverActive = false;
      }
    }

    // --- MOBILE DISCOVERY: first-touch ripple + idle nudges ---
    if (isLandingPage) {
      var isTouching = mouseActive;

      // #4: First touch anywhere → ripple from center
      if (isTouching && !hasEverTouched) {
        hasEverTouched = true;
        lastRippleTime = -10; // bypass cooldown
        spawnRipple();
      }

      // Track last interaction time
      if (isTouching) {
        lastInteractionTime = time;
      }

      // #5: Idle nudge — gentle ripple from center after no touch
      if (!isTouching && hasEverTouched && time > awakenDuration) {
        var idleDuration = time - lastInteractionTime;
        if (idleDuration > idleNudgeInterval && time - lastIdleNudgeTime > idleNudgeCooldown) {
          lastIdleNudgeTime = time;
          lastRippleTime = -10;
          spawnRipple();
        }
      }
      // Also nudge if user has NEVER interacted and awakening is done
      if (!hasEverTouched && time > awakenDuration + 1.5 && time - lastIdleNudgeTime > idleNudgeCooldown) {
        lastIdleNudgeTime = time;
        lastRippleTime = -10;
        spawnRipple();
      }
    }

    // Portal reveal + ripple trigger
    if (portal) {
      var dxP = mouseX - centerX;
      var dyP = mouseY - centerY;
      var distToCenterSq = dxP * dxP + dyP * dyP;
      var fingerInHoldZone = portalHoldEnabled && mouseActive && distToCenterSq < portalHoldRadius * portalHoldRadius;
      var portalNear = mouseActive && distToCenterSq < portalRevealDist * portalRevealDist;

      if (portalNear) {
        if (!wasNearPortal) {
          spawnRipple();
          wasNearPortal = true;
        }
        if (distToCenterSq < 6400) { // 80*80
          spawnRipple();
        }
      } else {
        wasNearPortal = false;
      }

      if (fingerInHoldZone && !portalHoldTriggered) {
        portalCharge = _min(1, portalCharge + dt / portalChargeDuration);
        setPortalClass('is-charging', true);
        setPortalVar('--portal-charge', portalCharge.toFixed(3));
        if (portalCharge >= 1 && typeof window.triggerLandingTransition === 'function') {
          portalHoldTriggered = true;
          window.triggerLandingTransition();
        }
      } else {
        portalCharge = _max(0, portalCharge - dt * 1.8);
        if (portalCharge <= 0.001) {
          portalCharge = 0;
        }
        setPortalClass('is-charging', portalCharge > 0.001);
        setPortalVar('--portal-charge', portalCharge.toFixed(3));
      }

      portalPresence = portalProximity > 0
        ? _min(1, Math.pow(portalProximity, 2.35) * 1.2 + portalCentered * 0.32 + portalCharge * 0.72)
        : _min(1, portalCharge * 0.72);

      portalIdle = _max(0, 1 - portalPresence * 1.9 - portalCentered * 1.4 - portalCharge * 1.8);
      portalIdleGlow = portalIdle * (0.22 + portalBreath * 0.34);

      if (portalProximity > 0.08 || portalCentered > 0.02 || portalCharge > 0.01) {
        var portalPulseRate = 1.8 + portalProximity * 2.4 + portalCentered * 4.2 + portalCharge * 5.8;
        var portalPulseWave = 0.5 + 0.5 * _sin(time * portalPulseRate);
        portalPulse = portalPulseWave * (portalProximity * 0.34 + portalCentered * 0.46 + portalCharge * 0.62);
      } else {
        portalPulse = 0;
      }

      var portalLive = portalProximity > 0.06 || portalCentered > 0.08 || portalCharge > 0.01;

      setPortalClass('is-near', portalProximity > 0.06 || portalCharge > 0.01);
      setPortalClass('is-centered', portalCentered > 0.08 || portalCharge > 0.03);

      portalStyleElapsed += dt;
      if (portalLive || portalStyleElapsed > 0.045) {
        portalStyleElapsed = 0;
        setPortalVar('--portal-proximity', portalProximity.toFixed(3));
        setPortalVar('--portal-presence', portalPresence.toFixed(3));
        setPortalVar('--portal-centered', portalCentered.toFixed(3));
        setPortalVar('--portal-pulse', portalPulse.toFixed(3));
        setPortalVar('--portal-idle', portalIdle.toFixed(3));
        setPortalVar('--portal-breath', portalBreath.toFixed(3));
        setPortalVar('--portal-idle-glow', portalIdleGlow.toFixed(3));

        if (portalLive) {
          portalSweep = time * (34 + portalCentered * 90 + portalCharge * 140);
          var portalSweepDeg = portalSweep * 57.2958;
          setPortalVar('--portal-sweep', portalSweepDeg.toFixed(2) + 'deg');
          setPortalVar('--portal-sweep-soft', (portalSweepDeg * 0.62).toFixed(2) + 'deg');
          setPortalVar('--portal-sweep-reverse', (-portalSweepDeg * 0.88).toFixed(2) + 'deg');
          setPortalVar('--portal-sweep-ring', (portalSweepDeg * 1.12).toFixed(2) + 'deg');
        } else {
          setPortalVar('--portal-sweep', '0deg');
          setPortalVar('--portal-sweep-soft', '0deg');
          setPortalVar('--portal-sweep-reverse', '0deg');
          setPortalVar('--portal-sweep-ring', '0deg');
        }
      }
    }

    // Update ripples
    for (var ri = ripples.length - 1; ri >= 0; ri--) {
      var rip = ripples[ri];
      rip.radius += rippleSpeed * dt;
      if (rip.radius > rip.maxRadius) {
        ripples.splice(ri, 1);
      } else {
        rip.outer = rip.radius + rippleRingWidth;
        rip.inner = rip.radius - rippleRingWidth;
        var ripAgeFade = _max(0, 1 - rip.radius / rip.maxRadius);
        rip.ageFadeSq = ripAgeFade * ripAgeFade;
      }
    }

    // --- Pre-compute per-frame easter egg cursor distance (invariant across particles) ---
    var eeSuppression = 0;
    var cursorNearEECached = 0;
    if (isLandingPage && mouseActive) {
      var _dceX = mouseX - easterEggX;
      var _dceY = mouseY - easterEggY;
      var _dceSq = _dceX * _dceX + _dceY * _dceY;
      var _dce = _sqrt(_dceSq);
      eeSuppression = _max(0, 1 - _dce / 250);
      eeSuppression = eeSuppression * eeSuppression;
      cursorNearEECached = _max(0, 1 - _dce / 200);
    }

    // --- Pre-compute squared radii for threshold comparisons ---
    var blackHoleRadiusSq = blackHoleRadius * blackHoleRadius;
    var easterEggRadiusSq = easterEggRadius * easterEggRadius;

    // --- Draw buffers: quantize opacity into buckets for batched drawing ---
    // Each bucket stores line segments as flat arrays: [x1, y1, x2, y2, x1, y1, x2, y2, ...]
    resetStrokeBuckets(fieldBuckets);
    if (revealActive) resetStrokeBuckets(fieldBucketsDark);

    var pLen = particles.length;
    var particleStart = 0;
    var particleEnd = pLen;
    if (!isLandingPage && gridCols > 0) {
      var firstVisibleRow = _max(0, ((visibleTop - spacing * 0.5) / spacing) | 0);
      var lastVisibleRow = _min(gridRows - 1, ((visibleBottom - spacing * 0.5) / spacing + 1) | 0);
      particleStart = firstVisibleRow * gridCols;
      particleEnd = _min(pLen, (lastVisibleRow + 1) * gridCols);
    }

    var maxMouseRadius = mouseInfluence + 65;
    var maxMouseRadiusSq = maxMouseRadius * maxMouseRadius;
    var wakeRadiusSq = wakeRadius * wakeRadius;
    var wakeLen = wakeTrail.length;
    for (var wf = 0; wf < wakeLen; wf++) {
      var wakePoint = wakeTrail[wf];
      var wakeAge = (time - wakePoint.time) / wakeMaxAge;
      wakePoint.fade = (1 - wakeAge) * (1 - wakeAge);
    }

    for (var i = particleStart; i < particleEnd; i++) {
      var p = particles[i];
      if (!isLandingPage && (p.y < visibleTop || p.y > visibleBottom)) continue;
      var layerSpeedMult = p.layerSpeed;
      var lcLen = p.layerLen;
      var lcWidth = p.layerWidth;
      var distCenterSq = p.centerDistSq;

      // Waves with layer-specific speed
      var waveTime = time * layerSpeedMult;
      var wavePhase = p.waveX + waveTime * 1.6;
      var swell = _sin(wavePhase) * 1.8 + _sin(p.waveXY + waveTime * 1.15) * 1.3;
      var cross = _cos(p.waveY + waveTime * 0.9) * 0.9 + _sin(p.waveFastX - waveTime * 1.25) * 0.65;
      var deep = _sin(p.waveDiag + waveTime * 0.45) * 1.0;

      var random = p.drift * _sin(waveTime * 0.7 + p.seed1) * 0.08
                 + _sin(waveTime * 1.3 + p.seed2Wave) * 0.05
                 + _cos(waveTime * 0.9 + p.seed3Wave) * 0.04;

      var liveAngle = swell + cross + deep + random;

      // --- #1: GRAVITATIONAL CURRENT (mobile only) ---
      // Subtle inward bias — like water circling a drain
      if (gravityStrength > 0) {
        // Only apply outside the black hole zone to avoid fighting the spiral
        if (distCenterSq > blackHoleRadiusSq) {
          // Spiral offset so it's not just pointing at center — add a swirl
          var gSpiral = p.centerAngle + 0.6;
          var gDiff = angleDiff(liveAngle, gSpiral);
          // Stronger pull closer to center, fades at edges
          liveAngle += gDiff * gravityStrength * p.centerFalloff;
        }
      }

      // --- AWAKENING: blend from startAngle to live wave angle ---
      var baseAngle = startAngle * (1 - awakenEased) + liveAngle * awakenEased;

      // --- RIPPLE INFLUENCE ---
      var rippleAngleOffset = 0;
      var rippleOpacityBoost = 0;
      var rippleLenBoost = 0;
      for (var rj = 0; rj < ripples.length; rj++) {
        var rp = ripples[rj];
        var rdx = p.x - rp.x;
        var rdy = p.y - rp.y;
        // Fast bounding-box reject before sqrt
        var ringOuter = rp.outer;
        var ringInner = rp.inner;
        if (rdx > ringOuter || rdx < -ringOuter || rdy > ringOuter || rdy < -ringOuter) continue;
        var rDist = _sqrt(rdx * rdx + rdy * rdy);
        if (rDist > ringOuter || (ringInner > 0 && rDist < ringInner)) continue;
        var distFromRing = _abs(rDist - rp.radius);

        if (distFromRing < rippleRingWidth) {
          var ringStrength = (1 - distFromRing / rippleRingWidth) * rp.ageFadeSq;

          var radialAngle = _atan2(rdy, rdx);
          var tangentAngle = radialAngle + PI * 0.5;
          var outwardPush = radialAngle * 0.15;
          rippleAngleOffset += angleDiff(0, tangentAngle + outwardPush) * ringStrength * 0.7;
          rippleOpacityBoost += ringStrength * 0.2 * opacityScale;
          rippleLenBoost += ringStrength * 6;
        }
      }

      baseAngle += rippleAngleOffset;

      // --- WAKE TRAIL INFLUENCE ---
      var wakeAngleOffset = 0;
      var wakeOpacityBoost = 0;
      for (var wi = 0; wi < wakeLen; wi++) {
        var wp = wakeTrail[wi];
        var wdx2 = p.x - wp.x;
        var wdy2 = p.y - wp.y;
        // Fast bounding-box reject
        if (wdx2 > wakeRadius || wdx2 < -wakeRadius || wdy2 > wakeRadius || wdy2 < -wakeRadius) continue;
        var wDistSq2 = wdx2 * wdx2 + wdy2 * wdy2;
        if (wDistSq2 < wakeRadiusSq) {
          var wDist2 = _sqrt(wDistSq2);
          var wStrength = (1 - wDist2 / wakeRadius) * wp.fade;
          // Push outward from wake point
          var wAngle = _atan2(wdy2, wdx2);
          wakeAngleOffset += angleDiff(0, wAngle) * wStrength * 0.4;
          wakeOpacityBoost += wStrength * 0.1 * opacityScale;
        }
      }

      baseAngle += wakeAngleOffset;

      if (_vfScrollKick > 0 && _vfScrollDirection !== 0) {
        var scrollAngle = _vfScrollDirection > 0 ? PI * 0.5 : -PI * 0.5;
        var snapStrength = _min(1, _vfScrollKick * 1.35 + _abs(scrollTilt) * 0.3);
        baseAngle = scrollAngle * snapStrength + baseAngle * (1 - snapStrength);
      }

      var bhResistance = 0;
      var targetAngle = baseAngle;
      var drawOpacity = p.baseOpacityLayer + rippleOpacityBoost + wakeOpacityBoost;
      var drawLen = (lineLen * lcLen) + rippleLenBoost;
      var widthScale = 1;
      var speed = returnSpeed;

      if (_vfScrollKick > 0) {
        speed = _max(speed, 0.38 + _vfScrollKick * 0.22);
      }

      // --- AWAKENING: fade opacity in ---
      drawOpacity *= awakenEased;

      if (isLandingPage) {
        var distBHSq = distCenterSq;

        if (distBHSq < blackHoleRadiusSq) {
          var distBH = p.centerDist;
          var bhStrength = p.blackHoleStrength;
          bhResistance = bhStrength;
          var spiralOffset = bhStrength * 2.0 + _sin(time * 3.5 + p.seed1) * bhStrength * 0.6;
          var bhAngle = p.centerAngle + spiralOffset;
          targetAngle = bhAngle * bhStrength * awakenEased + baseAngle * (1 - bhStrength);
          drawOpacity = (p.baseOpacityLayer + bhStrength * 0.4 * opacityScale + rippleOpacityBoost + wakeOpacityBoost) * awakenEased;
          drawLen = lineLen * lcLen + bhStrength * 12 + rippleLenBoost;
          speed = returnSpeed + bhStrength * 0.3;
          if (distBH < 35) { var fade = p.blackHoleCoreFade; drawOpacity *= fade; drawLen = lineLen * lcLen * fade + bhStrength * 12 * fade; }
        }

        var distEESq = p.easterDistSq;

        if (distEESq < easterEggRadiusSq) {
          var eeStrength = p.easterStrength;
          var eeSpiralOffset = eeStrength * 1.8 + _sin(time * 2.5 + p.seed2) * eeStrength * 0.5;
          var eeAngle = p.easterAngle + eeSpiralOffset;
          var eeDiff = angleDiff(targetAngle, eeAngle);
          targetAngle += eeDiff * eeStrength * 0.8;

          var baseDim = eeStrength * 0.85;
          var totalDim = baseDim + cursorNearEECached * eeStrength * 0.9;
          if (totalDim > 0.99) totalDim = 0.99;

          drawOpacity *= (1 - totalDim);
          drawLen *= (1 - totalDim * 0.7);
          widthScale *= (1 - totalDim * 0.6);
          speed = _max(speed, returnSpeed + eeStrength * 0.2);
        }
      }

      if (mouseActive) {
        var dxM = mouseX - p.x;
        var dyM = mouseY - p.y;
        var distMSq = dxM * dxM + dyM * dyM;

        if (distMSq < maxMouseRadiusSq) {
          var particleMouseRadius = mouseInfluence + p.mouseRadiusOffset + _sin(time * 3 + p.mouseWaveSeed) * 25;
          var particleMouseRadiusSq = particleMouseRadius * particleMouseRadius;

          if (distMSq < particleMouseRadiusSq) {
            var particleNearEE = 0;
            if (isLandingPage) {
              if (p.easterDistSq < easterEggRadiusSq) {
                particleNearEE = p.easterLinear;
              }
            }

            var distM = _sqrt(distMSq);
            var mStrength = (1 - distM / particleMouseRadius);
            mStrength = mStrength * mStrength;
            var mouseEffect = mStrength * (1 - bhResistance * 0.85);

            if (particleNearEE > 0) {
              var dimFactor = particleNearEE * mouseEffect;
              drawOpacity *= _max(0.02, 1 - dimFactor * 3);
            } else {
              var brightenAmount = mouseEffect * 0.3 * opacityScale;
              drawOpacity = _max(drawOpacity, p.baseOpacityLayer + brightenAmount);
            }

            // Field modes shared with the WebGL renderer via
            // window.__vectorFieldMode: 0 attract, 1 vortex, 2 repel, 3 scatter.
            var fieldMode = window.__vectorFieldMode | 0;
            var mouseTargetAngle = _atan2(dyM, dxM);
            if (fieldMode === 1) mouseTargetAngle += PI * 0.5;
            else if (fieldMode === 2) mouseTargetAngle += PI;
            else if (fieldMode === 3) mouseTargetAngle = p.seed1 * TWO_PI + time * (1.2 + p.seed2 * 2.4);
            var mouseDiff = angleDiff(targetAngle, mouseTargetAngle);
            targetAngle += mouseDiff * mouseEffect * 0.9;
            drawLen = _max(drawLen, lineLen * lcLen + mouseEffect * 10 * (1 - eeSuppression * particleNearEE));
            speed = _max(speed, followSpeed + mouseEffect * 0.4);
          }
        }
      }

      if (bhResistance > 0.1) speed = _max(speed, returnSpeed + bhResistance * 0.35);

      p.currentAngle += angleDiff(p.currentAngle, targetAngle) * speed;
      while (p.currentAngle > PI) p.currentAngle -= TWO_PI;
      while (p.currentAngle < -PI) p.currentAngle += TWO_PI;

      if (revealActive) {
        var edgeBoost = _max(0, 1 - _abs(p.centerDist - revealRadius) / 56);
        if (edgeBoost > 0) {
          drawOpacity = _min(1, drawOpacity + edgeBoost * 0.1);
          drawLen += edgeBoost * 2.8;
          widthScale *= 1 + edgeBoost * 0.1;
        }
      }

      var halfLen = drawLen * 0.5;
      var cosA = _cos(p.currentAngle);
      var sinA = _sin(p.currentAngle);

      // Width based on rotation: more rotated from horizontal = thicker
      var angleFactor = sinA < 0 ? -sinA : sinA; // abs without function call
      var angleWidth = (lineWidth * lcWidth) * (0.6 + angleFactor * 0.6) * widthScale;
      if (drawOpacity <= 0.001 || drawLen <= 0.2 || angleWidth <= 0.02) continue;

      // Quantize opacity into bucket for batched drawing
      // Clamp to [0, 1] and map to bucket index
      var clampedOpacity = drawOpacity < 0 ? 0 : (drawOpacity > 1 ? 1 : drawOpacity);
      var bucketIdx = (clampedOpacity * (OPACITY_BUCKETS - 1) + 0.5) | 0;
      var useDarkBucket = revealActive && distCenterSq <= revealRadiusSq;
      var bucketSet = useDarkBucket ? fieldBucketsDark : fieldBuckets;
      addStrokeSegment(
        bucketSet,
        bucketIdx,
        p.x - cosA * halfLen,
        p.y - sinA * halfLen,
        p.x + cosA * halfLen,
        p.y + sinA * halfLen,
        angleWidth
      );
    }

    // --- BATCHED DRAW: one beginPath/stroke per opacity bucket ---
    strokeBuckets(fieldBuckets.lines, fieldBuckets.widthSums, fieldBuckets.counts, revealActive ? bucketStylesLight : bucketStylesLine);
    if (revealActive) {
      strokeBuckets(fieldBucketsDark.lines, fieldBucketsDark.widthSums, fieldBucketsDark.counts, bucketStylesDark);
    }

    // --- DRAW RIPPLE RINGS ---
    if (isLandingPage || isContactPage) {
      for (var rk = 0; rk < ripples.length; rk++) {
        var drip = ripples[rk];
        var ripAge = drip.radius / drip.maxRadius;
        var ripAlpha = (1 - ripAge) * (1 - ripAge) * (isLandingPage ? 0.15 : 0.22);
        if (ripAlpha < 0.005) continue;

        ctx.beginPath();
        ctx.arc(drip.x, drip.y, drip.radius, 0, TWO_PI);
        ctx.strokeStyle = 'rgba(' + ((revealActive && drip.radius <= revealRadius) ? darkLineColor : lineColor) + ', ' + ripAlpha + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        var innerR = drip.radius * 0.85;
        if (innerR > 5) {
          ctx.beginPath();
          ctx.arc(drip.x, drip.y, innerR, 0, TWO_PI);
          ctx.strokeStyle = 'rgba(' + ((revealActive && innerR <= revealRadius) ? darkLineColor : lineColor) + ', ' + (ripAlpha * 0.5) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // --- PORTAL REVEAL EDGE + FIELD-DRIVEN CENTER CUE ---
    if (isLandingPage) {
      if (revealActive) {
        var horizonAlpha = _min(0.08, 0.008 + landingTransition.progress * 0.04);
        if (revealRadius > 8) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, revealRadius, 0, TWO_PI);
          ctx.strokeStyle = 'rgba(244, 242, 236, ' + horizonAlpha + ')';
          ctx.lineWidth = 0.7 + landingTransition.progress * 1.8;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(centerX, centerY, revealRadius, 0, TWO_PI);
          ctx.strokeStyle = 'rgba(26, 26, 26, ' + (0.012 + landingTransition.progress * 0.022) + ')';
          ctx.lineWidth = 0.45 + landingTransition.progress * 0.45;
          ctx.stroke();
        }
      } else {
        var portalGlowStrength = _min(1, portalIdleGlow * 0.94 + portalPresence * 0.42 + portalCentered * 0.24 + portalCharge * 0.44 + portalPulse * 0.34);
        if (portalGlowStrength > 0.012) {
          var portalGlowRadius = 34 + portalIdleGlow * 156 + portalPresence * 84 + portalCentered * 28 + portalCharge * 72 + portalPulse * 64;
          var portalGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, portalGlowRadius);
          portalGlow.addColorStop(0, 'rgba(' + lightLineColor + ', ' + (0.016 + portalGlowStrength * 0.14) + ')');
          portalGlow.addColorStop(0.18, 'rgba(' + lightLineColor + ', ' + (0.009 + portalGlowStrength * 0.085) + ')');
          portalGlow.addColorStop(0.42, 'rgba(' + lightLineColor + ', ' + (0.004 + portalGlowStrength * 0.04) + ')');
          portalGlow.addColorStop(0.7, 'rgba(' + lightLineColor + ', ' + (0.001 + portalGlowStrength * 0.012) + ')');
          portalGlow.addColorStop(1, 'rgba(' + lightLineColor + ', 0)');
          ctx.save();
          ctx.fillStyle = portalGlow;
          ctx.beginPath();
          ctx.arc(centerX, centerY, portalGlowRadius, 0, TWO_PI);
          ctx.fill();
          ctx.restore();
        }

        if (portalPresence > 0.012 || portalCharge > 0.01) {
          if (portalCentered > 0.03 || portalCharge > 0.01) {
            var seamHalf = 1 + portalCentered * 4 + portalCharge * 6 + portalPulse * 3;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - seamHalf);
            ctx.lineTo(centerX, centerY + seamHalf);
            ctx.strokeStyle = 'rgba(' + lineColor + ', ' + (0.015 + portalCentered * 0.12 + portalCharge * 0.16 + portalPulse * 0.08) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      var distToEE = 100000;
      if (mouseActive) {
        var dxEEm = mouseX - easterEggX;
        var dyEEm = mouseY - easterEggY;
        distToEE = _sqrt(dxEEm * dxEEm + dyEEm * dyEEm);
      }
      var cursorProximity = _max(0, 1 - distToEE / 200);
      var darkCenter = 0.25 + cursorProximity * 0.3;
      var darkMid = 0.08 + cursorProximity * 0.15;
      var darkRadius = 90 + cursorProximity * 40;

      var darkGrad = ctx.createRadialGradient(easterEggX, easterEggY, 0, easterEggX, easterEggY, darkRadius);
      darkGrad.addColorStop(0, 'rgba(0, 0, 0, ' + darkCenter + ')');
      darkGrad.addColorStop(0.6, 'rgba(0, 0, 0, ' + darkMid + ')');
      darkGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = darkGrad;
      ctx.fillRect(easterEggX - darkRadius, easterEggY - darkRadius, darkRadius * 2, darkRadius * 2);

      if (easterEgg) {
        var easterEggNear = mouseActive && distToEE < easterEggHoldRadius;
        if (easterEggNear) {
          if (!easterEggVisible) { easterEgg.classList.add('is-visible'); easterEggVisible = true; }
          if (!easterEggHoldTriggered) {
            easterEggCharge = _min(1, easterEggCharge + dt / easterEggChargeDuration);
            easterEgg.classList.toggle('is-charging', easterEggCharge > 0.001);
            setEasterEggVar('--easter-charge', easterEggCharge.toFixed(3));
            if (easterEggCharge >= 1) openEasterEgg();
          }
        } else {
          easterEggCharge = _max(0, easterEggCharge - dt * 1.15);
          easterEgg.classList.toggle('is-charging', easterEggCharge > 0.001);
          setEasterEggVar('--easter-charge', easterEggCharge.toFixed(3));
          if (distToEE < 100 && mouseActive) {
            if (!easterEggVisible) { easterEgg.classList.add('is-visible'); easterEggVisible = true; }
          } else if (easterEggCharge <= 0.001) {
            if (easterEggVisible) { easterEgg.classList.remove('is-visible'); easterEggVisible = false; }
          }
        }
      }
    }

    requestAnimationFrame(animate);
  }

  _vfResizeHandler = scheduleResize;
  window.addEventListener('resize', scheduleResize);
  resize();
  requestAnimationFrame(animate);

  // Stop on landing hide
  var landing = document.getElementById('landing');
  if (landing) {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'attributes' && m.attributeName === 'style') {
          if (landing.style.display === 'none') {
            _vectorFieldInstanceId++;
            observer.disconnect();
          }
        }
      });
    });
    observer.observe(landing, { attributes: true });
  }
}

window.initVectorFieldCanvas = initVectorFieldCanvas;
window.initVectorField = function () {
  if (typeof window.initVectorFieldWebGL === 'function' && window.initVectorFieldWebGL()) {
    return;
  }

  initVectorFieldCanvas();
};

window.initVectorField();
