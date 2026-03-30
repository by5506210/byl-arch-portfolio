// ============================================
// LANDING PAGE — Typed Animation (~1.5s total)
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
    document.getElementById('site').style.display = 'block';
    document.querySelector('#nav').style.opacity = '1';
    document.querySelector('#scroll-hint').style.opacity = '1';
    setTimeout(() => { if (typeof initSlideshow === 'function') initSlideshow(); }, 0);
    return;
  }

  document.body.style.overflow = 'hidden';

  const lines = [];
  for (let i = 0; i < totalLines; i++) {
    const line = document.createElement('div');
    line.classList.add('landing__line');
    linesContainer.appendChild(line);
    lines.push(line);
  }

  const tl = gsap.timeline({ delay: 0.2 });

  // All gray lines appear in rapid succession (~0.8s total)
  lines.forEach((line, i) => {
    const isBold = i === totalLines - 1;

    if (!isBold) {
      tl.call(() => {
        line.style.opacity = 1;
        line.textContent = baseText;
        line.classList.add('landing__line--typed');
      }, null, 0.2 + i * 0.08); // Stagger every 80ms
    }
  });

  // Brief pause, then bold line appears (~0.4s after gray lines finish)
  const boldLine = lines[totalLines - 1];
  const boldStart = 0.2 + (totalLines - 1) * 0.08 + 0.25;

  tl.call(() => {
    boldLine.style.opacity = 1;
    boldLine.classList.add('landing__line--bold');
    boldLine.innerHTML = 'click here.<span class="landing__cursor"></span>';

    // Dim previous lines
    lines.forEach((l, li) => {
      if (li < totalLines - 1) {
        gsap.to(l, { color: '#1a1a1a', duration: 0.3 });
      }
    });
  }, null, boldStart);

  // Click handler
  linesContainer.addEventListener('click', (e) => {
    if (boldLine.contains(e.target) || e.target === boldLine) {
      triggerTransition();
    }
  });

  function triggerTransition() {
    landing.classList.add('landing--transitioning');
    document.getElementById('site').style.display = 'block';

    gsap.to(landing, {
      yPercent: -100,
      duration: 1,
      ease: 'power3.inOut',
      onComplete: () => {
        landing.style.display = 'none';
        document.body.style.overflow = '';
        document.body.style.background = '#e8e4df';

        gsap.to('#nav', { opacity: 1, duration: 0.6, ease: 'power2.out' });
        gsap.to('#scroll-hint', { opacity: 1, duration: 0.6, delay: 0.3, ease: 'power2.out' });

        if (typeof initSlideshow === 'function') {
          initSlideshow();
        }
      },
    });
  }
})();
