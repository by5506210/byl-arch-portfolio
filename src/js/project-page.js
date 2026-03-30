// ============================================
// PROJECT PAGE — Clip-reveal image animations
// ============================================

(function () {
  // Reveal gallery images with clip-path wipe on scroll
  var images = document.querySelectorAll('.project-gallery__image');

  if (images.length === 0) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -10% 0px'
  });

  images.forEach(function (img) {
    observer.observe(img);
  });
})();
