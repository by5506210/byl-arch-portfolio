// ============================================
// WEBGL DOT FIELD - cursor-proximity background
// ============================================

(function () {
  'use strict';

  var previousInitVectorField = window.initVectorField;
  var instances = [];
  var listenersAttached = false;
  var pointerX = -1000;
  var pointerY = -1000;
  var pointerClearTimer = null;

  var VERTEX_SHADER = [
    'attribute vec2 a_position;',
    'attribute vec3 a_dot;',
    'uniform vec2 u_resolution;',
    'uniform vec2 u_mouse;',
    'uniform float u_mousePresence;',
    'uniform float u_cursorRadius;',
    'uniform float u_cursorBoost;',
    'uniform float u_pixelRatio;',
    'varying float v_alpha;',
    'void main() {',
    '  vec2 zeroToOne = a_position / u_resolution;',
    '  vec2 clipSpace = zeroToOne * 2.0 - 1.0;',
    '  float cursorRadius = max(80.0, u_cursorRadius + a_dot.z);',
    '  float distToMouse = distance(a_position, u_mouse);',
    '  float strength = (1.0 - smoothstep(0.0, cursorRadius, distToMouse)) * u_mousePresence;',
    '  float radius = a_dot.x * (1.0 + strength * u_cursorBoost);',
    '  float alpha = a_dot.y * (1.0 + strength * 0.9);',
    '  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);',
    '  gl_PointSize = max(1.0, radius * 2.0 * u_pixelRatio);',
    '  v_alpha = min(alpha, 0.58);',
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
      throw new Error(error || 'Could not compile dot field shader');
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
      throw new Error(error || 'Could not link dot field shader program');
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
    this.mousePresence = 0;
    this.smoothedMouseX = -1000;
    this.smoothedMouseY = -1000;
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
        spacing: isMobile ? 18 : 26,
        radius: isMobile ? 0.48 : 0.62,
        alpha: this.isDividerField ? 0.26 : 0.21,
        cursorRadius: isMobile ? 180 : 235,
        cursorBoost: 2.55,
        budget: 3600
      };
    }

    if (this.isContactPage) {
      return {
        spacing: isMobile ? 17 : 26,
        radius: isMobile ? 0.58 : 0.78,
        alpha: 0.27,
        cursorRadius: isMobile ? 195 : 250,
        cursorBoost: 2.65,
        budget: 3600
      };
    }

    return {
      spacing: isMobile ? 18 : 27,
      radius: isMobile ? 0.54 : 0.72,
      alpha: 0.24,
      cursorRadius: isMobile ? 190 : 245,
      cursorBoost: 2.6,
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
      this.canvas.setAttribute('data-renderer', 'dot-webgl-unavailable');
      return;
    }

    try {
      this.program = createProgram(this.gl);
    } catch (error) {
      this.canvas.setAttribute('data-renderer', 'dot-webgl-error');
      return;
    }

    this.positionBuffer = this.gl.createBuffer();
    this.dotBuffer = this.gl.createBuffer();
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
      dot: gl.getAttribLocation(this.program, 'a_dot'),
      resolution: gl.getUniformLocation(this.program, 'u_resolution'),
      mouse: gl.getUniformLocation(this.program, 'u_mouse'),
      mousePresence: gl.getUniformLocation(this.program, 'u_mousePresence'),
      cursorRadius: gl.getUniformLocation(this.program, 'u_cursorRadius'),
      cursorBoost: gl.getUniformLocation(this.program, 'u_cursorBoost'),
      pixelRatio: gl.getUniformLocation(this.program, 'u_pixelRatio'),
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
        var jitterX = (fieldNoise(row, col, 8) - 0.5) * this.spacing * 0.22;
        var jitterY = (fieldNoise(row, col, 9) - 0.5) * this.spacing * 0.22;
        var x = (col - 0.5) * this.spacing + jitterX;
        var y = (row - 0.5) * this.spacing + jitterY;
        var layerRand = fieldNoise(row, col, 1);
        var layerSize = layerRand < 0.58 ? 1 : (layerRand < 0.86 ? 0.78 : 0.58);
        var layerAlpha = layerRand < 0.58 ? 1 : (layerRand < 0.86 ? 0.68 : 0.42);
        var radius = this.baseRadius * layerSize * (0.72 + fieldNoise(row, col, 5) * 0.76);
        var alpha = this.baseAlpha * layerAlpha * (0.58 + fieldNoise(row, col, 6) * 0.78);
        var cursorOffset = (fieldNoise(row, col, 7) - 0.5) * 54;

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

  DotField.prototype.resolveMouse = function () {
    var mouseX = pointerX;
    var mouseY = pointerY;
    if (!this.isHomeField && mouseY > 0) {
      mouseY += window.scrollY || window.pageYOffset || 0;
    }
    return { x: mouseX, y: mouseY };
  };

  DotField.prototype.updateMouse = function (dt) {
    var mouse = this.resolveMouse();
    var mouseActive = mouse.x > 0 && mouse.y > 0;
    var targetPresence = mouseActive ? 1 : 0;
    var presenceEase = 1 - Math.exp(-dt * (mouseActive ? 10 : 7));
    var priorPresence = this.mousePresence;
    var priorX = this.smoothedMouseX;
    var priorY = this.smoothedMouseY;

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

    return Math.abs(priorPresence - this.mousePresence) > 0.001 ||
      Math.abs(priorX - this.smoothedMouseX) > 0.05 ||
      Math.abs(priorY - this.smoothedMouseY) > 0.05;
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

    gl.uniform2f(this.locations.resolution, this.fieldWidth, this.fieldHeight);
    gl.uniform2f(this.locations.mouse, this.smoothedMouseX, this.smoothedMouseY);
    gl.uniform1f(this.locations.mousePresence, clamp(this.mousePresence, 0, 1));
    gl.uniform1f(this.locations.cursorRadius, this.cursorRadius);
    gl.uniform1f(this.locations.cursorBoost, this.cursorBoost);
    gl.uniform1f(this.locations.pixelRatio, this.backingScale);
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

    var changed = this.updateMouse(dt);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initDotField();
    }, { once: true });
  } else {
    initDotField();
  }
})();
