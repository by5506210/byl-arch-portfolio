// ============================================
// VECTOR FIELD — Chaotic field with spring-back black hole
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

  var spacing = 24;
  var lineLen = 15;
  var mouseInfluence = 220;
  var returnSpeed = 0.08;
  var followSpeed = 0.25;

  var blackHoleRadius = 280;

  var mouseX = -1000;
  var mouseY = -1000;
  var centerX = 0;
  var centerY = 0;
  var particles = [];
  var running = true;
  var time = 0;

  var portal = document.getElementById('landing-portal');
  var portalVisible = false;
  var portalRevealDist = 160;

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
          baseOpacity: 0.18 + Math.random() * 0.1,
          seed1: Math.random() * 100,
          seed2: Math.random() * 100,
          seed3: Math.random() * 100,
          seed4: Math.random() * 100,
          drift: (Math.random() - 0.5) * 3,
          // Per-particle irregular mouse influence radius
          mouseRadiusOffset: (Math.random() - 0.5) * 80
        });
      }
    }
  }

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

  if (landing) {
    landing.addEventListener('touchstart', function (e) {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
    }, { passive: true });
    landing.addEventListener('touchmove', function (e) {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
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
    time += 0.016;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Portal reveal
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

      // === CHAOTIC AMBIENT MOTION ===
      var t1 = time * 2.0 + p.seed1;
      var t2 = time * 1.2 + p.seed2;
      var t3 = time * 2.8 + p.seed3;
      var t4 = time * 0.7 + p.seed4;

      // Large sweeping flow
      var flow = Math.sin(p.x * 0.003 + t2 * 0.5) * 1.2
               + Math.cos(p.y * 0.004 + t4 * 0.4) * 1.0;

      // Regional turbulence — fast, chaotic
      var turb = Math.sin(p.x * 0.018 + p.y * 0.009 + t1) * 1.1
               + Math.cos(p.x * 0.012 - p.y * 0.015 + t3) * 0.9;

      // Per-particle jitter — high frequency, unique to each
      var jitter = Math.sin(t1 * 4.0 + p.seed1 * 12) * 0.6
                 + Math.cos(t3 * 3.5 + p.seed2 * 9) * 0.5
                 + Math.sin(t4 * 5.0 + p.seed3 * 7) * 0.3;

      // Gusts — large sweeping directional changes
      var gust = Math.sin(p.x * 0.002 + time * 2.2) * Math.cos(p.y * 0.003 + time * 0.9) * 1.5;

      // Random drift per particle
      var particleDrift = p.drift * Math.sin(time * 1.2 + p.seed3) * 0.7;

      var baseAngle = flow + turb + jitter + gust + particleDrift;

      // === BLACK HOLE — Spring-back behavior ===
      var dxBH = centerX - p.x;
      var dyBH = centerY - p.y;
      var distBH = Math.sqrt(dxBH * dxBH + dyBH * dyBH);

      // How much the black hole resists disturbance (stronger near center)
      var bhResistance = 0; // 0 = no resistance, 1 = full lock to black hole

      var targetAngle = baseAngle;
      var drawOpacity = p.baseOpacity;
      var drawLen = lineLen;
      var speed = returnSpeed;

      if (distBH < blackHoleRadius) {
        var angleToBH = Math.atan2(dyBH, dxBH);
        var bhStrength = (1 - distBH / blackHoleRadius);
        bhStrength = bhStrength * bhStrength * bhStrength;

        // Resistance: near center = strong spring back, far = weak
        bhResistance = bhStrength;

        // Spiral with variation
        var spiralOffset = bhStrength * 1.8 + Math.sin(time * 3.5 + p.seed1) * bhStrength * 0.5;
        var bhAngle = angleToBH + spiralOffset;

        // Blend: near center mostly black hole angle, far mostly ambient
        targetAngle = bhAngle * bhStrength + baseAngle * (1 - bhStrength);

        drawOpacity = p.baseOpacity + bhStrength * 0.35;
        drawLen = lineLen + bhStrength * 10;
        speed = returnSpeed + bhStrength * 0.25;

        // Event horizon
        if (distBH < 30) {
          var fade = distBH / 30;
          drawOpacity *= fade;
          drawLen *= fade;
        }
      }

      // === MOUSE CURSOR — Irregular influence shape ===
      var dxM = mouseX - p.x;
      var dyM = mouseY - p.y;
      var distM = Math.sqrt(dxM * dxM + dyM * dyM);

      // Each particle has a different radius for the mouse influence
      var particleMouseRadius = mouseInfluence + p.mouseRadiusOffset;
      // Add time-varying wobble to the radius
      particleMouseRadius += Math.sin(time * 3 + p.seed1 * 5) * 25;

      if (distM < particleMouseRadius) {
        var angleToMouse = Math.atan2(dyM, dxM);
        var mStrength = (1 - distM / particleMouseRadius);
        mStrength = mStrength * mStrength;

        // Reduce mouse influence based on black hole resistance
        // Near center: mouse has little effect. Far: full effect.
        var mouseEffect = mStrength * (1 - bhResistance * 0.85);

        var mouseDiff = angleDiff(targetAngle, angleToMouse);
        targetAngle += mouseDiff * mouseEffect * 0.9;

        drawOpacity = Math.max(drawOpacity, p.baseOpacity + mouseEffect * 0.4);
        drawLen = Math.max(drawLen, lineLen + mouseEffect * 12);
        speed = Math.max(speed, followSpeed + mouseEffect * 0.4);
      }

      // Spring back: if inside black hole zone, speed toward black hole angle
      // is boosted (resistance makes it snap back faster after disturbance)
      if (bhResistance > 0.1) {
        speed = Math.max(speed, returnSpeed + bhResistance * 0.35);
      }

      var diff = angleDiff(p.currentAngle, targetAngle);
      p.currentAngle += diff * speed;

      while (p.currentAngle > Math.PI) p.currentAngle -= Math.PI * 2;
      while (p.currentAngle < -Math.PI) p.currentAngle += Math.PI * 2;

      drawLine(p.x, p.y, p.currentAngle, drawLen, drawOpacity);
    }

    // Glow at center
    var glowGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 90);
    glowGrad.addColorStop(0, 'rgba(232, 228, 223, 0.05)');
    glowGrad.addColorStop(1, 'rgba(232, 228, 223, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(centerX - 90, centerY - 90, 180, 180);

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
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  window.addEventListener('resize', resize);
  resize();
  animate();

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
