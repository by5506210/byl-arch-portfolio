// ============================================
// STACKING IMAGE SLIDESHOW
// ============================================

function initSlideshow() {
  var container = document.getElementById('slideshow-container');
  var slides = Array.from(document.querySelectorAll('.slideshow__slide'));
  var scrollHint = document.getElementById('scroll-hint');
  var totalSlides = slides.length;

  if (totalSlides === 0) return;

  var currentSlide = 0;
  var isAnimating = false;
  var hasScrolled = false;

  // Setup: first slide visible on top, rest hidden below
  // CRITICAL: each slide gets incrementing z-index so later slides are ON TOP
  slides.forEach(function (slide, i) {
    slide.style.position = 'absolute';
    slide.style.top = '0';
    slide.style.left = '0';
    slide.style.width = '100%';
    slide.style.height = '100vh';
    slide.style.background = '#e8e4df';
    slide.style.zIndex = String(i + 1);

    if (i === 0) {
      slide.style.transform = 'translateY(0%)';
    } else {
      slide.style.transform = 'translateY(100%)';
    }
  });

  // Wheel handler
  var accumulatedDelta = 0;
  var wheelTimeout;

  container.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (isAnimating) return;

    accumulatedDelta += e.deltaY;
    clearTimeout(wheelTimeout);
    wheelTimeout = setTimeout(function () { accumulatedDelta = 0; }, 150);

    if (accumulatedDelta > 50 && currentSlide < totalSlides - 1) {
      goToSlide(currentSlide + 1);
      accumulatedDelta = 0;
    } else if (accumulatedDelta < -50 && currentSlide > 0) {
      goToSlide(currentSlide - 1);
      accumulatedDelta = 0;
    }
  }, { passive: false });

  // Touch support
  var touchStartY = 0;
  container.addEventListener('touchstart', function (e) {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  container.addEventListener('touchend', function (e) {
    var diff = touchStartY - e.changedTouches[0].clientY;
    if (isAnimating) return;
    if (diff > 50 && currentSlide < totalSlides - 1) goToSlide(currentSlide + 1);
    else if (diff < -50 && currentSlide > 0) goToSlide(currentSlide - 1);
  }, { passive: true });

  // Keyboard
  document.addEventListener('keydown', function (e) {
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

    var slide;

    if (targetIndex > currentSlide) {
      // Scrolling DOWN: next slide rises up ON TOP
      slide = slides[targetIndex];
      slide.style.transition = 'none';
      slide.style.transform = 'translateY(100%)';

      // Force reflow so transition works
      slide.offsetHeight;

      slide.style.transition = 'transform 0.8s cubic-bezier(0.76, 0, 0.24, 1)';
      slide.style.transform = 'translateY(0%)';

      slide.addEventListener('transitionend', function handler() {
        slide.removeEventListener('transitionend', handler);
        currentSlide = targetIndex;
        isAnimating = false;
      });
    } else {
      // Scrolling UP: current slide drops back down
      slide = slides[currentSlide];
      slide.style.transition = 'transform 0.8s cubic-bezier(0.76, 0, 0.24, 1)';
      slide.style.transform = 'translateY(100%)';

      slide.addEventListener('transitionend', function handler() {
        slide.removeEventListener('transitionend', handler);
        currentSlide = targetIndex;
        isAnimating = false;
      });
    }

    // Fallback in case transitionend doesn't fire
    setTimeout(function () {
      isAnimating = false;
      currentSlide = targetIndex;
    }, 900);
  }

  // Click handler for project navigation
  slides.forEach(function (slide) {
    slide.addEventListener('click', function () {
      if (slide.classList.contains('slideshow__slide--coming-soon')) return;

      var href = slide.dataset.href;
      if (!href) return;

      var img = slide.querySelector('img');
      if (!img) return;

      var rect = img.getBoundingClientRect();
      var clone = img.cloneNode(true);
      clone.style.position = 'fixed';
      clone.style.top = rect.top + 'px';
      clone.style.left = rect.left + 'px';
      clone.style.width = rect.width + 'px';
      clone.style.height = rect.height + 'px';
      clone.style.zIndex = '200';
      clone.style.objectFit = 'cover';
      clone.style.transition = 'all 0.6s cubic-bezier(0.76, 0, 0.24, 1)';
      document.body.appendChild(clone);

      // Force reflow
      clone.offsetHeight;

      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.width = '100vw';
      clone.style.height = '100vh';

      setTimeout(function () {
        window.location.href = href;
      }, 600);
    });
  });
}
