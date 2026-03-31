// ============================================
// VECTOR FIELD — Ocean waves with black hole center
// ============================================

(function () {
  var canvas = document.getElementById('vector-field');
  if (!canvas) return;

  if (window.location.hash === '#portfolio') {
    canvas.style.display = 'none';
    return;
  }

  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;

  var spacing = 26;
  var lineLen = 14;
  var mouseInfluence = 200;
  var returnSpeed = 0.07;
  var followSpeed = 0.2;

  var blackHoleRadius = 250;

  var mouseX = -1000;
  var mouseY = -1000;
  var centerX = 0;
  var centerY = 0;
  var particles = [];
  var running = true;
  var time = 0;

  var portal = document.getElementById('landing-portal');
  var portalVisible = false;
  var portalRevealDist = 220;

  // Make canvas transparent to pointer events so portal is clickable
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
          baseOpacity: 0.14 + Math.random() * 0.08
        });
      }
    }
  }

  // Track mouse on the landing div itself (not just document)
  var landing = document.getElementById('landing');
  if (landing) {
    landing.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
  }
  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  document.addEventListener('mouseleave', function () {
    mouseX = -1000;
    mouseY = -1000;
  });

  // Also support touch for portal reveal on mobile
  if (landing) {
    landing.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      mouseX = t.clientX;
      mouseY = t.clientY;
    }, { passive: true });
    landing.addEventListener('touchmove', function (e) {
      var t = e.touches[0];
      mouseX = t.clientX;
      mouseY = t.clientY;
    }, { passive: true });
  }

  function angleDiff(from, to) {
    var d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function animate() {
    if (!running) return;
    time += 0.012; // Faster for vigorous motion

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Portal reveal check
    var dxP = mouseX - centerX;
    var dyP = mouseY - centerY;
    var distToCenter = Math.sqrt(dxP * dxP + dyP * dyP);

    if (portal) {
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

      // Ocean wave flow — dominant horizontal direction with rolling swells
      // Main current: flows right with undulation
      var waveY = p.y / window.innerHeight; // 0-1 vertical position
      var wavePhase = p.x * 0.008 + time * 2.5; // fast horizontal sweep

      // Primary ocean swell — large rolling waves
      var swell = Math.sin(wavePhase) * 1.2
                + Math.sin(p.x * 0.005 + p.y * 0.01 + time * 1.8) * 0.8;

      // Cross-current — perpendicular ripples
      var cross = Math.cos(p.y * 0.012 + time * 1.4) * 0.5
                + Math.sin(p.x * 0.015 - time * 2.0) * 0.4;

      // Deep undercurrent — slow, wide
      var deep = Math.sin((p.x + p.y) * 0.003 + time * 0.6) * 0.6;

      // Turbulence near edges — chaotic foam
      var edgeDist = Math.min(p.x, p.y, window.innerWidth - p.x, window.innerHeight - p.y) / 100;
      var turbulence = edgeDist < 1 ? (1 - edgeDist) * Math.sin(time * 5 + i) * 0.8 : 0;

      var baseAngle = swell + cross + deep + turbulence;

      var targetAngle = baseAngle;
      var drawOpacity = p.baseOpacity;
      var drawLen = lineLen;
      var speed = returnSpeed;

      // Wave brightness variation — brighter at wave crests
      var waveCrest = (Math.sin(wavePhase) + 1) * 0.5; // 0-1
      drawOpacity += waveCrest * 0.08;

      // Black hole vortex at center
      var dxBH = centerX - p.x;
      var dyBH = centerY - p.y;
      var distBH = Math.sqrt(dxBH * dxBH + dyBH * dyBH);

      if (distBH < blackHoleRadius) {
        var angleToBH = Math.atan2(dyBH, dxBH);
        var bhStrength = (1 - distBH / blackHoleRadius);
        bhStrength = bhStrength * bhStrength * bhStrength;

        // Strong spiral — more rotation for vigorous swirl
        var spiralOffset = bhStrength * 1.5 + Math.sin(time * 3) * bhStrength * 0.3;
        targetAngle = angleToBH + spiralOffset;

        drawOpacity = p.baseOpacity + bhStrength * 0.4;
        drawLen = lineLen + bhStrength * 8;
        speed = returnSpeed + bhStrength * 0.2;

        // Event horizon fade
        if (distBH < 35) {
          var fade = distBH / 35;
          drawOpacity *= fade;
          drawLen *= fade;
        }
      }

      // Mouse cursor influence
      var dxM = mouseX - p.x;
      var dyM = mouseY - p.y;
      var distM = Math.sqrt(dxM * dxM + dyM * dyM);

      if (distM < mouseInfluence) {
        var angleToMouse = Math.atan2(dyM, dxM);
        var mStrength = (1 - distM / mouseInfluence);
        mStrength = mStrength * mStrength;

        var mouseDiff = angleDiff(targetAngle, angleToMouse);
        targetAngle += mouseDiff * mStrength * 0.85;

        drawOpacity = Math.max(drawOpacity, p.baseOpacity + mStrength * 0.35);
        drawLen = Math.max(drawLen, lineLen + mStrength * 10);
        speed = Math.max(speed, followSpeed + mStrength * 0.35);
      }

      var diff = angleDiff(p.currentAngle, targetAngle);
      p.currentAngle += diff * speed;

      while (p.currentAngle > Math.PI) p.currentAngle -= Math.PI * 2;
      while (p.currentAngle < -Math.PI) p.currentAngle += Math.PI * 2;

      drawLine(p.x, p.y, p.currentAngle, drawLen, drawOpacity);
    }

    // Glow at center
    var glowGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 80);
    glowGrad.addColorStop(0, 'rgba(232, 228, 223, 0.06)');
    glowGrad.addColorStop(1, 'rgba(232, 228, 223, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(centerX - 80, centerY - 80, 160, 160);

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
    ctx.strokeStyle = 'rgba(232, 228, 223, ' + opacity + ')';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  window.addEventListener('resize', resize);
  resize();
  animate();

  // Stop when landing hides
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
})();
