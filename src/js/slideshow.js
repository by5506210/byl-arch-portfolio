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

  // Initialize Lenis for smooth scroll feel (but we intercept wheel events)
  const lenis = new Lenis({
    prevent: () => true, // We handle scrolling manually
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Position all slides: first visible, rest below viewport
  slides.forEach((slide, i) => {
    if (i === 0) {
      gsap.set(slide, { y: 0, zIndex: totalSlides - i });
    } else {
      gsap.set(slide, { y: '100%', zIndex: totalSlides - i });
    }
  });

  // Wheel event handler
  let wheelTimeout;
  let accumulatedDelta = 0;
  const SCROLL_THRESHOLD = 50;

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (isAnimating) return;

    accumulatedDelta += e.deltaY;

    clearTimeout(wheelTimeout);
    wheelTimeout = setTimeout(() => {
      accumulatedDelta = 0;
    }, 150);

    if (Math.abs(accumulatedDelta) >= SCROLL_THRESHOLD) {
      if (accumulatedDelta > 0 && currentSlide < totalSlides - 1) {
        navigateToSlide(currentSlide + 1);
      } else if (accumulatedDelta < 0 && currentSlide > 0) {
        navigateToSlide(currentSlide - 1);
      }
      accumulatedDelta = 0;
    }
  }, { passive: false });

  // Touch support for mobile
  let touchStartY = 0;
  let touchEndY = 0;

  container.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;

    if (isAnimating) return;

    if (diff > 50 && currentSlide < totalSlides - 1) {
      navigateToSlide(currentSlide + 1);
    } else if (diff < -50 && currentSlide > 0) {
      navigateToSlide(currentSlide - 1);
    }
  }, { passive: true });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (isAnimating) return;
    if (document.getElementById('landing').style.display !== 'none') return;

    if ((e.key === 'ArrowDown' || e.key === ' ') && currentSlide < totalSlides - 1) {
      e.preventDefault();
      navigateToSlide(currentSlide + 1);
    } else if (e.key === 'ArrowUp' && currentSlide > 0) {
      e.preventDefault();
      navigateToSlide(currentSlide - 1);
    }
  });

  function navigateToSlide(targetIndex) {
    if (targetIndex === currentSlide || isAnimating) return;
    isAnimating = true;

    // Hide scroll hint on first scroll
    if (!hasScrolled) {
      hasScrolled = true;
      scrollHint.classList.add('slideshow__scroll-hint--hidden');
    }

    const direction = targetIndex > currentSlide ? 1 : -1;

    if (direction === 1) {
      // Scrolling down: next slide comes up from below
      // It covers ~80% of current slide (stops at 20% from top)
      const nextSlide = slides[targetIndex];
      const peekAmount = targetIndex * 20; // Each stacked slide offset

      gsap.fromTo(nextSlide,
        { y: '100%' },
        {
          y: 0,
          duration: 0.8,
          ease: 'power2.inOut',
          onComplete: () => {
            currentSlide = targetIndex;
            isAnimating = false;
          },
        }
      );
    } else {
      // Scrolling up: current slide goes back down
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
    slide.addEventListener('click', (e) => {
      if (slide.classList.contains('slideshow__slide--coming-soon')) return;

      const href = slide.dataset.href;
      if (!href) return;

      const img = slide.querySelector('img');
      if (!img) return;

      // Zoom-in transition
      const rect = img.getBoundingClientRect();

      // Create a clone for the zoom animation
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
