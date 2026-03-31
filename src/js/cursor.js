// ============================================
// CUSTOM CURSOR — iPad-style with magnetic nav
// ============================================

(function () {
  var cursor = document.createElement('div');
  cursor.classList.add('cursor');
  var isLanding = document.getElementById('landing');
  var onLandingPage = isLanding && isLanding.style.display !== 'none' && window.location.hash !== '#portfolio';
  if (!onLandingPage) {
    cursor.classList.add('cursor--dark');
  }
  document.body.appendChild(cursor);

  var mouseX = -100, mouseY = -100;
  var cursorX = -100, cursorY = -100;
  var snapping = false;

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function updateCursor() {
    if (!snapping) {
      var pullX = mouseX;
      var pullY = mouseY;

      // Black hole pull toward portal center on landing page
      if (isLanding && isLanding.style.display !== 'none') {
        var cx = window.innerWidth / 2;
        var cy = window.innerHeight / 2;
        var dx = cx - mouseX;
        var dy = cy - mouseY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var pullRadius = 250;

        if (dist < pullRadius && dist > 3) {
          var strength = (1 - dist / pullRadius);
          strength = strength * strength * 0.45;
          pullX = mouseX + dx * strength;
          pullY = mouseY + dy * strength;
        }

        // Instant follow on landing
        cursorX = pullX;
        cursorY = pullY;
      } else {
        // Smooth follow on other pages
        cursorX += (pullX - cursorX) * 0.35;
        cursorY += (pullY - cursorY) * 0.35;
      }

      cursor.style.left = cursorX + 'px';
      cursor.style.top = cursorY + 'px';
    }
    requestAnimationFrame(updateCursor);
  }
  requestAnimationFrame(updateCursor);

  // Cursor states
  document.addEventListener('mouseover', function (e) {
    var target = e.target;

    // Snap to links/buttons
    var link = target.closest('a, button, .project-back, .landing__portal');
    if (link && !target.closest('.slideshow__slide')) {
      var rect = link.getBoundingClientRect();
      snapping = true;
      cursor.className = 'cursor cursor--snap';
      var isDark = !isLanding || isLanding.style.display === 'none';
      if (isDark) cursor.classList.add('cursor--dark');
      cursor.style.left = (rect.left + rect.width / 2) + 'px';
      cursor.style.top = (rect.top + rect.height / 2) + 'px';
      cursor.style.width = (rect.width + 16) + 'px';
      cursor.style.height = (rect.height + 10) + 'px';
      cursor.style.borderRadius = '50%';
      return;
    }

    // Hovering clickable slide
    if (target.closest('.slideshow__slide:not(.slideshow__slide--coming-soon)')) {
      snapping = false;
      cursor.className = 'cursor cursor--hover-image';
      cursor.style.width = '';
      cursor.style.height = '';
      cursor.style.borderRadius = '';
      return;
    }

    // Default
    snapping = false;
    var isDark = !isLanding || isLanding.style.display === 'none' || window.location.hash === '#portfolio';
    cursor.className = 'cursor' + (isDark ? ' cursor--dark' : '');
    cursor.style.width = '';
    cursor.style.height = '';
    cursor.style.borderRadius = '';
  });

  // Magnetic nav links
  var navLinks = document.querySelectorAll('.nav__link');
  navLinks.forEach(function (link) {
    link.addEventListener('mousemove', function (e) {
      var rect = link.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;
      link.style.transform = 'translate(' + x * 0.2 + 'px, ' + y * 0.2 + 'px)';
    });
    link.addEventListener('mouseleave', function () {
      link.style.transform = 'translate(0, 0)';
    });
  });

  document.addEventListener('mouseleave', function () {
    cursor.classList.add('cursor--hidden');
  });
  document.addEventListener('mouseenter', function () {
    cursor.classList.remove('cursor--hidden');
  });
})();
