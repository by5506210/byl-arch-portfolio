// ============================================
// CUSTOM CURSOR + MAGNETIC NAV
// ============================================

(function () {
  var cursor = document.createElement('div');
  cursor.classList.add('cursor');
  document.body.appendChild(cursor);

  var mouseX = -100, mouseY = -100;
  var cursorX = -100, cursorY = -100;

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Smooth follow
  function updateCursor() {
    var dx = mouseX - cursorX;
    var dy = mouseY - cursorY;
    cursorX += dx * 0.15;
    cursorY += dy * 0.15;
    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';
    requestAnimationFrame(updateCursor);
  }
  requestAnimationFrame(updateCursor);

  // Cursor states
  document.addEventListener('mouseover', function (e) {
    var target = e.target;

    // Clickable slide images
    if (target.closest('.slideshow__slide:not(.slideshow__slide--coming-soon)')) {
      cursor.className = 'cursor cursor--hover-image';
      return;
    }

    // Links
    if (target.closest('a') || target.closest('button') || target.closest('.project-back')) {
      cursor.className = 'cursor cursor--hover-link';
      return;
    }

    // Default
    cursor.className = 'cursor';
  });

  // Magnetic nav links
  var navLinks = document.querySelectorAll('.nav__link');
  navLinks.forEach(function (link) {
    link.addEventListener('mousemove', function (e) {
      var rect = link.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;
      link.style.transform = 'translate(' + x * 0.3 + 'px, ' + y * 0.3 + 'px)';
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
