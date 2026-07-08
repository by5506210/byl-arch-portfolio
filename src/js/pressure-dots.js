// ============================================
// PRESSURE DOTS - cursor-proximity dot field
// for the Aphelion Field lab.
//
// Interactions:
//   move          dots bloom under the cursor, biggest at the center
//   move fast     the bloom stretches into a comet along the motion
//   click         a pulse ring rolls outward through the dots
//   press + hold  the field charges (grows); release fires a pulse
//                 whose power matches the charge
// ============================================

(function () {
  'use strict';

  var instances = [];
  var listenersAttached = false;
  var pointerX = -1000;
  var pointerY = -1000;
  var pointerClearTimer = null;

  var DOT_MODES = { reveal: 0, glow: 1, repel: 2, attract: 3 };
  var globalDotMode = DOT_MODES.reveal;

  var VERTEX_SHADER = [
    'attribute vec2 a_position;',
    'attribute vec3 a_dot;',
    'uniform vec2 u_resolution;',
    'uniform vec2 u_mouse;',
    'uniform float u_mousePresence;',
    'uniform float u_cursorRadius;',
    'uniform float u_cursorBoost;',
    'uniform float u_pixelRatio;',
    'uniform vec2 u_drag;',
    'uniform float u_charge;',
    'uniform int u_dotMode;',
    'uniform int u_rippleCount;',
    'uniform vec4 u_ripples[6];',
    'varying float v_alpha;',
    // Anisotropic falloff: the bloom stretches along the drag vector,
    // strongly behind the motion (a trailing wake), slightly ahead.
    'float fieldStrength(vec2 toDot, float radius, vec2 drag) {',
    '  float dragMag = length(drag);',
    '  vec2 dragDir = dragMag > 0.001 ? drag / dragMag : vec2(1.0, 0.0);',
    '  float along = dot(toDot, dragDir);',
    '  float across = dot(toDot, vec2(-dragDir.y, dragDir.x));',
    '  float stretch = along < 0.0 ? 1.8 : 0.5;',
    '  float axisScale = 1.0 / (1.0 + dragMag * stretch);',
    '  float dist = length(vec2(along * axisScale, across));',
    '  return 1.0 - smoothstep(0.0, radius, dist);',
    '}',
    // Dot modes:
    //   0 reveal  - invisible at rest, exponential bloom under the cursor
    //   1 glow    - all dots visible; the cursor area brightens and swells
    //   2 repel   - all dots visible; the cursor craters them outward
    //   3 attract - all dots visible; dots gather toward the cursor
    'void main() {',
    '  float chargeScale = 1.0 + u_charge * 0.55;',
    '  float cursorRadius = max(80.0, (u_cursorRadius + a_dot.z) * chargeScale);',
    '  vec2 toDot = a_position - u_mouse;',
    '  float strength = fieldStrength(toDot, cursorRadius, u_drag) * u_mousePresence;',
    '  float sizeCurve = strength * strength;',
    '  float boost = u_cursorBoost * (1.0 + u_charge * 0.6);',
    '  float radius;',
    '  float alpha;',
    '  float pushAmt = 0.0;',
    '  if (u_dotMode == 0) {',
    '    float visibility = smoothstep(0.0, 0.32, strength);',
    '    radius = a_dot.x * (0.2 + sizeCurve * boost);',
    '    alpha = a_dot.y * visibility * 2.6;',
    '    pushAmt = sizeCurve * (10.0 + u_charge * 10.0);',
    '  } else if (u_dotMode == 1) {',
    '    radius = a_dot.x * (1.1 + sizeCurve * boost * 0.55);',
    '    alpha = a_dot.y * (0.85 + strength * 2.2);',
    '    pushAmt = sizeCurve * 6.0;',
    '  } else if (u_dotMode == 2) {',
    '    radius = a_dot.x * (1.15 + sizeCurve * boost * 0.25);',
    '    alpha = a_dot.y * (0.9 + strength * 1.2);',
    '    pushAmt = strength * (26.0 + u_charge * 22.0);',
    '  } else {',
    '    radius = a_dot.x * (1.1 + sizeCurve * boost * 0.35);',
    '    alpha = a_dot.y * (0.9 + strength * 1.6);',
    '    pushAmt = -strength * (18.0 + u_charge * 16.0);',
    '  }',
    '  vec2 pos = a_position;',
    '  float dist = length(toDot);',
    '  if (strength > 0.001 && dist > 0.001) {',
    '    if (u_dotMode == 3) {',
    '      pushAmt = -min(-pushAmt, max(dist - 6.0, 0.0));',
    '    }',
    '    pos += (toDot / dist) * pushAmt;',
    '  }',
    '  for (int i = 0; i < 6; i++) {',
    '    if (i >= u_rippleCount) break;',
    '    vec4 rp = u_ripples[i];',
    '    vec2 rippleDelta = pos - rp.xy;',
    '    float rippleDist = length(rippleDelta);',
    '    float band = max(0.0, 1.0 - abs(rippleDist - rp.z) / 130.0);',
    '    if (band > 0.001) {',
    '      float amp = band * rp.w;',
    '      radius += a_dot.x * amp * 6.5;',
    '      alpha += amp * (0.22 + a_dot.y * 1.4);',
    '      vec2 rippleDir = rippleDist > 0.001 ? rippleDelta / rippleDist : vec2(0.0, -1.0);',
    '      pos += rippleDir * amp * 11.0;',
    '    }',
    '  }',
    '  vec2 zeroToOne = pos / u_resolution;',
    '  vec2 clipSpace = zeroToOne * 2.0 - 1.0;',
    '  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);',
    '  gl_PointSize = max(1.0, radius * 2.0 * u_pixelRatio);',
    '  v_alpha = min(alpha, 0.72);',
    '}'
  ].join('\n');

  var FRAGMENT_SHADER = [
    'precision mediump float;',
    'uniform vec3 u_color;',
    'varying float v_alpha;',
    'void main() {',
    '  vec2 point = gl_PointCoord - vec2(0.5);',
    '  float dist = length(point) * 2.0;',
    '  if (dist > 1.0) discard;',
    '  float edge = 1.0 - smoothstep(0.62, 1.0, dist);',
    '  gl_FragColor = vec4(u_color, v_alpha * edge);',
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
      throw new Error(error || 'Could not compile pressure dots shader');
    }

    return shader;
  }

  function createProgram(gl) {
    var vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    var fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    var program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(error || 'Could not link pressure dots shader program');
    }

    return program;
  }

  function getDotCanvases(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var canvases = [];

    if (scope.matches && scope.matches('canvas[data-field="pressure-dots"]')) {
      canvases.push(scope);
    }

    var found = scope.querySelectorAll ? scope.querySelectorAll('canvas[data-field="pressure-dots"]') : [];
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

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    function setPointerPosition(clientX, clientY) {
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

    function beginHold(clientX, clientY) {
      for (var i = 0; i < instances.length; i++) {
        instances[i].beginHold(clientX, clientY);
      }
    }

    function releaseHold(clientX, clientY) {
      for (var i = 0; i < instances.length; i++) {
        instances[i].releaseHold(clientX, clientY);
      }
    }

    document.addEventListener('pointerdown', function (event) {
      setPointerPosition(event.clientX, event.clientY);
      beginHold(event.clientX, event.clientY);
    }, { passive: true });

    document.addEventListener('pointermove', function (event) {
      setPointerPosition(event.clientX, event.clientY);
    }, { passive: true });

    document.addEventListener('pointerup', function (event) {
      releaseHold(event.clientX, event.clientY);
      if (event.pointerType === 'touch' || event.pointerType === 'pen') clearPointer(140);
    }, { passive: true });

    document.addEventListener('pointercancel', function () {
      releaseHold(pointerX, pointerY);
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
    this.positionBuffer = null;
    this.dotBuffer = null;
    this.positionData = null;
    this.dotData = null;
    this.pointCount = 0;

    this.surface = canvas.getAttribute('data-field-surface') || 'page';
    this.isHomeField = this.surface.indexOf('home') === 0;
    this.isContactPage = this.surface === 'contact';
    this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.fieldWidth = 0;
    this.fieldHeight = 0;
    this.backingScale = 1;
    this.lastCanvasWidth = 0;
    this.lastCanvasHeight = 0;
    this.lastFieldWidth = 0;
    this.lastFieldHeight = 0;
    this.lastSpacing = 0;
    this.spacing = 27;
    this.baseRadius = 0.72;
    this.baseAlpha = 0.24;
    this.cursorRadius = 190;
    this.cursorBoost = 8.5;
    this.mousePresence = 0;
    this.smoothedMouseX = -1000;
    this.smoothedMouseY = -1000;
    this.velX = 0;
    this.velY = 0;
    this.charge = 0;
    this.holding = false;
    this.holdStart = 0;
    this.ripples = [];
    this.rippleUniforms = new Float32Array(24);
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

    return {
      spacing: isMobile ? 18 : 27,
      radius: isMobile ? 0.54 : 0.72,
      alpha: 0.24,
      cursorRadius: isMobile ? 142 : 190,
      cursorBoost: 8.5,
      budget: 3600
    };
  };

  DotField.prototype.resolveFieldHeight = function () {
    if (this.isHomeField || this.isContactPage) return window.innerHeight;

    var parent = this.canvas.parentElement;
    var parentHeight = parent ? Math.max(parent.scrollHeight, parent.offsetHeight) : 0;

    return Math.max(window.innerHeight, parentHeight);
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
    var options = {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: false
    };

    this.gl = this.canvas.getContext('webgl', options) ||
      this.canvas.getContext('experimental-webgl', options);

    if (!this.gl) {
      this.canvas.setAttribute('data-renderer', 'pressure-webgl-unavailable');
      return;
    }

    try {
      this.program = createProgram(this.gl);
    } catch (error) {
      this.canvas.setAttribute('data-renderer', 'pressure-webgl-error');
      return;
    }

    this.positionBuffer = this.gl.createBuffer();
    this.dotBuffer = this.gl.createBuffer();
    this.cacheLocations();
    this.configureGL();

    this.canvas.setAttribute('data-renderer', 'pressure-webgl');
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
      dot: gl.getAttribLocation(this.program, 'a_dot'),
      resolution: gl.getUniformLocation(this.program, 'u_resolution'),
      mouse: gl.getUniformLocation(this.program, 'u_mouse'),
      mousePresence: gl.getUniformLocation(this.program, 'u_mousePresence'),
      cursorRadius: gl.getUniformLocation(this.program, 'u_cursorRadius'),
      cursorBoost: gl.getUniformLocation(this.program, 'u_cursorBoost'),
      pixelRatio: gl.getUniformLocation(this.program, 'u_pixelRatio'),
      drag: gl.getUniformLocation(this.program, 'u_drag'),
      charge: gl.getUniformLocation(this.program, 'u_charge'),
      dotMode: gl.getUniformLocation(this.program, 'u_dotMode'),
      rippleCount: gl.getUniformLocation(this.program, 'u_rippleCount'),
      ripples: gl.getUniformLocation(this.program, 'u_ripples[0]'),
      color: gl.getUniformLocation(this.program, 'u_color')
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
      if (this.dotBuffer) this.gl.deleteBuffer(this.dotBuffer);
      if (this.program) this.gl.deleteProgram(this.program);
    }

    this.positionBuffer = null;
    this.dotBuffer = null;
    this.program = null;
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
    this.program = createProgram(this.gl);
    this.positionBuffer = this.gl.createBuffer();
    this.dotBuffer = this.gl.createBuffer();
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

  DotField.prototype.buildGrid = function () {
    var cols = Math.ceil(this.fieldWidth / this.spacing) + 2;
    var rows = Math.ceil(this.fieldHeight / this.spacing) + 2;
    var count = cols * rows;
    var positions = new Float32Array(count * 2);
    var dotData = new Float32Array(count * 3);
    var index = 0;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var jitterX = (fieldNoise(row, col, 8) - 0.5) * this.spacing * 0.11;
        var jitterY = (fieldNoise(row, col, 9) - 0.5) * this.spacing * 0.11;
        var x = (col - 0.5) * this.spacing + jitterX;
        var y = (row - 0.5) * this.spacing + jitterY;
        var layerRand = fieldNoise(row, col, 1);
        var layerAlpha = layerRand < 0.58 ? 1 : (layerRand < 0.86 ? 0.68 : 0.42);
        var radius = this.baseRadius;
        var alpha = this.baseAlpha * layerAlpha * (0.58 + fieldNoise(row, col, 6) * 0.78);
        var cursorOffset = (fieldNoise(row, col, 7) - 0.5) * 30;

        positions[index * 2] = x;
        positions[index * 2 + 1] = y;
        dotData[index * 3] = radius;
        dotData[index * 3 + 1] = alpha;
        dotData[index * 3 + 2] = cursorOffset;
        index++;
      }
    }

    this.positionData = positions;
    this.dotData = dotData;
    this.pointCount = count;
  };

  DotField.prototype.uploadBuffers = function () {
    var gl = this.gl;
    if (!gl || !this.positionData || !this.dotData) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positionData, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.dotBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.dotData, gl.STATIC_DRAW);
  };

  // --- Interaction: pulses and press-and-hold charge ---

  DotField.prototype.toFieldY = function (clientY) {
    if (!this.isHomeField && clientY > 0) {
      return clientY + (window.scrollY || window.pageYOffset || 0);
    }
    return clientY;
  };

  DotField.prototype.addPulse = function (clientX, clientY, power) {
    if (this.reducedMotion) return;
    this.ripples.push({
      x: clientX,
      y: this.toFieldY(clientY),
      power: clamp(power || 0.7, 0.3, 1.8),
      start: performance.now()
    });
    if (this.ripples.length > 6) this.ripples.shift();
    this.requestRender();
  };

  DotField.prototype.beginHold = function (clientX, clientY) {
    if (this.reducedMotion) return;
    this.holding = true;
    this.holdStart = performance.now();
    this.requestRender();
  };

  DotField.prototype.releaseHold = function (clientX, clientY) {
    if (!this.holding) return;
    this.holding = false;
    var heldMs = performance.now() - this.holdStart;
    var chargeAtRelease = clamp(heldMs / 900, 0, 1);
    this.addPulse(clientX, clientY, 0.65 + chargeAtRelease * 0.95);
  };

  // Prune expired pulses and pack live ones into the uniform array.
  DotField.prototype.updateRipples = function (now) {
    var RIPPLE_LIFE = 1.2;
    var live = 0;
    for (var i = 0; i < this.ripples.length; i++) {
      var age = (now - this.ripples[i].start) / 1000;
      if (age >= RIPPLE_LIFE) continue;
      this.ripples[live] = this.ripples[i];
      var fade = 1 - age / RIPPLE_LIFE;
      this.rippleUniforms[live * 4] = this.ripples[i].x;
      this.rippleUniforms[live * 4 + 1] = this.ripples[i].y;
      this.rippleUniforms[live * 4 + 2] = 42 + age * 540 * (0.75 + this.ripples[i].power * 0.35);
      this.rippleUniforms[live * 4 + 3] = Math.pow(fade, 1.5) * this.ripples[i].power;
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
    var priorCharge = this.charge;

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

    // Smoothed cursor velocity drives the comet stretch of the bloom.
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

    // Press-and-hold charge: ramps up over ~0.9s, releases quickly.
    var chargeTarget = this.holding
      ? clamp((performance.now() - this.holdStart) / 900, 0, 1)
      : 0;
    var chargeEase = 1 - Math.exp(-dt * (this.holding ? 6 : 9));
    this.charge += (chargeTarget - this.charge) * chargeEase;
    if (!this.holding && this.charge < 0.005) this.charge = 0;

    return Math.abs(priorPresence - this.mousePresence) > 0.001 ||
      Math.abs(priorX - this.smoothedMouseX) > 0.05 ||
      Math.abs(priorY - this.smoothedMouseY) > 0.05 ||
      Math.abs(priorVelX - this.velX) > 0.5 ||
      Math.abs(priorVelY - this.velY) > 0.5 ||
      Math.abs(priorCharge - this.charge) > 0.001 ||
      this.holding;
  };

  // Convert smoothed velocity into the drag uniform: direction of motion,
  // length (0..1) is the stretch amount.
  DotField.prototype.resolveDrag = function () {
    var speed = Math.sqrt(this.velX * this.velX + this.velY * this.velY);
    if (speed < 40) return { x: 0, y: 0 };
    var mag = Math.min(1, speed / 1500);
    return { x: (this.velX / speed) * mag, y: (this.velY / speed) * mag };
  };

  DotField.prototype.draw = function () {
    var gl = this.gl;
    if (!gl || !this.program || !this.pointCount) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.dotBuffer);
    gl.enableVertexAttribArray(this.locations.dot);
    gl.vertexAttribPointer(this.locations.dot, 3, gl.FLOAT, false, 0, 0);

    var drag = this.resolveDrag();
    var rippleCount = this.updateRipples(performance.now());

    gl.uniform2f(this.locations.resolution, this.fieldWidth, this.fieldHeight);
    gl.uniform2f(this.locations.mouse, this.smoothedMouseX, this.smoothedMouseY);
    gl.uniform1f(this.locations.cursorRadius, this.cursorRadius);
    gl.uniform1f(this.locations.cursorBoost, this.cursorBoost);
    gl.uniform1f(this.locations.pixelRatio, this.backingScale);
    gl.uniform1f(this.locations.mousePresence, clamp(this.mousePresence, 0, 1));
    gl.uniform2f(this.locations.drag, drag.x, drag.y);
    gl.uniform1f(this.locations.charge, clamp(this.charge, 0, 1));
    gl.uniform1i(this.locations.dotMode, globalDotMode);
    gl.uniform1i(this.locations.rippleCount, rippleCount);
    gl.uniform4fv(this.locations.ripples, this.rippleUniforms);
    gl.uniform3f(this.locations.color, 0.065, 0.065, 0.065);
    gl.drawArrays(gl.POINTS, 0, this.pointCount);
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

  window.initPressureDots = initDotField;
  window.setPressureDotsMode = function (name) {
    if (!DOT_MODES.hasOwnProperty(name)) return false;
    globalDotMode = DOT_MODES[name];
    requestRenderAll();
    return true;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initDotField();
    }, { once: true });
  } else {
    initDotField();
  }
})();
