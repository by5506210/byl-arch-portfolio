// ============================================
// LANDING PAGE — Typed Flood Animation
// ============================================

(function () {
  var landing = document.getElementById('landing');
  var linesContainer = document.getElementById('landing-lines');
  var baseText = 'click here';
  var boldText = 'click here.';

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

  // Measure how many lines fit the screen
  var testLine = document.createElement('div');
  testLine.style.visibility = 'hidden';
  testLine.style.position = 'absolute';
  testLine.textContent = baseText;
  testLine.classList.add('landing__line');
  testLine.style.opacity = '1';
  linesContainer.appendChild(testLine);
  var singleLineHeight = testLine.offsetHeight || 20;
  var gapStr = getComputedStyle(linesContainer).gap;
  var gap = parseFloat(gapStr);
  if (isNaN(gap)) gap = 3; // Fallback for browsers returning "normal"
  var effectiveLineHeight = singleLineHeight + gap;
  if (effectiveLineHeight < 10) effectiveLineHeight = 22; // Safety floor
  linesContainer.removeChild(testLine);

  var padding = window.innerHeight * 0.08;
  var availableHeight = window.innerHeight - padding;
  var totalLines = Math.floor(availableHeight / effectiveLineHeight);
  if (totalLines < 10) totalLines = 10; // Minimum
  if (totalLines > 80) totalLines = 80; // Maximum to prevent performance issues

  // Bold clickable line sits in the middle
  var boldLineIndex = Math.floor(totalLines / 2);

  // Create horizontal line element for transition
  var hLine = document.createElement('div');
  hLine.classList.add('landing__line-reveal');
  landing.appendChild(hLine);

  // Pre-create all lines
  var allLines = [];
  for (var i = 0; i < totalLines; i++) {
    var line = document.createElement('div');
    line.classList.add('landing__line');
    linesContainer.appendChild(line);
    allLines.push(line);
  }

  // Start typing after a brief pause
  setTimeout(startTyping, 150);

  function startTyping() {
    var lineIndex = 0;
    var charIndex = 0;

    // Typing speed — starts moderate, gets faster
    var baseCharDelay = 25;  // ms per character
    var baseLineGap = 40;    // ms between lines

    function typeNext() {
      if (lineIndex >= totalLines) {
        // All lines typed — dim non-bold lines
        setTimeout(function () {
          allLines.forEach(function (l) {
            if (!l.classList.contains('landing__line--bold')) {
              l.style.transition = 'color 0.5s ease';
              l.style.color = '#1a1a1a';
            }
          });
        }, 200);
        return;
      }

      var isBold = lineIndex === boldLineIndex;
      var text = isBold ? boldText : baseText;
      var currentLine = allLines[lineIndex];

      // Show line on first character
      if (charIndex === 0) {
        currentLine.style.opacity = '1';
        if (isBold) {
          currentLine.classList.add('landing__line--bold');
        }
      }

      charIndex++;
      if (isBold) {
        currentLine.textContent = text.substring(0, charIndex);
      } else {
        currentLine.textContent = text.substring(0, charIndex);
      }

      if (charIndex >= text.length) {
        // Line complete
        if (isBold) {
          currentLine.innerHTML = text + '<span class="landing__cursor"></span>';
        } else {
          currentLine.classList.add('landing__line--typed');
        }

        lineIndex++;
        charIndex = 0;

        // Speed increases as we go — lines type faster and faster
        // First 10 lines: normal speed. After that: accelerate
        var speed;
        if (lineIndex <= 10) {
          speed = Math.max(0.4, 1 - lineIndex * 0.06);
        } else {
          // Rapid acceleration after line 10
          speed = Math.max(0.08, 0.4 - (lineIndex - 10) * 0.03);
        }

        if (lineIndex < totalLines) {
          setTimeout(typeNext, baseLineGap * speed);
        } else {
          typeNext(); // final call to trigger dim
        }
      } else {
        // Speed up character typing as we go deeper
        var speed;
        if (lineIndex <= 10) {
          speed = Math.max(0.4, 1 - lineIndex * 0.06);
        } else {
          speed = Math.max(0.08, 0.4 - (lineIndex - 10) * 0.03);
        }
        setTimeout(typeNext, baseCharDelay * speed);
      }
    }

    typeNext();
  }

  // Click handler — bold line triggers transition
  linesContainer.addEventListener('click', function (e) {
    var boldLine = linesContainer.querySelector('.landing__line--bold');
    if (!boldLine) return;
    if (boldLine.contains(e.target) || e.target === boldLine) {
      triggerTransition();
    }
  });

  // Magnetic pull on the bold clickable line
  document.addEventListener('mousemove', function (e) {
    var boldLine = linesContainer.querySelector('.landing__line--bold');
    if (!boldLine) return;

    var rect = boldLine.getBoundingClientRect();
    var centerX = rect.left + rect.width / 2;
    var centerY = rect.top + rect.height / 2;
    var distX = e.clientX - centerX;
    var distY = e.clientY - centerY;
    var dist = Math.sqrt(distX * distX + distY * distY);
    var pullRadius = 120;

    if (dist < pullRadius) {
      var strength = (1 - dist / pullRadius) * 0.35;
      boldLine.style.transform = 'translate(' + (distX * strength) + 'px, ' + (distY * strength) + 'px)';
      boldLine.style.transition = 'transform 0.15s ease-out';
    } else {
      boldLine.style.transform = 'translate(0, 0)';
      boldLine.style.transition = 'transform 0.4s ease-out';
    }
  });

  function triggerTransition() {
    landing.classList.add('landing--transitioning');

    hLine.style.transition = 'width 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
    hLine.style.width = '100vw';

    setTimeout(function () {
      var site = document.getElementById('site');
      site.style.display = 'block';

      landing.style.transition = 'transform 1s cubic-bezier(0.76, 0, 0.24, 1)';
      landing.style.transform = 'translateY(-100%)';

      setTimeout(function () {
        landing.style.display = 'none';
        document.body.style.overflow = '';
        document.body.style.background = '#e8e4df';

        var cursorEl = document.querySelector('.cursor');
        if (cursorEl) cursorEl.classList.add('cursor--dark');

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
