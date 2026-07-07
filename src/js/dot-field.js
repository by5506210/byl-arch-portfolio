// ============================================
// WEBGL GRID FIELD - cursor warps the grid like
// mass distorting the fabric of space
// ============================================

(function () {
  'use strict';

  var previousInitVectorField = window.initVectorField;
  var instances = [];
  var listenersAttached = false;
  var pointerX = -1000;
  var pointerY = -1000;
  var pointerClearTimer = null;
  var pointerInputBlockedUntil = 0;
  var revealState = {
    active: false,
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.5,
    radius: 0,
    progress: 0
  };

  // Anisotropic cursor field shared by the line-warp and dimple shaders.
  // The pocket stretches along the drag vector: strongly behind the motion
  // (a trailing wake), slightly ahead. dragMag 0 -> perfect circle.
  var FABRIC_FIELD_GLSL = [
    'float fabricField(vec2 toVertex, float radius, vec2 drag) {',
    '  float dragMag = length(drag);',
    '  vec2 dragDir = dragMag > 0.001 ? drag / dragMag : vec2(1.0, 0.0);',
    '  float along = dot(toVertex, dragDir);',
    '  float across = dot(toVertex, vec2(-dragDir.y, dragDir.x));',
    '  float stretch = along < 0.0 ? 1.9 : 0.55;',
    '  float axisScale = 1.0 / (1.0 + dragMag * stretch);',
    '  float dist = length(vec2(along * axisScale, across));',
    '  return 1.0 - smoothstep(0.0, radius, dist);',
    '}'
  ].join('\n');

  var VERTEX_SHADER = [
    'attribute vec2 a_position;',
    'attribute float a_seed;',
    'uniform vec2 u_resolution;',
    'uniform vec2 u_mouse;',
    'uniform float u_mousePresence;',
    'uniform float u_cursorRadius;',
    'uniform float u_warpAmount;',
    'uniform float u_baseAlpha;',
    'uniform vec2 u_drag;',
    'uniform vec2 u_revealCenter;',
    'uniform vec4 u_reveal;',
    'uniform int u_rippleCount;',
    'uniform vec4 u_ripples[6];',
    'varying float v_alpha;',
    FABRIC_FIELD_GLSL,
    'void main() {',
    '  vec2 pos = a_position;',
    '  float alpha = u_baseAlpha;',
    '  vec2 toVertex = a_position - u_mouse;',
    '  float seededRadius = u_cursorRadius * (0.88 + a_seed * 0.24);',
    '  float t = fabricField(toVertex, seededRadius, u_drag) * u_mousePresence;',
    '  if (t > 0.001) {',
    '    float dist = length(toVertex);',
    '    vec2 dir = dist > 0.001 ? toVertex / dist : vec2(0.0, 1.0);',
    '    vec2 tangent = vec2(-dir.y, dir.x);',
    '    float push = t * t * u_warpAmount * (0.82 + a_seed * 0.36);',
    '    pos += dir * push + tangent * push * (a_seed - 0.5) * 0.55;',
    '    alpha *= 1.0 + t * 0.85;',
    '  }',
    '  for (int i = 0; i < 6; i++) {',
    '    if (i >= u_rippleCount) break;',
    '    vec4 rp = u_ripples[i];',
    '    vec2 rippleDelta = pos - rp.xy;',
    '    float rippleDist = length(rippleDelta);',
    '    float band = 1.0 - smoothstep(0.0, 110.0, abs(rippleDist - rp.z));',
    '    if (band > 0.001) {',
    '      vec2 rippleDir = rippleDist > 0.001 ? rippleDelta / rippleDist : vec2(0.0, -1.0);',
    '      float amp = band * rp.w;',
    '      pos += rippleDir * amp * (9.0 + a_seed * 8.0);',
    '      alpha += amp * 0.2;',
    '    }',
    '  }',
    '  if (u_reveal.x > 0.5) {',
    '    float damp = clamp(u_reveal.w, 0.0, 1.0);',
    '    vec2 revealDelta = pos - u_revealCenter;',
    '    float revealDist = length(revealDelta);',
    '    float band = 1.0 - smoothstep(0.0, 150.0, abs(revealDist - u_reveal.y));',
    '    vec2 revealDir = revealDist > 0.001 ? revealDelta / revealDist : vec2(0.0, -1.0);',
    '    pos += revealDir * band * 18.0 * mix(1.0, 0.33, damp);',
    '    alpha += band * 0.24 * mix(1.0, 0.43, damp);',
    '  }',
    '  vec2 zeroToOne = pos / u_resolution;',
    '  vec2 clipSpace = zeroToOne * 2.0 - 1.0;',
    '  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);',
    '  v_alpha = min(alpha, 0.85);',
    '}'
  ].join('\n');

  var FRAGMENT_SHADER = [
    'precision mediump float;',
    'uniform vec3 u_color;',
    'varying float v_alpha;',
    'void main() {',
    '  gl_FragColor = vec4(u_color, v_alpha);',
    '}'
  ].join('\n');

  // Soft shadow painted under the lines: the fabric dips into shade where
  // the cursor presses. Drawn as a fullscreen quad before the grid pass.
  var DIMPLE_VERTEX_SHADER = [
    'attribute vec2 a_position;',
    'uniform vec2 u_resolution;',
    'varying vec2 v_pos;',
    'void main() {',
    '  v_pos = a_position;',
    '  vec2 zeroToOne = a_position / u_resolution;',
    '  vec2 clipSpace = zeroToOne * 2.0 - 1.0;',
    '  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);',
    '}'
  ].join('\n');

  var DIMPLE_FRAGMENT_SHADER = [
    'precision mediump float;',
    'uniform vec2 u_mouse;',
    'uniform float u_mousePresence;',
    'uniform float u_cursorRadius;',
    'uniform vec2 u_drag;',
    'uniform float u_dimpleStrength;',
    'uniform vec3 u_color;',
    'varying vec2 v_pos;',
    FABRIC_FIELD_GLSL,
    'void main() {',
    '  float t = fabricField(v_pos - u_mouse, u_cursorRadius, u_drag) * u_mousePresence;',
    '  float shade = t * t * u_dimpleStrength;',
    '  gl_FragColor = vec4(u_color, shade);',
    '}'
  ].join('\n');

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function fieldNoise(row, col, salt) {
    var n = Math.imul(row + 1, 374761393) ^
      Math.imul(col + 1, 668265263) ^
      Math.imul(salt + 1, 224682251);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function compileShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(error || 'Could not compile grid field shader');
    }

    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    var vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    var fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    var program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(error || 'Could not link grid field shader program');
    }

    return program;
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

  function requestRenderAll() {
    for (var i = 0; i < instances.length; i++) {
      instances[i].requestRender();
    }
  }

  function resetPointerState() {
    if (pointerClearTimer) {
      clearTimeout(pointerClearTimer);
      pointerClearTimer = null;
    }

    pointerX = -1000;
    pointerY = -1000;

    for (var i = 0; i < instances.length; i++) {
      if (typeof instances[i].resetMouseState === 'function') {
        instances[i].resetMouseState();
      }
    }
  }

  function setDotFieldTransition(config) {
    var wasActive = revealState.active;
    revealState.active = !!(config && config.active);
    revealState.x = config && typeof config.x === 'number' ? config.x : window.innerWidth * 0.5;
    revealState.y = config && typeof config.y === 'number' ? config.y : window.innerHeight * 0.5;
    revealState.radius = config && typeof config.radius === 'number' ? Math.max(0, config.radius) : 0;
    revealState.progress = config && typeof config.progress === 'number' ? clamp(config.progress, 0, 1) : 0;
    if (revealState.active || wasActive) {
      pointerInputBlockedUntil = Date.now() + 220;
      resetPointerState();
      for (var i = 0; i < instances.length; i++) {
        if (instances[i].ripples) instances[i].ripples.length = 0;
      }
    }
    requestRenderAll();
  }

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    function setPointerPosition(clientX, clientY) {
      if (revealState.active || Date.now() < pointerInputBlockedUntil) {
        resetPointerState();
        return;
      }

      if (pointerClearTimer) {
        clearTimeout(pointerClearTimer);
        pointerClearTimer = null;
      }
      pointerX = clientX;
      pointerY = clientY;
      requestRenderAll();
    }

    function clearPointer(delay) {
      if (pointerClearTimer) clearTimeout(pointerClearTimer);
      pointerClearTimer = setTimeout(function () {
        pointerX = -1000;
        pointerY = -1000;
        pointerClearTimer = null;
        requestRenderAll();
      }, delay || 0);
    }

    document.addEventListener('pointerdown', function (event) {
      setPointerPosition(event.clientX, event.clientY);
      if (!revealState.active && Date.now() >= pointerInputBlockedUntil) {
        for (var i = 0; i < instances.length; i++) {
          if (typeof instances[i].addRipple === 'function') {
            instances[i].addRipple(event.clientX, event.clientY);
          }
        }
      }
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

    window.addEventListener('scroll', requestRenderAll, { passive: true });
  }

  function stopInstances() {
    for (var i = 0; i < instances.length; i++) {
      instances[i].stop();
    }
    instances = [];
  }

  function DotField(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.program = null;
    this.dimpleProgram = null;
    this.positionBuffer = null;
    this.positionData = null;
    this.seedBuffer = null;
    this.seedData = null;
    this.dimpleBuffer = null;
    this.vertexCount = 0;
    this.ripples = [];
    this.rippleUniforms = new Float32Array(24);

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
    this.baseAlpha = 0.13;
    this.cursorRadius = 185;
    this.warpAmount = 24;
    this.dimpleStrength = 0.06;
    this.mousePresence = 0;
    this.smoothedMouseX = -1000;
    this.smoothedMouseY = -1000;
    this.velX = 0;
    this.velY = 0;
    this.lastFrameTime = 0;
    this.resizeFrame = null;
    this.raf = null;
    this.running = false;

    this.resizeHandler = this.scheduleResize.bind(this);
    this.contextLostHandler = this.handleContextLost.bind(this);
    this.contextRestoredHandler = this.handleContextRestored.bind(this);
    this.animate = this.animate.bind(this);
  }

  DotField.prototype.resolveMetrics = function () {
    var isMobile = window.innerWidth < 768;

    if (this.isHomeField) {
      return {
        spacing: isMobile ? 30 : 42,
        alpha: this.isDividerField ? 0.15 : 0.12,
        cursorRadius: isMobile ? 140 : 185,
        warp: isMobile ? 18 : 24,
        dimple: 0.055
      };
    }

    if (this.isContactPage) {
      return {
        spacing: isMobile ? 28 : 42,
        alpha: 0.16,
        cursorRadius: isMobile ? 145 : 195,
        warp: isMobile ? 19 : 26,
        dimple: 0.07
      };
    }

    return {
      spacing: isMobile ? 30 : 44,
      alpha: 0.14,
      cursorRadius: isMobile ? 142 : 190,
      warp: isMobile ? 18 : 25,
      dimple: 0.065
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

    // Cap total line vertices on very large fields by widening the spacing.
    var budgetSpacing = Math.sqrt((this.fieldWidth * this.fieldHeight) / 2600);
    if (budgetSpacing > this.spacing) this.spacing = budgetSpacing;

    this.baseAlpha = metrics.alpha;
    this.cursorRadius = metrics.cursorRadius;
    this.warpAmount = metrics.warp;
    this.dimpleStrength = metrics.dimple;
  };

  DotField.prototype.init = function () {
    var options = {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: false
    };

    this.gl = this.canvas.getContext('webgl', options) ||
      this.canvas.getContext('experimental-webgl', options);

    if (!this.gl) {
      this.canvas.setAttribute('data-renderer', 'dot-webgl-unavailable');
      return;
    }

    try {
      this.program = createProgram(this.gl, VERTEX_SHADER, FRAGMENT_SHADER);
      this.dimpleProgram = createProgram(this.gl, DIMPLE_VERTEX_SHADER, DIMPLE_FRAGMENT_SHADER);
    } catch (error) {
      this.canvas.setAttribute('data-renderer', 'dot-webgl-error');
      return;
    }

    this.positionBuffer = this.gl.createBuffer();
    this.seedBuffer = this.gl.createBuffer();
    this.dimpleBuffer = this.gl.createBuffer();
    this.cacheLocations();
    this.configureGL();

    this.canvas.setAttribute('data-renderer', 'dot-webgl');
    this.canvas.style.pointerEvents = 'none';
    this.canvas.addEventListener('webglcontextlost', this.contextLostHandler, false);
    this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler, false);
    window.addEventListener('resize', this.resizeHandler);

    this.running = true;
    this.resize();
    this.draw();
  };

  DotField.prototype.cacheLocations = function () {
    var gl = this.gl;
    this.locations = {
      position: gl.getAttribLocation(this.program, 'a_position'),
      seed: gl.getAttribLocation(this.program, 'a_seed'),
      rippleCount: gl.getUniformLocation(this.program, 'u_rippleCount'),
      ripples: gl.getUniformLocation(this.program, 'u_ripples[0]'),
      resolution: gl.getUniformLocation(this.program, 'u_resolution'),
      mouse: gl.getUniformLocation(this.program, 'u_mouse'),
      mousePresence: gl.getUniformLocation(this.program, 'u_mousePresence'),
      cursorRadius: gl.getUniformLocation(this.program, 'u_cursorRadius'),
      warpAmount: gl.getUniformLocation(this.program, 'u_warpAmount'),
      baseAlpha: gl.getUniformLocation(this.program, 'u_baseAlpha'),
      drag: gl.getUniformLocation(this.program, 'u_drag'),
      revealCenter: gl.getUniformLocation(this.program, 'u_revealCenter'),
      reveal: gl.getUniformLocation(this.program, 'u_reveal'),
      color: gl.getUniformLocation(this.program, 'u_color')
    };
    this.dimpleLocations = {
      position: gl.getAttribLocation(this.dimpleProgram, 'a_position'),
      resolution: gl.getUniformLocation(this.dimpleProgram, 'u_resolution'),
      mouse: gl.getUniformLocation(this.dimpleProgram, 'u_mouse'),
      mousePresence: gl.getUniformLocation(this.dimpleProgram, 'u_mousePresence'),
      cursorRadius: gl.getUniformLocation(this.dimpleProgram, 'u_cursorRadius'),
      drag: gl.getUniformLocation(this.dimpleProgram, 'u_drag'),
      dimpleStrength: gl.getUniformLocation(this.dimpleProgram, 'u_dimpleStrength'),
      color: gl.getUniformLocation(this.dimpleProgram, 'u_color')
    };
  };

  DotField.prototype.configureGL = function () {
    var gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  };

  DotField.prototype.stop = function () {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = null;

    window.removeEventListener('resize', this.resizeHandler);
    this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler, false);
    this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler, false);

    if (this.gl) {
      if (this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer);
      if (this.seedBuffer) this.gl.deleteBuffer(this.seedBuffer);
      if (this.dimpleBuffer) this.gl.deleteBuffer(this.dimpleBuffer);
      if (this.program) this.gl.deleteProgram(this.program);
      if (this.dimpleProgram) this.gl.deleteProgram(this.dimpleProgram);
    }

    this.positionBuffer = null;
    this.seedBuffer = null;
    this.dimpleBuffer = null;
    this.program = null;
    this.dimpleProgram = null;
    this.gl = null;
  };

  DotField.prototype.handleContextLost = function (event) {
    event.preventDefault();
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  };

  DotField.prototype.handleContextRestored = function () {
    this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
    if (!this.gl) return;
    this.program = createProgram(this.gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.dimpleProgram = createProgram(this.gl, DIMPLE_VERTEX_SHADER, DIMPLE_FRAGMENT_SHADER);
    this.positionBuffer = this.gl.createBuffer();
    this.seedBuffer = this.gl.createBuffer();
    this.dimpleBuffer = this.gl.createBuffer();
    this.cacheLocations();
    this.configureGL();
    this.lastCanvasWidth = 0;
    this.lastCanvasHeight = 0;
    this.lastSpacing = 0;
    this.running = true;
    this.resize();
    this.requestRender();
  };

  DotField.prototype.resize = function () {
    if (!this.gl) return;

    var nextFieldWidth = window.innerWidth;
    var nextFieldHeight = this.resolveFieldHeight();
    var isMobile = nextFieldWidth < 768;
    var rawDpr = window.devicePixelRatio || 1;
    var dprCap = isMobile ? 1.25 : 1.1;
    var nextDpr = Math.min(rawDpr, dprCap);
    var pixelBudget = 1800000;
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
      this.gl.viewport(0, 0, canvasWidth, canvasHeight);
      this.lastCanvasWidth = canvasWidth;
      this.lastCanvasHeight = canvasHeight;
      this.lastFieldWidth = this.fieldWidth;
      this.lastFieldHeight = this.fieldHeight;
    }

    if (gridChanged) {
      this.buildGrid();
      this.uploadBuffers();
      this.lastSpacing = this.spacing;
    }

    this.requestRender();
  };

  DotField.prototype.scheduleResize = function () {
    var self = this;
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = requestAnimationFrame(function () {
      self.resizeFrame = null;
      self.resize();
    });
  };

  // Build the grid as tessellated line segments (gl.LINES pairs) so the
  // vertex shader can bend lines smoothly around the cursor. Each line is
  // sampled every few pixels; sample points carry a tiny baked-in
  // perpendicular wobble for a hand-drawn feel, plus a per-point seed so
  // threads respond to the cursor with individual character. Shared segment
  // endpoints reuse the same wobble and seed so lines never crack apart.
  DotField.prototype.buildGrid = function () {
    var spacing = this.spacing;
    var step = Math.max(9, spacing * 0.3);
    var width = this.fieldWidth;
    var height = this.fieldHeight;
    var cols = Math.ceil(width / spacing) + 1;
    var rows = Math.ceil(height / spacing) + 1;
    var segments = [];
    var seeds = [];
    var wobble = 1.3;
    var i, j, prevX, prevY, x, y, offset, seed, prevSeed;

    // Horizontal lines
    for (i = 0; i < rows; i++) {
      y = i * spacing;
      prevX = -step;
      offset = (fieldNoise(i, 0, 3) - 0.5) * wobble;
      prevY = y + offset;
      prevSeed = fieldNoise(i, 0, 5);
      var samplesH = Math.ceil((width + step * 2) / step);
      for (j = 1; j <= samplesH; j++) {
        x = -step + j * step;
        offset = (fieldNoise(i, j, 3) - 0.5) * wobble;
        seed = fieldNoise(i, j, 5);
        segments.push(prevX, prevY, x, y + offset);
        seeds.push(prevSeed, seed);
        prevX = x;
        prevY = y + offset;
        prevSeed = seed;
      }
    }

    // Vertical lines
    for (i = 0; i < cols; i++) {
      x = i * spacing;
      prevY = -step;
      offset = (fieldNoise(0, i, 4) - 0.5) * wobble;
      prevX = x + offset;
      prevSeed = fieldNoise(0, i, 6);
      var samplesV = Math.ceil((height + step * 2) / step);
      for (j = 1; j <= samplesV; j++) {
        y = -step + j * step;
        offset = (fieldNoise(j, i, 4) - 0.5) * wobble;
        seed = fieldNoise(j, i, 6);
        segments.push(prevX, prevY, x + offset, y);
        seeds.push(prevSeed, seed);
        prevX = x + offset;
        prevY = y;
        prevSeed = seed;
      }
    }

    this.positionData = new Float32Array(segments);
    this.seedData = new Float32Array(seeds);
    this.vertexCount = segments.length / 2;
  };

  DotField.prototype.uploadBuffers = function () {
    var gl = this.gl;
    if (!gl || !this.positionData || !this.seedData) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positionData, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.seedData, gl.STATIC_DRAW);

    var w = this.fieldWidth;
    var h = this.fieldHeight;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dimpleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, w, 0, 0, h, w, h]), gl.STATIC_DRAW);
  };

  // A click drops a decaying displacement ring onto the fabric.
  DotField.prototype.addRipple = function (clientX, clientY) {
    if (this.reducedMotion) return;
    var y = clientY;
    if (!this.isHomeField) {
      y += window.scrollY || window.pageYOffset || 0;
    }
    this.ripples.push({ x: clientX, y: y, start: performance.now() });
    if (this.ripples.length > 6) this.ripples.shift();
    this.requestRender();
  };

  // Prune expired ripples and pack live ones into the uniform array.
  // Returns the live ripple count.
  DotField.prototype.updateRipples = function (now) {
    var RIPPLE_LIFE = 1.15;
    var live = 0;
    for (var i = 0; i < this.ripples.length; i++) {
      var age = (now - this.ripples[i].start) / 1000;
      if (age >= RIPPLE_LIFE) continue;
      this.ripples[live] = this.ripples[i];
      var fade = 1 - age / RIPPLE_LIFE;
      this.rippleUniforms[live * 4] = this.ripples[i].x;
      this.rippleUniforms[live * 4 + 1] = this.ripples[i].y;
      this.rippleUniforms[live * 4 + 2] = 46 + age * 520;
      this.rippleUniforms[live * 4 + 3] = Math.pow(fade, 1.6);
      live++;
    }
    this.ripples.length = live;
    return live;
  };

  DotField.prototype.resolveMouse = function () {
    var mouseX = pointerX;
    var mouseY = pointerY;
    if (!this.isHomeField && mouseY > 0) {
      mouseY += window.scrollY || window.pageYOffset || 0;
    }
    return { x: mouseX, y: mouseY };
  };

  DotField.prototype.resetMouseState = function () {
    this.mousePresence = 0;
    this.smoothedMouseX = -1000;
    this.smoothedMouseY = -1000;
    this.velX = 0;
    this.velY = 0;
    this.lastFrameTime = 0;
    this.requestRender();
  };

  DotField.prototype.updateMouse = function (dt) {
    var mouse = this.resolveMouse();
    var mouseActive = mouse.x > 0 && mouse.y > 0;
    var targetPresence = mouseActive ? 1 : 0;
    var presenceEase = 1 - Math.exp(-dt * (mouseActive ? 10 : 7));
    var priorPresence = this.mousePresence;
    var priorX = this.smoothedMouseX;
    var priorY = this.smoothedMouseY;
    var priorVelX = this.velX;
    var priorVelY = this.velY;

    this.mousePresence += (targetPresence - this.mousePresence) * presenceEase;

    if (mouseActive) {
      if (this.smoothedMouseX < -500 || this.smoothedMouseY < -500) {
        this.smoothedMouseX = mouse.x;
        this.smoothedMouseY = mouse.y;
      } else {
        var followEase = 1 - Math.exp(-dt * 18);
        this.smoothedMouseX += (mouse.x - this.smoothedMouseX) * followEase;
        this.smoothedMouseY += (mouse.y - this.smoothedMouseY) * followEase;
      }
    } else if (this.mousePresence < 0.01) {
      this.smoothedMouseX = -1000;
      this.smoothedMouseY = -1000;
    }

    // Smoothed cursor velocity drives the drag stretch of the warp pocket.
    if (mouseActive && priorX > -500 && priorY > -500) {
      var instVx = (this.smoothedMouseX - priorX) / dt;
      var instVy = (this.smoothedMouseY - priorY) / dt;
      var velEase = 1 - Math.exp(-dt * 7);
      this.velX += (instVx - this.velX) * velEase;
      this.velY += (instVy - this.velY) * velEase;
    } else {
      var velDecay = Math.exp(-dt * 6);
      this.velX *= velDecay;
      this.velY *= velDecay;
      if (Math.abs(this.velX) < 1) this.velX = 0;
      if (Math.abs(this.velY) < 1) this.velY = 0;
    }

    return Math.abs(priorPresence - this.mousePresence) > 0.001 ||
      Math.abs(priorX - this.smoothedMouseX) > 0.05 ||
      Math.abs(priorY - this.smoothedMouseY) > 0.05 ||
      Math.abs(priorVelX - this.velX) > 0.5 ||
      Math.abs(priorVelY - this.velY) > 0.5;
  };

  // Convert smoothed velocity into the drag uniform: a unit-ish vector in
  // the direction of motion whose length (0..1) is the stretch amount.
  DotField.prototype.resolveDrag = function () {
    var speed = Math.sqrt(this.velX * this.velX + this.velY * this.velY);
    if (speed < 40) return { x: 0, y: 0 };
    var mag = Math.min(1, speed / 1500);
    return { x: (this.velX / speed) * mag, y: (this.velY / speed) * mag };
  };

  DotField.prototype.draw = function () {
    var gl = this.gl;
    if (!gl || !this.program || !this.dimpleProgram || !this.vertexCount) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    var revealActive = this.isHomeField && revealState.active;
    var revealInteractionPresence = revealActive ? 0 : 1;
    var presence = clamp(this.mousePresence * revealInteractionPresence, 0, 1);
    var drag = this.resolveDrag();

    // Pass 1: gravity dimple shadow under the grid.
    gl.useProgram(this.dimpleProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dimpleBuffer);
    gl.enableVertexAttribArray(this.dimpleLocations.position);
    gl.vertexAttribPointer(this.dimpleLocations.position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.dimpleLocations.resolution, this.fieldWidth, this.fieldHeight);
    gl.uniform2f(this.dimpleLocations.mouse, this.smoothedMouseX, this.smoothedMouseY);
    gl.uniform1f(this.dimpleLocations.mousePresence, presence);
    gl.uniform1f(this.dimpleLocations.cursorRadius, this.cursorRadius);
    gl.uniform2f(this.dimpleLocations.drag, drag.x, drag.y);
    gl.uniform1f(this.dimpleLocations.dimpleStrength, this.dimpleStrength);
    gl.uniform3f(this.dimpleLocations.color, 0.065, 0.065, 0.065);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Pass 2: the grid lines.
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuffer);
    gl.enableVertexAttribArray(this.locations.seed);
    gl.vertexAttribPointer(this.locations.seed, 1, gl.FLOAT, false, 0, 0);

    var rippleCount = this.updateRipples(performance.now());
    gl.uniform1i(this.locations.rippleCount, rippleCount);
    gl.uniform4fv(this.locations.ripples, this.rippleUniforms);

    gl.uniform2f(this.locations.resolution, this.fieldWidth, this.fieldHeight);
    gl.uniform2f(this.locations.mouse, this.smoothedMouseX, this.smoothedMouseY);
    gl.uniform1f(this.locations.cursorRadius, this.cursorRadius);
    gl.uniform1f(this.locations.warpAmount, this.warpAmount);
    gl.uniform1f(this.locations.baseAlpha, this.baseAlpha);
    gl.uniform2f(this.locations.drag, drag.x, drag.y);
    gl.uniform1f(this.locations.mousePresence, presence);
    var revealDamp = this.reducedMotion ? 1 : (window.innerWidth < 768 ? 0.81 : 0);
    gl.uniform2f(this.locations.revealCenter, revealState.x, revealState.y);
    gl.uniform4f(
      this.locations.reveal,
      revealActive ? 1 : 0,
      revealActive ? revealState.radius : 0,
      revealActive ? revealState.progress : 0,
      revealDamp
    );
    gl.uniform3f(this.locations.color, 0.065, 0.065, 0.065);
    gl.drawArrays(gl.LINES, 0, this.vertexCount);
  };

  DotField.prototype.requestRender = function () {
    if (!this.running || this.raf || !this.gl) return;
    this.raf = requestAnimationFrame(this.animate);
  };

  DotField.prototype.animate = function (timestamp) {
    if (!this.running || !this.gl) return;

    this.raf = null;

    if (document.hidden) {
      this.lastFrameTime = 0;
      return;
    }

    var rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && (Math.abs(rect.width - this.fieldWidth) > 2 || Math.abs(rect.height - this.fieldHeight) > 2)) {
      this.scheduleResize();
    }

    if (!this.lastFrameTime) this.lastFrameTime = timestamp;
    var dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;
    if (dt > 0.1) dt = 0.05;
    if (dt <= 0) dt = 1 / 60;

    var changed = this.updateMouse(dt) || this.ripples.length > 0;
    this.draw();

    if (changed) {
      this.raf = requestAnimationFrame(this.animate);
    } else {
      this.lastFrameTime = 0;
    }
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
  window.setDotFieldTransition = setDotFieldTransition;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initDotField();
    }, { once: true });
  } else {
    initDotField();
  }
})();
