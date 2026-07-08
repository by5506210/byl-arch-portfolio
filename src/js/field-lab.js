// ============================================
// APHELION FIELD LAB - switches between the
// vector / fabric / pressure-dot field systems
// ============================================

(function () {
  'use strict';

  function getPage() {
    return document.querySelector('.field-lab-page');
  }

  function getLayers(page) {
    return {
      vector: page.querySelector('#vector-field'),
      fabric: page.querySelector('canvas[data-field="dots"]'),
      dots: page.querySelector('canvas[data-field="pressure-dots"]')
    };
  }

  function setField(name) {
    var page = getPage();
    if (!page) return;

    var layers = getLayers(page);
    Object.keys(layers).forEach(function (key) {
      if (layers[key]) layers[key].classList.toggle('is-active', key === name);
    });

    document.querySelectorAll('[data-lab-field]').forEach(function (chip) {
      chip.classList.toggle('is-active', chip.getAttribute('data-lab-field') === name);
    });

    var modes = document.querySelector('.field-lab__modes');
    if (modes) modes.classList.toggle('is-visible', name === 'fabric');

    // The pressure field self-initializes on page load; this is a safety
    // net in case its canvas arrived after that (e.g. SPA container swap).
    if (name === 'dots' && typeof window.initPressureDots === 'function') {
      var dotsCanvas = layers.dots;
      if (dotsCanvas && dotsCanvas.getAttribute('data-renderer') !== 'pressure-webgl') {
        window.initPressureDots();
      }
    }
  }

  document.addEventListener('click', function (event) {
    var fieldChip = event.target.closest('[data-lab-field]');
    if (fieldChip) {
      setField(fieldChip.getAttribute('data-lab-field'));
      return;
    }

    var modeChip = event.target.closest('[data-lab-mode]');
    if (modeChip && typeof window.setDotFieldWarpMode === 'function') {
      window.setDotFieldWarpMode(modeChip.getAttribute('data-lab-mode'));
      document.querySelectorAll('[data-lab-mode]').forEach(function (chip) {
        chip.classList.toggle('is-active', chip === modeChip);
      });
    }
  });

  function boot() {
    if (getPage()) setField('fabric');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
