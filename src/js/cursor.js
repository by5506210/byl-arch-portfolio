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
      // Check if we should pull cursor toward the bold "click here" line
      var boldLine = document.querySelector('.landing__line--bold');
      var pullX = mouseX;
      var pullY = mouseY;

      if (boldLine && isLanding && isLanding.style.display !== 'none') {
        var rect = boldLine.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        var dx = centerX - mouseX;
        var dy = centerY - mouseY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var pullRadius = 250;

        if (dist < pullRadius && dist > 5) {
          // Black hole pull — stronger as you get closer
          var strength = (1 - dist / pullRadius);
          strength = strength * strength * 0.4; // Quadratic, max 40%
          pullX = mouseX + dx * strength;
          pullY = mouseY + dy * strength;
        }

        // On landing page, cursor follows instantly (no lerp lag)
        cursorX = pullX;
        cursorY = pullY;
      } else {
        // On other pages, subtle smoothing
        var lerpSpeed = 0.35;
        cursorX += (pullX - cursorX) * lerpSpeed;
        cursorY += (pullY - cursorY) * lerpSpeed;
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

    var link = target.closest('a, button, .project-back');
    if (link && !target.closest('.slideshow__slide')) {
      var rect = link.getBoundingClientRect();
      snapping = true;
      cursor.className = 'cursor cursor--snap';
      if (isLanding && !isLanding.classList.contains('cursor--dark')) {
        // Keep light cursor colors on landing
      } else {
        cursor.classList.add('cursor--dark');
      }
      cursor.style.left = (rect.left + rect.width / 2) + 'px';
      cursor.style.top = (rect.top + rect.height / 2) + 'px';
      cursor.style.width = (rect.width + 16) + 'px';
      cursor.style.height = (rect.height + 10) + 'px';
      cursor.style.borderRadius = '8px';
      return;
    }

    if (target.closest('.slideshow__slide:not(.slideshow__slide--coming-soon)')) {
      snapping = false;
      cursor.className = 'cursor cursor--hover-image';
      cursor.style.width = '';
      cursor.style.height = '';
      cursor.style.borderRadius = '';
      return;
    }

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
