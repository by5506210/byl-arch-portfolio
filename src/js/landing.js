// ============================================
// LANDING PAGE — Typed Animation (~1.5s)
// ============================================

(function () {
  const landing = document.getElementById('landing');
  const linesContainer = document.getElementById('landing-lines');
  const totalLines = 10;
  const baseText = 'click here';

  // Skip landing if returning from a project page
  if (window.location.hash === '#portfolio') {
    landing.style.display = 'none';
    document.body.style.background = '#e8e4df';
    var site = document.getElementById('site');
    site.style.display = 'block';
    document.querySelector('#nav').style.opacity = '1';
    document.querySelector('#scroll-hint').style.opacity = '1';
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

  // Character-by-character typing with acceleration
  var lineIndex = 0;
  var charIndex = 0;
  var currentText = baseText;
  var baseDelay = 25; // ms per character for first line
  var lineGap = 60; // ms pause between lines

  function typeNext() {
    if (lineIndex >= totalLines) return;

    var isBold = lineIndex === totalLines - 1;
    currentText = isBold ? 'click here.' : baseText;
    var line = lines[lineIndex];

    if (charIndex === 0) {
      line.style.opacity = '1';
      if (isBold) {
        line.classList.add('landing__line--bold');
      }
    }

    charIndex++;
    line.textContent = currentText.substring(0, charIndex);

    if (charIndex >= currentText.length) {
      // Line complete
      if (isBold) {
        line.innerHTML = currentText + '<span class="landing__cursor"></span>';
        // Dim previous lines
        for (var j = 0; j < totalLines - 1; j++) {
          lines[j].style.color = '#1a1a1a';
          lines[j].style.transition = 'color 0.3s';
        }
      } else {
        line.classList.add('landing__line--typed');
      }
      lineIndex++;
      charIndex = 0;

      if (lineIndex < totalLines) {
        // Accelerate: later lines type faster
        var speedFactor = Math.max(0.3, 1 - lineIndex * 0.08);
        setTimeout(typeNext, lineGap * speedFactor);
      }
    } else {
      // Next character — accelerate per line
      var speedFactor = Math.max(0.3, 1 - lineIndex * 0.08);
      setTimeout(typeNext, baseDelay * speedFactor);
    }
  }

  // Start after brief delay
  setTimeout(typeNext, 200);

  // Click handler
  linesContainer.addEventListener('click', function (e) {
    var boldLine = lines[totalLines - 1];
    if (!boldLine.classList.contains('landing__line--bold')) return;
    if (boldLine.contains(e.target) || e.target === boldLine) {
      triggerTransition();
    }
  });

  function triggerTransition() {
    landing.classList.add('landing--transitioning');
    var site = document.getElementById('site');
    site.style.display = 'block';

    // Smooth slide up
    landing.style.transition = 'transform 1s cubic-bezier(0.76, 0, 0.24, 1)';
    landing.style.transform = 'translateY(-100%)';

    setTimeout(function () {
      landing.style.display = 'none';
      document.body.style.overflow = '';
      document.body.style.background = '#e8e4df';

      var nav = document.getElementById('nav');
      nav.style.transition = 'opacity 0.6s';
      nav.style.opacity = '1';

      var hint = document.getElementById('scroll-hint');
      setTimeout(function () {
        hint.style.transition = 'opacity 0.6s';
        hint.style.opacity = '1';
      }, 300);

      if (typeof initSlideshow === 'function') {
        initSlideshow();
      }
    }, 1000);
  }
})();
