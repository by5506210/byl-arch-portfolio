// ============================================
// VECTOR FIELD — Magnetic line segments on landing
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

  var spacing = 30;
  var lineLen = 13;
  var influenceRadius = 200;
  var returnSpeed = 0.06;
  var followSpeed = 0.18;

  var mouseX = -1000;
  var mouseY = -1000;
  var particles = [];
  var running = true;
  var time = 0;

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    buildGrid();
  }

  function buildGrid() {
    particles = [];
    var cols = Math.ceil(window.innerWidth / spacing) + 1;
    var rows = Math.ceil(window.innerHeight / spacing) + 1;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var baseAngle = Math.sin(col * 0.3) * 0.4 + Math.cos(row * 0.4) * 0.3;
        particles.push({
          x: col * spacing + spacing * 0.5,
          y: row * spacing + spacing * 0.5,
          col: col,
          row: row,
          baseAngle: baseAngle,
          currentAngle: baseAngle,
          targetAngle: baseAngle,
          baseOpacity: 0.07 + Math.random() * 0.05
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

  // Shortest angle difference — prevents 360 flip
  function angleDiff(from, to) {
    var diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  function animate() {
    if (!running) return;
    time += 0.008;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      // Ambient drift — wave-like flowing motion
      p.baseAngle = Math.sin(p.col * 0.25 + time * 1.2) * 0.6
                   + Math.cos(p.row * 0.3 + time * 0.8) * 0.5
                   + Math.sin((p.col + p.row) * 0.15 + time * 0.5) * 0.3;

      var dx = mouseX - p.x;
      var dy = mouseY - p.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      var drawOpacity = p.baseOpacity;
      var drawLen = lineLen;

      if (dist < influenceRadius) {
        var angleToMouse = Math.atan2(dy, dx);
        var strength = 1 - (dist / influenceRadius);
        strength = strength * strength * strength; // Cubic falloff

        // Blend between base angle and mouse angle using shortest path
        var diff = angleDiff(p.currentAngle, angleToMouse);
        p.currentAngle += diff * (followSpeed + strength * 0.4);

        drawOpacity = p.baseOpacity + strength * 0.45;
        drawLen = lineLen + strength * 10;
      } else {
        // Return to base angle via shortest path
        var diff = angleDiff(p.currentAngle, p.baseAngle);
        p.currentAngle += diff * returnSpeed;
      }

      // Normalize angle to prevent accumulation
      while (p.currentAngle > Math.PI) p.currentAngle -= Math.PI * 2;
      while (p.currentAngle < -Math.PI) p.currentAngle += Math.PI * 2;

      drawLine(p.x, p.y, p.currentAngle, drawLen, drawOpacity);
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
    ctx.strokeStyle = 'rgba(232, 228, 223, ' + opacity + ')';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  window.addEventListener('resize', resize);
  resize();
  animate();

  // Stop when landing transitions away
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
