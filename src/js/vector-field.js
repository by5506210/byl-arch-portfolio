// ============================================
// VECTOR FIELD — Ocean waves with spring-back black hole
// ============================================

// Track active instance so we can stop it on reinit
var _vectorFieldRunning = false;

function initVectorField() {
  var canvas = document.getElementById('vector-field');
  if (!canvas) return;

  // Stop any previous instance
  _vectorFieldRunning = false;

  var isLandingPage = !!document.getElementById('landing');
  if (isLandingPage && window.location.hash === '#portfolio') {
    canvas.style.display = 'none';
    return;
  }

  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;

  var isDarkLines = canvas.getAttribute('data-color') === 'dark';
  var lineColor = isDarkLines ? '26, 26, 26' : '232, 228, 223';

  // Content pages get subtler lines so they don't fight with content
  var isContentPage = !isLandingPage;
  var opacityScale = isContentPage ? 0.5 : 1.0;

  var spacing = 24;
  var lineLen = isContentPage ? 12 : 15;
  var mouseInfluence = 220;
  var returnSpeed = 0.08;
  var followSpeed = 0.25;
  var blackHoleRadius = 300;

  var mouseX = -1000;
  var mouseY = -1000;
  var centerX = 0;
  var centerY = 0;
  var particles = [];
  var running = true;
  _vectorFieldRunning = true;
  var time = 0;
  var lastFrameTime = 0;

  var portal = isLandingPage ? document.getElementById('landing-portal') : null;
  var portalVisible = false;
  var portalRevealDist = 160;

  // Easter egg: second black hole position (bottom-right area)
  var easterEggX = 0;
  var easterEggY = 0;
  var easterEggRadius = 200;
  var easterEgg = isLandingPage ? document.getElementById('easter-egg-portal') : null;
  var easterEggVisible = false;

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
    // Easter egg position — bottom-right quadrant
    easterEggX = window.innerWidth * 0.82;
    easterEggY = window.innerHeight * 0.78;
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
          col: col,
          row: row,
          currentAngle: Math.random() * Math.PI * 2,
          baseOpacity: (0.18 + Math.random() * 0.1) * opacityScale,
          seed1: Math.random() * 100,
          seed2: Math.random() * 100,
          seed3: Math.random() * 100,
          drift: (Math.random() - 0.5) * 3,
          mouseRadiusOffset: (Math.random() - 0.5) * 80
        });
      }
    }
  }

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseleave', function () {
    mouseX = -1000;
    mouseY = -1000;
  });

  // Touch support for mobile
  document.addEventListener('touchstart', function (e) {
    mouseX = e.touches[0].clientX;
    mouseY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    mouseX = e.touches[0].clientX;
    mouseY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', function () {
    mouseX = -1000;
    mouseY = -1000;
  });

  function angleDiff(from, to) {
    var d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function animate(timestamp) {
    if (!running || !_vectorFieldRunning) return;

    // Delta-time: consistent speed regardless of frame rate (60fps vs 120fps)
    if (!lastFrameTime) lastFrameTime = timestamp;
    var dt = (timestamp - lastFrameTime) / 1000; // seconds
    lastFrameTime = timestamp;
    // Clamp dt to avoid jumps on tab switch
    if (dt > 0.1) dt = 0.016;
    time += dt;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Portal reveal
    if (portal) {
      var dxP = mouseX - centerX;
      var dyP = mouseY - centerY;
      var distToCenter = Math.sqrt(dxP * dxP + dyP * dyP);

      if (distToCenter < portalRevealDist && mouseX > 0) {
        if (!portalVisible) {
          portal.classList.add('is-visible');
          portalVisible = true;
        }
      } else {
        if (portalVisible) {
          portal.classList.remove('is-visible');
          portalVisible = false;
        }
      }
    }

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      // === GENTLE WAVES WITH RANDOMNESS ===
      var wavePhase = p.x * 0.006 + time * 1.4;

      var swell = Math.sin(wavePhase) * 0.7
                + Math.sin(p.x * 0.004 + p.y * 0.008 + time * 1.0) * 0.5;

      var cross = Math.cos(p.y * 0.01 + time * 0.8) * 0.35
                + Math.sin(p.x * 0.012 - time * 1.1) * 0.25;

      var deep = Math.sin((p.x + p.y) * 0.003 + time * 0.4) * 0.4;

      // Per-particle randomness — each drifts independently
      var random = p.drift * Math.sin(time * 0.7 + p.seed1) * 0.3
                 + Math.sin(time * 1.3 + p.seed2 * 5) * 0.2
                 + Math.cos(time * 0.9 + p.seed3 * 3) * 0.15;

      var baseAngle = swell + cross + deep + random;

      var dxBH = centerX - p.x;
      var dyBH = centerY - p.y;
      var distBH = Math.sqrt(dxBH * dxBH + dyBH * dyBH);

      var bhResistance = 0;
      var targetAngle = baseAngle;
      var drawOpacity = p.baseOpacity;
      var drawLen = lineLen;
      var speed = returnSpeed;

      // Black hole — landing page only
      if (isLandingPage && distBH < blackHoleRadius) {
        var angleToBH = Math.atan2(dyBH, dxBH);
        var bhStrength = (1 - distBH / blackHoleRadius);
        bhStrength = bhStrength * bhStrength * bhStrength;
        bhResistance = bhStrength;

        var spiralOffset = bhStrength * 2.0 + Math.sin(time * 3.5 + p.seed1) * bhStrength * 0.6;
        var bhAngle = angleToBH + spiralOffset;
        targetAngle = bhAngle * bhStrength + baseAngle * (1 - bhStrength);

        drawOpacity = p.baseOpacity + bhStrength * 0.4 * opacityScale;
        drawLen = lineLen + bhStrength * 12;
        speed = returnSpeed + bhStrength * 0.3;

        if (distBH < 30) {
          var fade = distBH / 30;
          drawOpacity *= fade;
          drawLen *= fade;
        }
      }

      // Easter egg black hole — subtle, darker
      if (isLandingPage) {
        var dxEE = easterEggX - p.x;
        var dyEE = easterEggY - p.y;
        var distEE = Math.sqrt(dxEE * dxEE + dyEE * dyEE);

        if (distEE < easterEggRadius) {
          var eeStrength = (1 - distEE / easterEggRadius);
          eeStrength = eeStrength * eeStrength;
          var angleToEE = Math.atan2(dyEE, dxEE);
          var eeSpiralOffset = eeStrength * 1.8 + Math.sin(time * 2.5 + p.seed2) * eeStrength * 0.5;
          var eeAngle = angleToEE + eeSpiralOffset;

          // Stronger blend
          var eeDiff = angleDiff(targetAngle, eeAngle);
          targetAngle += eeDiff * eeStrength * 0.8;

          // Darken lines near easter egg
          drawOpacity *= (1 - eeStrength * 0.8);
          speed = Math.max(speed, returnSpeed + eeStrength * 0.2);
        }
      }

      // Mouse cursor — irregular shape
      var dxM = mouseX - p.x;
      var dyM = mouseY - p.y;
      var distM = Math.sqrt(dxM * dxM + dyM * dyM);

      var particleMouseRadius = mouseInfluence + p.mouseRadiusOffset;
      particleMouseRadius += Math.sin(time * 3 + p.seed1 * 5) * 25;

      if (distM < particleMouseRadius) {
        var angleToMouse = Math.atan2(dyM, dxM);
        var mStrength = (1 - distM / particleMouseRadius);
        mStrength = mStrength * mStrength;

        var mouseEffect = mStrength * (1 - bhResistance * 0.85);

        var mouseDiff = angleDiff(targetAngle, angleToMouse);
        targetAngle += mouseDiff * mouseEffect * 0.9;

        drawOpacity = Math.max(drawOpacity, p.baseOpacity + mouseEffect * 0.3 * opacityScale);
        drawLen = Math.max(drawLen, lineLen + mouseEffect * 10);
        speed = Math.max(speed, followSpeed + mouseEffect * 0.4);
      }

      if (bhResistance > 0.1) {
        speed = Math.max(speed, returnSpeed + bhResistance * 0.35);
      }

      var diff = angleDiff(p.currentAngle, targetAngle);
      p.currentAngle += diff * speed;

      while (p.currentAngle > Math.PI) p.currentAngle -= Math.PI * 2;
      while (p.currentAngle < -Math.PI) p.currentAngle += Math.PI * 2;

      drawLine(p.x, p.y, p.currentAngle, drawLen, drawOpacity);
    }

    // Glow at center — landing only (slightly increased)
    if (isLandingPage) {
      var glowGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 120);
      glowGrad.addColorStop(0, 'rgba(' + lineColor + ', 0.08)');
      glowGrad.addColorStop(0.5, 'rgba(' + lineColor + ', 0.03)');
      glowGrad.addColorStop(1, 'rgba(' + lineColor + ', 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(centerX - 120, centerY - 120, 240, 240);

      // Easter egg: dark spot — more noticeable
      var darkGrad = ctx.createRadialGradient(easterEggX, easterEggY, 0, easterEggX, easterEggY, 90);
      darkGrad.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
      darkGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.08)');
      darkGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = darkGrad;
      ctx.fillRect(easterEggX - 90, easterEggY - 90, 180, 180);

      // Easter egg portal reveal
      var dxEEm = mouseX - easterEggX;
      var dyEEm = mouseY - easterEggY;
      var distToEE = Math.sqrt(dxEEm * dxEEm + dyEEm * dyEEm);

      if (easterEgg) {
        if (distToEE < 100 && mouseX > 0) {
          if (!easterEggVisible) {
            easterEgg.classList.add('is-visible');
            easterEggVisible = true;
          }
        } else {
          if (easterEggVisible) {
            easterEgg.classList.remove('is-visible');
            easterEggVisible = false;
          }
        }
      }
    }

    requestAnimationFrame(animate);
  }

  function drawLine(x, y, angle, len, opacity) {
    var halfLen = len / 2;
    var x1 = x - Math.cos(angle) * halfLen;
    var y1 = y - Math.sin(angle) * halfLen;
    var x2 = x + Math.cos(angle) * halfLen;
    var y2 = y + Math.sin(angle) * halfLen;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(' + lineColor + ', ' + opacity + ')';
    ctx.lineWidth = isContentPage ? 1 : 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

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
            running = false;
            observer.disconnect();
          }
        }
      });
    });
    observer.observe(landing, { attributes: true });
  }
}

// Run on initial load
initVectorField();
