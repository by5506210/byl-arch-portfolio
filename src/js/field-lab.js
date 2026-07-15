// ============================================
// APHELION FIELD LAB - switches between the
// vector / fabric / pressure-dot field systems
// and each system's A-D behavior modes
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

    // Only the exhibited system gets to render; the hidden ones would
    // otherwise keep drawing full-screen frames behind zero opacity.
    if (typeof window.setVectorFieldActive === 'function') {
      window.setVectorFieldActive(name === 'vector');
    }
    if (typeof window.setDotFieldActive === 'function') {
      window.setDotFieldActive(name === 'fabric');
    }
    if (typeof window.setPressureDotsActive === 'function') {
      window.setPressureDotsActive(name === 'dots');
    }

    document.querySelectorAll('[data-lab-field]').forEach(function (chip) {
      chip.classList.toggle('is-active', chip.getAttribute('data-lab-field') === name);
    });

    document.querySelectorAll('.field-lab__modes').forEach(function (row) {
      row.classList.toggle('is-visible', row.getAttribute('data-modes-for') === name);
    });

    // The pressure field self-initializes on page load; this is a safety
    // net in case its canvas arrived after that (e.g. SPA container swap).
    if (name === 'dots' && typeof window.initPressureDots === 'function') {
      var dotsCanvas = layers.dots;
      if (dotsCanvas && dotsCanvas.getAttribute('data-renderer') !== 'pressure-webgl') {
        window.initPressureDots();
      }
    }
  }

  function activateModeChip(chip) {
    var row = chip.closest('.field-lab__modes');
    if (!row) return;
    row.querySelectorAll('.field-lab__mode').forEach(function (sibling) {
      sibling.classList.toggle('is-active', sibling === chip);
    });
  }

  document.addEventListener('click', function (event) {
    var fieldChip = event.target.closest('[data-lab-field]');
    if (fieldChip) {
      setField(fieldChip.getAttribute('data-lab-field'));
      return;
    }

    var fabricChip = event.target.closest('[data-fabric-mode]');
    if (fabricChip && typeof window.setDotFieldWarpMode === 'function') {
      if (window.setDotFieldWarpMode(fabricChip.getAttribute('data-fabric-mode'))) {
        activateModeChip(fabricChip);
      }
      return;
    }

    var dotsChip = event.target.closest('[data-dots-mode]');
    if (dotsChip && typeof window.setPressureDotsMode === 'function') {
      if (window.setPressureDotsMode(dotsChip.getAttribute('data-dots-mode'))) {
        activateModeChip(dotsChip);
      }
      return;
    }

    var vectorChip = event.target.closest('[data-vector-mode]');
    if (vectorChip && typeof window.setVectorFieldMode === 'function') {
      if (window.setVectorFieldMode(vectorChip.getAttribute('data-vector-mode'))) {
        activateModeChip(vectorChip);
      }
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
