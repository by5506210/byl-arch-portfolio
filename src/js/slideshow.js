// ============================================
// STACKING IMAGE SLIDESHOW
// ============================================

function initSlideshow() {
  const container = document.getElementById('slideshow-container');
  const slides = document.querySelectorAll('.slideshow__slide');
  const scrollHint = document.getElementById('scroll-hint');
  const totalSlides = slides.length;

  if (totalSlides === 0) return;

  let currentSlide = 0;
  let isAnimating = false;
  let hasScrolled = false;

  // Initialize Lenis
  const lenis = new Lenis({ prevent: () => true });
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Position slides: first visible, rest hidden below
  // ALL slides start with z-index 0 except the first
  slides.forEach((slide, i) => {
    slide.style.position = 'absolute';
    slide.style.top = '0';
    slide.style.left = '0';
    slide.style.width = '100%';
    slide.style.height = '100vh';

    if (i === 0) {
      gsap.set(slide, { y: '0%', zIndex: 1, visibility: 'visible' });
    } else {
      gsap.set(slide, { y: '100%', zIndex: i + 1, visibility: 'visible' });
    }
  });

  // Wheel handler
  let accumulatedDelta = 0;
  let wheelTimeout;
  const SCROLL_THRESHOLD = 50;

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (isAnimating) return;

    accumulatedDelta += e.deltaY;
    clearTimeout(wheelTimeout);
    wheelTimeout = setTimeout(() => { accumulatedDelta = 0; }, 150);

    if (Math.abs(accumulatedDelta) >= SCROLL_THRESHOLD) {
      if (accumulatedDelta > 0 && currentSlide < totalSlides - 1) {
        goToSlide(currentSlide + 1);
      } else if (accumulatedDelta < 0 && currentSlide > 0) {
        goToSlide(currentSlide - 1);
      }
      accumulatedDelta = 0;
    }
  }, { passive: false });

  // Touch support
  let touchStartY = 0;
  container.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  container.addEventListener('touchend', (e) => {
    const diff = touchStartY - e.changedTouches[0].clientY;
    if (isAnimating) return;
    if (diff > 50 && currentSlide < totalSlides - 1) goToSlide(currentSlide + 1);
    else if (diff < -50 && currentSlide > 0) goToSlide(currentSlide - 1);
  }, { passive: true });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (isAnimating) return;
    if (document.getElementById('landing').style.display !== 'none') return;
    if ((e.key === 'ArrowDown' || e.key === ' ') && currentSlide < totalSlides - 1) {
      e.preventDefault();
      goToSlide(currentSlide + 1);
    } else if (e.key === 'ArrowUp' && currentSlide > 0) {
      e.preventDefault();
      goToSlide(currentSlide - 1);
    }
  });

  function goToSlide(targetIndex) {
    if (targetIndex === currentSlide || isAnimating) return;
    isAnimating = true;

    if (!hasScrolled) {
      hasScrolled = true;
      scrollHint.classList.add('slideshow__scroll-hint--hidden');
    }

    if (targetIndex > currentSlide) {
      // Scrolling DOWN: next slide rises up ON TOP of current
      const nextSlide = slides[targetIndex];
      // Ensure it's above everything
      gsap.set(nextSlide, { zIndex: 100 + targetIndex });

      gsap.fromTo(nextSlide,
        { y: '100%' },
        {
          y: '0%',
          duration: 0.8,
          ease: 'power2.inOut',
          onComplete: () => {
            currentSlide = targetIndex;
            isAnimating = false;
          },
        }
      );
    } else {
      // Scrolling UP: current slide drops back down, revealing previous
      const currentSlideEl = slides[currentSlide];

      gsap.to(currentSlideEl, {
        y: '100%',
        duration: 0.8,
        ease: 'power2.inOut',
        onComplete: () => {
          currentSlide = targetIndex;
          isAnimating = false;
        },
      });
    }
  }

  // Click handler for project navigation
  slides.forEach((slide) => {
    slide.addEventListener('click', () => {
      if (slide.classList.contains('slideshow__slide--coming-soon')) return;

      const href = slide.dataset.href;
      if (!href) return;

      const img = slide.querySelector('img');
      if (!img) return;

      const rect = img.getBoundingClientRect();
      const clone = img.cloneNode(true);
      clone.style.position = 'fixed';
      clone.style.top = rect.top + 'px';
      clone.style.left = rect.left + 'px';
      clone.style.width = rect.width + 'px';
      clone.style.height = rect.height + 'px';
      clone.style.zIndex = '200';
      clone.style.objectFit = 'cover';
      clone.style.transition = 'none';
      document.body.appendChild(clone);

      gsap.to(clone, {
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        duration: 0.6,
        ease: 'power2.inOut',
        onComplete: () => {
          window.location.href = href;
        },
      });
    });
  });
}
