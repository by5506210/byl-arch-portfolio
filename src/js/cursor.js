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
  var snapTarget = null;
  var snapPadX = 0;
  var snapPadY = 0;
  var snapRadiusCap = 8;
  var snapRadiusFactor = 0.2;

  function enterSnapState() {
    if (currentState !== 'snap') {
      cursor.classList.remove('cursor--hover-image');
      cursor.classList.add('cursor--snap');
      var isDark = !isLanding || isLanding.style.display === 'none';
      cursor.classList.toggle('cursor--dark', isDark);
      currentState = 'snap';
    }
  }

  function applySnapRect(rect) {
    var width = rect.width + snapPadX;
    var height = rect.height + snapPadY;
    var radius = Math.min(snapRadiusCap, height * snapRadiusFactor);

    cursor.style.width = width + 'px';
    cursor.style.height = height + 'px';
    cursor.style.borderRadius = radius + 'px';
    cursor.style.transform = 'translate(' + (rect.left + rect.width * 0.5 - width * 0.5) + 'px,' + (rect.top + rect.height * 0.5 - height * 0.5) + 'px)';

    // Keep the internal cursor position in sync so exiting snap mode does not jump.
    cursorX = rect.left + rect.width * 0.5;
    cursorY = rect.top + rect.height * 0.5;
  }

  function updateSnapTargetRect() {
    if (!snapping || !snapTarget || !snapTarget.isConnected) return false;
    var rect = snapTarget.getBoundingClientRect();
    if (!rect || rect.width < 0.5 || rect.height < 0.5) return false;
    applySnapRect(rect);
    return true;
  }

  function beginSnap(targetEl, config) {
    if (!targetEl) return;
    snapping = true;
    snapTarget = targetEl;
    snapPadX = config.padX;
    snapPadY = config.padY;
    snapRadiusCap = config.radiusCap;
    snapRadiusFactor = config.radiusFactor;
    enterSnapState();
    if (!updateSnapTargetRect()) {
      snapping = false;
      snapTarget = null;
    }
  }

  function endSnap() {
    snapping = false;
    snapTarget = null;
  }

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function updateCursor() {
    if (snapping) {
      if (!updateSnapTargetRect()) {
        endSnap();
      }
    }

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

    var projectCard = target.closest('.projects-index__card, .projects-atlas__node, .projects-helix__node');
    if (projectCard && !projectCard.classList.contains('projects-index__card--coming-soon')) {
      var projectSnapTarget =
        projectCard.querySelector('.projects-helix__thumb') ||
        projectCard.querySelector('.projects-atlas__node-thumb') ||
        projectCard.querySelector('.projects-index__card-img') ||
        projectCard;
      beginSnap(projectSnapTarget, {
        padX: 18,
        padY: 18,
        radiusCap: 8,
        radiusFactor: 0.06
      });
      return;
    }

    // Snap to links/buttons
    var link = target.closest('a, button, .project-back');
    if (link && !target.closest('.slideshow__slide')) {
      beginSnap(link, {
        padX: 20,
        padY: 12,
        radiusCap: 7,
        radiusFactor: 0.25
      });
      return;
    }

    // Hovering clickable slide
    if (target.closest('.slideshow__slide:not(.slideshow__slide--coming-soon)')) {
      endSnap();
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
    endSnap();
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
