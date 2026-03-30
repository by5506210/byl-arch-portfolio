// ============================================
// PROJECT PAGE — Scroll-triggered image reveals
// ============================================

(function () {
  gsap.registerPlugin(ScrollTrigger);

  // Animate gallery images on scroll
  const galleryImages = document.querySelectorAll('.project-gallery__image');

  galleryImages.forEach((img) => {
    gsap.to(img, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: img,
        start: 'top 85%',
        once: true,
      },
    });
  });
})();
