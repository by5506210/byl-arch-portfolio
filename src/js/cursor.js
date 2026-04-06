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

      cursor.style.transform = 'translate(' + (cursorX - 7) + 'px,' + (cursorY - 7) + 'px)';
    }
    requestAnimationFrame(updateCursor);
  }
  requestAnimationFrame(updateCursor);

  // Track current cursor state to avoid redundant class changes
  var currentState = 'default';

  // Cursor states
  document.addEventListener('mouseover', function (e) {
    var target = e.target;

    var projectCard = target.closest('.projects-index__card');
    if (projectCard && !projectCard.classList.contains('projects-index__card--coming-soon')) {
      var projectSnapTarget = projectCard.querySelector('.projects-index__card-img') || projectCard;
      var projectRect = projectSnapTarget.getBoundingClientRect();
      snapping = true;

      if (currentState !== 'snap') {
        cursor.classList.remove('cursor--hover-image');
        cursor.classList.add('cursor--snap');
        var isProjectDark = !isLanding || isLanding.style.display === 'none';
        cursor.classList.toggle('cursor--dark', isProjectDark);
        currentState = 'snap';
      }

      var projectPad = 18;
      var projectW = projectRect.width + projectPad;
      var projectH = projectRect.height + projectPad;
      var projectRadius = Math.min(8, projectH * 0.06);

      cursor.style.width = projectW + 'px';
      cursor.style.height = projectH + 'px';
      cursor.style.borderRadius = projectRadius + 'px';
      cursor.style.transform = 'translate(' + (projectRect.left + projectRect.width / 2 - projectW / 2) + 'px,' + (projectRect.top + projectRect.height / 2 - projectH / 2) + 'px)';
      return;
    }

    // Snap to links/buttons
    var link = target.closest('a, button, .project-back');
    if (link && !target.closest('.slideshow__slide')) {
      var rect = link.getBoundingClientRect();
      snapping = true;

      if (currentState !== 'snap') {
        cursor.classList.remove('cursor--hover-image');
        cursor.classList.add('cursor--snap');
        var isDark = !isLanding || isLanding.style.display === 'none';
        cursor.classList.toggle('cursor--dark', isDark);
        currentState = 'snap';
      }

      // iPad-style: rectangle that hugs the element with padding
      var padX = 20;
      var padY = 12;
      var w = rect.width + padX;
      var h = rect.height + padY;
      // Rounded corners proportional to height, capped for pill vs rect
      var radius = Math.min(7, h * 0.25);

      cursor.style.width = w + 'px';
      cursor.style.height = h + 'px';
      cursor.style.borderRadius = radius + 'px';
      cursor.style.transform = 'translate(' + (rect.left + rect.width / 2 - w / 2) + 'px,' + (rect.top + rect.height / 2 - h / 2) + 'px)';
      return;
    }

    // Hovering clickable slide
    if (target.closest('.slideshow__slide:not(.slideshow__slide--coming-soon)')) {
      snapping = false;
      if (currentState !== 'hover-image') {
        cursor.classList.remove('cursor--snap');
        cursor.classList.add('cursor--hover-image');
        cursor.classList.remove('cursor--dark');
        currentState = 'hover-image';
      }
      cursor.style.width = '';
      cursor.style.height = '';
      cursor.style.borderRadius = '';
      return;
    }

    // Default
    snapping = false;
    if (currentState !== 'default') {
      cursor.classList.remove('cursor--snap', 'cursor--hover-image');
      var isDark = !isLanding || isLanding.style.display === 'none' || window.location.hash === '#portfolio';
      cursor.classList.toggle('cursor--dark', isDark);
      currentState = 'default';
    }
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
