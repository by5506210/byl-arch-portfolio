// ============================================
// PROJECT PAGE — All interactive features
// ============================================

// Gallery reveal with stagger
function initGalleryReveals() {
  var images = document.querySelectorAll('.project-gallery__image');
  if (images.length === 0) return;

  var revealIndex = 0;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var delay = revealIndex * 0.12;
        entry.target.style.transitionDelay = delay + 's';
        var img = entry.target.querySelector('img');
        if (img) img.style.transitionDelay = delay + 's';
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
        revealIndex++;
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -8% 0px'
  });

  images.forEach(function (img) {
    observer.observe(img);
  });
}

// Parallax hero image
function initParallaxHero() {
  if (window.innerWidth <= 768) return;
  var heroImg = document.querySelector('.project-hero img');
  if (!heroImg) return;

  var hero = document.querySelector('.project-hero');
  var ticking = false;

  function updateParallax() {
    var scrollY = window.scrollY;
    var heroH = hero.offsetHeight;
    if (scrollY < heroH) {
      heroImg.style.transform = 'translateY(' + (scrollY * 0.3) + 'px)';
    }
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }, { passive: true });
}

// Integrated nav bar — contains back, project name, and nav links
function initNavBar() {
  // Skip on slideshow page — it has its own nav bar
  if (document.querySelector('.slideshow-nav-bar')) return;

  var hero = document.querySelector('.project-hero');

  // Build the unified bar
  var bar = document.createElement('div');
  bar.classList.add('project-nav-bar');

  // Left: back arrow — goes to previous page
  var backEl = document.createElement('a');
  backEl.href = '#';
  backEl.classList.add('project-nav-bar__back');
  backEl.innerHTML = '&larr;';
  backEl.addEventListener('click', function (e) {
    e.preventDefault();
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '../index.html#portfolio';
    }
  });
  bar.appendChild(backEl);

  // Center: BYL logo (always present, links to homepage)
  var logo = document.createElement('a');
  logo.href = '../index.html#portfolio';
  logo.classList.add('project-nav-bar__logo');
  logo.textContent = 'BYL';
  bar.appendChild(logo);

  // Right: nav links
  var links = document.createElement('div');
  links.classList.add('project-nav-bar__links');
  links.innerHTML =
    '<a href="projects.html" class="project-nav-bar__link">Projects</a>' +
    '<a href="about.html" class="project-nav-bar__link">About</a>' +
    '<a href="contact.html" class="project-nav-bar__link">Contact</a>';
  bar.appendChild(links);

  document.body.appendChild(bar);

  // If hero exists, show/hide bar style on scroll
  if (hero) {
    // Bar starts transparent over the hero, becomes solid when scrolled past
    bar.classList.add('project-nav-bar--over-hero');

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          bar.classList.add('project-nav-bar--over-hero');
          bar.classList.remove('project-nav-bar--solid');
        } else {
          bar.classList.remove('project-nav-bar--over-hero');
          bar.classList.add('project-nav-bar--solid');
        }
      });
    }, { threshold: 0 });

    observer.observe(hero);
  } else {
    // No hero — always solid
    bar.classList.add('project-nav-bar--solid');
  }
}

// Animated spec counters
function initSpecCounters() {
  var values = document.querySelectorAll('.project-details__meta-value');
  if (values.length === 0) return;

  values.forEach(function (el) {
    var text = el.textContent.trim();
    var match = text.match(/^([\d,]+\.?\d*)/);
    if (!match) return;

    var numStr = match[1];
    var target = parseFloat(numStr.replace(/,/g, ''));
    var suffix = text.substring(match[0].length);
    var hasCommas = numStr.indexOf(',') !== -1;
    var decimals = numStr.indexOf('.') !== -1 ? numStr.split('.')[1].length : 0;

    el.dataset.target = target;
    el.dataset.suffix = suffix;
    el.dataset.hasCommas = hasCommas;
    el.dataset.decimals = decimals;
    el.textContent = '0' + suffix;
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && entry.target.dataset.target) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  values.forEach(function (el) {
    if (el.dataset.target) observer.observe(el);
  });
}

function animateCounter(el) {
  var target = parseFloat(el.dataset.target);
  var suffix = el.dataset.suffix;
  var hasCommas = el.dataset.hasCommas === 'true';
  var decimals = parseInt(el.dataset.decimals);
  var duration = 1500;
  var start = performance.now();

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function formatNumber(n) {
    var fixed = n.toFixed(decimals);
    if (!hasCommas) return fixed;
    var parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  function tick(now) {
    var elapsed = now - start;
    var progress = Math.min(elapsed / duration, 1);
    var eased = easeOutExpo(progress);
    var current = target * eased;
    el.textContent = formatNumber(current) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

// Filmstrip drag scroll + slider controls
function initFilmstrip() {
  var filmstrip = document.querySelector('.project-filmstrip');
  if (!filmstrip) return;

  var track = filmstrip.querySelector('.project-filmstrip__track');
  var frames = filmstrip.querySelectorAll('.project-filmstrip__frame');
  var prevBtn = filmstrip.querySelector('.project-filmstrip__arrow--prev');
  var nextBtn = filmstrip.querySelector('.project-filmstrip__arrow--next');
  var dots = filmstrip.querySelectorAll('.project-filmstrip__dot');
  var isDragging = false;
  var startX = 0;
  var currentX = 0;
  var velocity = 0;
  var animFrame;
  var currentSlide = 0;
  var totalSlides = frames.length;

  function getMaxScroll() {
    return -(track.scrollWidth - filmstrip.offsetWidth);
  }

  function clamp(val) {
    return Math.max(getMaxScroll(), Math.min(0, val));
  }

  function setPosition(x) {
    currentX = clamp(x);
    track.style.transform = 'translateX(' + currentX + 'px)';
  }

  function goToSlide(index) {
    if (index < 0) index = 0;
    if (index >= totalSlides) index = totalSlides - 1;
    currentSlide = index;

    // Calculate target position based on frame offset
    var frame = frames[index];
    var targetX = -(frame.offsetLeft - filmstrip.offsetWidth * 0.08);
    targetX = clamp(targetX);

    // Smooth animate
    cancelAnimationFrame(animFrame);
    var startPos = currentX;
    var dist = targetX - startPos;
    var startTime = null;
    var duration = 400;

    function slideAnim(ts) {
      if (!startTime) startTime = ts;
      var elapsed = ts - startTime;
      var t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      t = 1 - Math.pow(1 - t, 3);
      setPosition(startPos + dist * t);
      if (elapsed < duration) {
        animFrame = requestAnimationFrame(slideAnim);
      } else {
        updateControls();
      }
    }
    animFrame = requestAnimationFrame(slideAnim);
    updateControls();
  }

  function updateControls() {
    // Update dots
    if (dots.length) {
      dots.forEach(function (dot, i) {
        dot.classList.toggle('project-filmstrip__dot--active', i === currentSlide);
      });
    }
    // Update arrows
    if (prevBtn) prevBtn.classList.toggle('project-filmstrip__arrow--disabled', currentSlide === 0);
    if (nextBtn) nextBtn.classList.toggle('project-filmstrip__arrow--disabled', currentSlide >= totalSlides - 1);
  }

  // Detect which slide is closest after drag
  function snapToNearest() {
    var closest = 0;
    var closestDist = Infinity;
    for (var i = 0; i < totalSlides; i++) {
      var frameTarget = -(frames[i].offsetLeft - filmstrip.offsetWidth * 0.08);
      var d = Math.abs(currentX - frameTarget);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    }
    currentSlide = closest;
    updateControls();
  }

  // Arrow click handlers
  if (prevBtn) prevBtn.addEventListener('click', function () { goToSlide(currentSlide - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { goToSlide(currentSlide + 1); });

  // Dot click handlers
  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { goToSlide(i); });
  });

  filmstrip.addEventListener('mousedown', function (e) {
    isDragging = true;
    startX = e.clientX - currentX;
    velocity = 0;
    cancelAnimationFrame(animFrame);
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    var newX = e.clientX - startX;
    velocity = newX - currentX;
    setPosition(newX);
  });

  document.addEventListener('mouseup', function () {
    if (!isDragging) return;
    isDragging = false;
    applyMomentum();
  });

  filmstrip.addEventListener('touchstart', function (e) {
    isDragging = true;
    startX = e.touches[0].clientX - currentX;
    velocity = 0;
    cancelAnimationFrame(animFrame);
  }, { passive: true });

  filmstrip.addEventListener('touchmove', function (e) {
    if (!isDragging) return;
    var newX = e.touches[0].clientX - startX;
    velocity = newX - currentX;
    setPosition(newX);
  }, { passive: true });

  filmstrip.addEventListener('touchend', function () {
    isDragging = false;
    applyMomentum();
  });

  function applyMomentum() {
    function drift() {
      if (Math.abs(velocity) < 0.5) {
        snapToNearest();
        return;
      }
      velocity *= 0.92;
      setPosition(currentX + velocity);
      animFrame = requestAnimationFrame(drift);
    }
    drift();
  }

  updateControls();
}

// Initialize all features
function initProjectPage() {
  // Clean up previous bar if exists
  var oldBar = document.querySelector('.project-nav-bar');
  if (oldBar) oldBar.remove();

  initGalleryReveals();
  initParallaxHero();
  initNavBar();
  initSpecCounters();
  initFilmstrip();
}

initProjectPage();
