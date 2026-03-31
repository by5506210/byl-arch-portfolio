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

  // Calculate how many lines can fill the viewport
  var lineHeight = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.7; // ~line-height
  var viewportHeight = window.innerHeight;
  var totalLines = Math.ceil(viewportHeight / lineHeight) + 5; // overshoot slightly
  var boldLineIndex = Math.floor(totalLines / 2); // clickable line in the middle

  // Phase 1: slow-typed initial lines (first 8)
  var phase1Count = 8;
  var allLines = [];

  // Create horizontal line element
  var hLine = document.createElement('div');
  hLine.classList.add('landing__line-reveal');
  landing.appendChild(hLine);

  // Start immediately (no loader delay)
  setTimeout(startTyping, 200);

  function createLine(isBold) {
    var line = document.createElement('div');
    line.classList.add('landing__line');
    if (isBold) line.classList.add('landing__line--bold');
    linesContainer.appendChild(line);
    allLines.push(line);
    return line;
  }

  function startTyping() {
    var lineIndex = 0;
    var charIndex = 0;
    var baseDelay = 22;
    var lineGap = 50;

    // Create phase 1 lines
    for (var i = 0; i < phase1Count; i++) {
      createLine(false);
    }

    function typeNext() {
      if (lineIndex >= phase1Count) {
        // Phase 1 done — start flood
        startFlood();
        return;
      }

      var currentLine = allLines[lineIndex];

      if (charIndex === 0) {
        currentLine.style.opacity = '1';
      }

      charIndex++;
      currentLine.textContent = baseText.substring(0, charIndex);

      if (charIndex >= baseText.length) {
        currentLine.classList.add('landing__line--typed');
        lineIndex++;
        charIndex = 0;

        if (lineIndex < phase1Count) {
          var speedFactor = Math.max(0.3, 1 - lineIndex * 0.1);
          setTimeout(typeNext, lineGap * speedFactor);
        } else {
          typeNext();
        }
      } else {
        var speedFactor = Math.max(0.3, 1 - lineIndex * 0.1);
        setTimeout(typeNext, baseDelay * speedFactor);
      }
    }

    typeNext();
  }

  function startFlood() {
    // Create remaining lines to fill the screen
    var remainingCount = totalLines - phase1Count;
    var floodLines = [];

    for (var i = 0; i < remainingCount; i++) {
      var globalIndex = phase1Count + i;
      var isBold = globalIndex === boldLineIndex;
      var line = createLine(isBold);
      floodLines.push({ el: line, isBold: isBold });
    }

    // Rapidly reveal flood lines with staggered timing
    var floodDelay = 30; // fast stagger
    floodLines.forEach(function (item, i) {
      setTimeout(function () {
        item.el.style.opacity = '1';
        if (item.isBold) {
          item.el.innerHTML = boldText + '<span class="landing__cursor"></span>';
        } else {
          item.el.textContent = baseText;
          item.el.classList.add('landing__line--typed');
        }
      }, i * floodDelay);
    });

    // After flood finishes, dim non-bold lines
    setTimeout(function () {
      allLines.forEach(function (line) {
        if (!line.classList.contains('landing__line--bold')) {
          line.style.color = '#1a1a1a';
          line.style.transition = 'color 0.4s';
        }
      });
    }, remainingCount * floodDelay + 100);
  }

  // Click handler — click the bold line
  linesContainer.addEventListener('click', function (e) {
    var boldLine = linesContainer.querySelector('.landing__line--bold');
    if (!boldLine) return;
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

        // Switch cursor to dark for light background
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
