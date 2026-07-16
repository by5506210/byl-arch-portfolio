// ============================================
// WEBGL GRID FIELD - cursor warps the grid like
// mass pressing a stiff drafting grid
// ============================================

(function () {
  'use strict';

  var previousInitVectorField = window.initVectorField;
  var instances = [];
  var listenersAttached = false;
  // The field lab pauses this system while another field is the exhibit.
  var fieldPaused = false;

  // Ambient breathing intensity, shared across all lab field systems via
  // window.__fieldBreathe (0 = still, 1 = default, 2 = storm).
  function getBreathe() {
    return typeof window.__fieldBreathe === 'number' ? window.__fieldBreathe : 1;
  }
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

  var WARP_MODES = { smooth: 0, crease: 1, axis: 2, terrace: 3 };
  var globalWarpMode = WARP_MODES.terrace;

  // Warp modes (kept for experimentation, selectable via
  // window.setDotFieldWarpMode or data-field-mode on the canvas):
  //   0 smooth  - soft radial bell, drapes like cloth
  //   1 crease  - linear tent falloff, bends like card stock
  //   2 axis    - threads bow as rigid rods along one axis
  //   3 terrace - displacement quantized into stepped contour bands
  // a_axis = (0|1 line orientation, base coordinate of the line).
  var VERTEX_SHADER = [
    'attribute vec2 a_position;',
    'attribute float a_seed;',
    'attribute vec2 a_axis;',
    'uniform vec2 u_resolution;',
    'uniform vec2 u_mouse;',
    'uniform float u_mousePresence;',
    'uniform float u_cursorRadius;',
    'uniform float u_warpAmount;',
    'uniform float u_baseAlpha;',
    'uniform int u_warpMode;',
    'uniform vec2 u_revealCenter;',
    'uniform vec4 u_reveal;',
    'uniform int u_rippleCount;',
    'uniform vec4 u_ripples[6];',
    // Persistent terrain (CONTOUR game): deposited mass blobs that warp
    // the grid exactly like held cursor presses. xy = center, z = push
    // amplitude (px), w = radius. Zero count = shader behaves as before.
    'uniform int u_terrainCount;',
    'uniform vec4 u_terrain[16];',
    'uniform float u_time;',
    'uniform float u_breathe;',
    'varying float v_alpha;',
    'void main() {',
    '  vec2 pos = a_position;',
    '  float alpha = u_baseAlpha;',
    // Ambient breathing: the same slow wave family the vector field
    // rides, so the fabric undulates like cloth instead of sitting still.
    // u_breathe is the displacement in px (0 disables entirely).
    '  if (u_breathe > 0.001) {',
    '    float bwx = sin(a_position.x * 0.006 + u_time * 1.15) * 1.4 + sin(a_position.y * 0.008 + u_time * 0.85) * 1.0;',
    '    float bwy = cos(a_position.x * 0.005 - u_time * 1.0) * 1.2 + sin((a_position.x + a_position.y) * 0.0035 + u_time * 0.7) * 1.2;',
    '    pos += vec2(bwx, bwy) * u_breathe;',
    '    alpha *= 1.0 + sin(u_time * 0.8 + a_position.x * 0.004 + a_position.y * 0.005) * min(u_breathe * 0.045, 0.16);',
    '  }',
    '  vec2 toVertex = a_position - u_mouse;',
    '  float dist = length(toVertex);',
    '  float seededRadius = u_cursorRadius * (0.96 + a_seed * 0.08);',
    '  float lin = max(0.0, 1.0 - dist / seededRadius);',
    '  float t;',
    '  if (u_warpMode == 0) {',
    '    float s = 1.0 - smoothstep(0.0, seededRadius, dist);',
    '    t = s * s;',
    '  } else if (u_warpMode == 3) {',
    '    t = lin > 0.0 ? ceil(lin * 3.0) / 3.0 * 0.75 : 0.0;',
    '  } else {',
    '    t = lin;',
    '  }',
    '  t *= u_mousePresence;',
    '  if (t > 0.001) {',
    '    float push = t * u_warpAmount * (0.95 + a_seed * 0.1);',
    '    if (u_warpMode == 2) {',
    '      float side = a_axis.x < 0.5 ? sign(a_axis.y - u_mouse.y) : sign(a_axis.y - u_mouse.x);',
    '      pos += a_axis.x < 0.5 ? vec2(0.0, side * push) : vec2(side * push, 0.0);',
    '    } else {',
    '      vec2 dir = dist > 0.001 ? toVertex / dist : vec2(0.0, 1.0);',
    '      pos += dir * push;',
    '    }',
    '    alpha *= 1.0 + min(t, 1.0) * 0.85;',
    '  }',
    '  for (int k = 0; k < 16; k++) {',
    '    if (k >= u_terrainCount) break;',
    '    vec4 tb = u_terrain[k];',
    '    vec2 tDelta = a_position - tb.xy;',
    '    float tDist = length(tDelta);',
    '    float tLin = max(0.0, 1.0 - tDist / max(tb.w, 1.0));',
    '    float tt;',
    '    if (u_warpMode == 0) {',
    '      float ts = 1.0 - smoothstep(0.0, tb.w, tDist);',
    '      tt = ts * ts;',
    '    } else if (u_warpMode == 3) {',
    '      tt = tLin > 0.0 ? ceil(tLin * 3.0) / 3.0 * 0.75 : 0.0;',
    '    } else {',
    '      tt = tLin;',
    '    }',
    '    if (tt > 0.001) {',
    '      vec2 tDir = tDist > 0.001 ? tDelta / tDist : vec2(0.0, 1.0);',
    '      pos += tDir * tt * tb.z;',
    '      alpha *= 1.0 + min(tt, 1.0) * 0.5;',
    '    }',
    '  }',
    '  for (int i = 0; i < 6; i++) {',
    '    if (i >= u_rippleCount) break;',
    '    vec4 rp = u_ripples[i];',
    '    vec2 rippleDelta = pos - rp.xy;',
    '    float rippleDist = length(rippleDelta);',
    '    float band = max(0.0, 1.0 - abs(rippleDist - rp.z) / 110.0);',
    '    if (band > 0.001) {',
    '      float amp = band * rp.w;',
    '      float rippleAmp = amp * (9.0 + a_seed * 8.0);',
    '      if (u_warpMode == 2) {',
    '        float rippleSide = a_axis.x < 0.5 ? sign(a_axis.y - rp.y) : sign(a_axis.y - rp.x);',
    '        pos += a_axis.x < 0.5 ? vec2(0.0, rippleSide * rippleAmp) : vec2(rippleSide * rippleAmp, 0.0);',
    '      } else {',
    '        vec2 rippleDir = rippleDist > 0.001 ? rippleDelta / rippleDist : vec2(0.0, -1.0);',
    '        pos += rippleDir * rippleAmp;',
    '      }',
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

  // Pressed-panel shade under the lines: near-uniform tone inside the
  // pocket with a defined rim, rather than a soft radial shadow.
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
    'uniform float u_dimpleStrength;',
    'uniform int u_warpMode;',
    'uniform vec3 u_color;',
    'varying vec2 v_pos;',
    'void main() {',
    '  float dist = length(v_pos - u_mouse);',
    '  float lin = max(0.0, 1.0 - dist / u_cursorRadius);',
    '  float t = lin * u_mousePresence;',
    '  float shade;',
    '  if (u_warpMode == 0) {',
    '    shade = u_dimpleStrength * t * t;',
    '  } else if (u_warpMode == 3) {',
    '    float band = lin > 0.0 ? ceil(lin * 3.0) / 3.0 : 0.0;',
    '    shade = u_dimpleStrength * band * u_mousePresence;',
    '  } else {',
    '    shade = u_dimpleStrength * (0.55 + 0.45 * t) * smoothstep(0.0, 0.08, t);',
    '  }',
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
    this.axisBuffer = null;
    this.axisData = null;
    this.dimpleBuffer = null;
    this.vertexCount = 0;
    this.ripples = [];
    this.rippleUniforms = new Float32Array(24);
    this.terrainUniforms = new Float32Array(64);
    this.terrainCount = 0;
    this.time = 0;

    this.surface = canvas.getAttribute('data-field-surface') || 'page';
    var modeAttr = canvas.getAttribute('data-field-mode');
    this.forcedWarpMode = modeAttr && WARP_MODES.hasOwnProperty(modeAttr) ? WARP_MODES[modeAttr] : -1;
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
    this.axisBuffer = this.gl.createBuffer();
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
    // Kick the loop so ambient breathing runs without waiting for input.
    this.requestRender();
  };

  DotField.prototype.cacheLocations = function () {
    var gl = this.gl;
    this.locations = {
      position: gl.getAttribLocation(this.program, 'a_position'),
      seed: gl.getAttribLocation(this.program, 'a_seed'),
      axis: gl.getAttribLocation(this.program, 'a_axis'),
      rippleCount: gl.getUniformLocation(this.program, 'u_rippleCount'),
      ripples: gl.getUniformLocation(this.program, 'u_ripples[0]'),
      terrainCount: gl.getUniformLocation(this.program, 'u_terrainCount'),
      terrain: gl.getUniformLocation(this.program, 'u_terrain[0]'),
      time: gl.getUniformLocation(this.program, 'u_time'),
      breathe: gl.getUniformLocation(this.program, 'u_breathe'),
      resolution: gl.getUniformLocation(this.program, 'u_resolution'),
      mouse: gl.getUniformLocation(this.program, 'u_mouse'),
      mousePresence: gl.getUniformLocation(this.program, 'u_mousePresence'),
      cursorRadius: gl.getUniformLocation(this.program, 'u_cursorRadius'),
      warpAmount: gl.getUniformLocation(this.program, 'u_warpAmount'),
      baseAlpha: gl.getUniformLocation(this.program, 'u_baseAlpha'),
      warpMode: gl.getUniformLocation(this.program, 'u_warpMode'),
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
      dimpleStrength: gl.getUniformLocation(this.dimpleProgram, 'u_dimpleStrength'),
      warpMode: gl.getUniformLocation(this.dimpleProgram, 'u_warpMode'),
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
      if (this.axisBuffer) this.gl.deleteBuffer(this.axisBuffer);
      if (this.dimpleBuffer) this.gl.deleteBuffer(this.dimpleBuffer);
      if (this.program) this.gl.deleteProgram(this.program);
      if (this.dimpleProgram) this.gl.deleteProgram(this.dimpleProgram);
    }

    this.positionBuffer = null;
    this.seedBuffer = null;
    this.axisBuffer = null;
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
    this.axisBuffer = this.gl.createBuffer();
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

  // Build the grid as tessellated line segments (gl.LINES pairs). Each
  // sample point carries a tiny baked-in perpendicular wobble for a
  // hand-drawn feel, a subtle per-point seed, and its line's orientation +
  // base coordinate so the shader can bow whole threads along one axis.
  // Shared segment endpoints reuse the same values so lines never crack.
  DotField.prototype.buildGrid = function () {
    var spacing = this.spacing;
    var step = Math.max(9, spacing * 0.3);
    var width = this.fieldWidth;
    var height = this.fieldHeight;
    var cols = Math.ceil(width / spacing) + 1;
    var rows = Math.ceil(height / spacing) + 1;
    var segments = [];
    var seeds = [];
    var axes = [];
    var wobble = 1.3;
    var i, j, prevX, prevY, x, y, offset, seed, prevSeed;

    // Horizontal lines (axis flag 0, base = row y)
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
        axes.push(0, y, 0, y);
        prevX = x;
        prevY = y + offset;
        prevSeed = seed;
      }
    }

    // Vertical lines (axis flag 1, base = column x)
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
        axes.push(1, x, 1, x);
        prevX = x + offset;
        prevY = y;
        prevSeed = seed;
      }
    }

    this.positionData = new Float32Array(segments);
    this.seedData = new Float32Array(seeds);
    this.axisData = new Float32Array(axes);
    this.vertexCount = segments.length / 2;
  };

  DotField.prototype.uploadBuffers = function () {
    var gl = this.gl;
    if (!gl || !this.positionData || !this.seedData || !this.axisData) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positionData, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.seedData, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.axisBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.axisData, gl.STATIC_DRAW);

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
    this.lastFrameTime = 0;
    this.requestRender();
  };

  DotField.prototype.updateMouse = function (dt) {
    var mouse = this.resolveMouse();
    var mouseActive = mouse.x > 0 && mouse.y > 0;
    var targetPresence = mouseActive ? 1 : 0;
    // Stiff response: fast engage, fast release.
    var presenceEase = 1 - Math.exp(-dt * (mouseActive ? 16 : 12));
    var priorPresence = this.mousePresence;
    var priorX = this.smoothedMouseX;
    var priorY = this.smoothedMouseY;

    this.mousePresence += (targetPresence - this.mousePresence) * presenceEase;

    if (mouseActive) {
      if (this.smoothedMouseX < -500 || this.smoothedMouseY < -500) {
        this.smoothedMouseX = mouse.x;
        this.smoothedMouseY = mouse.y;
      } else {
        // Near-1:1 tracking; just enough softening to kill pointer jitter.
        var followEase = 1 - Math.exp(-dt * 40);
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
    if (!gl || !this.program || !this.dimpleProgram || !this.vertexCount) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    var revealActive = this.isHomeField && revealState.active;
    var revealInteractionPresence = revealActive ? 0 : 1;
    var presence = clamp(this.mousePresence * revealInteractionPresence, 0, 1);
    var warpMode = this.forcedWarpMode >= 0 ? this.forcedWarpMode : globalWarpMode;

    // Pass 1: dimple shade under the grid.
    gl.useProgram(this.dimpleProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dimpleBuffer);
    gl.enableVertexAttribArray(this.dimpleLocations.position);
    gl.vertexAttribPointer(this.dimpleLocations.position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.dimpleLocations.resolution, this.fieldWidth, this.fieldHeight);
    gl.uniform2f(this.dimpleLocations.mouse, this.smoothedMouseX, this.smoothedMouseY);
    gl.uniform1f(this.dimpleLocations.mousePresence, presence);
    gl.uniform1f(this.dimpleLocations.cursorRadius, this.cursorRadius);
    gl.uniform1f(this.dimpleLocations.dimpleStrength, this.dimpleStrength);
    gl.uniform1i(this.dimpleLocations.warpMode, warpMode);
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

    gl.bindBuffer(gl.ARRAY_BUFFER, this.axisBuffer);
    gl.enableVertexAttribArray(this.locations.axis);
    gl.vertexAttribPointer(this.locations.axis, 2, gl.FLOAT, false, 0, 0);

    var rippleCount = this.updateRipples(performance.now());
    gl.uniform1i(this.locations.rippleCount, rippleCount);
    gl.uniform4fv(this.locations.ripples, this.rippleUniforms);
    gl.uniform1i(this.locations.terrainCount, this.terrainCount);
    gl.uniform4fv(this.locations.terrain, this.terrainUniforms);
    gl.uniform1f(this.locations.time, this.time);
    gl.uniform1f(this.locations.breathe, this.reducedMotion ? 0 : getBreathe() * 2.6);

    gl.uniform2f(this.locations.resolution, this.fieldWidth, this.fieldHeight);
    gl.uniform2f(this.locations.mouse, this.smoothedMouseX, this.smoothedMouseY);
    gl.uniform1f(this.locations.cursorRadius, this.cursorRadius);
    gl.uniform1f(this.locations.warpAmount, this.warpAmount);
    gl.uniform1f(this.locations.baseAlpha, this.baseAlpha);
    gl.uniform1i(this.locations.warpMode, warpMode);
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

  DotField.prototype.setTerrain = function (blobs) {
    var count = Math.min(16, blobs ? blobs.length : 0);
    this.terrainUniforms.fill(0);
    for (var i = 0; i < count; i++) {
      var blob = blobs[i];
      this.terrainUniforms[i * 4] = blob.x;
      this.terrainUniforms[i * 4 + 1] = blob.y;
      this.terrainUniforms[i * 4 + 2] = blob.amp;
      this.terrainUniforms[i * 4 + 3] = blob.radius;
    }
    this.terrainCount = count;
    this.requestRender();
  };

  DotField.prototype.requestRender = function () {
    if (fieldPaused || !this.running || this.raf || !this.gl) return;
    this.raf = requestAnimationFrame(this.animate);
  };

  DotField.prototype.animate = function (timestamp) {
    if (!this.running || !this.gl) return;

    this.raf = null;

    if (fieldPaused || document.hidden) {
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
    this.time += dt;

    // Breathing keeps the loop alive so the ambient wave actually moves;
    // at breathe 0 (or reduced motion) it reverts to render-on-demand.
    var breathing = !this.reducedMotion && getBreathe() > 0.001;
    var changed = this.updateMouse(dt) || this.ripples.length > 0 || breathing;
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
    // A fresh init always starts unpaused; the field lab re-pauses as
    // needed (pause state must not leak across SPA navigations).
    fieldPaused = false;

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
  window.setDotFieldActive = function (active) {
    fieldPaused = !active;
    if (!fieldPaused) requestRenderAll();
  };
  // CONTOUR game: persistent deposited-mass blobs ({x, y, amp, radius}).
  window.setDotFieldTerrain = function (blobs) {
    for (var i = 0; i < instances.length; i++) {
      instances[i].setTerrain(blobs);
    }
  };
  // Wake the loop after window.__fieldBreathe changes (e.g. slider input).
  window.refreshDotField = requestRenderAll;
  window.setDotFieldWarpMode = function (name) {
    if (!WARP_MODES.hasOwnProperty(name)) return false;
    globalWarpMode = WARP_MODES[name];
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
