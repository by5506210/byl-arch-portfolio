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

  // Create progress dots
  var progressContainer = document.createElement('div');
  progressContainer.classList.add('slideshow__progress');
  slides.forEach(function (_, i) {
    var dot = document.createElement('div');
    dot.classList.add('slideshow__dot');
    if (i === 0) dot.classList.add('is-active');
    progressContainer.appendChild(dot);
  });
  document.body.appendChild(progressContainer);

  var dots = Array.from(progressContainer.querySelectorAll('.slideshow__dot'));

  // Setup slides
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
      slide.classList.add('is-active');
    } else {
      slide.style.transform = 'translateY(100%)';
    }
  });

  function updateDots(index) {
    dots.forEach(function (dot, i) {
      if (i === index) {
        dot.classList.add('is-active');
      } else {
        dot.classList.remove('is-active');
      }
    });
  }

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

    updateDots(targetIndex);

    if (targetIndex > currentSlide) {
      // Scrolling DOWN: next slide rises up ON TOP
      var nextSlide = slides[targetIndex];

      // Remove active from current
      slides[currentSlide].classList.remove('is-active');

      nextSlide.style.transition = 'none';
      nextSlide.style.transform = 'translateY(100%)';
      nextSlide.offsetHeight; // Force reflow

      nextSlide.style.transition = 'transform 0.8s cubic-bezier(0.76, 0, 0.24, 1)';
      nextSlide.style.transform = 'translateY(0%)';

      // Activate after slight delay for title animation
      setTimeout(function () {
        nextSlide.classList.add('is-active');
      }, 200);

      nextSlide.addEventListener('transitionend', function handler() {
        nextSlide.removeEventListener('transitionend', handler);
        currentSlide = targetIndex;
        isAnimating = false;
      });
    } else {
      // Scrolling UP: current slide drops back down
      var currSlide = slides[currentSlide];
      currSlide.classList.remove('is-active');

      currSlide.style.transition = 'transform 0.8s cubic-bezier(0.76, 0, 0.24, 1)';
      currSlide.style.transform = 'translateY(100%)';

      // Activate previous slide
      setTimeout(function () {
        slides[targetIndex].classList.add('is-active');
      }, 200);

      currSlide.addEventListener('transitionend', function handler() {
        currSlide.removeEventListener('transitionend', handler);
        currentSlide = targetIndex;
        isAnimating = false;
      });
    }

    // Fallback
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

      // Hide dots during transition
      progressContainer.style.opacity = '0';

      clone.offsetHeight; // Force reflow

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
