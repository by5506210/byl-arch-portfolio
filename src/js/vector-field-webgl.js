// ============================================
// VECTOR FIELD WEBGL - Instanced line renderer
// ============================================

(function () {
  'use strict';

  var ACTIVE_RENDERER = null;
  var FIELD_MODES = { attract: 0, vortex: 1, repel: 2, scatter: 3 };
  var vectorFieldMode = FIELD_MODES.attract;
  var INSTANCE_ID = 0;

  var MAX_RIPPLES = 8;
  var MAX_WAKE_POINTS = 8;

  var LIGHT_LINE = [232, 228, 223];
  var DARK_LINE = [26, 26, 26];

  var mouseX = -1000;
  var mouseY = -1000;
  var listenersAttached = false;
  var lastScrollY = 0;
  var lastTouchY = null;
  var scrollVelocity = 0;
  var scrollDirection = 0;
  var scrollKick = 0;

  var PI = Math.PI;
  var TWO_PI = PI * 2;

  function registerScroll(delta) {
    if (!delta || Math.abs(delta) < 0.5) return;
    scrollVelocity += delta;
    scrollDirection = delta > 0 ? 1 : -1;
    scrollKick = 1;
  }

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    document.addEventListener('mouseleave', function () {
      mouseX = -1000;
      mouseY = -1000;
    });

    // On the Aphelion Field lab, clicks fire a high-power shockwave:
    // faster wavefront, physical displacement, impact flash, and a short
    // cooldown so rapid clicks each land.
    document.addEventListener('pointerdown', function (e) {
      if (ACTIVE_RENDERER && ACTIVE_RENDERER.isLabPage &&
          ACTIVE_RENDERER.canvas && ACTIVE_RENDERER.canvas.isConnected &&
          typeof ACTIVE_RENDERER.spawnRipple === 'function') {
        ACTIVE_RENDERER.spawnRipple(e.clientX, e.clientY, null, 2.1, 470, 0.12);
      }
    }, { passive: true });

    document.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches.length) return;
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
      lastTouchY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!e.touches || !e.touches.length) return;
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
      if (lastTouchY !== null) {
        registerScroll((lastTouchY - e.touches[0].clientY) * 0.18);
      }
      lastTouchY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', function () {
      mouseX = -1000;
      mouseY = -1000;
      lastTouchY = null;
    });

    window.addEventListener('wheel', function (e) {
      registerScroll(e.deltaY * 0.05);
    }, { passive: true });

    lastScrollY = window.scrollY || window.pageYOffset || 0;
    window.addEventListener('scroll', function () {
      var scrollY = window.scrollY || window.pageYOffset || 0;
      registerScroll((scrollY - lastScrollY) * 0.6);
      lastScrollY = scrollY;
    }, { passive: true });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function angleDiff(from, to) {
    var d = to - from;
    while (d > PI) d -= TWO_PI;
    while (d < -PI) d += TWO_PI;
    return d;
  }

  function replaceCanvasForFallback(canvas) {
    if (!canvas || !canvas.parentNode) return;
    var replacement = canvas.cloneNode(false);
    canvas.parentNode.replaceChild(replacement, canvas);
  }

  function makeShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || 'Shader compile failed.');
    }

    return shader;
  }

  function makeProgram(gl, vertexSource, fragmentSource) {
    var program = gl.createProgram();
    var vertex = makeShader(gl, gl.VERTEX_SHADER, vertexSource);
    var fragment = makeShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);

    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(message || 'Program link failed.');
    }

    return program;
  }

  var VECTOR_VERTEX_SOURCE = [
    'precision highp float;',
    '',
    'attribute vec2 aCorner;',
    'attribute vec2 aPosition;',
    'attribute vec4 aSeed;',
    'attribute vec4 aStyle;',
    'attribute vec4 aAssemble0;',
    'attribute vec4 aAssemble1;',
    'attribute vec4 aAssemble2;',
    '',
    'uniform vec2 uResolution;',
    'uniform float uTime;',
    'uniform float uAwaken;',
    'uniform vec2 uMouse;',
    'uniform float uMouseActive;',
    'uniform float uMouseRadius;',
    'uniform int uFieldMode;',
    'uniform float uModeIntensity;',
    'uniform vec3 uScroll;',
    'uniform vec2 uLine;',
    'uniform vec2 uCenter;',
    'uniform float uOpacityScale;',
    'uniform float uIsLanding;',
    'uniform float uBlackHoleRadius;',
    'uniform float uMaxGravityDistance;',
    'uniform float uGravityStrength;',
    'uniform vec4 uEaster;',
    'uniform vec2 uEasterExtra;',
    'uniform vec3 uReveal;',
    'uniform vec4 uAssemble;',
    'uniform int uRippleCount;',
    'uniform vec4 uRipples[8];',
    'uniform int uWakeCount;',
    'uniform vec4 uWake[8];',
    '',
    'varying float vOpacity;',
    'varying float vUseDark;',
    'varying vec2 vLocalPx;',
    'varying vec2 vHalfSize;',
    '',
    'const float PI = 3.141592653589793;',
    'const float TWO_PI = 6.283185307179586;',
    'const float RIPPLE_RING_WIDTH = 120.0;',
    '',
    'float angleDelta(float fromAngle, float toAngle) {',
    '  float d = mod(toAngle - fromAngle + PI, TWO_PI) - PI;',
    '  return d;',
    '}',
    '',
    'vec4 layerConfig(float layer) {',
    '  if (layer < 0.5) return vec4(1.0, 1.0, 1.0, 1.0);',
    '  if (layer < 1.5) return vec4(0.7, 0.8, 1.0, 0.9);',
    '  return vec4(0.45, 0.6, 1.0, 0.8);',
    '}',
    '',
    'void main() {',
    '  vec2 basePos = aPosition;',
    '  vec4 lc = layerConfig(aStyle.x);',
    '  float waveTime = uTime * lc.z;',
    '  float swell = sin(basePos.x * 0.006 + waveTime * 1.6) * 1.8 +',
    '    sin(basePos.x * 0.004 + basePos.y * 0.008 + waveTime * 1.15) * 1.3;',
    '  float cross = cos(basePos.y * 0.01 + waveTime * 0.9) * 0.9 +',
    '    sin(basePos.x * 0.012 - waveTime * 1.25) * 0.65;',
    '  float deep = sin((basePos.x + basePos.y) * 0.003 + waveTime * 0.45) * 1.0;',
    '  float randomDrift = aSeed.w * sin(waveTime * 0.7 + aSeed.x) * 0.08 +',
    '    sin(waveTime * 1.3 + aSeed.y * 5.0) * 0.05 +',
    '    cos(waveTime * 0.9 + aSeed.z * 3.0) * 0.04;',
    '  float liveAngle = swell + cross + deep + randomDrift;',
    '',
    '  vec2 toCenter = uCenter - basePos;',
    '  float centerDist = length(toCenter);',
    '  float centerDistSq = dot(toCenter, toCenter);',
    '  float centerAngle = atan(toCenter.y, toCenter.x);',
    '  float centerFalloff = uMaxGravityDistance > 0.0 ? max(0.0, 1.0 - centerDist / uMaxGravityDistance) : 0.0;',
    '  float blackHoleRadiusSq = uBlackHoleRadius * uBlackHoleRadius;',
    '',
    '  if (uGravityStrength > 0.0 && centerDistSq > blackHoleRadiusSq) {',
    '    liveAngle += angleDelta(liveAngle, centerAngle + 0.6) * uGravityStrength * centerFalloff;',
    '  }',
    '',
    '  float targetAngle = liveAngle * uAwaken;',
    '  float drawOpacity = aStyle.y * lc.x * uAwaken;',
    '  float drawLen = uLine.x * lc.w;',
    '  float widthScale = 1.0;',
    '  float bhResistance = 0.0;',
    '  float rippleOpacityBoost = 0.0;',
    '  float rippleLenBoost = 0.0;',
    '  vec2 rippleShift = vec2(0.0);',
    '',
    '  for (int i = 0; i < 8; i++) {',
    '    if (i >= uRippleCount) break;',
    '    vec4 rp = uRipples[i];',
    '    vec2 delta = basePos - rp.xy;',
    '    float ringOuter = rp.z + RIPPLE_RING_WIDTH;',
    '    float ringInner = rp.z - RIPPLE_RING_WIDTH;',
    '    if (abs(delta.x) > ringOuter || abs(delta.y) > ringOuter) continue;',
    '    float dist = length(delta);',
    '    if (dist > ringOuter || (ringInner > 0.0 && dist < ringInner)) continue;',
    '    float distFromRing = abs(dist - rp.z);',
    '    if (distFromRing >= RIPPLE_RING_WIDTH) continue;',
    '    float strength = (1.0 - distFromRing / RIPPLE_RING_WIDTH) * rp.w;',
    '    float radialAngle = atan(delta.y, delta.x);',
    '    float tangentAngle = radialAngle + PI * 0.5;',
    '    targetAngle += angleDelta(0.0, tangentAngle + radialAngle * 0.15) * strength * 0.7;',
    '    rippleOpacityBoost += strength * 0.2 * uOpacityScale;',
    '    rippleLenBoost += strength * 6.0;',
    // The wavefront physically shoves lines outward, so a strong pulse
    // reads as a shockwave instead of a subtle rotation.
    '    rippleShift += (dist > 0.001 ? delta / dist : vec2(0.0, -1.0)) * strength * 12.0;',
    '  }',
    '',
    '  drawOpacity += rippleOpacityBoost;',
    '  drawLen += rippleLenBoost;',
    '',
    '  for (int j = 0; j < 8; j++) {',
    '    if (j >= uWakeCount) break;',
    '    vec4 wp = uWake[j];',
    '    vec2 wakeDelta = basePos - wp.xy;',
    '    if (abs(wakeDelta.x) > 100.0 || abs(wakeDelta.y) > 100.0) continue;',
    '    float wakeDist = length(wakeDelta);',
    '    if (wakeDist >= 100.0) continue;',
    '    float wakeStrength = (1.0 - wakeDist / 100.0) * wp.z;',
    '    targetAngle += angleDelta(0.0, atan(wakeDelta.y, wakeDelta.x)) * wakeStrength * 0.4;',
    '    drawOpacity += wakeStrength * 0.1 * uOpacityScale;',
    '  }',
    '',
    '  if (uScroll.x > 0.0 && abs(uScroll.y) > 0.0) {',
    '    float scrollAngle = uScroll.y > 0.0 ? PI * 0.5 : -PI * 0.5;',
    '    float snapStrength = min(1.0, uScroll.x * 1.35 + abs(uScroll.z) * 0.3);',
    '    targetAngle = mix(targetAngle, scrollAngle, snapStrength);',
    '  }',
    '',
    '  vec2 toEaster = uEaster.xy - basePos;',
    '  float easterDist = length(toEaster);',
    '  float easterLinear = max(0.0, 1.0 - easterDist / max(1.0, uEaster.z));',
    '  float easterStrength = easterLinear * easterLinear;',
    '',
    '  if (uIsLanding > 0.5) {',
    '    if (centerDistSq < blackHoleRadiusSq) {',
    '      float bhStrength = max(0.0, 1.0 - centerDist / uBlackHoleRadius);',
    '      bhStrength = bhStrength * bhStrength * bhStrength;',
    '      bhResistance = bhStrength;',
    '      float spiralOffset = bhStrength * 2.0 + sin(uTime * 3.5 + aSeed.x) * bhStrength * 0.6;',
    '      float bhAngle = centerAngle + spiralOffset;',
    '      targetAngle = mix(targetAngle, bhAngle, bhStrength * uAwaken);',
    '      drawOpacity = (aStyle.y * lc.x + bhStrength * 0.4 * uOpacityScale + rippleOpacityBoost) * uAwaken;',
    '      drawLen = uLine.x * lc.w + bhStrength * 12.0 + rippleLenBoost;',
    '      if (centerDist < 35.0) {',
    '        float fade = centerDist / 35.0;',
    '        drawOpacity *= fade;',
    '        drawLen = uLine.x * lc.w * fade + bhStrength * 12.0 * fade;',
    '      }',
    '    }',
    '',
    '    if (easterStrength > 0.0) {',
    '      float eeAngle = atan(toEaster.y, toEaster.x) + easterStrength * 1.8 + sin(uTime * 2.5 + aSeed.y) * easterStrength * 0.5;',
    '      targetAngle += angleDelta(targetAngle, eeAngle) * easterStrength * 0.8;',
    '      float totalDim = min(0.99, easterStrength * 0.85 + uEasterExtra.x * easterStrength * 0.9);',
    '      drawOpacity *= 1.0 - totalDim;',
    '      drawLen *= 1.0 - totalDim * 0.7;',
    '      widthScale *= 1.0 - totalDim * 0.6;',
    '    }',
    '  }',
    '',
    '  vec2 mouseShift = vec2(0.0);',
    '  if (uMouseActive > 0.001) {',
    '    vec2 toMouse = uMouse - basePos;',
    '    float distMouseSq = dot(toMouse, toMouse);',
    '    float maxMouseRadius = uMouseRadius + 65.0;',
    '    if (distMouseSq < maxMouseRadius * maxMouseRadius) {',
    '      float particleMouseRadius = uMouseRadius + aStyle.z + sin(uTime * 3.0 + aSeed.x * 5.0) * 25.0;',
    '      float distMouse = sqrt(distMouseSq);',
    '      if (distMouse < particleMouseRadius) {',
    '        float radiusRatio = clamp(distMouse / particleMouseRadius, 0.0, 1.0);',
    '        float mStrength = 1.0 - smoothstep(0.0, 1.0, radiusRatio);',
    '        float mouseEffect = mStrength * uMouseActive * (1.0 - bhResistance * 0.85);',
    '        float angleInfluence = mouseEffect * smoothstep(18.0, 58.0, distMouse);',
    '        float particleNearEE = uIsLanding > 0.5 ? easterLinear : 0.0;',
    '        if (particleNearEE > 0.0) {',
    '          drawOpacity *= max(0.02, 1.0 - particleNearEE * mouseEffect * 3.0);',
    '        } else {',
    '          drawOpacity = max(drawOpacity, aStyle.y * lc.x + mouseEffect * 0.3 * uOpacityScale);',
    '        }',
    // Field modes, each with its own kinematics (angle alone can't
    // distinguish them: a centered segment pointing at the cursor looks
    // identical to one pointing away). uModeIntensity gates the physical
    // displacement / opacity shaping to the lab page so the landing and
    // content pages keep their calmer cursor response.
    //   0 attract - lines aim at the cursor and crowd inward (iron filings)
    //   1 vortex  - tangential alignment + swirling displacement (whirlpool)
    //   2 repel   - lines aim away and get shoved out; the core empties
    //               into a crater with a bright rim
    //   3 scatter - coherent turbulence: eddies of wind churning the field
    '        float mouseAngle = atan(toMouse.y, toMouse.x);',
    '        vec2 mouseDir = distMouse > 0.001 ? toMouse / distMouse : vec2(0.0, 0.0);',
    '        vec2 mouseTangent = vec2(-mouseDir.y, mouseDir.x);',
    '        float modeAlign = 0.52;',
    '        float modeLenBoost = 8.0;',
    '        if (uFieldMode == 0) {',
    '          mouseShift = mouseDir * mouseEffect * min(distMouse * 0.5, 30.0);',
    '          modeAlign = 0.85;',
    '          modeLenBoost = 13.0;',
    '          drawOpacity = min(1.0, drawOpacity + mouseEffect * 0.35 * uOpacityScale * uModeIntensity);',
    '        } else if (uFieldMode == 1) {',
    '          mouseAngle += 1.5707963 + mouseEffect * 0.45 * uModeIntensity;',
    '          float swirlPump = 0.75 + 0.25 * sin(uTime * 2.6 - distMouse * 0.045);',
    '          mouseShift = (mouseTangent * 40.0 * swirlPump + mouseDir * 12.0) * mouseEffect;',
    '          modeAlign = 0.9;',
    '          modeLenBoost = 12.0;',
    '        } else if (uFieldMode == 2) {',
    '          mouseAngle += 3.14159265;',
    '          mouseShift = -mouseDir * mouseEffect * 44.0;',
    '          modeAlign = 0.85;',
    '          modeLenBoost = 11.0;',
    '          float core = 1.0 - smoothstep(0.0, 90.0, distMouse);',
    '          float rim = smoothstep(0.15, 0.4, mStrength) * (1.0 - smoothstep(0.5, 0.85, mStrength));',
    '          drawOpacity *= 1.0 - core * 0.85 * uModeIntensity;',
    '          drawOpacity = min(1.0, drawOpacity + rim * 0.45 * uOpacityScale * uModeIntensity);',
    '        } else if (uFieldMode == 3) {',
    '          float turb = sin(basePos.x * 0.03 + uTime * 3.0) + cos(basePos.y * 0.027 - uTime * 2.2) + sin((basePos.x + basePos.y) * 0.02 + uTime * 1.6);',
    // Off the lab, keep the legacy per-particle churn so a mode carried
    // over from the lab page cannot change other pages' feel.
    '          mouseAngle = mix(aSeed.x * 6.2831853 + uTime * (1.2 + aSeed.y * 2.4), turb * 2.2, uModeIntensity);',
    '          mouseShift = vec2(cos(mouseAngle), sin(mouseAngle)) * mouseEffect * 22.0;',
    '          modeAlign = 0.95;',
    '          modeLenBoost = 6.0 + (sin(turb * 4.7) * 0.5 + 0.5) * 14.0;',
    '        }',
    '        mouseShift *= uModeIntensity;',
    '        targetAngle += angleDelta(targetAngle, mouseAngle) * angleInfluence * mix(0.52, modeAlign, uModeIntensity);',
    '        drawLen = max(drawLen, uLine.x * lc.w + mouseEffect * mix(8.0, modeLenBoost, uModeIntensity) * (1.0 - uEasterExtra.y * particleNearEE));',
    '      }',
    '    }',
    '  }',
    '',
    '  if (uReveal.x > 0.5) {',
    '    float edgeBoost = max(0.0, 1.0 - abs(centerDist - uReveal.y) / 56.0);',
    '    drawOpacity = min(1.0, drawOpacity + edgeBoost * 0.1);',
    '    drawLen += edgeBoost * 2.8;',
    '    widthScale *= 1.0 + edgeBoost * 0.1;',
    '  }',
    '',
    '  vec2 drawPos = basePos + rippleShift + mouseShift;',
    '  float drawAngle = targetAngle;',
    '  float lineWidth = uLine.y * lc.y * (0.6 + abs(sin(drawAngle)) * 0.6) * widthScale;',
    '',
    '  if (uAssemble.x > 0.5) {',
    '    if (aAssemble2.z < 0.5) {',
    '      drawOpacity = 0.0;',
    '    } else {',
    '      float progress = clamp((uTime - uAssemble.y) / max(0.0001, uAssemble.z), 0.0, 1.0);',
    '      float startOffset = aAssemble2.y * uAssemble.w;',
    '      float localProgress = progress <= startOffset ? 0.0 : clamp((progress - startOffset) / max(0.0001, 1.0 - startOffset), 0.0, 1.0);',
    '      float lp = 1.0 - localProgress;',
    '      float localEase = 1.0 - lp * lp * lp * lp;',
    '      float travelPresence = max(0.0, 1.0 - abs(localProgress - 0.42) / 0.42);',
    '      float meltProgress = progress < 0.78 ? 0.0 : (progress - 0.78) / 0.22;',
    '      drawPos = mix(aAssemble0.xy, aAssemble0.zw, localEase);',
    '      drawAngle = aAssemble1.x + angleDelta(aAssemble1.x, aAssemble1.y) * localEase;',
    '      drawLen = mix(uLine.x * lc.w, aAssemble1.w, localEase) * (1.0 + travelPresence * 0.22);',
    '      drawOpacity = mix(aStyle.y * lc.x * 0.52, aAssemble1.z, localEase) + 0.32 + travelPresence * 0.48;',
    '      lineWidth = uLine.y * lc.y * (0.65 + abs(sin(drawAngle)) * 0.55) * mix(0.55 + lc.y * 0.4, aAssemble2.x, localEase) * (1.0 + travelPresence * 0.34);',
    '      if (uReveal.x > 0.5) {',
    '        float assembleCenterDist = length(uCenter - drawPos);',
    '        float revealEdgeBoost = max(0.0, 1.0 - abs(assembleCenterDist - uReveal.y) / 56.0);',
    '        drawOpacity = min(1.0, drawOpacity + revealEdgeBoost * 0.08);',
    '        drawLen *= 1.0 + revealEdgeBoost * 0.08;',
    '        lineWidth *= 1.0 + revealEdgeBoost * 0.08;',
    '      }',
    '      if (meltProgress > 0.0 && localProgress > 0.02) {',
    '        float localMelt = min(1.0, meltProgress * (0.55 + localProgress * 0.25));',
    '        drawOpacity *= 1.0 - localMelt * 0.34;',
    '        drawLen *= 1.0 - localMelt * 0.12;',
    '        lineWidth *= 1.0 - localMelt * 0.08;',
    '      }',
    '    }',
    '  }',
    '',
    '  drawOpacity = clamp(drawOpacity, 0.0, 1.0);',
    '  vec2 dir = vec2(cos(drawAngle), sin(drawAngle));',
    '  vec2 normal = vec2(-dir.y, dir.x);',
    '  float aaPad = 2.0;',
    '  vec2 quadSize = vec2(drawLen + aaPad * 2.0, lineWidth + aaPad * 2.0);',
    '  vec2 localPx = aCorner * quadSize;',
    '  vec2 world = drawPos + dir * localPx.x + normal * localPx.y;',
    '  vec2 clip = vec2(world.x / uResolution.x * 2.0 - 1.0, 1.0 - world.y / uResolution.y * 2.0);',
    '',
    '  gl_Position = vec4(clip, 0.0, 1.0);',
    '  vOpacity = drawOpacity;',
    '  vUseDark = (uReveal.x > 0.5 && length(uCenter - drawPos) <= uReveal.y) ? 1.0 : 0.0;',
    '  vLocalPx = localPx;',
    '  vHalfSize = vec2(drawLen * 0.5, lineWidth * 0.5);',
    '}'
  ].join('\n');

  var VECTOR_FRAGMENT_SOURCE = [
    'precision highp float;',
    '',
    'uniform vec3 uLineColor;',
    'uniform vec3 uLightColor;',
    'uniform vec3 uDarkColor;',
    'uniform vec3 uReveal;',
    '',
    'varying float vOpacity;',
    'varying float vUseDark;',
    'varying vec2 vLocalPx;',
    'varying vec2 vHalfSize;',
    '',
    'void main() {',
    '  float radius = max(0.42, vHalfSize.y);',
    '  float halfSegment = max(0.0, vHalfSize.x - radius);',
    '  vec2 q = vec2(abs(vLocalPx.x) - halfSegment, abs(vLocalPx.y));',
    '  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;',
    '  float coverage = 1.0 - smoothstep(-0.72, 0.72, dist);',
    '  float alpha = clamp(vOpacity * coverage, 0.0, 1.0);',
    '  if (alpha <= 0.001) discard;',
    '  vec3 color = uReveal.x > 0.5 ? mix(uLightColor, uDarkColor, vUseDark) : uLineColor;',
    '  gl_FragColor = vec4(color, alpha);',
    '}'
  ].join('\n');

  var EFFECT_VERTEX_SOURCE = [
    'precision highp float;',
    '',
    'attribute vec2 aPosition;',
    'uniform vec2 uResolution;',
    'varying vec2 vPixel;',
    '',
    'void main() {',
    '  gl_Position = vec4(aPosition, 0.0, 1.0);',
    '  vec2 uv = aPosition * 0.5 + 0.5;',
    '  vPixel = vec2(uv.x * uResolution.x, (1.0 - uv.y) * uResolution.y);',
    '}'
  ].join('\n');

  var EFFECT_FRAGMENT_SOURCE = [
    'precision highp float;',
    '',
    'uniform vec2 uResolution;',
    'uniform float uIsLanding;',
    'uniform float uIsContact;',
    'uniform vec3 uLineColor;',
    'uniform vec3 uLightColor;',
    'uniform vec3 uDarkColor;',
    'uniform vec3 uReveal;',
    'uniform vec2 uCenter;',
    'uniform vec4 uPortal;',
    'uniform vec4 uEaster;',
    'uniform vec2 uMouse;',
    'uniform float uMouseActive;',
    'uniform int uRippleCount;',
    'uniform vec4 uRipples[8];',
    '',
    'varying vec2 vPixel;',
    '',
    'vec4 over(vec4 base, vec3 color, float alpha) {',
    '  alpha = clamp(alpha, 0.0, 1.0);',
    '  float outAlpha = alpha + base.a * (1.0 - alpha);',
    '  vec3 outColor = outAlpha <= 0.0001 ? vec3(0.0) : (color * alpha + base.rgb * base.a * (1.0 - alpha)) / outAlpha;',
    '  return vec4(outColor, outAlpha);',
    '}',
    '',
    'void main() {',
    '  vec4 outColor = vec4(0.0);',
    '',
    '  for (int i = 0; i < 8; i++) {',
    '    if (i >= uRippleCount) break;',
    '    vec4 rp = uRipples[i];',
    '    float dist = length(vPixel - rp.xy);',
    // rp.w carries fade * power. Only the power EXCESS over the ambient 1.0
    // widens/flashes, so the landing and contact pages' power-1 ripples
    // render exactly as before this existed.
    '    float excess = max(0.0, rp.w - 1.0);',
    '    float ringWidth = 2.8 + excess * 4.5;',
    '    float ring = 1.0 - smoothstep(0.0, ringWidth, abs(dist - rp.z));',
    '    float innerRing = 1.0 - smoothstep(0.0, 2.2, abs(dist - rp.z * 0.85));',
    '    float baseAlpha = rp.w * (uIsLanding > 0.5 ? 0.15 : 0.22);',
    '    vec3 color = (uReveal.x > 0.5 && rp.z <= uReveal.y) ? uDarkColor : uLineColor;',
    '    outColor = over(outColor, color, ring * baseAlpha);',
    '    outColor = over(outColor, color, innerRing * baseAlpha * 0.5);',
    // Impact flash: a soft disc that blooms at the pulse origin and dies
    // by the time the wavefront reaches ~150px, so clicks land with a punch.
    '    float youth = max(0.0, 1.0 - rp.z / 150.0);',
    '    if (youth > 0.0 && excess > 0.0) {',
    '      float flash = max(0.0, 1.0 - dist / max(rp.z + 24.0, 24.0));',
    '      outColor = over(outColor, color, flash * flash * youth * excess * 0.55);',
    '    }',
    '  }',
    '',
    '  if (uIsLanding > 0.5) {',
    '    if (uReveal.x > 0.5 && uReveal.y > 8.0) {',
    '      float distReveal = length(vPixel - uCenter);',
    '      float ringA = 1.0 - smoothstep(0.0, 1.8 + uReveal.z * 2.5, abs(distReveal - uReveal.y));',
    '      outColor = over(outColor, uLightColor, ringA * min(0.18, 0.025 + uReveal.z * 0.09));',
    '      float ringB = 1.0 - smoothstep(0.0, 0.9, abs(distReveal - uReveal.y));',
    '      outColor = over(outColor, uDarkColor, ringB * (0.012 + uReveal.z * 0.022));',
    '    } else {',
    '      float portalDist = length(vPixel - uCenter);',
    '      float portalFalloff = max(0.0, 1.0 - portalDist / max(1.0, uPortal.y));',
    '      portalFalloff = portalFalloff * portalFalloff;',
    '      outColor = over(outColor, uLightColor, portalFalloff * (0.016 + uPortal.x * 0.14));',
    '      if (uPortal.z > 0.012) {',
    '        float seam = (1.0 - smoothstep(0.0, 1.2, abs(vPixel.x - uCenter.x))) * (1.0 - smoothstep(0.0, 12.0 + uPortal.z * 22.0, abs(vPixel.y - uCenter.y)));',
    '        outColor = over(outColor, uLineColor, seam * (0.015 + uPortal.z * 0.18 + uPortal.w * 0.16));',
    '      }',
    '    }',
    '',
    '    float distToEE = length(vPixel - uEaster.xy);',
    '    float cursorProximity = 0.0;',
    '    if (uMouseActive > 0.001) cursorProximity = max(0.0, 1.0 - length(uMouse - uEaster.xy) / 200.0) * uMouseActive;',
    '    float darkRadius = 90.0 + cursorProximity * 40.0;',
    '    float darkFalloff = max(0.0, 1.0 - distToEE / darkRadius);',
    '    float darkAlpha = (0.08 + cursorProximity * 0.15) * darkFalloff * darkFalloff;',
    '    darkAlpha += (0.17 + cursorProximity * 0.15) * smoothstep(0.35, 1.0, darkFalloff);',
    '    outColor = over(outColor, vec3(0.0), darkAlpha);',
    '  }',
    '',
    '  if (outColor.a <= 0.001) discard;',
    '  gl_FragColor = outColor;',
    '}'
  ].join('\n');

  function WebGLVectorField(canvas, gl, instancing, options) {
    this.canvas = canvas;
    this.gl = gl;
    this.instancing = instancing;
    this.options = options || {};
    this.id = ++INSTANCE_ID;

    this.isLandingPage = !!document.getElementById('landing');
    this.isContentPage = !this.isLandingPage;
    this.isContactPage = this.isContentPage && !!document.querySelector('.contact-page');
    this.isLabPage = this.isContentPage && !!document.querySelector('.field-lab-page');
    this.portal = this.isLandingPage ? document.getElementById('landing-portal') : null;
    this.easterEgg = this.isLandingPage ? document.getElementById('easter-egg-portal') : null;
    this.contactPulseAnchor = this.isContactPage ? document.querySelector('.contact-page__card') : null;

    this.coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.touchCapable = this.coarsePointer || !!(navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.lowPowerDevice = this.reducedMotion ||
      this.coarsePointer ||
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      (navigator.deviceMemory && navigator.deviceMemory <= 4);

    this.isMobile = window.innerWidth < 768;
    this.fieldWidth = 0;
    this.fieldHeight = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.easterEggX = 0;
    this.easterEggY = 0;
    this.gridCols = 0;
    this.gridRows = 0;
    this.spacing = 24;
    this.lineLen = 16;
    this.lineWidth = 1.7;
    this.dpr = 1;
    this.backingScale = 1;
    this.lastCanvasWidth = 0;
    this.lastCanvasHeight = 0;
    this.lastFieldWidth = 0;
    this.lastFieldHeight = 0;
    this.lastSpacing = 0;
    this.resizeFrame = null;

    this.isDarkLines = canvas.getAttribute('data-color') === 'dark';
    this.lineColor = this.isDarkLines ? DARK_LINE : LIGHT_LINE;
    this.opacityScale = this.isContentPage
      ? (this.isLabPage ? 1.15 : (this.isContactPage ? 0.52 : 0.18))
      : 1.0;

    this.time = 0;
    this.lastFrameTime = 0;
    this.minFrameMs = this.resolveFrameInterval();
    this.awakenDuration = 2.5;
    this.smoothedMouseX = -1000;
    this.smoothedMouseY = -1000;
    this.smoothedMousePresence = 0;

    this.particles = [];
    this.particleCount = 0;
    this.positionData = null;
    this.seedData = null;
    this.styleData = null;
    this.assemble0Data = null;
    this.assemble1Data = null;
    this.assemble2Data = null;

    this.blackHoleRadius = 300;
    this.maxGravityDistance = 0;
    this.gravityStrength = this.isMobile && this.isLandingPage ? 0.25 : 0;
    this.easterEggRadius = 200;
    // The lab is the exhibit, so the cursor gets a wider reach there and
    // the mode kinematics (displacement, crater, swirl) run at full force.
    this.mouseInfluence = this.isLabPage ? 300 : 220;
    this.modeIntensity = this.isLabPage ? 1 : 0;

    this.ripples = [];
    this.rippleUniforms = new Float32Array(MAX_RIPPLES * 4);
    this.rippleMaxRadius = Math.max(window.innerWidth, window.innerHeight) * 0.8;
    this.rippleSpeed = 280;
    this.rippleCooldown = 0.35;
    this.lastRippleTime = -10;
    this.wasNearPortal = false;

    this.wakeTrail = [];
    this.wakeUniforms = new Float32Array(MAX_WAKE_POINTS * 4);
    this.wakeMaxAge = 0.8;
    this.wakeRadius = 100;
    this.wakeMaxPoints = 12;
    this.lastWakeX = -1000;
    this.lastWakeY = -1000;

    this.hasEverTouched = false;
    this.lastInteractionTime = 0;
    this.idleNudgeInterval = 3;
    this.lastIdleNudgeTime = -10;
    this.idleNudgeCooldown = 2.5;

    this.portalRevealDist = 178;
    this.portalGlowDist = 390;
    this.portalCharge = 0;
    this.portalChargeDuration = 1.02;
    this.portalHoldRadius = this.touchCapable ? (this.isMobile ? 104 : 124) : 96;
    this.portalHoldEnabled = this.touchCapable || this.isMobile;
    this.portalHoldTriggered = false;
    this.portalStyleCache = {};
    this.portalClassState = {};
    this.portalStyleElapsed = 0;
    this.portalGlowStrength = 0.08;
    this.portalGlowRadius = 100;
    this.portalPresence = 0;
    this.portalCentered = 0;

    this.easterEggVisible = false;
    this.easterEggCharge = 0;
    this.easterEggChargeDuration = 4;
    this.easterEggHoldRadius = this.touchCapable ? 128 : 108;
    this.easterEggHoldTriggered = false;
    this.easterEggStyleCache = {};
    this.easterCursorNear = 0;
    this.easterSuppression = 0;

    this.contactPulseInterval = 2.2;
    this.lastContactPulseTime = -10;
    this.contactPulseHoverActive = false;

    this.landingTransition = {
      active: false,
      radius: 0,
      progress: 0
    };

    this.assembleState = {
      active: false,
      startTime: 0,
      duration: 0.82,
      staggerSpan: 0.28
    };

    this.running = false;
    this.paused = false;
    this.raf = null;
    this.resizeHandler = this.scheduleResize.bind(this);
    this.hiddenHandler = null;
    this.landingObserver = null;
    // Cache the rAF callback so we don't allocate a new bound function every frame.
    this.boundAnimate = this.animate.bind(this);
    // Cached contact-pulse center (page coords), recomputed on resize rather than
    // every frame — see resolveContactPulseCenter.
    this.contactPulseCenter = null;
    this.contactPulseDirty = true;
  }

  WebGLVectorField.prototype.init = function () {
    var gl = this.gl;

    this.vectorProgram = makeProgram(gl, VECTOR_VERTEX_SOURCE, VECTOR_FRAGMENT_SOURCE);
    this.effectProgram = makeProgram(gl, EFFECT_VERTEX_SOURCE, EFFECT_FRAGMENT_SOURCE);
    this.collectLocations();
    this.createBuffers();
    this.configureInitialDom();

    this.canvas.style.pointerEvents = 'none';
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    attachListeners();
    this.resize();
    this.installLifecycleHooks();
    return true;
  };

  WebGLVectorField.prototype.collectLocations = function () {
    var gl = this.gl;

    this.vectorLocations = {
      attribs: {
        corner: gl.getAttribLocation(this.vectorProgram, 'aCorner'),
        position: gl.getAttribLocation(this.vectorProgram, 'aPosition'),
        seed: gl.getAttribLocation(this.vectorProgram, 'aSeed'),
        style: gl.getAttribLocation(this.vectorProgram, 'aStyle'),
        assemble0: gl.getAttribLocation(this.vectorProgram, 'aAssemble0'),
        assemble1: gl.getAttribLocation(this.vectorProgram, 'aAssemble1'),
        assemble2: gl.getAttribLocation(this.vectorProgram, 'aAssemble2')
      },
      uniforms: this.mapUniforms(this.vectorProgram, [
        'uResolution', 'uTime', 'uAwaken', 'uMouse', 'uMouseActive', 'uMouseRadius', 'uFieldMode',
        'uModeIntensity', 'uScroll', 'uLine',
        'uCenter', 'uOpacityScale', 'uIsLanding', 'uBlackHoleRadius', 'uMaxGravityDistance',
        'uGravityStrength', 'uEaster', 'uEasterExtra', 'uReveal', 'uAssemble',
        'uRippleCount', 'uRipples[0]', 'uWakeCount', 'uWake[0]',
        'uLineColor', 'uLightColor', 'uDarkColor'
      ])
    };

    this.effectLocations = {
      attribs: {
        position: gl.getAttribLocation(this.effectProgram, 'aPosition')
      },
      uniforms: this.mapUniforms(this.effectProgram, [
        'uResolution', 'uIsLanding', 'uIsContact', 'uLineColor', 'uLightColor', 'uDarkColor',
        'uReveal', 'uCenter', 'uPortal', 'uEaster', 'uMouse', 'uMouseActive',
        'uRippleCount', 'uRipples[0]'
      ])
    };
  };

  WebGLVectorField.prototype.mapUniforms = function (program, names) {
    var gl = this.gl;
    var map = {};
    for (var i = 0; i < names.length; i++) {
      map[names[i]] = gl.getUniformLocation(program, names[i]);
    }
    return map;
  };

  WebGLVectorField.prototype.createBuffers = function () {
    var gl = this.gl;

    this.cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, -0.5,
       0.5, -0.5,
      -0.5,  0.5,
      -0.5,  0.5,
       0.5, -0.5,
       0.5,  0.5
    ]), gl.STATIC_DRAW);

    this.positionBuffer = gl.createBuffer();
    this.seedBuffer = gl.createBuffer();
    this.styleBuffer = gl.createBuffer();
    this.assemble0Buffer = gl.createBuffer();
    this.assemble1Buffer = gl.createBuffer();
    this.assemble2Buffer = gl.createBuffer();

    this.effectBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.effectBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       3, -1,
      -1,  3
    ]), gl.STATIC_DRAW);
  };

  WebGLVectorField.prototype.configureInitialDom = function () {
    if (this.portal) {
      this.portal.classList.add('is-visible');
      this.setPortalVar('--portal-proximity', '0');
      this.setPortalVar('--portal-charge', '0');
      this.setPortalVar('--portal-presence', '0');
      this.setPortalVar('--portal-centered', '0');
      this.setPortalVar('--portal-pulse', '0');
      this.setPortalVar('--portal-idle', '1');
      this.setPortalVar('--portal-breath', '0.5');
      this.setPortalVar('--portal-idle-glow', '0.08');
      this.setPortalVar('--portal-sweep', '0deg');
      this.setPortalVar('--portal-sweep-soft', '0deg');
      this.setPortalVar('--portal-sweep-reverse', '0deg');
      this.setPortalVar('--portal-sweep-ring', '0deg');
    }

    if (this.easterEgg) {
      this.setEasterEggVar('--easter-charge', '0');
    }
  };

  WebGLVectorField.prototype.installLifecycleHooks = function () {
    var self = this;

    window.addEventListener('resize', this.resizeHandler);

    this.canvas.addEventListener('webglcontextlost', function (event) {
      event.preventDefault();
      self.stop();
    }, false);

    var landing = document.getElementById('landing');
    if (landing) {
      this.landingObserver = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type === 'attributes' && m.attributeName === 'style' && landing.style.display === 'none') {
            self.stop();
            break;
          }
        }
      });
      this.landingObserver.observe(landing, { attributes: true });
    }
  };

  WebGLVectorField.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.raf = requestAnimationFrame(this.boundAnimate);
  };

  WebGLVectorField.prototype.stop = function () {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    window.removeEventListener('resize', this.resizeHandler);
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = null;
    if (this.landingObserver) this.landingObserver.disconnect();
    this.landingObserver = null;
  };

  WebGLVectorField.prototype.resolveFieldMetrics = function () {
    if (this.isContactPage) {
      return {
        spacing: this.isMobile ? 18 : 24,
        lineLen: this.isMobile ? 11 : 14,
        lineWidth: this.isMobile ? 1.15 : 1.35
      };
    }

    if (this.isContentPage) {
      // The Aphelion Field lab shows the field as the exhibit itself, so it
      // gets landing-tier dash sizes instead of the faint content styling.
      if (this.isLabPage) {
        return {
          spacing: this.isMobile ? 16 : 24,
          lineLen: this.isMobile ? 11 : 16,
          lineWidth: this.isMobile ? 1.2 : 1.7
        };
      }
      return {
        spacing: this.isMobile ? 20 : 30,
        lineLen: 9,
        lineWidth: 0.8
      };
    }

    return {
      spacing: this.isMobile ? 16 : 24,
      lineLen: this.isMobile ? 11 : 16,
      lineWidth: this.isMobile ? 1.2 : 1.7
    };
  };

  WebGLVectorField.prototype.applyResponsiveFieldSizing = function () {
    var baseMetrics = this.resolveFieldMetrics();
    var baseSpacing = baseMetrics.spacing;
    var baseLineLen = baseMetrics.lineLen;
    var baseLineWidth = baseMetrics.lineWidth;

    this.spacing = baseSpacing;
    if (!this.isMobile) {
      var particleBudget = this.isLandingPage || this.isLabPage ? 4200 : (this.isContactPage ? 3600 : 3000);
      var budgetSpacing = Math.sqrt((this.fieldWidth * this.fieldHeight) / particleBudget);
      if (budgetSpacing > this.spacing) this.spacing = budgetSpacing;
    }

    var spacingScale = this.spacing / baseSpacing;
    var visualScale = !this.isMobile ? Math.sqrt(spacingScale) : 1;
    this.lineLen = baseLineLen * Math.min(1.18, visualScale);
    this.lineWidth = baseLineWidth * Math.min(1.1, visualScale);
  };

  WebGLVectorField.prototype.resolveFrameInterval = function () {
    if (this.reducedMotion) return 1000 / 24;
    // The lab shows the field as the exhibit itself, so it gets full
    // framerate like the landing page (the sibling field systems are
    // paused there while the vector layer is active).
    if (this.isLandingPage || this.isContactPage || this.isLabPage) return 0;
    return this.lowPowerDevice ? 1000 / 20 : 1000 / 28;
  };

  WebGLVectorField.prototype.resize = function () {
    this.contactPulseDirty = true;
    var parent = this.canvas.parentElement;
    var nextFieldWidth = window.innerWidth;
    var nextFieldHeight = this.isLandingPage
      ? window.innerHeight
      : Math.max(window.innerHeight, parent ? parent.scrollHeight : window.innerHeight);
    var nextIsMobile = nextFieldWidth < 768;

    if (
      !nextIsMobile &&
      this.lastFieldHeight > 0 &&
      nextFieldWidth === this.lastFieldWidth &&
      Math.abs(nextFieldHeight - this.lastFieldHeight) <= 12
    ) {
      nextFieldHeight = this.lastFieldHeight;
    }

    var rawDpr = window.devicePixelRatio || 1;
    var dprCap = this.isContentPage
      ? (nextIsMobile ? 1.5 : 1.35)
      : (nextIsMobile ? 1.75 : 1.5);
    var dprFloor = this.lowPowerDevice ? 1 : (this.isContentPage ? 1.2 : 1.35);
    var nextDpr = Math.min(dprCap, Math.max(rawDpr, dprFloor));
    var nextBackingScale = nextDpr;

    if (!nextIsMobile) {
      var pixelBudget = this.isLandingPage ? 4147200 : 3200000;
      var scaledPixels = nextFieldWidth * nextFieldHeight * nextDpr * nextDpr;
      if (scaledPixels > pixelBudget) {
        nextBackingScale = nextDpr * Math.sqrt(pixelBudget / scaledPixels);
      }
    }

    this.fieldWidth = nextFieldWidth;
    this.fieldHeight = nextFieldHeight;
    this.isMobile = nextIsMobile;
    this.dpr = nextDpr;
    this.backingScale = nextBackingScale;
    this.centerX = this.fieldWidth / 2;
    this.centerY = this.fieldHeight / 2;
    this.easterEggX = this.fieldWidth * 0.82;
    this.easterEggY = this.isLandingPage ? this.fieldHeight * 0.78 : window.innerHeight * 0.78;
    this.gravityStrength = this.isMobile && this.isLandingPage ? 0.25 : 0;
    this.maxGravityDistance = Math.max(this.fieldWidth, window.innerHeight) * 0.6;
    this.rippleMaxRadius = Math.max(this.fieldWidth, this.fieldHeight) * 0.8;
    this.minFrameMs = this.resolveFrameInterval();
    this.applyResponsiveFieldSizing();

    var canvasWidth = Math.ceil(this.fieldWidth * this.backingScale);
    var canvasHeight = Math.ceil(this.fieldHeight * this.backingScale);
    var sizeChanged = canvasWidth !== this.lastCanvasWidth ||
      canvasHeight !== this.lastCanvasHeight ||
      this.fieldWidth !== this.lastFieldWidth ||
      this.fieldHeight !== this.lastFieldHeight;
    var gridChanged = sizeChanged || Math.abs(this.spacing - this.lastSpacing) > 0.01;

    if (sizeChanged) {
      this.canvas.width = Math.max(1, canvasWidth);
      this.canvas.height = Math.max(1, canvasHeight);
      this.canvas.style.width = this.fieldWidth + 'px';
      this.canvas.style.height = this.fieldHeight + 'px';
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.lastCanvasWidth = canvasWidth;
      this.lastCanvasHeight = canvasHeight;
      this.lastFieldWidth = this.fieldWidth;
      this.lastFieldHeight = this.fieldHeight;
    }

    if (gridChanged) {
      this.buildGrid();
      this.lastSpacing = this.spacing;
    }
  };

  WebGLVectorField.prototype.scheduleResize = function () {
    var self = this;
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = requestAnimationFrame(function () {
      self.resizeFrame = null;
      self.resize();
    });
  };

  WebGLVectorField.prototype.buildGrid = function () {
    var cols = Math.ceil(this.fieldWidth / this.spacing) + 1;
    var rows = Math.ceil(this.fieldHeight / this.spacing) + 1;
    var count = cols * rows;
    var positions = new Float32Array(count * 2);
    var seeds = new Float32Array(count * 4);
    var styles = new Float32Array(count * 4);
    var particles = new Array(count);
    var index = 0;

    this.gridCols = cols;
    this.gridRows = rows;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var layerRand = Math.random();
        var layer = layerRand < 0.6 ? 0 : (layerRand < 0.85 ? 1 : 2);
        var px = col * this.spacing + this.spacing * 0.5;
        var py = row * this.spacing + this.spacing * 0.5;
        var seed1 = Math.random() * 100;
        var seed2 = Math.random() * 100;
        var seed3 = Math.random() * 100;
        var drift = (Math.random() - 0.5) * 1.0;
        var mouseRadiusOffset = (Math.random() - 0.5) * 80;
        var baseOpacity = (0.24 + Math.random() * 0.12) * this.opacityScale;

        positions[index * 2] = px;
        positions[index * 2 + 1] = py;

        seeds[index * 4] = seed1;
        seeds[index * 4 + 1] = seed2;
        seeds[index * 4 + 2] = seed3;
        seeds[index * 4 + 3] = drift;

        styles[index * 4] = layer;
        styles[index * 4 + 1] = baseOpacity;
        styles[index * 4 + 2] = mouseRadiusOffset;
        styles[index * 4 + 3] = 0;

        particles[index] = {
          index: index,
          x: px,
          y: py,
          layer: layer,
          seed1: seed1,
          seed2: seed2,
          seed3: seed3,
          drift: drift,
          baseOpacity: baseOpacity
        };

        index++;
      }
    }

    this.particles = particles;
    this.particleCount = count;
    this.positionData = positions;
    this.seedData = seeds;
    this.styleData = styles;
    this.assemble0Data = new Float32Array(count * 4);
    this.assemble1Data = new Float32Array(count * 4);
    this.assemble2Data = new Float32Array(count * 4);
    this.assembleState.active = false;
    this.uploadParticleBuffers();
  };

  WebGLVectorField.prototype.uploadParticleBuffers = function () {
    var gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positionData, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.seedData, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.styleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.styleData, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.assemble0Buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.assemble0Data, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.assemble1Buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.assemble1Data, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.assemble2Buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.assemble2Data, gl.DYNAMIC_DRAW);
  };

  WebGLVectorField.prototype.updateAssembleBuffers = function () {
    var gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.assemble0Buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.assemble0Data, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.assemble1Buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.assemble1Data, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.assemble2Buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.assemble2Data, gl.DYNAMIC_DRAW);
  };

  WebGLVectorField.prototype.setDivisor = function (location, divisor) {
    if (location < 0) return;
    if (this.instancing.vertexAttribDivisor) {
      this.instancing.vertexAttribDivisor(location, divisor);
    } else {
      this.instancing.ext.vertexAttribDivisorANGLE(location, divisor);
    }
  };

  WebGLVectorField.prototype.bindAttrib = function (location, buffer, size, divisor) {
    if (location < 0) return;
    var gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    this.setDivisor(location, divisor);
  };

  WebGLVectorField.prototype.bindVectorAttributes = function () {
    var attribs = this.vectorLocations.attribs;
    this.bindAttrib(attribs.corner, this.cornerBuffer, 2, 0);
    this.bindAttrib(attribs.position, this.positionBuffer, 2, 1);
    this.bindAttrib(attribs.seed, this.seedBuffer, 4, 1);
    this.bindAttrib(attribs.style, this.styleBuffer, 4, 1);
    this.bindAttrib(attribs.assemble0, this.assemble0Buffer, 4, 1);
    this.bindAttrib(attribs.assemble1, this.assemble1Buffer, 4, 1);
    this.bindAttrib(attribs.assemble2, this.assemble2Buffer, 4, 1);
  };

  WebGLVectorField.prototype.bindEffectAttributes = function () {
    var attribs = this.effectLocations.attribs;
    this.bindAttrib(attribs.position, this.effectBuffer, 2, 0);
  };

  WebGLVectorField.prototype.drawInstanced = function () {
    var gl = this.gl;
    if (this.instancing.drawArraysInstanced) {
      this.instancing.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.particleCount);
    } else {
      this.instancing.ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, this.particleCount);
    }
  };

  WebGLVectorField.prototype.setPortalVar = function (name, value) {
    if (!this.portal || this.portalStyleCache[name] === value) return;
    this.portalStyleCache[name] = value;
    this.portal.style.setProperty(name, value);
  };

  WebGLVectorField.prototype.setPortalClass = function (name, active) {
    if (!this.portal || this.portalClassState[name] === active) return;
    this.portalClassState[name] = active;
    this.portal.classList.toggle(name, active);
  };

  WebGLVectorField.prototype.setEasterEggVar = function (name, value) {
    if (!this.easterEgg || this.easterEggStyleCache[name] === value) return;
    this.easterEggStyleCache[name] = value;
    this.easterEgg.style.setProperty(name, value);
  };

  WebGLVectorField.prototype.openEasterEgg = function () {
    if (!this.easterEgg || this.easterEggHoldTriggered) return;
    this.easterEggHoldTriggered = true;
    this.easterEgg.classList.add('is-opening');
    var href = this.easterEgg.getAttribute('href');
    if (href) window.location.href = href;
  };

  // power scales the pulse's rotation/opacity/displacement and its drawn
  // ring; speed sets the wavefront's px/s; cooldownOverride lets clicks
  // bypass the ambient 0.35s throttle.
  WebGLVectorField.prototype.spawnRipple = function (originX, originY, maxRadiusOverride, power, speedOverride, cooldownOverride) {
    var cooldown = typeof cooldownOverride === 'number' ? cooldownOverride : this.rippleCooldown;
    if (this.time - this.lastRippleTime < cooldown) return;
    this.lastRippleTime = this.time;
    this.ripples.push({
      x: typeof originX === 'number' ? originX : this.centerX,
      y: typeof originY === 'number' ? originY : this.centerY,
      radius: 0,
      maxRadius: typeof maxRadiusOverride === 'number' ? maxRadiusOverride : this.rippleMaxRadius,
      power: typeof power === 'number' ? power : 1,
      speed: typeof speedOverride === 'number' ? speedOverride : this.rippleSpeed,
      ageFadeSq: 1
    });
    if (this.ripples.length > MAX_RIPPLES) this.ripples.shift();
  };

  WebGLVectorField.prototype.resolveContactPulseCenter = function (scrollY) {
    if (!this.contactPulseAnchor) {
      return {
        x: this.centerX,
        y: (scrollY || 0) + window.innerHeight * 0.5
      };
    }

    // The card's page-absolute position only shifts on layout/resize, so measure it
    // once per resize instead of every frame. resolveContactPulseCenter ran each
    // frame while the cursor was active, and getBoundingClientRect forces a
    // synchronous reflow — a real per-frame stall on the contact page.
    if (this.contactPulseDirty || !this.contactPulseCenter) {
      var rect = this.contactPulseAnchor.getBoundingClientRect();
      var pageY = window.scrollY || window.pageYOffset || 0;
      this.contactPulseCenter = {
        x: rect.left + rect.width * 0.5,
        y: rect.top + pageY + rect.height * 0.5
      };
      this.contactPulseDirty = false;
    }
    return this.contactPulseCenter;
  };

  WebGLVectorField.prototype.layerConfig = function (layer) {
    if (layer < 0.5) return [1.0, 1.0, 1.0, 1.0];
    if (layer < 1.5) return [0.7, 0.8, 1.0, 0.9];
    return [0.45, 0.6, 1.0, 0.8];
  };

  WebGLVectorField.prototype.computeApproxAngle = function (p) {
    var lc = this.layerConfig(p.layer);
    var waveTime = this.time * lc[2];
    var swell = Math.sin(p.x * 0.006 + waveTime * 1.6) * 1.8 +
      Math.sin(p.x * 0.004 + p.y * 0.008 + waveTime * 1.15) * 1.3;
    var cross = Math.cos(p.y * 0.01 + waveTime * 0.9) * 0.9 +
      Math.sin(p.x * 0.012 - waveTime * 1.25) * 0.65;
    var deep = Math.sin((p.x + p.y) * 0.003 + waveTime * 0.45) * 1.0;
    var random = p.drift * Math.sin(waveTime * 0.7 + p.seed1) * 0.08 +
      Math.sin(waveTime * 1.3 + p.seed2 * 5) * 0.05 +
      Math.cos(waveTime * 0.9 + p.seed3 * 3) * 0.04;
    var awaken = Math.min(1, this.time / this.awakenDuration);
    var t = 1 - awaken;
    return (swell + cross + deep + random) * (1 - t * t * t);
  };

  WebGLVectorField.prototype.startAssembleTransition = function (config) {
    if (!this.isLandingPage || !this.particles.length) return;
    var targets = (config && config.targets) ? config.targets.slice() : [];
    if (!targets.length) return;

    var duration = (config && config.duration) ? config.duration : 0.82;
    var maxAssembleParticles = (config && config.maxParticles) ? config.maxParticles : this.particles.length;
    var targetCount = Math.min(this.particles.length, maxAssembleParticles);
    var spacing = this.spacing;

    function serpentineSort(a, b) {
      var rowA = (a.y / spacing) | 0;
      var rowB = (b.y / spacing) | 0;
      if (rowA !== rowB) return rowA - rowB;
      return rowA % 2 === 0 ? (a.x - b.x) : (b.x - a.x);
    }

    var spatialParticles = this.particles.slice().sort(serpentineSort);
    var sortedTargets = targets.sort(serpentineSort);
    var sortedParticles = spatialParticles.slice(0, targetCount);
    if (!sortedParticles.length || !sortedTargets.length) return;

    this.assemble0Data.fill(0);
    this.assemble1Data.fill(0);
    this.assemble2Data.fill(0);

    var targetUsage = new Array(sortedTargets.length);
    for (var tu = 0; tu < sortedTargets.length; tu++) targetUsage[tu] = 0;

    for (var i = 0; i < sortedParticles.length; i++) {
      var p = sortedParticles[i];
      var targetIndex = Math.min(sortedTargets.length - 1, ((i + 0.5) * sortedTargets.length / sortedParticles.length) | 0);
      var target = sortedTargets[targetIndex];
      var usage = targetUsage[targetIndex]++;
      var ring = (usage / 9) | 0;
      var cell = usage % 9;
      var offsetCol = (cell % 3) - 1;
      var offsetRow = ((cell / 3) | 0) - 1;
      var offsetScale = spacing * (0.055 + ring * 0.03);
      var clusterFade = usage === 0 ? 1 : Math.max(0.1, 0.32 - ring * 0.04 - (Math.abs(offsetCol) + Math.abs(offsetRow)) * 0.035);
      var idx4 = p.index * 4;

      this.assemble0Data[idx4] = p.x;
      this.assemble0Data[idx4 + 1] = p.y;
      this.assemble0Data[idx4 + 2] = target.x + offsetCol * offsetScale * 0.82;
      this.assemble0Data[idx4 + 3] = target.y + offsetRow * offsetScale * 0.46;

      this.assemble1Data[idx4] = this.computeApproxAngle(p);
      this.assemble1Data[idx4 + 1] = target.angle;
      this.assemble1Data[idx4 + 2] = Math.min(1, Math.max(0.08, target.opacity * clusterFade));
      this.assemble1Data[idx4 + 3] = target.len * (usage === 0 ? 1.02 : Math.max(0.36, 0.52 - ring * 0.035));

      this.assemble2Data[idx4] = target.width * (usage === 0 ? 1 : Math.max(0.22, 0.34 - ring * 0.025));
      this.assemble2Data[idx4 + 1] = i / Math.max(1, sortedParticles.length - 1);
      this.assemble2Data[idx4 + 2] = 1;
      this.assemble2Data[idx4 + 3] = 0;
    }

    this.assembleState = {
      active: true,
      startTime: this.time,
      duration: duration,
      staggerSpan: window.innerWidth < 768 ? 0.22 : 0.28
    };

    this.updateAssembleBuffers();
  };

  WebGLVectorField.prototype.setTransitionState = function (config) {
    if (!this.isLandingPage) return;
    var wasActive = this.landingTransition.active;

    this.landingTransition.active = !!(config && config.active);
    this.landingTransition.radius = config && typeof config.radius === 'number' ? config.radius : 0;
    this.landingTransition.progress = config && typeof config.progress === 'number' ? config.progress : 0;

    if (this.landingTransition.active && !wasActive) {
      this.lastRippleTime = -10;
      this.spawnRipple();
    }
  };

  WebGLVectorField.prototype.updateRipples = function (dt) {
    for (var i = this.ripples.length - 1; i >= 0; i--) {
      var rip = this.ripples[i];
      rip.radius += (rip.speed || this.rippleSpeed) * dt;
      if (rip.radius > rip.maxRadius) {
        this.ripples.splice(i, 1);
      } else {
        var ageFade = Math.max(0, 1 - rip.radius / rip.maxRadius);
        rip.ageFadeSq = ageFade * ageFade;
      }
    }

    this.rippleUniforms.fill(0);
    var count = Math.min(MAX_RIPPLES, this.ripples.length);
    for (var r = 0; r < count; r++) {
      var rp = this.ripples[r];
      var offset = r * 4;
      this.rippleUniforms[offset] = rp.x;
      this.rippleUniforms[offset + 1] = rp.y;
      this.rippleUniforms[offset + 2] = rp.radius;
      // Fade and power share one slot; the shaders treat w as strength.
      this.rippleUniforms[offset + 3] = rp.ageFadeSq * (rp.power || 1);
    }
  };

  WebGLVectorField.prototype.updateWake = function (mouseActive, pageMouseX, pageMouseY) {
    if (mouseActive) {
      var dx = pageMouseX - this.lastWakeX;
      var dy = pageMouseY - this.lastWakeY;
      if (dx * dx + dy * dy > 900) {
        this.wakeTrail.push({ x: pageMouseX, y: pageMouseY, time: this.time, fade: 1 });
        this.lastWakeX = pageMouseX;
        this.lastWakeY = pageMouseY;
        while (this.wakeTrail.length > this.wakeMaxPoints) this.wakeTrail.shift();
      }
    }

    while (this.wakeTrail.length > 0 && this.time - this.wakeTrail[0].time > this.wakeMaxAge) {
      this.wakeTrail.shift();
    }

    this.wakeUniforms.fill(0);
    var count = Math.min(MAX_WAKE_POINTS, this.wakeTrail.length);
    for (var i = 0; i < count; i++) {
      var wp = this.wakeTrail[this.wakeTrail.length - count + i];
      var age = (this.time - wp.time) / this.wakeMaxAge;
      wp.fade = (1 - age) * (1 - age);
      var offset = i * 4;
      this.wakeUniforms[offset] = wp.x;
      this.wakeUniforms[offset + 1] = wp.y;
      this.wakeUniforms[offset + 2] = wp.fade;
      this.wakeUniforms[offset + 3] = 0;
    }
  };

  WebGLVectorField.prototype.updatePortal = function (dt, mouseActive, pageMouseX, pageMouseY) {
    if (!this.portal) return;

    var portalProximity = 0;
    var portalCentered = 0;
    var portalPresence = 0;
    var portalPulse = 0;
    var portalBreath = 0.5 + 0.5 * Math.sin(this.time * 1.18);
    var portalIdle = 1;
    var portalIdleGlow = 0.08;

    if (mouseActive) {
      var portalDx = pageMouseX - this.centerX;
      var portalDy = pageMouseY - this.centerY;
      var portalDist = Math.sqrt(portalDx * portalDx + portalDy * portalDy);
      portalProximity = Math.max(0, 1 - portalDist / this.portalGlowDist);
      if (portalProximity < 0.08) portalProximity = 0;
      portalCentered = Math.max(0, 1 - portalDist / (this.portalHoldRadius * 1.2));
    }

    var dxP = pageMouseX - this.centerX;
    var dyP = pageMouseY - this.centerY;
    var distToCenterSq = dxP * dxP + dyP * dyP;
    var fingerInHoldZone = this.portalHoldEnabled && mouseActive && distToCenterSq < this.portalHoldRadius * this.portalHoldRadius;
    var portalNear = mouseActive && distToCenterSq < this.portalRevealDist * this.portalRevealDist;

    if (portalNear) {
      if (!this.wasNearPortal) {
        this.spawnRipple();
        this.wasNearPortal = true;
      }
      if (distToCenterSq < 6400) this.spawnRipple();
    } else {
      this.wasNearPortal = false;
    }

    if (fingerInHoldZone && !this.portalHoldTriggered) {
      this.portalCharge = Math.min(1, this.portalCharge + dt / this.portalChargeDuration);
      this.setPortalClass('is-charging', true);
      this.setPortalVar('--portal-charge', this.portalCharge.toFixed(3));
      if (this.portalCharge >= 1 && typeof window.triggerLandingTransition === 'function') {
        this.portalHoldTriggered = true;
        window.triggerLandingTransition();
      }
    } else {
      this.portalCharge = Math.max(0, this.portalCharge - dt * 1.8);
      if (this.portalCharge <= 0.001) this.portalCharge = 0;
      this.setPortalClass('is-charging', this.portalCharge > 0.001);
      this.setPortalVar('--portal-charge', this.portalCharge.toFixed(3));
    }

    portalPresence = portalProximity > 0
      ? Math.min(1, Math.pow(portalProximity, 2.35) * 1.2 + portalCentered * 0.32 + this.portalCharge * 0.72)
      : Math.min(1, this.portalCharge * 0.72);

    portalIdle = Math.max(0, 1 - portalPresence * 1.9 - portalCentered * 1.4 - this.portalCharge * 1.8);
    portalIdleGlow = portalIdle * (0.22 + portalBreath * 0.34);

    if (portalProximity > 0.08 || portalCentered > 0.02 || this.portalCharge > 0.01) {
      var portalPulseRate = 1.8 + portalProximity * 2.4 + portalCentered * 4.2 + this.portalCharge * 5.8;
      var portalPulseWave = 0.5 + 0.5 * Math.sin(this.time * portalPulseRate);
      portalPulse = portalPulseWave * (portalProximity * 0.34 + portalCentered * 0.46 + this.portalCharge * 0.62);
    }

    var portalLive = portalProximity > 0.06 || portalCentered > 0.08 || this.portalCharge > 0.01;
    this.setPortalClass('is-near', portalProximity > 0.06 || this.portalCharge > 0.01);
    this.setPortalClass('is-centered', portalCentered > 0.08 || this.portalCharge > 0.03);

    this.portalStyleElapsed += dt;
    if (portalLive || this.portalStyleElapsed > 0.045) {
      this.portalStyleElapsed = 0;
      this.setPortalVar('--portal-proximity', portalProximity.toFixed(3));
      this.setPortalVar('--portal-presence', portalPresence.toFixed(3));
      this.setPortalVar('--portal-centered', portalCentered.toFixed(3));
      this.setPortalVar('--portal-pulse', portalPulse.toFixed(3));
      this.setPortalVar('--portal-idle', portalIdle.toFixed(3));
      this.setPortalVar('--portal-breath', portalBreath.toFixed(3));
      this.setPortalVar('--portal-idle-glow', portalIdleGlow.toFixed(3));

      if (portalLive) {
        var portalSweepDeg = this.time * (34 + portalCentered * 90 + this.portalCharge * 140) * 57.2958;
        this.setPortalVar('--portal-sweep', portalSweepDeg.toFixed(2) + 'deg');
        this.setPortalVar('--portal-sweep-soft', (portalSweepDeg * 0.62).toFixed(2) + 'deg');
        this.setPortalVar('--portal-sweep-reverse', (-portalSweepDeg * 0.88).toFixed(2) + 'deg');
        this.setPortalVar('--portal-sweep-ring', (portalSweepDeg * 1.12).toFixed(2) + 'deg');
      } else {
        this.setPortalVar('--portal-sweep', '0deg');
        this.setPortalVar('--portal-sweep-soft', '0deg');
        this.setPortalVar('--portal-sweep-reverse', '0deg');
        this.setPortalVar('--portal-sweep-ring', '0deg');
      }
    }

    this.portalGlowStrength = Math.min(1, portalIdleGlow * 0.94 + portalPresence * 0.42 + portalCentered * 0.24 + this.portalCharge * 0.44 + portalPulse * 0.34);
    this.portalGlowRadius = 34 + portalIdleGlow * 156 + portalPresence * 84 + portalCentered * 28 + this.portalCharge * 72 + portalPulse * 64;
    this.portalPresence = portalPresence;
    this.portalCentered = portalCentered;
  };

  WebGLVectorField.prototype.updateEasterEgg = function (dt, mouseActive, pageMouseX, pageMouseY) {
    this.easterCursorNear = 0;
    this.easterSuppression = 0;

    if (!this.isLandingPage) return;

    var distToEE = 100000;
    if (mouseActive) {
      var dx = pageMouseX - this.easterEggX;
      var dy = pageMouseY - this.easterEggY;
      distToEE = Math.sqrt(dx * dx + dy * dy);
      this.easterCursorNear = Math.max(0, 1 - distToEE / 200);
      this.easterSuppression = Math.max(0, 1 - distToEE / 250);
      this.easterSuppression *= this.easterSuppression;
    }

    if (!this.easterEgg) return;

    var easterEggNear = mouseActive && distToEE < this.easterEggHoldRadius;
    if (easterEggNear) {
      if (!this.easterEggVisible) {
        this.easterEgg.classList.add('is-visible');
        this.easterEggVisible = true;
      }
      if (!this.easterEggHoldTriggered) {
        this.easterEggCharge = Math.min(1, this.easterEggCharge + dt / this.easterEggChargeDuration);
        this.easterEgg.classList.toggle('is-charging', this.easterEggCharge > 0.001);
        this.setEasterEggVar('--easter-charge', this.easterEggCharge.toFixed(3));
        if (this.easterEggCharge >= 1) this.openEasterEgg();
      }
    } else {
      this.easterEggCharge = Math.max(0, this.easterEggCharge - dt * 1.15);
      this.easterEgg.classList.toggle('is-charging', this.easterEggCharge > 0.001);
      this.setEasterEggVar('--easter-charge', this.easterEggCharge.toFixed(3));
      if (distToEE < 100 && mouseActive) {
        if (!this.easterEggVisible) {
          this.easterEgg.classList.add('is-visible');
          this.easterEggVisible = true;
        }
      } else if (this.easterEggCharge <= 0.001 && this.easterEggVisible) {
        this.easterEgg.classList.remove('is-visible');
        this.easterEggVisible = false;
      }
    }
  };

  WebGLVectorField.prototype.updateLandingDiscovery = function (mouseActive) {
    if (!this.isLandingPage) return;

    if (mouseActive && !this.hasEverTouched) {
      this.hasEverTouched = true;
      this.lastRippleTime = -10;
      this.spawnRipple();
    }

    if (mouseActive) {
      this.lastInteractionTime = this.time;
    }

    if (!mouseActive && this.hasEverTouched && this.time > this.awakenDuration) {
      var idleDuration = this.time - this.lastInteractionTime;
      if (idleDuration > this.idleNudgeInterval && this.time - this.lastIdleNudgeTime > this.idleNudgeCooldown) {
        this.lastIdleNudgeTime = this.time;
        this.lastRippleTime = -10;
        this.spawnRipple();
      }
    }

    if (!this.hasEverTouched && this.time > this.awakenDuration + 1.5 && this.time - this.lastIdleNudgeTime > this.idleNudgeCooldown) {
      this.lastIdleNudgeTime = this.time;
      this.lastRippleTime = -10;
      this.spawnRipple();
    }
  };

  WebGLVectorField.prototype.updateContactPulse = function (mouseActive, pageMouseX, pageMouseY, pageScrollY) {
    if (!this.isContactPage) return;

    if (this.time - this.lastContactPulseTime > this.contactPulseInterval) {
      var pulseCenter = this.resolveContactPulseCenter(pageScrollY);
      this.lastRippleTime = -10;
      this.spawnRipple(pulseCenter.x, pulseCenter.y, Math.max(window.innerWidth, window.innerHeight) * 0.72);
      this.lastContactPulseTime = this.time;
    }

    if (mouseActive) {
      var hoverCenter = this.resolveContactPulseCenter(pageScrollY);
      var hoverDx = pageMouseX - hoverCenter.x;
      var hoverDy = pageMouseY - hoverCenter.y;
      var isNearContactButton = hoverDx * hoverDx + hoverDy * hoverDy < 150 * 150;
      if (isNearContactButton && !this.contactPulseHoverActive) {
        this.lastRippleTime = -10;
        this.spawnRipple(hoverCenter.x, hoverCenter.y, Math.max(window.innerWidth, window.innerHeight) * 0.62);
        this.contactPulseHoverActive = true;
      } else if (!isNearContactButton) {
        this.contactPulseHoverActive = false;
      }
    } else {
      this.contactPulseHoverActive = false;
    }
  };

  WebGLVectorField.prototype.setColorUniform = function (location, color) {
    if (!location) return;
    this.gl.uniform3f(location, color[0] / 255, color[1] / 255, color[2] / 255);
  };

  WebGLVectorField.prototype.updateSmoothedMouse = function (mouseActive, pageMouseX, pageMouseY, dt) {
    var targetPresence = mouseActive ? 1 : 0;
    var presenceEase = 1 - Math.exp(-dt * (mouseActive ? 10 : 7));
    this.smoothedMousePresence += (targetPresence - this.smoothedMousePresence) * presenceEase;

    if (!mouseActive) return;

    if (this.smoothedMousePresence < 0.04 || this.smoothedMouseX < -500 || this.smoothedMouseY < -500) {
      this.smoothedMouseX = pageMouseX;
      this.smoothedMouseY = pageMouseY;
      return;
    }

    var followEase = 1 - Math.exp(-dt * 13);
    this.smoothedMouseX += (pageMouseX - this.smoothedMouseX) * followEase;
    this.smoothedMouseY += (pageMouseY - this.smoothedMouseY) * followEase;
  };

  WebGLVectorField.prototype.setVectorUniforms = function (mousePresence, pageMouseX, pageMouseY, scrollTilt) {
    var gl = this.gl;
    var u = this.vectorLocations.uniforms;
    var awaken = this.isLandingPage ? Math.min(1, this.time / this.awakenDuration) : 1;
    var t1 = 1 - awaken;
    var awakenEased = 1 - t1 * t1 * t1;

    gl.uniform2f(u.uResolution, this.fieldWidth, this.fieldHeight);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uAwaken, awakenEased);
    gl.uniform2f(u.uMouse, pageMouseX, pageMouseY);
    gl.uniform1f(u.uMouseActive, mousePresence);
    gl.uniform1f(u.uMouseRadius, this.mouseInfluence);
    gl.uniform1i(u.uFieldMode, vectorFieldMode);
    gl.uniform1f(u.uModeIntensity, this.modeIntensity);
    var scrollVectorShift = (this.isMobile || this.touchCapable) ? 0 : scrollKick;
    gl.uniform3f(u.uScroll, scrollVectorShift, scrollDirection, scrollVectorShift > 0 ? scrollTilt : 0);
    gl.uniform2f(u.uLine, this.lineLen, this.lineWidth);
    gl.uniform2f(u.uCenter, this.centerX, this.centerY);
    gl.uniform1f(u.uOpacityScale, this.opacityScale);
    gl.uniform1f(u.uIsLanding, this.isLandingPage ? 1 : 0);
    gl.uniform1f(u.uBlackHoleRadius, this.blackHoleRadius);
    gl.uniform1f(u.uMaxGravityDistance, this.maxGravityDistance);
    gl.uniform1f(u.uGravityStrength, this.gravityStrength);
    gl.uniform4f(u.uEaster, this.easterEggX, this.easterEggY, this.easterEggRadius, 0);
    gl.uniform2f(u.uEasterExtra, this.easterCursorNear, this.easterSuppression);
    gl.uniform3f(u.uReveal, this.landingTransition.active ? 1 : 0, this.landingTransition.radius, this.landingTransition.progress);
    gl.uniform4f(
      u.uAssemble,
      this.assembleState.active ? 1 : 0,
      this.assembleState.startTime,
      this.assembleState.duration,
      this.assembleState.staggerSpan
    );
    gl.uniform1i(u.uRippleCount, Math.min(MAX_RIPPLES, this.ripples.length));
    gl.uniform4fv(u['uRipples[0]'], this.rippleUniforms);
    gl.uniform1i(u.uWakeCount, Math.min(MAX_WAKE_POINTS, this.wakeTrail.length));
    gl.uniform4fv(u['uWake[0]'], this.wakeUniforms);
    this.setColorUniform(u.uLineColor, this.lineColor);
    this.setColorUniform(u.uLightColor, LIGHT_LINE);
    this.setColorUniform(u.uDarkColor, DARK_LINE);
  };

  WebGLVectorField.prototype.setEffectUniforms = function (mousePresence, pageMouseX, pageMouseY) {
    var gl = this.gl;
    var u = this.effectLocations.uniforms;

    gl.uniform2f(u.uResolution, this.fieldWidth, this.fieldHeight);
    gl.uniform1f(u.uIsLanding, this.isLandingPage ? 1 : 0);
    gl.uniform1f(u.uIsContact, this.isContactPage ? 1 : 0);
    this.setColorUniform(u.uLineColor, this.lineColor);
    this.setColorUniform(u.uLightColor, LIGHT_LINE);
    this.setColorUniform(u.uDarkColor, DARK_LINE);
    gl.uniform3f(u.uReveal, this.landingTransition.active ? 1 : 0, this.landingTransition.radius, this.landingTransition.progress);
    gl.uniform2f(u.uCenter, this.centerX, this.centerY);
    gl.uniform4f(u.uPortal, this.portalGlowStrength, this.portalGlowRadius, this.portalPresence, this.portalCharge);
    gl.uniform4f(u.uEaster, this.easterEggX, this.easterEggY, this.easterEggRadius, 0);
    gl.uniform2f(u.uMouse, pageMouseX, pageMouseY);
    gl.uniform1f(u.uMouseActive, mousePresence);
    gl.uniform1i(u.uRippleCount, Math.min(MAX_RIPPLES, this.ripples.length));
    gl.uniform4fv(u['uRipples[0]'], this.rippleUniforms);
  };

  WebGLVectorField.prototype.render = function (mousePresence, pageMouseX, pageMouseY, scrollTilt) {
    var gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.vectorProgram);
    this.bindVectorAttributes();
    this.setVectorUniforms(mousePresence, pageMouseX, pageMouseY, scrollTilt);
    this.drawInstanced();

    gl.useProgram(this.effectProgram);
    this.bindEffectAttributes();
    this.setEffectUniforms(mousePresence, pageMouseX, pageMouseY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // Park the render loop while another lab field system is the exhibit.
  WebGLVectorField.prototype.setPaused = function (paused) {
    paused = !!paused;
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      this.lastFrameTime = 0;
    } else if (this.running && !this.raf) {
      this.raf = requestAnimationFrame(this.boundAnimate);
    }
  };

  WebGLVectorField.prototype.animate = function (timestamp) {
    if (!this.running || this.paused || this.id !== INSTANCE_ID) return;

    if (document.hidden) {
      this.lastFrameTime = 0;
      this.raf = requestAnimationFrame(this.boundAnimate);
      return;
    }

    var transitionFidelityActive = this.isLandingPage && (this.assembleState.active || this.landingTransition.active);
    var activeMinFrameMs = transitionFidelityActive ? 0 : this.minFrameMs;

    if (!this.lastFrameTime) this.lastFrameTime = activeMinFrameMs > 0 ? timestamp - activeMinFrameMs : timestamp;
    var elapsedMs = timestamp - this.lastFrameTime;
    if (activeMinFrameMs > 0 && elapsedMs < activeMinFrameMs) {
      this.raf = requestAnimationFrame(this.boundAnimate);
      return;
    }

    var dt = elapsedMs / 1000;
    this.lastFrameTime = activeMinFrameMs > 0 ? timestamp - (elapsedMs % activeMinFrameMs) : timestamp;
    if (dt > 0.1) dt = transitionFidelityActive ? 0.016 : 0.05;
    this.time += dt;

    var pageMouseX = mouseX;
    var pageMouseY = mouseY;
    var pageScrollY = 0;
    if (!this.isLandingPage) {
      pageScrollY = window.scrollY || window.pageYOffset || 0;
      if (pageMouseY > 0) pageMouseY += pageScrollY;
    }
    var mouseActive = pageMouseX > 0 && pageMouseY > 0;

    scrollVelocity *= 0.9;
    scrollKick *= 0.9;
    if (Math.abs(scrollVelocity) < 0.001) scrollVelocity = 0;
    if (scrollKick < 0.001) scrollKick = 0;
    var scrollTilt = clamp(scrollVelocity / 10, -1, 1);
    this.updateSmoothedMouse(mouseActive, pageMouseX, pageMouseY, dt);

    this.updateWake(mouseActive, pageMouseX, pageMouseY);
    this.updateLandingDiscovery(mouseActive);
    this.updateContactPulse(mouseActive, pageMouseX, pageMouseY, pageScrollY);
    this.updatePortal(dt, mouseActive, pageMouseX, pageMouseY);
    this.updateEasterEgg(dt, mouseActive, pageMouseX, pageMouseY);
    this.updateRipples(dt);
    this.render(this.smoothedMousePresence, this.smoothedMouseX, this.smoothedMouseY, scrollTilt);

    this.raf = requestAnimationFrame(this.boundAnimate);
  };

  function getWebGLContext(canvas) {
    var attributes = {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    };

    var gl = canvas.getContext('webgl2', attributes);
    if (gl) {
      return {
        gl: gl,
        instancing: {
          vertexAttribDivisor: gl.vertexAttribDivisor ? gl.vertexAttribDivisor.bind(gl) : null,
          drawArraysInstanced: gl.drawArraysInstanced ? gl.drawArraysInstanced.bind(gl) : null,
          ext: null
        }
      };
    }

    gl = canvas.getContext('webgl', attributes) || canvas.getContext('experimental-webgl', attributes);
    if (!gl) return null;
    var ext = gl.getExtension('ANGLE_instanced_arrays');
    if (!ext) {
      return {
        gl: gl,
        instancing: null
      };
    }

    return {
      gl: gl,
      instancing: {
        vertexAttribDivisor: null,
        drawArraysInstanced: null,
        ext: ext
      }
    };
  }

  window.setVectorFieldMode = function (name) {
    if (!FIELD_MODES.hasOwnProperty(name)) return false;
    vectorFieldMode = FIELD_MODES[name];
    window.__vectorFieldMode = vectorFieldMode;
    return true;
  };

  window.initVectorFieldWebGL = function () {
    var canvas = document.getElementById('vector-field');
    if (!canvas) return false;

    var isLandingPage = !!document.getElementById('landing');
    if (isLandingPage && window.location.hash === '#portfolio') {
      canvas.style.display = 'none';
      return true;
    }

    if (ACTIVE_RENDERER) {
      ACTIVE_RENDERER.stop();
      ACTIVE_RENDERER = null;
    }

    var context = null;
    try {
      context = getWebGLContext(canvas);
      if (!context || !context.gl || !context.instancing) {
        if (context && context.gl) replaceCanvasForFallback(canvas);
        return false;
      }

      var renderer = new WebGLVectorField(canvas, context.gl, context.instancing);
      renderer.init();
      canvas.setAttribute('data-renderer', 'webgl');
      ACTIVE_RENDERER = renderer;

      window.setVectorFieldTransition = function (config) {
        if (ACTIVE_RENDERER) ACTIVE_RENDERER.setTransitionState(config);
      };

      window.startVectorFieldAssemble = function (config) {
        if (ACTIVE_RENDERER) ACTIVE_RENDERER.startAssembleTransition(config);
      };

      // The field lab pauses whichever field systems aren't the exhibit.
      window.setVectorFieldActive = function (active) {
        if (ACTIVE_RENDERER) ACTIVE_RENDERER.setPaused(!active);
      };

      renderer.start();
      return true;
    } catch (err) {
      if (window.console && console.warn) {
        console.warn('Vector field WebGL renderer unavailable, falling back to Canvas2D.', err);
      }
      if (ACTIVE_RENDERER) {
        ACTIVE_RENDERER.stop();
        ACTIVE_RENDERER = null;
      }
      replaceCanvasForFallback(canvas);
      return false;
    }
  };
})();
