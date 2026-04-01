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
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    _vfMouseX = e.touches[0].clientX;
    _vfMouseY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function () {
    _vfMouseX = -1000;
    _vfMouseY = -1000;
  });
}

function initVectorField() {
  var canvas = document.getElementById('vector-field');
  if (!canvas) return;

  var isLandingPage = !!document.getElementById('landing');
  if (isLandingPage && window.location.hash === '#portfolio') {
    canvas.style.display = 'none';
    return;
  }

  // Kill previous instance by incrementing ID
  _vectorFieldInstanceId++;
  var myId = _vectorFieldInstanceId;

  // Remove old resize handler
  if (_vfResizeHandler) {
    window.removeEventListener('resize', _vfResizeHandler);
  }

  // Attach mouse/touch listeners once
  _vfAttachListeners();

  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;

  var isDarkLines = canvas.getAttribute('data-color') === 'dark';
  var lineColor = isDarkLines ? '26, 26, 26' : '232, 228, 223';

  var isContentPage = !isLandingPage;
  var opacityScale = isContentPage ? 0.5 : 1.0;

  // Mobile detection for zoom-out
  var isMobile = window.innerWidth < 768;

  // --- CONTRAST: bolder lines, higher opacity ---
  var spacing = isMobile ? 16 : 24;
  var lineLen = isContentPage ? 12 : (isMobile ? 11 : 16);
  var lineWidth = isContentPage ? 1 : (isMobile ? 1.2 : 1.7);
  var mouseInfluence = 220;
  var returnSpeed = 0.08;
  var followSpeed = 0.25;
  var blackHoleRadius = 300;

  var centerX = 0;
  var centerY = 0;
  var particles = [];
  var time = 0;
  var lastFrameTime = 0;

  var portal = isLandingPage ? document.getElementById('landing-portal') : null;
  var portalVisible = false;
  var portalRevealDist = 160;

  var easterEggX = 0;
  var easterEggY = 0;
  var easterEggRadius = 200;
  var easterEgg = isLandingPage ? document.getElementById('easter-egg-portal') : null;
  var easterEggVisible = false;

  // --- RIPPLE SYSTEM (PS5-style) ---
  var ripples = [];
  var rippleMaxRadius = Math.max(window.innerWidth, window.innerHeight) * 0.8;
  var rippleSpeed = 280; // px per second
  var rippleCooldown = 0.35; // seconds between ripples
  var lastRippleTime = -10;
  var wasNearPortal = false;

  canvas.style.pointerEvents = 'none';

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    centerX = window.innerWidth / 2;
    centerY = window.innerHeight / 2;
    easterEggX = window.innerWidth * 0.82;
    easterEggY = window.innerHeight * 0.78;
    isMobile = window.innerWidth < 768;
    spacing = isMobile ? 16 : 24;
    lineLen = isContentPage ? 12 : (isMobile ? 11 : 16);
    lineWidth = isContentPage ? 1 : (isMobile ? 1.2 : 1.7);
    rippleMaxRadius = Math.max(window.innerWidth, window.innerHeight) * 0.8;
    buildGrid();
  }

  function buildGrid() {
    particles = [];
    var cols = Math.ceil(window.innerWidth / spacing) + 1;
    var rows = Math.ceil(window.innerHeight / spacing) + 1;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        particles.push({
          x: col * spacing + spacing * 0.5,
          y: row * spacing + spacing * 0.5,
          currentAngle: Math.random() * Math.PI * 2,
          // --- CONTRAST: higher base opacity ---
          baseOpacity: (0.24 + Math.random() * 0.12) * opacityScale,
          seed1: Math.random() * 100,
          seed2: Math.random() * 100,
          seed3: Math.random() * 100,
          // --- REDUCED random drift ---
          drift: (Math.random() - 0.5) * 1.0,
          mouseRadiusOffset: (Math.random() - 0.5) * 80
        });
      }
    }
  }

  function angleDiff(from, to) {
    var d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
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

  function animate(timestamp) {
    // Check if this instance is still active
    if (myId !== _vectorFieldInstanceId) return;

    if (!lastFrameTime) lastFrameTime = timestamp;
    var dt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;
    if (dt > 0.1) dt = 0.016;
    time += dt;

    var mouseX = _vfMouseX;
    var mouseY = _vfMouseY;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Portal reveal + ripple trigger
    if (portal) {
      var dxP = mouseX - centerX;
      var dyP = mouseY - centerY;
      var distToCenter = Math.sqrt(dxP * dxP + dyP * dyP);

      if (distToCenter < portalRevealDist && mouseX > 0) {
        if (!portalVisible) { portal.classList.add('is-visible'); portalVisible = true; }
        // Spawn ripple when cursor enters portal zone
        if (!wasNearPortal) {
          spawnRipple();
          wasNearPortal = true;
        }
        // Continuous gentle ripples while hovering close
        if (distToCenter < 80) {
          spawnRipple();
        }
      } else {
        if (portalVisible) { portal.classList.remove('is-visible'); portalVisible = false; }
        wasNearPortal = false;
      }
    }

    // Update ripples
    for (var ri = ripples.length - 1; ri >= 0; ri--) {
      var rip = ripples[ri];
      rip.radius += rippleSpeed * dt;
      if (rip.radius > rip.maxRadius) {
        ripples.splice(ri, 1);
      }
    }

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      // --- STRONGER WAVES: increased amplitudes for more coherent flow ---
      var wavePhase = p.x * 0.006 + time * 1.6;
      var swell = Math.sin(wavePhase) * 1.1 + Math.sin(p.x * 0.004 + p.y * 0.008 + time * 1.15) * 0.8;
      var cross = Math.cos(p.y * 0.01 + time * 0.9) * 0.55 + Math.sin(p.x * 0.012 - time * 1.25) * 0.4;
      var deep = Math.sin((p.x + p.y) * 0.003 + time * 0.45) * 0.65;

      // --- REDUCED RANDOM: much smaller random component ---
      var random = p.drift * Math.sin(time * 0.7 + p.seed1) * 0.08
                 + Math.sin(time * 1.3 + p.seed2 * 5) * 0.05
                 + Math.cos(time * 0.9 + p.seed3 * 3) * 0.04;

      var baseAngle = swell + cross + deep + random;

      // --- RIPPLE INFLUENCE on vectors ---
      var rippleAngleOffset = 0;
      var rippleOpacityBoost = 0;
      var rippleLenBoost = 0;
      for (var rj = 0; rj < ripples.length; rj++) {
        var rp = ripples[rj];
        var rdx = p.x - rp.x;
        var rdy = p.y - rp.y;
        var rDist = Math.sqrt(rdx * rdx + rdy * rdy);
        var ringWidth = 120;
        var distFromRing = Math.abs(rDist - rp.radius);

        if (distFromRing < ringWidth) {
          var rippleAge = time - rp.birthTime;
          var ageFade = Math.max(0, 1 - rp.radius / rp.maxRadius);
          ageFade = ageFade * ageFade;
          var ringStrength = (1 - distFromRing / ringWidth) * ageFade;

          // Push vectors tangentially (perpendicular to radial direction)
          var radialAngle = Math.atan2(rdy, rdx);
          // Vectors align tangent to the ripple ring, with a slight outward push
          var tangentAngle = radialAngle + Math.PI * 0.5;
          var outwardPush = radialAngle * 0.15;
          rippleAngleOffset += angleDiff(0, tangentAngle + outwardPush) * ringStrength * 0.7;
          rippleOpacityBoost += ringStrength * 0.2 * opacityScale;
          rippleLenBoost += ringStrength * 6;
        }
      }

      baseAngle += rippleAngleOffset;

      var bhResistance = 0;
      var targetAngle = baseAngle;
      var drawOpacity = p.baseOpacity + rippleOpacityBoost;
      var drawLen = lineLen + rippleLenBoost;
      var speed = returnSpeed;

      if (isLandingPage) {
        var dxBH = centerX - p.x;
        var dyBH = centerY - p.y;
        var distBH = Math.sqrt(dxBH * dxBH + dyBH * dyBH);

        if (distBH < blackHoleRadius) {
          var bhStrength = (1 - distBH / blackHoleRadius);
          bhStrength = bhStrength * bhStrength * bhStrength;
          bhResistance = bhStrength;
          var spiralOffset = bhStrength * 2.0 + Math.sin(time * 3.5 + p.seed1) * bhStrength * 0.6;
          var bhAngle = Math.atan2(dyBH, dxBH) + spiralOffset;
          targetAngle = bhAngle * bhStrength + baseAngle * (1 - bhStrength);
          drawOpacity = p.baseOpacity + bhStrength * 0.4 * opacityScale + rippleOpacityBoost;
          drawLen = lineLen + bhStrength * 12 + rippleLenBoost;
          speed = returnSpeed + bhStrength * 0.3;
          if (distBH < 30) { var fade = distBH / 30; drawOpacity *= fade; drawLen *= fade; }
        }

        var dxEE = easterEggX - p.x;
        var dyEE = easterEggY - p.y;
        var distEE = Math.sqrt(dxEE * dxEE + dyEE * dyEE);

        if (distEE < easterEggRadius) {
          var eeStrength = (1 - distEE / easterEggRadius);
          eeStrength = eeStrength * eeStrength;
          var eeSpiralOffset = eeStrength * 1.8 + Math.sin(time * 2.5 + p.seed2) * eeStrength * 0.5;
          var eeAngle = Math.atan2(dyEE, dxEE) + eeSpiralOffset;
          var eeDiff = angleDiff(targetAngle, eeAngle);
          targetAngle += eeDiff * eeStrength * 0.8;

          // Base dimming from proximity to easter egg
          var baseDim = eeStrength * 0.8;

          // Extra dimming when cursor is near the easter egg
          var dxCursorEE = mouseX - easterEggX;
          var dyCursorEE = mouseY - easterEggY;
          var cursorToEE = Math.sqrt(dxCursorEE * dxCursorEE + dyCursorEE * dyCursorEE);
          var cursorNearEE = Math.max(0, 1 - cursorToEE / 200);
          // When cursor hovers: nearly invisible
          var totalDim = baseDim + cursorNearEE * eeStrength * 0.9;
          if (totalDim > 0.98) totalDim = 0.98;

          drawOpacity *= (1 - totalDim);
          speed = Math.max(speed, returnSpeed + eeStrength * 0.2);
        }
      }

      var dxM = mouseX - p.x;
      var dyM = mouseY - p.y;
      var distM = Math.sqrt(dxM * dxM + dyM * dyM);
      var particleMouseRadius = mouseInfluence + p.mouseRadiusOffset + Math.sin(time * 3 + p.seed1 * 5) * 25;

      // How close is the CURSOR to the easter egg?
      var eeSuppression = 0;
      if (isLandingPage) {
        var _dce = Math.sqrt((mouseX - easterEggX) * (mouseX - easterEggX) + (mouseY - easterEggY) * (mouseY - easterEggY));
        eeSuppression = Math.max(0, 1 - _dce / 250);
        eeSuppression = eeSuppression * eeSuppression;
      }

      // How close is THIS PARTICLE to the easter egg?
      var particleNearEE = 0;
      if (isLandingPage) {
        var _dpe = Math.sqrt((p.x - easterEggX) * (p.x - easterEggX) + (p.y - easterEggY) * (p.y - easterEggY));
        particleNearEE = Math.max(0, 1 - _dpe / easterEggRadius);
      }

      if (distM < particleMouseRadius) {
        var mStrength = (1 - distM / particleMouseRadius);
        mStrength = mStrength * mStrength;
        var mouseEffect = mStrength * (1 - bhResistance * 0.85);

        if (particleNearEE > 0) {
          // Particles near easter egg: cursor ALWAYS dims, never brightens
          var dimFactor = particleNearEE * mouseEffect;
          drawOpacity *= Math.max(0.02, 1 - dimFactor * 3);
        } else {
          // Normal brightening for all other particles
          var brightenAmount = mouseEffect * 0.3 * opacityScale;
          drawOpacity = Math.max(drawOpacity, p.baseOpacity + brightenAmount);
        }

        var mouseDiff = angleDiff(targetAngle, Math.atan2(dyM, dxM));
        targetAngle += mouseDiff * mouseEffect * 0.9;
        drawLen = Math.max(drawLen, lineLen + mouseEffect * 10 * (1 - eeSuppression * particleNearEE));
        speed = Math.max(speed, followSpeed + mouseEffect * 0.4);
      }

      if (bhResistance > 0.1) speed = Math.max(speed, returnSpeed + bhResistance * 0.35);

      p.currentAngle += angleDiff(p.currentAngle, targetAngle) * speed;
      while (p.currentAngle > Math.PI) p.currentAngle -= Math.PI * 2;
      while (p.currentAngle < -Math.PI) p.currentAngle += Math.PI * 2;

      // Inline draw for performance (no function call overhead)
      var halfLen = drawLen / 2;
      var cos = Math.cos(p.currentAngle);
      var sin = Math.sin(p.currentAngle);
      ctx.beginPath();
      ctx.moveTo(p.x - cos * halfLen, p.y - sin * halfLen);
      ctx.lineTo(p.x + cos * halfLen, p.y + sin * halfLen);
      ctx.strokeStyle = 'rgba(' + lineColor + ', ' + drawOpacity + ')';
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    // --- DRAW RIPPLE RINGS ---
    if (isLandingPage) {
      for (var rk = 0; rk < ripples.length; rk++) {
        var drip = ripples[rk];
        var ripAge = drip.radius / drip.maxRadius;
        var ripAlpha = (1 - ripAge) * (1 - ripAge) * 0.15;
        if (ripAlpha < 0.005) continue;

        // Draw 2 concentric rings per ripple for depth
        ctx.beginPath();
        ctx.arc(drip.x, drip.y, drip.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(' + lineColor + ', ' + ripAlpha + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner ring slightly behind
        var innerR = drip.radius * 0.85;
        if (innerR > 5) {
          ctx.beginPath();
          ctx.arc(drip.x, drip.y, innerR, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(' + lineColor + ', ' + (ripAlpha * 0.5) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // Glows — landing only
    if (isLandingPage) {
      var glowGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 140);
      glowGrad.addColorStop(0, 'rgba(' + lineColor + ', 0.10)');
      glowGrad.addColorStop(0.5, 'rgba(' + lineColor + ', 0.04)');
      glowGrad.addColorStop(1, 'rgba(' + lineColor + ', 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(centerX - 140, centerY - 140, 280, 280);

      var dxEEm = mouseX - easterEggX;
      var dyEEm = mouseY - easterEggY;
      var distToEE = Math.sqrt(dxEEm * dxEEm + dyEEm * dyEEm);
      var cursorProximity = Math.max(0, 1 - distToEE / 200);
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
            _vectorFieldInstanceId++; // kill this loop
            observer.disconnect();
          }
        }
      });
    });
    observer.observe(landing, { attributes: true });
  }
}

initVectorField();
