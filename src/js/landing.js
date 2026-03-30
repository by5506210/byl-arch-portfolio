// ============================================
// LANDING PAGE — Typed Animation (~1.5s)
// ============================================

(function () {
  var landing = document.getElementById('landing');
  var linesContainer = document.getElementById('landing-lines');
  var totalLines = 10;
  var baseText = 'click here';

  // Skip landing if returning from a project page
  if (window.location.hash === '#portfolio') {
    landing.style.display = 'none';
    document.body.style.background = '#e8e4df';
    var site = document.getElementById('site');
    site.style.display = 'block';
    document.querySelector('#nav').style.opacity = '1';
    document.querySelector('#scroll-hint').style.opacity = '1';
    // Remove loader
    var loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
    setTimeout(function () { if (typeof initSlideshow === 'function') initSlideshow(); }, 50);
    return;
  }

  document.body.style.overflow = 'hidden';

  // Create line elements
  var lines = [];
  for (var i = 0; i < totalLines; i++) {
    var line = document.createElement('div');
    line.classList.add('landing__line');
    linesContainer.appendChild(line);
    lines.push(line);
  }

  // Create horizontal line element
  var hLine = document.createElement('div');
  hLine.classList.add('landing__line-reveal');
  landing.appendChild(hLine);

  // Wait for loader to finish, then start typing
  setTimeout(startTyping, 1200);

  function startTyping() {
    var lineIndex = 0;
    var charIndex = 0;
    var baseDelay = 25;
    var lineGap = 60;

    function typeNext() {
      if (lineIndex >= totalLines) return;

      var isBold = lineIndex === totalLines - 1;
      var text = isBold ? 'click here.' : baseText;
      var currentLine = lines[lineIndex];

      if (charIndex === 0) {
        currentLine.style.opacity = '1';
        if (isBold) {
          currentLine.classList.add('landing__line--bold');
        }
      }

      charIndex++;
      currentLine.textContent = text.substring(0, charIndex);

      if (charIndex >= text.length) {
        if (isBold) {
          currentLine.innerHTML = text + '<span class="landing__cursor"></span>';
          for (var j = 0; j < totalLines - 1; j++) {
            lines[j].style.color = '#1a1a1a';
            lines[j].style.transition = 'color 0.3s';
          }
        } else {
          currentLine.classList.add('landing__line--typed');
        }
        lineIndex++;
        charIndex = 0;

        if (lineIndex < totalLines) {
          var speedFactor = Math.max(0.3, 1 - lineIndex * 0.08);
          setTimeout(typeNext, lineGap * speedFactor);
        }
      } else {
        var speedFactor = Math.max(0.3, 1 - lineIndex * 0.08);
        setTimeout(typeNext, baseDelay * speedFactor);
      }
    }

    typeNext();
  }

  // Click handler
  linesContainer.addEventListener('click', function (e) {
    var boldLine = lines[totalLines - 1];
    if (!boldLine || !boldLine.classList.contains('landing__line--bold')) return;
    if (boldLine.contains(e.target) || e.target === boldLine) {
      triggerTransition();
    }
  });

  function triggerTransition() {
    landing.classList.add('landing--transitioning');

    // Draw horizontal line across screen
    hLine.style.transition = 'width 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
    hLine.style.width = '100vw';

    setTimeout(function () {
      var site = document.getElementById('site');
      site.style.display = 'block';

      // Slide landing up
      landing.style.transition = 'transform 1s cubic-bezier(0.76, 0, 0.24, 1)';
      landing.style.transform = 'translateY(-100%)';

      setTimeout(function () {
        landing.style.display = 'none';
        document.body.style.overflow = '';
        document.body.style.background = '#e8e4df';

        var nav = document.getElementById('nav');
        nav.style.transition = 'opacity 0.6s';
        nav.style.opacity = '1';

        setTimeout(function () {
          var hint = document.getElementById('scroll-hint');
          hint.style.transition = 'opacity 0.6s';
          hint.style.opacity = '1';
        }, 300);

        if (typeof initSlideshow === 'function') {
          initSlideshow();
        }
      }, 1000);
    }, 400);
  }
})();
