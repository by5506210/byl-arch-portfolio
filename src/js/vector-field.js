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

function initVectorField() {
  var canvas = document.getElementById('vector-field');
  if (!canvas) return;

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

  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  var isDarkLines = canvas.getAttribute('data-color') === 'dark';
  var lightLineColor = '232, 228, 223';
  var darkLineColor = '26, 26, 26';
  var lineColor = isDarkLines ? darkLineColor : lightLineColor;

  var isContentPage = !isLandingPage;
  var opacityScale = isContentPage ? 0.18 : 1.0;

  var isMobile = window.innerWidth < 768;

  var spacing = isMobile ? 16 : 24;
  var lineLen = isContentPage ? 9 : (isMobile ? 11 : 16);
  var lineWidth = isContentPage ? 0.8 : (isMobile ? 1.2 : 1.7);
  var mouseInfluence = 220;
  var returnSpeed = 0.08;
  var followSpeed = 0.25;
  var blackHoleRadius = 300;

  var centerX = 0;
  var centerY = 0;
  var fieldWidth = 0;
  var fieldHeight = 0;
  var particles = [];
  var time = 0;
  var lastFrameTime = 0;
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
  var portalHoldRadius = 96;
  var portalHoldTriggered = false;

  var easterEggX = 0;
  var easterEggY = 0;
  var easterEggRadius = 200;
  var easterEgg = isLandingPage ? document.getElementById('easter-egg-portal') : null;
  var easterEggVisible = false;

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
    portal.style.setProperty('--portal-proximity', '0');
    portal.style.setProperty('--portal-charge', '0');
    portal.style.setProperty('--portal-presence', '0');
    portal.style.setProperty('--portal-centered', '0');
    portal.style.setProperty('--portal-pulse', '0');
    portal.style.setProperty('--portal-idle', '1');
    portal.style.setProperty('--portal-breath', '0.5');
    portal.style.setProperty('--portal-idle-glow', '0.08');
    portal.style.setProperty('--portal-sweep', '0deg');
    portal.style.setProperty('--portal-sweep-soft', '0deg');
    portal.style.setProperty('--portal-sweep-reverse', '0deg');
    portal.style.setProperty('--portal-sweep-ring', '0deg');
  }

  function resize() {
    var parent = canvas.parentElement;
    fieldWidth = window.innerWidth;
    fieldHeight = isLandingPage
      ? window.innerHeight
      : _max(window.innerHeight, parent ? parent.scrollHeight : window.innerHeight);

    canvas.width = fieldWidth * dpr;
    canvas.height = fieldHeight * dpr;
    canvas.style.width = fieldWidth + 'px';
    canvas.style.height = fieldHeight + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    centerX = fieldWidth / 2;
    centerY = fieldHeight / 2;
    easterEggX = fieldWidth * 0.82;
    easterEggY = isLandingPage ? fieldHeight * 0.78 : window.innerHeight * 0.78;
    isMobile = fieldWidth < 768;
    spacing = isMobile ? 16 : 24;
    lineLen = isContentPage ? 9 : (isMobile ? 11 : 16);
    lineWidth = isContentPage ? 0.8 : (isMobile ? 1.2 : 1.7);
    gravityStrength = isMobile && isLandingPage ? 0.25 : 0;
    rippleMaxRadius = Math.max(fieldWidth, fieldHeight) * 0.8;
    buildGrid();
  }

  function buildGrid() {
    particles = [];
    var cols = Math.ceil(fieldWidth / spacing) + 1;
    var rows = Math.ceil(fieldHeight / spacing) + 1;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        // --- DEPTH LAYERS: 0=front, 1=mid, 2=back ---
        var layerRand = Math.random();
        var layer = layerRand < 0.6 ? 0 : (layerRand < 0.85 ? 1 : 2);

        particles.push({
          x: col * spacing + spacing * 0.5,
          y: row * spacing + spacing * 0.5,
          currentAngle: startAngle, // start aligned for awakening
          baseOpacity: (0.24 + Math.random() * 0.12) * opacityScale,
          seed1: Math.random() * 100,
          seed2: Math.random() * 100,
          seed3: Math.random() * 100,
          drift: (Math.random() - 0.5) * 1.0,
          mouseRadiusOffset: (Math.random() - 0.5) * 80,
          layer: layer
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

  function spawnRipple() {
    if (time - lastRippleTime < rippleCooldown) return;
    lastRippleTime = time;
    ripples.push({
      x: centerX,
      y: centerY,
      birthTime: time,
      radius: 0,
      maxRadius: rippleMaxRadius
    });
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

  function strokeBuckets(bucketLines, bucketWidthSums, bucketCounts, color) {
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

  window.setVectorFieldTransition = setTransitionState;

  function animate(timestamp) {
    if (myId !== _vectorFieldInstanceId) return;

    if (!lastFrameTime) lastFrameTime = timestamp;
    var dt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;
    if (dt > 0.1) dt = 0.016;
    time += dt;

    var mouseX = _vfMouseX;
    var mouseY = _vfMouseY;
    if (!isLandingPage && mouseY > 0) {
      mouseY += window.scrollY || window.pageYOffset || 0;
    }
    _vfScrollVelocity *= 0.9;
    _vfScrollKick *= 0.9;
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

      if (isLandingPage && mouseX > 0) {
        var portalDx = mouseX - centerX;
        var portalDy = mouseY - centerY;
        portalDist = _sqrt(portalDx * portalDx + portalDy * portalDy);
        portalProximity = _max(0, 1 - portalDist / portalGlowDist);
        if (portalProximity < 0.08) portalProximity = 0;
        portalCentered = _max(0, 1 - portalDist / (portalHoldRadius * 1.2));
      }

    ctx.clearRect(0, 0, fieldWidth, fieldHeight);

    if (assembleState && assembleState.active) {
      var assembleProgress = _min(1, (time - assembleState.startTime) / assembleState.duration);
      var a1 = 1 - assembleProgress;
      var meltProgress = assembleProgress < 0.78 ? 0 : ((assembleProgress - 0.78) / 0.22);
      var ASSEMBLE_BUCKETS = 50;
      var assembleLines = new Array(ASSEMBLE_BUCKETS);
      var assembleWidthSums = new Array(ASSEMBLE_BUCKETS);
      var assembleCounts = new Array(ASSEMBLE_BUCKETS);
      var assembleLinesDark = revealActive ? new Array(ASSEMBLE_BUCKETS) : null;
      var assembleWidthSumsDark = revealActive ? new Array(ASSEMBLE_BUCKETS) : null;
      var assembleCountsDark = revealActive ? new Array(ASSEMBLE_BUCKETS) : null;

      for (var ab = 0; ab < ASSEMBLE_BUCKETS; ab++) {
        assembleLines[ab] = [];
        assembleWidthSums[ab] = 0;
        assembleCounts[ab] = 0;
        if (revealActive) {
          assembleLinesDark[ab] = [];
          assembleWidthSumsDark[ab] = 0;
          assembleCountsDark[ab] = 0;
        }
      }

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
        var assembleBucketIdx = (clampedAssembleOpacity * (ASSEMBLE_BUCKETS - 1) + 0.5) | 0;
        var insideReveal = revealActive && ((centerX - drawX) * (centerX - drawX) + (centerY - drawY) * (centerY - drawY)) <= revealRadiusSq;
        var assembleBucket = insideReveal ? assembleLinesDark[assembleBucketIdx] : assembleLines[assembleBucketIdx];
        assembleBucket.push(
          drawX - cosAssemble * halfLenAssemble,
          drawY - sinAssemble * halfLenAssemble,
          drawX + cosAssemble * halfLenAssemble,
          drawY + sinAssemble * halfLenAssemble
        );
        if (insideReveal) {
          assembleWidthSumsDark[assembleBucketIdx] += lineWidthAssemble;
          assembleCountsDark[assembleBucketIdx]++;
        } else {
          assembleWidthSums[assembleBucketIdx] += lineWidthAssemble;
          assembleCounts[assembleBucketIdx]++;
        }
      }

      strokeBuckets(assembleLines, assembleWidthSums, assembleCounts, revealActive ? lightLineColor : lineColor);
      if (revealActive) {
        strokeBuckets(assembleLinesDark, assembleWidthSumsDark, assembleCountsDark, darkLineColor);
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
    if (mouseX > 0 && mouseY > 0) {
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

    // --- MOBILE DISCOVERY: first-touch ripple + idle nudges ---
    if (isLandingPage) {
      var isTouching = mouseX > 0 && mouseY > 0;

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
      var fingerInHoldZone = isMobile && mouseX > 0 && distToCenterSq < portalHoldRadius * portalHoldRadius;
      var portalNear = mouseX > 0 && distToCenterSq < portalRevealDist * portalRevealDist;

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
        portal.classList.add('is-charging');
        portal.style.setProperty('--portal-charge', portalCharge.toFixed(3));
        if (portalCharge >= 1 && typeof window.triggerLandingTransition === 'function') {
          portalHoldTriggered = true;
          window.triggerLandingTransition();
        }
      } else {
        portalCharge = _max(0, portalCharge - dt * 1.8);
        if (portalCharge <= 0.001) {
          portalCharge = 0;
          portal.classList.remove('is-charging');
        }
        portal.style.setProperty('--portal-charge', portalCharge.toFixed(3));
      }

      portalPresence = portalProximity > 0
        ? _min(1, Math.pow(portalProximity, 2.35) * 1.2 + portalCentered * 0.32 + portalCharge * 0.72)
        : _min(1, portalCharge * 0.72);

      portalIdle = _max(0, 1 - portalPresence * 1.9 - portalCentered * 1.4 - portalCharge * 1.8);
      portalIdleGlow = portalIdle * (0.14 + portalBreath * 0.24);

      if (portalProximity > 0.08 || portalCentered > 0.02 || portalCharge > 0.01) {
        var portalPulseRate = 1.8 + portalProximity * 2.4 + portalCentered * 4.2 + portalCharge * 5.8;
        var portalPulseWave = 0.5 + 0.5 * _sin(time * portalPulseRate);
        portalPulse = portalPulseWave * (portalProximity * 0.34 + portalCentered * 0.46 + portalCharge * 0.62);
      } else {
        portalPulse = 0;
      }

      portalSweep = time * (34 + portalCentered * 90 + portalCharge * 140);

      portal.classList.toggle('is-near', portalProximity > 0.06 || portalCharge > 0.01);
      portal.classList.toggle('is-centered', portalCentered > 0.08 || portalCharge > 0.03);
      portal.style.setProperty('--portal-proximity', portalProximity.toFixed(3));
      portal.style.setProperty('--portal-presence', portalPresence.toFixed(3));
      portal.style.setProperty('--portal-centered', portalCentered.toFixed(3));
      portal.style.setProperty('--portal-pulse', portalPulse.toFixed(3));
      portal.style.setProperty('--portal-idle', portalIdle.toFixed(3));
      portal.style.setProperty('--portal-breath', portalBreath.toFixed(3));
      portal.style.setProperty('--portal-idle-glow', portalIdleGlow.toFixed(3));
      var portalSweepDeg = portalSweep * 57.2958;
      portal.style.setProperty('--portal-sweep', portalSweepDeg.toFixed(2) + 'deg');
      portal.style.setProperty('--portal-sweep-soft', (portalSweepDeg * 0.62).toFixed(2) + 'deg');
      portal.style.setProperty('--portal-sweep-reverse', (-portalSweepDeg * 0.88).toFixed(2) + 'deg');
      portal.style.setProperty('--portal-sweep-ring', (portalSweepDeg * 1.12).toFixed(2) + 'deg');
    }

    // Update ripples
    for (var ri = ripples.length - 1; ri >= 0; ri--) {
      var rip = ripples[ri];
      rip.radius += rippleSpeed * dt;
      if (rip.radius > rip.maxRadius) {
        ripples.splice(ri, 1);
      }
    }

    // --- Pre-compute per-frame easter egg cursor distance (invariant across particles) ---
    var eeSuppression = 0;
    var cursorNearEECached = 0;
    if (isLandingPage) {
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
    var OPACITY_BUCKETS = 50;
    var bucketLines = new Array(OPACITY_BUCKETS);
    var bucketWidthSums = new Array(OPACITY_BUCKETS);
    var bucketCounts = new Array(OPACITY_BUCKETS);
    var bucketLinesDark = revealActive ? new Array(OPACITY_BUCKETS) : null;
    var bucketWidthSumsDark = revealActive ? new Array(OPACITY_BUCKETS) : null;
    var bucketCountsDark = revealActive ? new Array(OPACITY_BUCKETS) : null;
    for (var bi = 0; bi < OPACITY_BUCKETS; bi++) {
      bucketLines[bi] = [];
      bucketWidthSums[bi] = 0;
      bucketCounts[bi] = 0;
      if (revealActive) {
        bucketLinesDark[bi] = [];
        bucketWidthSumsDark[bi] = 0;
        bucketCountsDark[bi] = 0;
      }
    }

    var pLen = particles.length;
    for (var i = 0; i < pLen; i++) {
      var p = particles[i];
      var lc = layerConfig[p.layer];
      var layerSpeedMult = lc[2];
      var lcOpacity = lc[0];
      var lcLen = lc[3];
      var lcWidth = lc[1];
      var dxCenter = centerX - p.x;
      var dyCenter = centerY - p.y;
      var distCenterSq = dxCenter * dxCenter + dyCenter * dyCenter;

      // Waves with layer-specific speed
      var waveTime = time * layerSpeedMult;
      var wavePhase = p.x * 0.006 + waveTime * 1.6;
      var swell = _sin(wavePhase) * 1.8 + _sin(p.x * 0.004 + p.y * 0.008 + waveTime * 1.15) * 1.3;
      var cross = _cos(p.y * 0.01 + waveTime * 0.9) * 0.9 + _sin(p.x * 0.012 - waveTime * 1.25) * 0.65;
      var deep = _sin((p.x + p.y) * 0.003 + waveTime * 0.45) * 1.0;

      var random = p.drift * _sin(waveTime * 0.7 + p.seed1) * 0.08
                 + _sin(waveTime * 1.3 + p.seed2 * 5) * 0.05
                 + _cos(waveTime * 0.9 + p.seed3 * 3) * 0.04;

      var liveAngle = swell + cross + deep + random;

      // --- #1: GRAVITATIONAL CURRENT (mobile only) ---
      // Subtle inward bias — like water circling a drain
      if (gravityStrength > 0) {
        var gdx = centerX - p.x;
        var gdy = centerY - p.y;
        var gDistSq = gdx * gdx + gdy * gdy;
        // Only apply outside the black hole zone to avoid fighting the spiral
        if (gDistSq > blackHoleRadiusSq) {
          var gAngle = _atan2(gdy, gdx);
          // Spiral offset so it's not just pointing at center — add a swirl
          var gSpiral = gAngle + 0.6;
          var gDiff = angleDiff(liveAngle, gSpiral);
          // Stronger pull closer to center, fades at edges
          var gDist = _sqrt(gDistSq);
          var maxGravDist = _max(window.innerWidth, window.innerHeight) * 0.6;
          var gFalloff = _max(0, 1 - gDist / maxGravDist);
          liveAngle += gDiff * gravityStrength * gFalloff;
        }
      }

      // --- AWAKENING: blend from startAngle to live wave angle ---
      var baseAngle = startAngle * (1 - awakenEased) + liveAngle * awakenEased;

      // --- RIPPLE INFLUENCE ---
      var rippleAngleOffset = 0;
      var rippleOpacityBoost = 0;
      var rippleLenBoost = 0;
      var ringWidth = 120;
      for (var rj = 0; rj < ripples.length; rj++) {
        var rp = ripples[rj];
        var rdx = p.x - rp.x;
        var rdy = p.y - rp.y;
        // Fast bounding-box reject before sqrt
        var ringOuter = rp.radius + 120;
        var ringInner = rp.radius - 120;
        if (rdx > ringOuter || rdx < -ringOuter || rdy > ringOuter || rdy < -ringOuter) continue;
        var rDist = _sqrt(rdx * rdx + rdy * rdy);
        if (rDist > ringOuter || (ringInner > 0 && rDist < ringInner)) continue;
        var distFromRing = _abs(rDist - rp.radius);

        if (distFromRing < ringWidth) {
          var ageFade = _max(0, 1 - rp.radius / rp.maxRadius);
          ageFade = ageFade * ageFade;
          var ringStrength = (1 - distFromRing / ringWidth) * ageFade;

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
      var wakeRadiusSq = wakeRadius * wakeRadius;
      for (var wi = 0; wi < wakeTrail.length; wi++) {
        var wp = wakeTrail[wi];
        var wdx2 = p.x - wp.x;
        var wdy2 = p.y - wp.y;
        // Fast bounding-box reject
        if (wdx2 > wakeRadius || wdx2 < -wakeRadius || wdy2 > wakeRadius || wdy2 < -wakeRadius) continue;
        var wDistSq2 = wdx2 * wdx2 + wdy2 * wdy2;
        if (wDistSq2 < wakeRadiusSq) {
          var wDist2 = _sqrt(wDistSq2);
          var wAge = (time - wp.time) / wakeMaxAge; // 0→1
          var wFade = (1 - wAge) * (1 - wAge); // quadratic fadeout
          var wStrength = (1 - wDist2 / wakeRadius) * wFade;
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
      var drawOpacity = (p.baseOpacity * lcOpacity) + rippleOpacityBoost + wakeOpacityBoost;
      var drawLen = (lineLen * lcLen) + rippleLenBoost;
      var widthScale = 1;
      var speed = returnSpeed;

      if (_vfScrollKick > 0) {
        speed = _max(speed, 0.38 + _vfScrollKick * 0.22);
      }

      // --- AWAKENING: fade opacity in ---
      drawOpacity *= awakenEased;

      if (isLandingPage) {
        var dxBH = dxCenter;
        var dyBH = dyCenter;
        var distBHSq = distCenterSq;

        if (distBHSq < blackHoleRadiusSq) {
          var distBH = _sqrt(distBHSq);
          var bhStrength = (1 - distBH / blackHoleRadius);
          bhStrength = bhStrength * bhStrength * bhStrength;
          bhResistance = bhStrength;
          var spiralOffset = bhStrength * 2.0 + _sin(time * 3.5 + p.seed1) * bhStrength * 0.6;
          var bhAngle = _atan2(dyBH, dxBH) + spiralOffset;
          targetAngle = bhAngle * bhStrength * awakenEased + baseAngle * (1 - bhStrength);
          drawOpacity = (p.baseOpacity * lcOpacity + bhStrength * 0.4 * opacityScale + rippleOpacityBoost + wakeOpacityBoost) * awakenEased;
          drawLen = lineLen * lcLen + bhStrength * 12 + rippleLenBoost;
          speed = returnSpeed + bhStrength * 0.3;
          if (distBH < 35) { var fade = distBH / 35; drawOpacity *= fade; drawLen = lineLen * lcLen * fade + bhStrength * 12 * fade; }
        }

        var dxEE = easterEggX - p.x;
        var dyEE = easterEggY - p.y;
        var distEESq = dxEE * dxEE + dyEE * dyEE;

        if (distEESq < easterEggRadiusSq) {
          var distEE = _sqrt(distEESq);
          var eeStrength = (1 - distEE / easterEggRadius);
          eeStrength = eeStrength * eeStrength;
          var eeSpiralOffset = eeStrength * 1.8 + _sin(time * 2.5 + p.seed2) * eeStrength * 0.5;
          var eeAngle = _atan2(dyEE, dxEE) + eeSpiralOffset;
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

      var dxM = mouseX - p.x;
      var dyM = mouseY - p.y;
      var distMSq = dxM * dxM + dyM * dyM;
      var particleMouseRadius = mouseInfluence + p.mouseRadiusOffset + _sin(time * 3 + p.seed1 * 5) * 25;
      var particleMouseRadiusSq = particleMouseRadius * particleMouseRadius;

      var particleNearEE = 0;
      if (isLandingPage) {
        var _dpeX = p.x - easterEggX;
        var _dpeY = p.y - easterEggY;
        var _dpeSq = _dpeX * _dpeX + _dpeY * _dpeY;
        if (_dpeSq < easterEggRadiusSq) {
          particleNearEE = _max(0, 1 - _sqrt(_dpeSq) / easterEggRadius);
        }
      }

      if (distMSq < particleMouseRadiusSq) {
        var distM = _sqrt(distMSq);
        var mStrength = (1 - distM / particleMouseRadius);
        mStrength = mStrength * mStrength;
        var mouseEffect = mStrength * (1 - bhResistance * 0.85);

        if (particleNearEE > 0) {
          var dimFactor = particleNearEE * mouseEffect;
          drawOpacity *= _max(0.02, 1 - dimFactor * 3);
        } else {
          var brightenAmount = mouseEffect * 0.3 * opacityScale;
          drawOpacity = _max(drawOpacity, p.baseOpacity * lcOpacity + brightenAmount);
        }

        var mouseDiff = angleDiff(targetAngle, _atan2(dyM, dxM));
        targetAngle += mouseDiff * mouseEffect * 0.9;
        drawLen = _max(drawLen, lineLen * lcLen + mouseEffect * 10 * (1 - eeSuppression * particleNearEE));
        speed = _max(speed, followSpeed + mouseEffect * 0.4);
      }

      if (bhResistance > 0.1) speed = _max(speed, returnSpeed + bhResistance * 0.35);

      p.currentAngle += angleDiff(p.currentAngle, targetAngle) * speed;
      while (p.currentAngle > PI) p.currentAngle -= TWO_PI;
      while (p.currentAngle < -PI) p.currentAngle += TWO_PI;

      if (revealActive) {
        var distCenter = _sqrt(distCenterSq);
        var edgeBoost = _max(0, 1 - _abs(distCenter - revealRadius) / 56);
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

      // Quantize opacity into bucket for batched drawing
      // Clamp to [0, 1] and map to bucket index
      var clampedOpacity = drawOpacity < 0 ? 0 : (drawOpacity > 1 ? 1 : drawOpacity);
      var bucketIdx = (clampedOpacity * (OPACITY_BUCKETS - 1) + 0.5) | 0;
      var useDarkBucket = revealActive && distCenterSq <= revealRadiusSq;
      var bucket = useDarkBucket ? bucketLinesDark[bucketIdx] : bucketLines[bucketIdx];
      bucket.push(p.x - cosA * halfLen, p.y - sinA * halfLen, p.x + cosA * halfLen, p.y + sinA * halfLen);
      if (useDarkBucket) {
        bucketWidthSumsDark[bucketIdx] += angleWidth;
        bucketCountsDark[bucketIdx]++;
      } else {
        bucketWidthSums[bucketIdx] += angleWidth;
        bucketCounts[bucketIdx]++;
      }
    }

    // --- BATCHED DRAW: one beginPath/stroke per opacity bucket ---
    strokeBuckets(bucketLines, bucketWidthSums, bucketCounts, revealActive ? lightLineColor : lineColor);
    if (revealActive) {
      strokeBuckets(bucketLinesDark, bucketWidthSumsDark, bucketCountsDark, darkLineColor);
    }

    // --- DRAW RIPPLE RINGS ---
    if (isLandingPage) {
      for (var rk = 0; rk < ripples.length; rk++) {
        var drip = ripples[rk];
        var ripAge = drip.radius / drip.maxRadius;
        var ripAlpha = (1 - ripAge) * (1 - ripAge) * 0.15;
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
      } else if (portalPresence > 0.012 || portalCharge > 0.01) {
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

      var dxEEm = mouseX - easterEggX;
      var dyEEm = mouseY - easterEggY;
      var distToEE = _sqrt(dxEEm * dxEEm + dyEEm * dyEEm);
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
        if (distToEE < 100 && mouseX > 0) {
          if (!easterEggVisible) { easterEgg.classList.add('is-visible'); easterEggVisible = true; }
        } else {
          if (easterEggVisible) { easterEgg.classList.remove('is-visible'); easterEggVisible = false; }
        }
      }
    }

    requestAnimationFrame(animate);
  }

  _vfResizeHandler = resize;
  window.addEventListener('resize', resize);
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

initVectorField();
