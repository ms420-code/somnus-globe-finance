/* ============================================================================
   SOMNUS — shared "Blue Marble" realistic Earth builder.
   Depends on THREE (r128). Used by both the homepage hero (index.html,
   always-on) and the globe command center's view-mode toggle (globe.js).

   window.SOMNUS_EARTH.create(THREE, opts) -> {
     group,                    // THREE.Group — add this to your scene
     state,                    // { ready, failed, nightIntensity }
     setSunDirection(vec3),    // world-space unit vector toward the sun
     setNightIntensity(0..1),  // 0 = always show day texture, 1 = full day/night blend
     setShimmerColor(hex),     // recolor the loading placeholder (e.g. on theme change)
     tick(dt),                 // call every frame: spins clouds + animates shimmer
   }

   Textures are NASA Blue Marble / Black Marble composites from three.js's own
   example asset set (day, night lights, specular ocean mask, cloud layer,
   normal/relief). A soft animated shimmer sphere is shown immediately and
   swapped for the real texture set once loaded — the sphere is never a flat
   black/empty ball while the ~2MB of 2K textures download.
   ============================================================================ */
(function (global) {
  "use strict";

  var TEX = {
    day: "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
    night: "https://threejs.org/examples/textures/planets/earth_lights_2048.png",
    normal: "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg",
    spec: "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg",
    clouds: "https://threejs.org/examples/textures/planets/earth_clouds_1024.png",
  };

  var EARTH_VERT =
    "varying vec3 vNormal; varying vec2 vUv;" +
    "void main(){ vNormal = normalize(normalMatrix * normal); vUv = uv;" +
    "gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }";

  var EARTH_FRAG =
    "uniform sampler2D dayTex; uniform sampler2D nightTex; uniform sampler2D specTex;" +
    "uniform sampler2D normalTex; uniform float useNormal;" +
    "uniform vec3 sunDirection; uniform float nightIntensity;" +
    "varying vec3 vNormal; varying vec2 vUv;" +
    "void main(){" +
    "  float ndotl = dot(normalize(vNormal), normalize(sunDirection));" +
    "  float mixF = mix(1.0, smoothstep(-0.2, 0.2, ndotl), nightIntensity);" +
    "  vec3 dayColor = texture2D(dayTex, vUv).rgb;" +
    "  vec3 nightColor = texture2D(nightTex, vUv).rgb * nightIntensity;" +
    "  vec3 color = mix(nightColor, dayColor, mixF);" +
    // cheap "bump relief": use the relief map's luminance to modulate
    // brightness in place of full tangent-space normal mapping
    "  float relief = texture2D(normalTex, vUv).r;" +
    "  color *= mix(1.0, mix(0.86, 1.1, relief), useNormal);" +
    // faint ocean specular sheen, biased toward the sub-solar highlight
    "  float spec = texture2D(specTex, vUv).r;" +
    "  float facing = clamp(dot(normalize(vNormal), vec3(0.0,0.0,1.0)), 0.0, 1.0);" +
    "  float sheen = pow(facing, 30.0) * mixF * spec;" +
    "  color += vec3(0.85,0.92,1.0) * sheen * 0.35;" +
    "  gl_FragColor = vec4(color, 1.0);" +
    "}";

  function create(THREE, opts) {
    opts = opts || {};
    var radius = opts.radius || 5;
    var onProgress = opts.onProgress || function () {};
    var onReady = opts.onReady || function () {};
    var onError = opts.onError || function () {};

    var group = new THREE.Group();
    var state = { ready: false, failed: false, nightIntensity: opts.nightIntensity != null ? opts.nightIntensity : 1 };

    // ---- loading shimmer: shown immediately, removed once textures land ----
    var shimmerMat = new THREE.ShaderMaterial({
      uniforms: {
        t: { value: 0 },
        color: { value: new THREE.Color(opts.shimmerColor != null ? opts.shimmerColor : 0x1b3a5c) },
      },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader:
        "uniform float t; uniform vec3 color; varying vec2 vUv;" +
        "void main(){" +
        "  float band = sin((vUv.x + vUv.y) * 18.0 - t * 2.2) * 0.5 + 0.5;" +
        "  vec3 c = color + band * 0.07;" +
        "  gl_FragColor = vec4(c, 1.0);" +
        "}",
    });
    var shimmerMesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), shimmerMat);
    group.add(shimmerMesh);

    var earthMat = null, earthMesh = null, cloudsMesh = null;
    var loader = new THREE.TextureLoader();
    var okCount = 0, errCount = 0;
    var TOTAL = 4; // day, night, spec, clouds gate readiness; normal map is a non-blocking bonus
    var texDay, texNight, texSpec, texClouds, texNormal;

    function ok() { okCount++; onProgress(okCount / TOTAL); if (okCount + errCount >= TOTAL) settle(); }
    function fail(label) {
      return function (err) {
        errCount++;
        console.warn("SOMNUS: realistic Earth texture failed to load (" + label + ").", err);
        if (okCount + errCount >= TOTAL) settle();
      };
    }

    texDay = loader.load(TEX.day, ok, undefined, fail("day"));
    texNight = loader.load(TEX.night, ok, undefined, fail("night"));
    texSpec = loader.load(TEX.spec, ok, undefined, fail("specular"));
    texClouds = loader.load(TEX.clouds, ok, undefined, fail("clouds"));
    texNormal = loader.load(TEX.normal, function () {
      if (earthMat) { earthMat.uniforms.useNormal.value = 1.0; }
    }); // cosmetic-only; never blocks or fails readiness

    function settle() {
      if (errCount >= TOTAL) {
        // every core texture failed (e.g. offline) — keep the shimmer up
        // forever rather than show a broken/black sphere
        state.failed = true;
        onError();
        return;
      }
      earthMat = new THREE.ShaderMaterial({
        uniforms: {
          dayTex: { value: texDay },
          nightTex: { value: texNight },
          specTex: { value: texSpec },
          normalTex: { value: texNormal },
          useNormal: { value: 0.0 },
          sunDirection: { value: new THREE.Vector3(1, 0, 0) },
          nightIntensity: { value: state.nightIntensity },
        },
        vertexShader: EARTH_VERT,
        fragmentShader: EARTH_FRAG,
      });
      earthMesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 96), earthMat);
      group.add(earthMesh);

      cloudsMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.008, 64, 64),
        new THREE.MeshBasicMaterial({ map: texClouds, transparent: true, opacity: 0.55, depthWrite: false })
      );
      group.add(cloudsMesh);

      group.remove(shimmerMesh);
      state.ready = true;
      onReady();
    }

    function setSunDirection(v) { if (earthMat) earthMat.uniforms.sunDirection.value.copy(v); }
    function setNightIntensity(n) { state.nightIntensity = n; if (earthMat) earthMat.uniforms.nightIntensity.value = n; }
    function setShimmerColor(hex) { shimmerMat.uniforms.color.value.setHex(hex); }
    function tick(dt) {
      if (!state.ready) shimmerMat.uniforms.t.value += dt;
      if (cloudsMesh) cloudsMesh.rotation.y += dt * 0.006;
    }
    function dispose() {
      [texDay, texNight, texSpec, texClouds, texNormal].forEach(function (t) { if (t) t.dispose(); });
      if (earthMat) earthMat.dispose();
      if (cloudsMesh) cloudsMesh.geometry.dispose();
      shimmerMesh.geometry.dispose(); shimmerMat.dispose();
    }

    return {
      group: group, state: state,
      setSunDirection: setSunDirection, setNightIntensity: setNightIntensity,
      setShimmerColor: setShimmerColor, tick: tick, dispose: dispose,
    };
  }

  global.SOMNUS_EARTH = { create: create };
})(window);
