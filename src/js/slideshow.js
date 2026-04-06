// ============================================
// STACKING IMAGE SLIDESHOW — Gradual Scroll
// ============================================

function initSlideshow() {
  // Clean up any leftover elements from previous init
  var oldTitle = document.querySelector('.slideshow__current-title');
  if (oldTitle) oldTitle.remove();
  var oldProgress = document.querySelector('.slideshow__progress');
  if (oldProgress) oldProgress.remove();
  // Remove any leftover zoom clones from back navigation
  var oldClones = document.querySelectorAll('.slideshow__zoom-clone');
  oldClones.forEach(function (c) { c.remove(); });

  var container = document.getElementById('slideshow-container');
  var slides = Array.from(document.querySelectorAll('.slideshow__slide'));
  var scrollHint = document.getElementById('scroll-hint');
  var totalSlides = slides.length;

  if (totalSlides === 0) return;

  function syncSlideImageOrientation() {
    slides.forEach(function (slide) {
      var wrapper = slide.querySelector('.slideshow__slide-img-wrapper');
      var img = wrapper && wrapper.querySelector('img');
      if (!wrapper || !img) return;

      function applyOrientation() {
        if (!img.naturalWidth || !img.naturalHeight) return;
        var ratio = img.naturalWidth / img.naturalHeight;
        var isLandscape = ratio >= 1.05;
        wrapper.classList.toggle('slideshow__slide-img-wrapper--landscape', isLandscape);
        wrapper.classList.toggle('slideshow__slide-img-wrapper--portrait', !isLandscape);
      }

      if (img.complete) {
        applyOrientation();
      } else {
        img.addEventListener('load', applyOrientation, { once: true });
      }
    });
  }

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

  // Create fixed title label
  var titleLabel = document.createElement('div');
  titleLabel.classList.add('slideshow__current-title');
  titleLabel.innerHTML = '<span class="slideshow__current-name"></span>' +
                          '<span class="slideshow__current-index"></span>';
  document.body.appendChild(titleLabel);
  var titleNameEl = titleLabel.querySelector('.slideshow__current-name');
  var titleIndexEl = titleLabel.querySelector('.slideshow__current-index');
  var lastTitleIndex = -1;

  // Gather slide names (from data-project or title-wrapper text)
  var slideNames = slides.map(function (slide) {
    var titleEl = slide.querySelector('.slideshow__title');
    if (titleEl) return titleEl.textContent;
    var dividerTitle = slide.querySelector('.slideshow__divider-title');
    if (dividerTitle) return dividerTitle.textContent;
    var aboutName = slide.querySelector('.slideshow__about-name');
    if (aboutName) return aboutName.textContent;
    return '';
  });

  // Count only project slides (not dividers/about) for numbering
  var projectCount = slides.filter(function (s) {
    return s.dataset.href && !s.classList.contains('slideshow__slide--about');
  }).length;

  // Precompute project number for each slide (avoids recounting in hot path)
  var slideProjectNumbers = [];
  var runningProjNum = 0;
  slides.forEach(function (slide) {
    if (slide.dataset.href && !slide.classList.contains('slideshow__slide--about')) {
      runningProjNum++;
    }
    slideProjectNumbers.push(runningProjNum);
  });

  // Precompute which slides are dark (divider or about)
  var slideDark = slides.map(function (slide) {
    return false;
  });

  // Cache nav element
  var nav = document.getElementById('nav');
  var lastActiveIndex = -1;

  // Setup slides
  slides.forEach(function (slide, i) {
    slide.style.position = 'absolute';
    slide.style.top = '0';
    slide.style.left = '0';
    slide.style.width = '100%';
    slide.style.height = '100vh';
    // Don't override background on divider or about slides (they use CSS black)
    if (!slide.classList.contains('slideshow__slide--divider') &&
        !slide.classList.contains('slideshow__slide--about')) {
      slide.style.background = '#f4f2ec';
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

  syncSlideImageOrientation();

  function applyScroll(progress) {
    var currentIndex = Math.floor(progress);
    var fraction = progress - currentIndex;

    // Only update transforms for the visible window of slides
    // Slides before currentIndex are at 0%, slides after currentIndex+1 are at 100%
    // Only the transitioning slide (currentIndex+1) needs per-frame updates
    for (var i = 0; i < totalSlides; i++) {
      if (i <= currentIndex) {
        slides[i].style.transform = 'translateY(0%)';
      } else if (i === currentIndex + 1) {
        slides[i].style.transform = 'translateY(' + ((1 - fraction) * 100) + '%)';
      } else {
        slides[i].style.transform = 'translateY(100%)';
      }
    }

    var activeIndex = Math.round(progress);
    activeIndex = Math.max(0, Math.min(activeIndex, totalSlides - 1));

    // Only update classes/DOM when the active slide actually changes
    if (activeIndex !== lastActiveIndex) {
      // Toggle is-active only on the two affected slides
      if (lastActiveIndex >= 0) slides[lastActiveIndex].classList.remove('is-active');
      slides[activeIndex].classList.add('is-active');

      // Update dots — only toggle the two affected dots
      if (lastActiveIndex >= 0 && dots[lastActiveIndex]) dots[lastActiveIndex].classList.remove('is-active');
      if (dots[activeIndex]) dots[activeIndex].classList.add('is-active');

      // Switch nav bar text color based on slide background (use precomputed dark flag)
      var isDark = slideDark[activeIndex];
      if (nav) {
        nav.classList.toggle('slideshow-nav-bar--on-dark', isDark);
        // Switch progress dots to light on dark slides
        dots.forEach(function (dot) {
          dot.classList.toggle('slideshow__dot--light', isDark);
        });
        // Switch scroll hint color
        if (scrollHint) {
          scrollHint.classList.toggle('slideshow__scroll-hint--on-dark', isDark);
        }
      }

      lastActiveIndex = activeIndex;
    }

    // Update fixed title label
    if (activeIndex !== lastTitleIndex) {
      lastTitleIndex = activeIndex;
      var name = slideNames[activeIndex] || '';

      if (slideDark[activeIndex] || !name) {
        titleLabel.classList.remove('is-visible');
      } else {
        titleNameEl.textContent = name;
        titleIndexEl.textContent = String(slideProjectNumbers[activeIndex]).padStart(2, '0') + ' / ' + String(projectCount).padStart(2, '0');
        titleLabel.classList.add('is-visible');
      }
    }
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

  // Animation loop — skip applyScroll when idle
  var isIdle = false;

  function animate() {
    var diff = targetProgress - scrollProgress;

    if (Math.abs(diff) < 0.001) {
      if (!isIdle) {
        scrollProgress = targetProgress;
        applyScroll(scrollProgress);
        isIdle = true;
      }
    } else {
      scrollProgress += diff * 0.12;
      applyScroll(scrollProgress);
      isIdle = false;
    }

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
      if (slide.classList.contains('slideshow__slide--divider')) return;

      var href = slide.dataset.href;
      if (!href) return;

      var img = slide.querySelector('.slideshow__slide-img-wrapper img');

      // If no full-size image (e.g. About Me slide), just navigate
      if (!img) {
        progressContainer.style.opacity = '0';
        setTimeout(function () {
          window.location.href = href;
        }, 300);
        return;
      }

      var rect = img.getBoundingClientRect();
      var clone = img.cloneNode(true);
      clone.classList.add('slideshow__zoom-clone');
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

  // Clean up zoom clones when user navigates back
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      var clones = document.querySelectorAll('.slideshow__zoom-clone');
      clones.forEach(function (c) { c.remove(); });
      if (progressContainer) progressContainer.style.opacity = '1';
    }
  });
}
