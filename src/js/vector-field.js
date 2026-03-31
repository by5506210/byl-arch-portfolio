// ============================================
// VECTOR FIELD — Magnetic line segments on landing
// ============================================

(function () {
  var canvas = document.getElementById('vector-field');
  if (!canvas) return;

  // Skip if returning from portfolio
  if (window.location.hash === '#portfolio') {
    canvas.style.display = 'none';
    return;
  }

  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;

  // Grid config
  var spacing = 28;
  var lineLen = 12;
  var influenceRadius = 180;
  var returnSpeed = 0.04;
  var followSpeed = 0.12;

  var mouseX = -1000;
  var mouseY = -1000;
  var particles = [];
  var running = true;

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);
    buildGrid();
  }

  function buildGrid() {
    particles = [];
    var cols = Math.ceil(window.innerWidth / spacing) + 1;
    var rows = Math.ceil(window.innerHeight / spacing) + 1;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        // Slight offset for organic feel
        var offsetX = (row % 2) * (spacing * 0.5);
        particles.push({
          x: col * spacing + offsetX,
          y: row * spacing,
          // Default angle: subtle ambient noise based on position
          baseAngle: Math.sin(col * 0.3) * 0.4 + Math.cos(row * 0.4) * 0.3,
          currentAngle: 0,
          targetAngle: 0,
          opacity: 0.08 + Math.random() * 0.06
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

  function animate() {
    if (!running) return;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var dx = mouseX - p.x;
      var dy = mouseY - p.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < influenceRadius) {
        // Point toward cursor with strength based on proximity
        var angleToMouse = Math.atan2(dy, dx);
        var strength = 1 - (dist / influenceRadius);
        strength = strength * strength; // Quadratic falloff — snappier near cursor

        p.targetAngle = angleToMouse;

        // Lerp faster when closer
        p.currentAngle += (p.targetAngle - p.currentAngle) * (followSpeed + strength * 0.25);

        // Boost opacity near cursor
        var drawOpacity = p.opacity + strength * 0.35;

        // Line length grows near cursor
        var drawLen = lineLen + strength * 8;

        drawLine(p.x, p.y, p.currentAngle, drawLen, drawOpacity);
      } else {
        // Return to base angle
        p.targetAngle = p.baseAngle;
        p.currentAngle += (p.targetAngle - p.currentAngle) * returnSpeed;

        drawLine(p.x, p.y, p.currentAngle, lineLen, p.opacity);
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
    ctx.strokeStyle = 'rgba(232, 228, 223, ' + opacity + ')';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Add subtle ambient drift over time
  var time = 0;
  var originalAnimate = animate;
  animate = function () {
    if (!running) return;
    time += 0.003;

    // Slowly drift base angles for living feel
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var col = (p.x / spacing) | 0;
      var row = (p.y / spacing) | 0;
      p.baseAngle = Math.sin(col * 0.3 + time) * 0.5 + Math.cos(row * 0.4 + time * 0.7) * 0.4;
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var dx = mouseX - p.x;
      var dy = mouseY - p.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < influenceRadius) {
        var angleToMouse = Math.atan2(dy, dx);
        var strength = 1 - (dist / influenceRadius);
        strength = strength * strength;

        p.targetAngle = angleToMouse;
        p.currentAngle += (p.targetAngle - p.currentAngle) * (followSpeed + strength * 0.25);

        var drawOpacity = p.opacity + strength * 0.4;
        var drawLen = lineLen + strength * 10;

        drawLine(p.x, p.y, p.currentAngle, drawLen, drawOpacity);
      } else {
        p.targetAngle = p.baseAngle;
        p.currentAngle += (p.targetAngle - p.currentAngle) * returnSpeed;

        drawLine(p.x, p.y, p.currentAngle, lineLen, p.opacity);
      }
    }

    requestAnimationFrame(animate);
  };

  window.addEventListener('resize', resize);
  resize();
  animate();

  // Stop animation when landing transitions away
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
