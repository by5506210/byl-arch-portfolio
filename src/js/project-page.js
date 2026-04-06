// ============================================
// PROJECT PAGE — All interactive features
// ============================================

function rememberPageForBackNav() {
  var current = window.location.pathname + window.location.search + window.location.hash;
  var last = sessionStorage.getItem('bylCurrentPage');

  if (last && last !== current) {
    sessionStorage.setItem('bylPreviousPage', last);
  }

  sessionStorage.setItem('bylCurrentPage', current);
}

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
    // Add native lazy loading to gallery images below the fold
    var imgEl = img.querySelector('img');
    if (imgEl) imgEl.loading = 'lazy';
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
  rememberPageForBackNav();

  var hero = document.querySelector('.project-hero');

  // Build the unified bar
  var bar = document.createElement('div');
  bar.classList.add('project-nav-bar');

  // Left: back arrow — goes to previous page
  var logo = document.createElement('a');
  logo.href = '../index.html';
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

  // Cache layout values to avoid reflow in hot paths
  var cachedMaxScroll = 0;
  var cachedFrameOffsets = [];
  var cachedFilmstripWidth = 0;

  function cacheLayout() {
    cachedFilmstripWidth = filmstrip.offsetWidth;
    cachedMaxScroll = -(track.scrollWidth - cachedFilmstripWidth);
    cachedFrameOffsets = [];
    for (var i = 0; i < totalSlides; i++) {
      cachedFrameOffsets.push(frames[i].offsetLeft);
    }
  }
  cacheLayout();

  window.addEventListener('resize', cacheLayout);

  function getMaxScroll() {
    return cachedMaxScroll;
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

    // Calculate target position based on cached frame offset
    var targetX = -(cachedFrameOffsets[index] - cachedFilmstripWidth * 0.08);
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

  // Detect which slide is closest after drag (uses cached offsets)
  function snapToNearest() {
    var closest = 0;
    var closestDist = Infinity;
    for (var i = 0; i < totalSlides; i++) {
      var frameTarget = -(cachedFrameOffsets[i] - cachedFilmstripWidth * 0.08);
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

function initProjectsIndexPreview() {
  var index = document.querySelector('.projects-index');
  if (!index) return;
  if (index.dataset.previewInit === 'true') return;
  index.dataset.previewInit = 'true';

  var layout = index.querySelector('.projects-index__layout');
  var preview = index.querySelector('.projects-preview');
  var screen = preview && preview.querySelector('.projects-preview__screen');
  var image = preview && preview.querySelector('.projects-preview__image');
  var title = preview && preview.querySelector('.projects-preview__meta-title');
  var cards = Array.prototype.slice.call(index.querySelectorAll('.projects-index__card:not(.projects-index__card--coming-soon)'));
  if (!layout || !preview || !screen || !image || !title || cards.length === 0) return;

  var activeCard = null;
  var beamTimer = null;
  var clearTimer = null;

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function setProjectionOrigin(card) {
    var cardFrame = card.querySelector('.projects-index__card-img') || card;
    var cardRect = cardFrame.getBoundingClientRect();
    var screenRect = screen.getBoundingClientRect();
    var deltaX = (cardRect.left + cardRect.width * 0.5) - (screenRect.left + screenRect.width * 0.5);
    var deltaY = (cardRect.top + cardRect.height * 0.5) - (screenRect.top + screenRect.height * 0.5);

    screen.style.setProperty('--preview-origin-x', clamp(deltaX * 0.38, -180, 180) + 'px');
    screen.style.setProperty('--preview-origin-y', clamp(deltaY * 0.28, -120, 120) + 'px');
  }

  function updateProjectionPan(card, evt) {
    if (!evt) return;
    var cardFrame = card.querySelector('.projects-index__card-img') || card;
    var rect = cardFrame.getBoundingClientRect();
    var normX = ((evt.clientX - rect.left) / rect.width) - 0.5;
    var normY = ((evt.clientY - rect.top) / rect.height) - 0.5;
    screen.style.setProperty('--preview-pan-x', clamp(normX * 28, -24, 24) + 'px');
    screen.style.setProperty('--preview-pan-y', clamp(normY * 22, -18, 18) + 'px');
  }

  function triggerProjectionBeam() {
    preview.classList.remove('is-projecting');
    void preview.offsetWidth;
    preview.classList.add('is-projecting');
    clearTimeout(beamTimer);
    beamTimer = setTimeout(function () {
      preview.classList.remove('is-projecting');
    }, 520);
  }

  function activatePreview(card, evt) {
    if (!card) return;
    clearTimeout(clearTimer);
    setProjectionOrigin(card);
    updateProjectionPan(card, evt);

    var imgEl = card.querySelector('.projects-index__card-img img');
    if (!imgEl) return;

    var nextSrc = imgEl.currentSrc || imgEl.src;
    var nextTitle = '';
    var titleEl = card.querySelector('.projects-index__card-name');
    if (titleEl) nextTitle = titleEl.textContent.trim();

    if (activeCard !== card || image.src !== nextSrc) {
      activeCard = card;
      preview.classList.remove('is-active');
      image.src = nextSrc;
      image.alt = imgEl.alt || nextTitle;
      title.textContent = nextTitle;
      triggerProjectionBeam();
      requestAnimationFrame(function () {
        preview.classList.add('is-active');
      });
      return;
    }

    preview.classList.add('is-active');
  }

  function clearPreview() {
    activeCard = null;
    preview.classList.remove('is-active', 'is-projecting');
    screen.style.setProperty('--preview-pan-x', '0px');
    screen.style.setProperty('--preview-pan-y', '0px');
    clearTimeout(clearTimer);
    clearTimer = setTimeout(function () {
      if (!activeCard) {
        title.textContent = '';
        image.src = '';
        image.alt = '';
      }
    }, 220);
  }

  cards.forEach(function (card) {
    card.addEventListener('mouseenter', function (evt) {
      activatePreview(card, evt);
    });

    card.addEventListener('mousemove', function (evt) {
      activatePreview(card, evt);
    });

    card.addEventListener('focus', function () {
      activatePreview(card);
    });
  });

  layout.addEventListener('mouseleave', function () {
    clearPreview();
  });

  window.addEventListener('resize', function () {
    if (activeCard) setProjectionOrigin(activeCard);
  });
}

// Initialize all features
function initProjectPage() {
  // Clean up previous bar if exists
  var oldBar = document.querySelector('.project-nav-bar');
  if (oldBar) oldBar.remove();

  initProjectsIndexPreview();
  initGalleryReveals();
  initParallaxHero();
  initNavBar();
  initSpecCounters();
  initFilmstrip();
}

initProjectPage();
