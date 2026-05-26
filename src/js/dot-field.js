// ============================================
// STATIC DOT FIELD - cursor-proximity background
// ============================================

(function () {
  'use strict';

  var previousInitVectorField = window.initVectorField;
  var instances = [];
  var listenersAttached = false;
  var mouseX = -1000;
  var mouseY = -1000;
  var touchInfluenceTimer = null;

  var DARK_DOT = '26, 26, 26';
  var TAU = Math.PI * 2;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(edge0, edge1, value) {
    var t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function fieldNoise(row, col, salt) {
    var n = Math.imul(row + 1, 374761393) ^
      Math.imul(col + 1, 668265263) ^
      Math.imul(salt + 1, 224682251);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    function setPointerPosition(clientX, clientY) {
      if (touchInfluenceTimer) {
        clearTimeout(touchInfluenceTimer);
        touchInfluenceTimer = null;
      }
      mouseX = clientX;
      mouseY = clientY;
    }

    function clearPointer(delay) {
      if (touchInfluenceTimer) clearTimeout(touchInfluenceTimer);
      touchInfluenceTimer = setTimeout(function () {
        mouseX = -1000;
        mouseY = -1000;
        touchInfluenceTimer = null;
      }, delay || 0);
    }

    document.addEventListener('pointerdown', function (event) {
      setPointerPosition(event.clientX, event.clientY);
    }, { passive: true });

    document.addEventListener('pointermove', function (event) {
      setPointerPosition(event.clientX, event.clientY);
    }, { passive: true });

    document.addEventListener('pointerup', function (event) {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') clearPointer(140);
    }, { passive: true });

    document.addEventListener('pointercancel', function () {
      clearPointer(80);
    }, { passive: true });

    document.addEventListener('mousemove', function (event) {
      setPointerPosition(event.clientX, event.clientY);
    });

    document.addEventListener('mouseleave', function () {
      clearPointer(0);
    });

    document.addEventListener('touchstart', function (event) {
      if (!event.touches || !event.touches.length) return;
      setPointerPosition(event.touches[0].clientX, event.touches[0].clientY);
    }, { passive: true });

    document.addEventListener('touchmove', function (event) {
      if (!event.touches || !event.touches.length) return;
      setPointerPosition(event.touches[0].clientX, event.touches[0].clientY);
    }, { passive: true });

    document.addEventListener('touchend', function () {
      clearPointer(140);
    }, { passive: true });

    document.addEventListener('touchcancel', function () {
      clearPointer(80);
    }, { passive: true });
  }

  function getDotCanvases(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var canvases = [];

    if (scope.matches && scope.matches('canvas[data-field="dots"]')) {
      canvases.push(scope);
    }

    var found = scope.querySelectorAll ? scope.querySelectorAll('canvas[data-field="dots"]') : [];
    for (var i = 0; i < found.length; i++) {
      if (canvases.indexOf(found[i]) === -1) canvases.push(found[i]);
    }

    return canvases;
  }

  function stopInstances() {
    for (var i = 0; i < instances.length; i++) {
      instances[i].stop();
    }
    instances = [];
  }

  function DotField(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true }) ||
      canvas.getContext('2d', { alpha: true }) ||
      canvas.getContext('2d');

    this.surface = canvas.getAttribute('data-field-surface') || 'page';
    this.isHomeField = this.surface.indexOf('home') === 0;
    this.isDividerField = this.surface === 'home-divider';
    this.isContactPage = this.surface === 'contact';
    this.isAboutPage = this.surface === 'about';
    this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.fieldWidth = 0;
    this.fieldHeight = 0;
    this.backingScale = 1;
    this.lastCanvasWidth = 0;
    this.lastCanvasHeight = 0;
    this.lastFieldWidth = 0;
    this.lastFieldHeight = 0;
    this.lastSpacing = 0;
    this.spacing = 32;
    this.baseRadius = 0.8;
    this.baseAlpha = 0.12;
    this.cursorRadius = 185;
    this.cursorBoost = 2.4;
    this.particles = [];
    this.gridCols = 0;
    this.gridRows = 0;
    this.mousePresence = 0;
    this.smoothedMouseX = -1000;
    this.smoothedMouseY = -1000;
    this.lastFrameTime = 0;
    this.resizeFrame = null;
    this.raf = null;
    this.running = false;
    this.resizeHandler = this.scheduleResize.bind(this);
    this.animate = this.animate.bind(this);
  }

  DotField.prototype.resolveMetrics = function () {
    var isMobile = window.innerWidth < 768;

    if (this.isHomeField) {
      return {
        spacing: isMobile ? 18 : 26,
        radius: isMobile ? 0.48 : 0.62,
        alpha: this.isDividerField ? 0.18 : 0.15,
        cursorRadius: isMobile ? 132 : 166,
        cursorBoost: 2.35,
        budget: 3600
      };
    }

    if (this.isContactPage) {
      return {
        spacing: isMobile ? 17 : 26,
        radius: isMobile ? 0.58 : 0.78,
        alpha: 0.2,
        cursorRadius: isMobile ? 145 : 188,
        cursorBoost: 2.5,
        budget: 3600
      };
    }

    return {
      spacing: isMobile ? 18 : 27,
      radius: isMobile ? 0.54 : 0.72,
      alpha: 0.18,
      cursorRadius: isMobile ? 140 : 182,
      cursorBoost: 2.45,
      budget: 3600
    };
  };

  DotField.prototype.resolveFieldHeight = function () {
    if (this.isHomeField || this.isContactPage) return window.innerHeight;

    var parent = this.canvas.parentElement;
    var parentHeight = parent ? Math.max(parent.scrollHeight, parent.offsetHeight) : 0;
    var bodyHeight = Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement ? document.documentElement.scrollHeight : 0
    );

    return Math.max(window.innerHeight, parentHeight, bodyHeight);
  };

  DotField.prototype.applyMetrics = function () {
    var metrics = this.resolveMetrics();
    this.spacing = metrics.spacing;

    if (window.innerWidth >= 768 && metrics.budget > 0) {
      var budgetSpacing = Math.sqrt((this.fieldWidth * this.fieldHeight) / metrics.budget);
      if (budgetSpacing > this.spacing) this.spacing = budgetSpacing;
    }

    var spacingScale = this.spacing / metrics.spacing;
    var visualScale = window.innerWidth >= 768 ? Math.sqrt(spacingScale) : 1;
    this.baseRadius = metrics.radius * Math.min(1.16, visualScale);
    this.baseAlpha = metrics.alpha;
    this.cursorRadius = metrics.cursorRadius;
    this.cursorBoost = metrics.cursorBoost;
  };

  DotField.prototype.init = function () {
    if (!this.ctx) return;
    this.canvas.setAttribute('data-renderer', 'dot-canvas');
    this.canvas.style.pointerEvents = 'none';
    this.resize();
    window.addEventListener('resize', this.resizeHandler);
    this.running = true;
    this.raf = requestAnimationFrame(this.animate);
  };

  DotField.prototype.stop = function () {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = null;
    window.removeEventListener('resize', this.resizeHandler);
  };

  DotField.prototype.resize = function () {
    var nextFieldWidth = window.innerWidth;
    var nextFieldHeight = this.resolveFieldHeight();
    var isMobile = nextFieldWidth < 768;
    var rawDpr = window.devicePixelRatio || 1;
    var dprCap = isMobile ? 1.25 : 1.05;
    var nextDpr = Math.min(rawDpr, dprCap);
    var pixelBudget = 1400000;
    var scaledPixels = nextFieldWidth * nextFieldHeight * nextDpr * nextDpr;

    this.fieldWidth = nextFieldWidth;
    this.fieldHeight = nextFieldHeight;
    this.backingScale = scaledPixels > pixelBudget
      ? nextDpr * Math.sqrt(pixelBudget / scaledPixels)
      : nextDpr;
    this.applyMetrics();

    var canvasWidth = Math.ceil(this.fieldWidth * this.backingScale);
    var canvasHeight = Math.ceil(this.fieldHeight * this.backingScale);
    var sizeChanged = canvasWidth !== this.lastCanvasWidth ||
      canvasHeight !== this.lastCanvasHeight ||
      this.fieldWidth !== this.lastFieldWidth ||
      this.fieldHeight !== this.lastFieldHeight;
    var gridChanged = sizeChanged || Math.abs(this.spacing - this.lastSpacing) > 0.01;

    if (sizeChanged) {
      this.canvas.width = canvasWidth;
      this.canvas.height = canvasHeight;
      this.canvas.style.width = this.fieldWidth + 'px';
      this.canvas.style.height = this.fieldHeight + 'px';
      this.lastCanvasWidth = canvasWidth;
      this.lastCanvasHeight = canvasHeight;
      this.lastFieldWidth = this.fieldWidth;
      this.lastFieldHeight = this.fieldHeight;
    }

    this.ctx.setTransform(this.backingScale, 0, 0, this.backingScale, 0, 0);

    if (gridChanged) {
      this.buildGrid();
      this.lastSpacing = this.spacing;
    }
  };

  DotField.prototype.scheduleResize = function () {
    var self = this;
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = requestAnimationFrame(function () {
      self.resizeFrame = null;
      self.resize();
    });
  };

  DotField.prototype.buildGrid = function () {
    var previous = this.particles;
    var previousCols = this.gridCols;
    var particles = [];
    var cols = Math.ceil(this.fieldWidth / this.spacing) + 2;
    var rows = Math.ceil(this.fieldHeight / this.spacing) + 2;
    this.gridCols = cols;
    this.gridRows = rows;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var jitterX = (fieldNoise(row, col, 8) - 0.5) * this.spacing * 0.22;
        var jitterY = (fieldNoise(row, col, 9) - 0.5) * this.spacing * 0.22;
        var x = (col - 0.5) * this.spacing + jitterX;
        var y = (row - 0.5) * this.spacing + jitterY;
        var layerRand = fieldNoise(row, col, 1);
        var layerSize = layerRand < 0.58 ? 1 : (layerRand < 0.86 ? 0.78 : 0.58);
        var layerAlpha = layerRand < 0.58 ? 1 : (layerRand < 0.86 ? 0.68 : 0.42);
        var prior = previous && previousCols > 0 ? previous[row * previousCols + col] : null;
        var radius = this.baseRadius * layerSize * (0.72 + fieldNoise(row, col, 5) * 0.76);

        particles.push({
          x: x,
          y: y,
          baseRadius: radius,
          currentRadius: prior ? prior.currentRadius : radius,
          baseAlpha: this.baseAlpha * layerAlpha * (0.58 + fieldNoise(row, col, 6) * 0.78),
          cursorOffset: (fieldNoise(row, col, 7) - 0.5) * 54
        });
      }
    }

    this.particles = particles;
  };

  DotField.prototype.updateMouse = function (dt, pageScrollY) {
    var pageMouseX = mouseX;
    var pageMouseY = mouseY;
    if (!this.isHomeField && pageMouseY > 0) pageMouseY += pageScrollY;

    var mouseActive = pageMouseX > 0 && pageMouseY > 0;
    var targetPresence = mouseActive ? 1 : 0;
    var presenceEase = 1 - Math.exp(-dt * (mouseActive ? 10 : 7));
    this.mousePresence += (targetPresence - this.mousePresence) * presenceEase;

    if (mouseActive) {
      if (this.smoothedMouseX < -500 || this.smoothedMouseY < -500) {
        this.smoothedMouseX = pageMouseX;
        this.smoothedMouseY = pageMouseY;
      } else {
        var followEase = 1 - Math.exp(-dt * 18);
        this.smoothedMouseX += (pageMouseX - this.smoothedMouseX) * followEase;
        this.smoothedMouseY += (pageMouseY - this.smoothedMouseY) * followEase;
      }
    } else if (this.mousePresence < 0.01) {
      this.smoothedMouseX = -1000;
      this.smoothedMouseY = -1000;
    }
  };

  DotField.prototype.draw = function (dt, pageScrollY) {
    var ctx = this.ctx;
    var visibleTop = 0;
    var visibleBottom = this.fieldHeight;

    if (!this.isHomeField && !this.isContactPage) {
      var padding = this.spacing * 3;
      visibleTop = Math.max(0, pageScrollY - padding);
      visibleBottom = Math.min(this.fieldHeight, pageScrollY + window.innerHeight + padding);
    }

    ctx.clearRect(0, visibleTop, this.fieldWidth, Math.max(1, visibleBottom - visibleTop));

    var mouseActive = this.mousePresence > 0.02 && this.smoothedMouseX > 0 && this.smoothedMouseY > 0;

    for (var i = 0; i < this.particles.length; i++) {
      var particle = this.particles[i];
      if (particle.y < visibleTop - this.spacing || particle.y > visibleBottom + this.spacing) continue;

      var targetRadius = particle.baseRadius;
      var targetAlpha = particle.baseAlpha;

      if (mouseActive) {
        var dx = particle.x - this.smoothedMouseX;
        var dy = particle.y - this.smoothedMouseY;
        var cursorRadius = Math.max(80, this.cursorRadius + particle.cursorOffset);
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < cursorRadius) {
          var strength = (1 - smoothstep(0, cursorRadius, dist)) * this.mousePresence;
          targetRadius = particle.baseRadius * (1 + strength * this.cursorBoost);
          targetAlpha = particle.baseAlpha * (1 + strength * 0.9);
        }
      }

      var ease = 1 - Math.exp(-dt * (this.reducedMotion ? 10 : 14));
      particle.currentRadius += (targetRadius - particle.currentRadius) * ease;

      if (targetAlpha <= 0.002 || particle.currentRadius <= 0.04) continue;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.currentRadius, 0, TAU);
      ctx.fillStyle = 'rgba(' + DARK_DOT + ', ' + clamp(targetAlpha, 0, 0.58).toFixed(4) + ')';
      ctx.fill();
    }
  };

  DotField.prototype.animate = function (timestamp) {
    if (!this.running) return;

    if (document.hidden) {
      this.lastFrameTime = 0;
      this.raf = requestAnimationFrame(this.animate);
      return;
    }

    var rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && (Math.abs(rect.width - this.fieldWidth) > 2 || Math.abs(rect.height - this.fieldHeight) > 2)) {
      this.scheduleResize();
    }

    var minFrameMs = this.reducedMotion ? 1000 / 24 : 0;
    if (!this.lastFrameTime) this.lastFrameTime = minFrameMs > 0 ? timestamp - minFrameMs : timestamp;
    var elapsedMs = timestamp - this.lastFrameTime;

    if (minFrameMs > 0 && elapsedMs < minFrameMs) {
      this.raf = requestAnimationFrame(this.animate);
      return;
    }

    var dt = elapsedMs / 1000;
    this.lastFrameTime = minFrameMs > 0 ? timestamp - (elapsedMs % minFrameMs) : timestamp;
    if (dt > 0.1) dt = 0.05;

    var pageScrollY = window.scrollY || window.pageYOffset || 0;
    this.updateMouse(dt, pageScrollY);
    this.draw(dt, pageScrollY);

    this.raf = requestAnimationFrame(this.animate);
  };

  function initDotField(root) {
    stopInstances();
    attachListeners();

    var canvases = getDotCanvases(root);
    for (var i = 0; i < canvases.length; i++) {
      var instance = new DotField(canvases[i]);
      instance.init();
      instances.push(instance);
    }
  }

  function initFieldDispatcher(root) {
    var dotCanvases = getDotCanvases(root);
    if (dotCanvases.length) initDotField(root);

    var vectorCanvas = document.getElementById('vector-field');
    var shouldUseVector = vectorCanvas && vectorCanvas.getAttribute('data-field') !== 'dots';
    if (shouldUseVector && typeof previousInitVectorField === 'function') {
      previousInitVectorField();
    }
  }

  window.initDotField = initDotField;
  window.initVectorField = initFieldDispatcher;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initDotField();
    }, { once: true });
  } else {
    initDotField();
  }
})();
