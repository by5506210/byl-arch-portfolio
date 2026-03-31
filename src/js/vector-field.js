// ============================================
// VECTOR FIELD — Magnetic field with black hole center
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

  var spacing = 28;
  var lineLen = 12;
  var mouseInfluence = 180;
  var returnSpeed = 0.05;
  var followSpeed = 0.15;

  // Black hole at center of screen
  var blackHoleRadius = 220;
  var blackHoleStrength = 0.9;

  var mouseX = -1000;
  var mouseY = -1000;
  var centerX = 0;
  var centerY = 0;
  var particles = [];
  var running = true;
  var time = 0;

  var portal = document.getElementById('landing-portal');
  var portalVisible = false;
  var portalRevealDist = 200;

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
          baseOpacity: 0.06 + Math.random() * 0.04
        });
      }
    }
  }

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  document.addEventListener('mouseleave', function () {
    mouseX = -1000;
    mouseY = -1000;
  });

  function angleDiff(from, to) {
    var d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function animate() {
    if (!running) return;
    time += 0.006;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Check cursor distance to center for portal reveal
    var dxPortal = mouseX - centerX;
    var dyPortal = mouseY - centerY;
    var distToCenter = Math.sqrt(dxPortal * dxPortal + dyPortal * dyPortal);

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

      // Ambient flow — organic drifting waves
      var baseAngle = Math.sin(p.col * 0.2 + time * 1.0) * 0.7
                    + Math.cos(p.row * 0.25 + time * 0.6) * 0.5
                    + Math.sin((p.col + p.row) * 0.12 + time * 0.4) * 0.4
                    + Math.cos(p.col * 0.08 - time * 0.3) * 0.3;

      var targetAngle = baseAngle;
      var drawOpacity = p.baseOpacity;
      var drawLen = lineLen;
      var speed = returnSpeed;

      // Black hole influence — always active at center
      var dxBH = centerX - p.x;
      var dyBH = centerY - p.y;
      var distBH = Math.sqrt(dxBH * dxBH + dyBH * dyBH);

      if (distBH < blackHoleRadius) {
        var angleToBH = Math.atan2(dyBH, dxBH);
        var bhStrength = (1 - distBH / blackHoleRadius);
        bhStrength = bhStrength * bhStrength * bhStrength; // Cubic

        // Spiral effect — rotate slightly for vortex look
        var spiralOffset = bhStrength * 0.8;
        targetAngle = angleToBH + spiralOffset;

        drawOpacity = p.baseOpacity + bhStrength * 0.3;
        drawLen = lineLen + bhStrength * 6;
        speed = returnSpeed + bhStrength * 0.15;

        // Very close to center — lines get dimmer (event horizon)
        if (distBH < 40) {
          var fade = distBH / 40;
          drawOpacity *= fade;
          drawLen *= fade;
        }
      }

      // Mouse cursor influence — layered on top
      var dxM = mouseX - p.x;
      var dyM = mouseY - p.y;
      var distM = Math.sqrt(dxM * dxM + dyM * dyM);

      if (distM < mouseInfluence) {
        var angleToMouse = Math.atan2(dyM, dxM);
        var mStrength = (1 - distM / mouseInfluence);
        mStrength = mStrength * mStrength;

        // Blend mouse influence with current target
        var mouseDiff = angleDiff(targetAngle, angleToMouse);
        targetAngle += mouseDiff * mStrength * 0.8;

        drawOpacity = Math.max(drawOpacity, p.baseOpacity + mStrength * 0.4);
        drawLen = Math.max(drawLen, lineLen + mStrength * 8);
        speed = Math.max(speed, followSpeed + mStrength * 0.3);
      }

      // Shortest-path angle interpolation
      var diff = angleDiff(p.currentAngle, targetAngle);
      p.currentAngle += diff * speed;

      // Normalize
      while (p.currentAngle > Math.PI) p.currentAngle -= Math.PI * 2;
      while (p.currentAngle < -Math.PI) p.currentAngle += Math.PI * 2;

      drawLine(p.x, p.y, p.currentAngle, drawLen, drawOpacity);
    }

    // Draw subtle radial glow at center
    var glowGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 60);
    glowGrad.addColorStop(0, 'rgba(232, 228, 223, 0.04)');
    glowGrad.addColorStop(1, 'rgba(232, 228, 223, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(centerX - 60, centerY - 60, 120, 120);

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
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  window.addEventListener('resize', resize);
  resize();
  animate();

  // Stop when landing hides
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
})();
