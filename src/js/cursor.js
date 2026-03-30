// ============================================
// CUSTOM CURSOR — iPad-style with magnetic nav
// ============================================

(function () {
  var cursor = document.createElement('div');
  cursor.classList.add('cursor');
  document.body.appendChild(cursor);

  var mouseX = -100, mouseY = -100;
  var cursorX = -100, cursorY = -100;
  var snapping = false;

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Smooth follow with slight lag
  function updateCursor() {
    if (!snapping) {
      var dx = mouseX - cursorX;
      var dy = mouseY - cursorY;
      cursorX += dx * 0.2;
      cursorY += dy * 0.2;
      cursor.style.left = cursorX + 'px';
      cursor.style.top = cursorY + 'px';
    }
    requestAnimationFrame(updateCursor);
  }
  requestAnimationFrame(updateCursor);

  // Cursor states
  document.addEventListener('mouseover', function (e) {
    var target = e.target;

    // Snap to links/buttons (iPad style — cursor morphs to hug the element)
    var link = target.closest('a, button, .project-back');
    if (link && !target.closest('.slideshow__slide')) {
      var rect = link.getBoundingClientRect();
      snapping = true;
      cursor.className = 'cursor cursor--snap';
      cursor.style.left = (rect.left + rect.width / 2) + 'px';
      cursor.style.top = (rect.top + rect.height / 2) + 'px';
      cursor.style.width = (rect.width + 16) + 'px';
      cursor.style.height = (rect.height + 10) + 'px';
      cursor.style.borderRadius = '8px';
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
    cursor.className = 'cursor';
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

  // Hide cursor when leaving window
  document.addEventListener('mouseleave', function () {
    cursor.classList.add('cursor--hidden');
  });
  document.addEventListener('mouseenter', function () {
    cursor.classList.remove('cursor--hidden');
  });
})();
