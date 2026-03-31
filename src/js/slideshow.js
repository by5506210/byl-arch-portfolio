// ============================================
// STACKING IMAGE SLIDESHOW — Gradual Scroll
// ============================================

function initSlideshow() {
  var container = document.getElementById('slideshow-container');
  var slides = Array.from(document.querySelectorAll('.slideshow__slide'));
  var scrollHint = document.getElementById('scroll-hint');
  var totalSlides = slides.length;

  if (totalSlides === 0) return;

  var scrollProgress = 0;
  var targetProgress = 0;
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
    // Don't override background on divider slides (they use CSS black)
    if (!slide.classList.contains('slideshow__slide--divider')) {
      slide.style.background = '#e8e4df';
    }
    slide.style.zIndex = String(i + 1);
    slide.style.willChange = 'transform';

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

  function applyScroll(progress) {
    var currentIndex = Math.floor(progress);
    var fraction = progress - currentIndex;

    slides.forEach(function (slide, i) {
      if (i < currentIndex) {
        slide.style.transform = 'translateY(0%)';
      } else if (i === currentIndex) {
        slide.style.transform = 'translateY(0%)';
      } else if (i === currentIndex + 1) {
        var offset = (1 - fraction) * 100;
        slide.style.transform = 'translateY(' + offset + '%)';
      } else {
        slide.style.transform = 'translateY(100%)';
      }
    });

    var activeIndex = Math.round(progress);
    activeIndex = Math.max(0, Math.min(activeIndex, totalSlides - 1));
    slides.forEach(function (slide, i) {
      if (i === activeIndex) {
        slide.classList.add('is-active');
      } else {
        slide.classList.remove('is-active');
      }
    });

    updateDots(activeIndex);
  }

  // Wheel handler
  var scrollSensitivity = 0.0015;

  container.addEventListener('wheel', function (e) {
    e.preventDefault();

    if (!hasScrolled) {
      hasScrolled = true;
      scrollHint.classList.add('slideshow__scroll-hint--hidden');
    }

    targetProgress += e.deltaY * scrollSensitivity;
    targetProgress = Math.max(0, Math.min(targetProgress, totalSlides - 1));
  }, { passive: false });

  // Animation loop
  function animate() {
    var diff = targetProgress - scrollProgress;
    scrollProgress += diff * 0.12;

    if (Math.abs(diff) < 0.001) {
      scrollProgress = targetProgress;
    }

    applyScroll(scrollProgress);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // Touch support — prevent rubber banding
  var touchStartY = 0;
  var touchLastY = 0;

  container.addEventListener('touchstart', function (e) {
    touchStartY = e.touches[0].clientY;
    touchLastY = touchStartY;
  }, { passive: false });

  container.addEventListener('touchmove', function (e) {
    e.preventDefault(); // Prevents iOS rubber banding / overscroll bounce

    var touchY = e.touches[0].clientY;
    var delta = touchLastY - touchY;
    touchLastY = touchY;

    if (!hasScrolled) {
      hasScrolled = true;
      scrollHint.classList.add('slideshow__scroll-hint--hidden');
    }

    targetProgress += delta * 0.003;
    targetProgress = Math.max(0, Math.min(targetProgress, totalSlides - 1));
  }, { passive: false });

  // Keyboard
  document.addEventListener('keydown', function (e) {
    var landingEl = document.getElementById('landing');
    if (landingEl && landingEl.style.display !== 'none') return;
    if (e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
      targetProgress = Math.min(Math.floor(targetProgress) + 1, totalSlides - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      targetProgress = Math.max(Math.ceil(targetProgress) - 1, 0);
    }
  });

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

      progressContainer.style.opacity = '0';

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
