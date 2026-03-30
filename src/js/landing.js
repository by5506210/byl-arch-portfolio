// ============================================
// LANDING PAGE — Typed Animation
// ============================================

(function () {
  const landing = document.getElementById('landing');
  const linesContainer = document.getElementById('landing-lines');
  const totalLines = 18;
  const baseText = 'click here';

  // Prevent scroll on landing
  document.body.style.overflow = 'hidden';

  // Create all line elements
  const lines = [];
  for (let i = 0; i < totalLines; i++) {
    const line = document.createElement('div');
    line.classList.add('landing__line');

    if (i === totalLines - 1) {
      // Bold final line
      line.classList.add('landing__line--bold');
      line.innerHTML = '';
    } else {
      line.textContent = '';
    }

    linesContainer.appendChild(line);
    lines.push(line);
  }

  // Typing animation using GSAP timeline
  const tl = gsap.timeline({ delay: 0.5 });

  // Initial cursor blink on first line
  lines[0].style.opacity = 1;
  lines[0].classList.add('landing__line--typing');

  tl.to({}, { duration: 1 }); // Wait with blinking cursor

  lines.forEach((line, i) => {
    const isBold = i === totalLines - 1;
    const text = isBold ? 'click here.' : baseText;
    const chars = text.split('');

    // Acceleration: each line types faster
    // Start at 0.06s per char, end at 0.015s per char
    const speed = Math.max(0.015, 0.06 - (i * 0.0025));
    const pauseAfter = Math.max(0.1, 0.3 - (i * 0.015));

    // Show line and start typing
    tl.call(() => {
      // Remove cursor from previous line
      if (i > 0) {
        lines[i - 1].classList.remove('landing__line--typing');
        lines[i - 1].classList.add('landing__line--typed');
      }

      line.style.opacity = 1;
      if (!isBold) {
        line.classList.add('landing__line--typing');
      }
    });

    // Type each character
    chars.forEach((char, ci) => {
      tl.call(() => {
        if (isBold) {
          // Build up text without cursor span
          line.textContent = text.substring(0, ci + 1);
        } else {
          line.textContent = text.substring(0, ci + 1);
        }
      }, null, `+=${speed}`);
    });

    if (isBold) {
      // Add blinking cursor span after text
      tl.call(() => {
        line.classList.remove('landing__line--typing');
        line.innerHTML = text + '<span class="landing__cursor"></span>';

        // Dim all previous lines slightly
        lines.forEach((l, li) => {
          if (li < totalLines - 1) {
            gsap.to(l, { color: '#222', duration: 0.5 });
          }
        });
      });
    } else {
      // Pause before next line
      tl.to({}, { duration: pauseAfter });
    }
  });

  // Click handler on bold line
  linesContainer.addEventListener('click', (e) => {
    const boldLine = lines[totalLines - 1];
    if (boldLine.contains(e.target) || e.target === boldLine) {
      triggerTransition();
    }
  });

  function triggerTransition() {
    landing.classList.add('landing--transitioning');

    const site = document.getElementById('site');
    site.style.display = 'block';

    // Transition: black landing dissolves upward
    gsap.to(landing, {
      yPercent: -100,
      duration: 1,
      ease: 'power3.inOut',
      onComplete: () => {
        landing.style.display = 'none';
        document.body.style.overflow = '';
        document.body.style.background = '#e8e4df';

        // Fade in navigation
        gsap.to('#nav', {
          opacity: 1,
          duration: 0.6,
          ease: 'power2.out',
        });

        // Show scroll hint
        gsap.to('#scroll-hint', {
          opacity: 1,
          duration: 0.6,
          delay: 0.3,
          ease: 'power2.out',
        });

        // Initialize slideshow
        if (typeof initSlideshow === 'function') {
          initSlideshow();
        }
      },
    });
  }
})();
