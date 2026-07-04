/* ============================================================================
   SOMNUS — globe command center (globe.html)
   Depends on THREE (r128), OrbitControls, topojson-client, and SOMNUS_DATA.
   ============================================================================ */
(function () {
  "use strict";

  const D = window.SOMNUS_DATA;
  const toast = (window.SOMNUS && window.SOMNUS.toast) || function (m) { console.warn(m); };
  const isSessionOpen = (window.SOMNUS && window.SOMNUS.isSessionOpen) || function () { return false; };
  const getTheme = (window.SOMNUS && window.SOMNUS.getTheme) || function () {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  };

  /* -------------------------------------------------------------- theme
     Every color the globe scene paints comes from this map so the light/dark
     toggle can re-skin the whole command center without rebuilding geometry. */
  const GLOBE_PALETTE = {
    dark: {
      // realistic deep-ocean blue (Apple Maps globe style) instead of a flat
      // near-black — day/night are the sunlit/shadow tones, deep/shallow
      // drive the disc-edge-darker, center-lighter depth shading in the
      // shader (see globeMat below). atmo is the outer atmosphere rim glow,
      // now a natural sky blue instead of neon — kept off the planet itself.
      clear: 0x05070D,
      day: 0x1B3A5C, night: 0x142C47, deep: 0x142C47, shallow: 0x2A4E75,
      atmo: 0x5AC8FA, atmoIntensity: 0.75,
      border: 0xB4DCFF, grid: 0x1f4a5e,
      landShades: [0x0A0F18, 0x0D131D, 0x101823, 0x131D29], landBase: 0x080C13,
      heatPosDim: 0x123322, heatNegDim: 0x331018, heatNegBright: 0xff3b5c,
      star1: 0xffffff, star2: 0x88aaff,
      hoverOverlay: "rgba(150,190,255,0.18)", highlight: 0xffffff,
      sessionOpen: 0x00ff88, sessionClosed: 0x445566,
      oil: 0xFFB000, pop: 0xB266FF, cityBeam: 0x00E5FF, cityDot: 0x00E5FF,
      tradeLine: 0x9B5CFF, tradePulse: 0x00ff88, legendClosed: "#445566",
    },
    light: {
      // lighter natural sea blue (same depth treatment as dark), warm
      // light gray-green land so it reads against the blue without going
      // realistic-textured (still flat vector fills per the site's style),
      // and a very faint atmosphere since it's daytime-UI, not "space."
      clear: 0xDCE4EE,
      day: 0xA8C4DC, night: 0x93B3D0, deep: 0x93B3D0, shallow: 0xBDD3E6,
      atmo: 0xCFE8FF, atmoIntensity: 0.18,
      border: 0x9AAABB, grid: 0x8FA6C0,
      landShades: [0xD8DFD0, 0xD2D9C9, 0xCCD3C2, 0xC6CDBB], landBase: 0xD8DFD0,
      heatPosDim: 0xBFE8D2, heatNegDim: 0xF3CBD3, heatNegBright: 0xD32B48,
      star1: 0x5C6B7E, star2: 0x7A8FAE,
      hoverOverlay: "rgba(20,40,70,0.16)", highlight: 0x0B1220,
      sessionOpen: 0x008045, sessionClosed: 0x7C8AA0,
      oil: 0x9E5F00, pop: 0x6A00E0, cityBeam: 0x007895, cityDot: 0x007895,
      tradeLine: 0x6A00E0, tradePulse: 0x008045, legendClosed: "#7C8AA0",
    },
  };
  let PAL = GLOBE_PALETTE[getTheme()];
  const hexCss = (n) => "#" + n.toString(16).padStart(6, "0");

  /* -------------------------------------------------------------- config */
  const GEO_RESOLUTION = "50m"; // finer coastlines than 110m; SG/HK exist here
  const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-" + GEO_RESOLUTION + ".json";
  const GLOBE_R = 5;
  const BORDER_R = GLOBE_R * 1.0015;
  const MAX_CONCURRENT = 2;   // heavy marker layers on at once
  const MAX_LABELS = 14;      // most name labels shown at once

  /* -------------------------------------------------------------- utils */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (id) => document.getElementById(id);

  function latLonToVec3(lat, lon, r) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }
  function vec3ToLatLon(p) {
    const r = p.length();
    const lat = 90 - Math.acos(clamp(p.y / r, -1, 1)) * 180 / Math.PI;
    let lon = Math.atan2(p.z, -p.x) * 180 / Math.PI - 180;
    if (lon < -180) lon += 360;
    return { lat, lon };
  }
  function makeCircleTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function makeGlowTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.4, "rgba(255,255,255,0.25)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  const circleTex = makeCircleTexture();
  const glowTex = makeGlowTexture();

  /* -------------------------------------------------------------- boot screen */
  const bootMsgs = [
    "INITIALIZING TERRA CORE...",
    "ESTABLISHING SATELLITE UPLINK...",
    "LOADING MARKET FEEDS [25 EXCHANGES]...",
    "LOADING COUNTRY GEOMETRY [NATURAL EARTH " + GEO_RESOLUTION.toUpperCase() + "]...",
    "SYNCING TIME ZONES // SESSION STATUS...",
    "MAPPING COMMODITY & TRADE VECTORS...",
    "RENDERING ATMOSPHERE...",
    "TERRA ONLINE.",
  ];
  let bootIdx = 0;
  const bootLinesEl = $("bootLines");
  const bootFillEl = $("bootFill");
  const GEO = { ready: false, failed: false };
  function bootStep() {
    if (bootIdx < bootMsgs.length) {
      if (bootIdx === bootMsgs.length - 1 && !(GEO.ready || GEO.failed)) {
        setTimeout(bootStep, 150); return;
      }
      const d = document.createElement("div");
      d.textContent = "> " + bootMsgs[bootIdx];
      bootLinesEl && bootLinesEl.appendChild(d);
      if (bootFillEl) bootFillEl.style.width = ((bootIdx + 1) / bootMsgs.length * 100) + "%";
      bootIdx++;
      setTimeout(bootStep, 240);
    } else {
      setTimeout(function () {
        const el = $("loading");
        if (!el) return;
        el.style.opacity = "0";
        setTimeout(function () { el.style.display = "none"; }, 800);
      }, 300);
    }
  }
  setTimeout(bootStep, 260);

  /* -------------------------------------------------------------- three setup */
  const canvas = $("globeCanvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(PAL.clear, 1); // deep space backdrop so the globe disc always reads

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 0, 13);
  scene.add(new THREE.AmbientLight(0x223344, 1.2));

  // starfield
  const starGroup = new THREE.Group(); scene.add(starGroup);
  function makeStars(count, spread, size, color) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = spread * (0.6 + Math.random() * 0.4);
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size, map: circleTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return new THREE.Points(geo, mat);
  }
  const stars1 = makeStars(1200, 400, 1.4, PAL.star1);
  const stars2 = makeStars(500, 700, 2.2, PAL.star2);
  starGroup.add(stars1); starGroup.add(stars2);

  // land fill texture (equirectangular, sampled by globe shader)
  const TEX_W = 2048, TEX_H = 1024;
  const landCanvas = document.createElement("canvas");
  landCanvas.width = TEX_W; landCanvas.height = TEX_H;
  const landCtx = landCanvas.getContext("2d");
  const landTexture = new THREE.CanvasTexture(landCanvas);
  landTexture.minFilter = THREE.LinearFilter;
  landTexture.generateMipmaps = false;

  const sunDir = new THREE.Vector3(1, 0, 0);
  const globeMat = new THREE.ShaderMaterial({
    uniforms: {
      sunDirection: { value: sunDir },
      dayColor: { value: new THREE.Color(PAL.day) },
      nightColor: { value: new THREE.Color(PAL.night) },
      deepColor: { value: new THREE.Color(PAL.deep) },
      shallowColor: { value: new THREE.Color(PAL.shallow) },
      landTex: { value: landTexture },
    },
    vertexShader:
      "varying vec3 vNormal; varying vec2 vUv;" +
      "void main(){ vNormal = normalize(normalMatrix * normal); vUv = uv;" +
      "gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "uniform vec3 sunDirection; uniform vec3 dayColor; uniform vec3 nightColor;" +
      "uniform vec3 deepColor; uniform vec3 shallowColor;" +
      "uniform sampler2D landTex; varying vec3 vNormal; varying vec2 vUv;" +
      "void main(){" +
      "  float ndotl = dot(normalize(vNormal), normalize(sunDirection));" +
      "  float mixF = smoothstep(-0.15, 0.15, ndotl);" +
      // camera-facing factor: ~1 at the center of the visible disc, ~0 at
      // the silhouette edge — stands in for real per-pixel depth/curvature
      // so the ocean isn't a flat color (darker rim, soft center highlight)
      "  float facing = clamp(dot(normalize(vNormal), vec3(0.0,0.0,1.0)), 0.0, 1.0);" +
      "  vec3 ocean = mix(nightColor, dayColor, mixF);" +
      "  ocean = mix(deepColor, ocean, pow(facing, 0.6));" +
      "  ocean = mix(ocean, shallowColor, pow(facing, 6.0) * mixF * 0.5);" +
      // faint specular sheen near the sub-solar highlight — real water has
      // a soft light response; keep the exponent high and the gain tiny
      "  float sheen = pow(facing, 40.0) * mixF;" +
      "  ocean += vec3(0.65, 0.78, 0.92) * sheen * 0.12;" +
      "  vec4 land = texture2D(landTex, vUv);" +
      "  vec3 landCol = land.rgb * mix(0.55, 1.25, mixF) + vec3(0.02,0.035,0.06);" +
      "  vec3 base = mix(ocean, landCol, land.a);" +
      "  gl_FragColor = vec4(base, 1.0);" +
      "}",
  });
  const globeCore = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R, 96, 96), globeMat);
  scene.add(globeCore);

  // subtle lat/lon grid
  const gridMat = new THREE.LineBasicMaterial({ color: PAL.grid, transparent: true, opacity: 0.18 });
  (function () {
    const g = new THREE.SphereGeometry(GLOBE_R * 1.001, 24, 16);
    const wire = new THREE.WireframeGeometry(g);
    scene.add(new THREE.LineSegments(wire, gridMat));
  })();

  // atmosphere — soft natural blue rim like Earth's real atmospheric limb
  // from space (dark theme); barely-there in light theme's daytime-UI look
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(PAL.atmo) },
      intensity: { value: PAL.atmoIntensity },
    },
    vertexShader:
      "varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal);" +
      "gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "uniform vec3 glowColor; uniform float intensity; varying vec3 vNormal;" +
      "void main(){ float i = pow(0.68 - dot(vNormal, vec3(0,0,1.0)), 3.0);" +
      "gl_FragColor = vec4(glowColor, clamp(i,0.0,1.0)*intensity); }",
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R * 1.12, 64, 64), atmoMat));

  /* -------------------------------------------------------------- country geometry */
  function heatColor(change) {
    const c = new THREE.Color();
    if (change >= 0) c.lerpColors(new THREE.Color(PAL.heatPosDim), new THREE.Color(PAL.sessionOpen), clamp(change / 3, 0, 1));
    else c.lerpColors(new THREE.Color(PAL.heatNegDim), new THREE.Color(PAL.heatNegBright), clamp(-change / 3, 0, 1));
    return c;
  }
  // 4 subtle land shade steps (all lighter than the dark ocean base — or
  // darker than the light ocean base, in light theme)
  let LAND_SHADES = PAL.landShades.map(hexCss);
  const countries = [];
  const marketByIso = {};
  D.MARKET_DATA.forEach((m) => { marketByIso[m.iso] = m; });
  let heatmapOn = true;
  let hoveredCountry = null;
  let baseImageData = null;

  const projX = (lon) => (lon + 180) / 360 * TEX_W;
  const projY = (lat) => (90 - lat) / 180 * TEX_H;

  function eachRing(geom, cb) {
    if (geom.type === "Polygon") geom.coordinates.forEach(cb);
    else if (geom.type === "MultiPolygon") geom.coordinates.forEach((poly) => poly.forEach(cb));
  }
  function pushSegments(out, a, b, r) {
    const steps = clamp(Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 0.8), 1, 64);
    let prev = latLonToVec3(a[1], a[0], r);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p = latLonToVec3(lerp(a[1], b[1], t), lerp(a[0], b[0], t), r);
      out.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      prev = p;
    }
  }

  const borderMat = new THREE.LineBasicMaterial({ color: PAL.border, transparent: true, opacity: 0.45, depthWrite: false });
  const borderGlowMat = new THREE.LineBasicMaterial({ color: PAL.border, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending });
  let borderLines = null, borderGlowLines = null;
  const highlightMat = new THREE.LineBasicMaterial({ color: PAL.highlight, transparent: true, opacity: 0.95, depthWrite: false });
  const highlightLines = new THREE.LineSegments(new THREE.BufferGeometry(), highlightMat);
  scene.add(highlightLines);

  function buildCountries(features) {
    features.forEach((f, idx) => {
      if (!f.geometry) return;
      const path = new Path2D();
      const rings = [];
      let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
      let bestRing = null, bestArea = -1;
      eachRing(f.geometry, (ring) => {
        rings.push(ring);
        // crude ring extent to pick a representative ring for the label anchor
        let rMinLon = 180, rMaxLon = -180, rMinLat = 90, rMaxLat = -90;
        ring.forEach((pt, i) => {
          if (pt[0] < minLon) minLon = pt[0]; if (pt[0] > maxLon) maxLon = pt[0];
          if (pt[1] < minLat) minLat = pt[1]; if (pt[1] > maxLat) maxLat = pt[1];
          if (pt[0] < rMinLon) rMinLon = pt[0]; if (pt[0] > rMaxLon) rMaxLon = pt[0];
          if (pt[1] < rMinLat) rMinLat = pt[1]; if (pt[1] > rMaxLat) rMaxLat = pt[1];
          if (i === 0) path.moveTo(projX(pt[0]), projY(pt[1]));
          else path.lineTo(projX(pt[0]), projY(pt[1]));
        });
        path.closePath();
        const area = (rMaxLon - rMinLon) * (rMaxLat - rMinLat);
        if (area > bestArea) { bestArea = area; bestRing = [(rMinLon + rMaxLon) / 2, (rMinLat + rMaxLat) / 2]; }
      });
      const iso = D.ISO_N3_TO_A2[String(f.id).padStart(3, "0")] || null;
      countries.push({
        name: f.properties.name, iso, rings, path,
        bbox: [minLon, minLat, maxLon, maxLat],
        centroid: bestRing || [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
        span: Math.max(maxLon - minLon, maxLat - minLat),
        shade: LAND_SHADES[idx % LAND_SHADES.length],
      });
    });
  }

  function buildBorderLines(mesh) {
    const verts = [];
    mesh.coordinates.forEach((line) => {
      for (let i = 0; i < line.length - 1; i++) pushSegments(verts, line[i], line[i + 1], BORDER_R);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
    borderGlowLines = new THREE.LineSegments(geo, borderGlowMat);
    borderLines = new THREE.LineSegments(geo, borderMat);
    scene.add(borderGlowLines); scene.add(borderLines);
  }

  function countryFillStyle(c) {
    if (heatmapOn && c.iso && marketByIso[c.iso]) {
      const fill = new THREE.Color(PAL.landBase).lerp(heatColor(marketByIso[c.iso].change), 0.6);
      return "rgba(" + Math.round(fill.r * 255) + "," + Math.round(fill.g * 255) + "," + Math.round(fill.b * 255) + ",0.9)";
    }
    return c.shade; // varied navy shade so neighbors read apart with no data on
  }
  function redrawLandTexture() {
    landCtx.clearRect(0, 0, TEX_W, TEX_H);
    countries.forEach((c) => { landCtx.fillStyle = countryFillStyle(c); landCtx.fill(c.path, "evenodd"); });
    baseImageData = landCtx.getImageData(0, 0, TEX_W, TEX_H);
    applyHoverOverlay();
  }
  function applyHoverOverlay() {
    if (!baseImageData) return;
    landCtx.putImageData(baseImageData, 0, 0);
    if (hoveredCountry) {
      landCtx.fillStyle = PAL.hoverOverlay;
      landCtx.fill(hoveredCountry.path, "evenodd");
    }
    landTexture.needsUpdate = true;
  }
  function setHeatmapOn(on) { heatmapOn = on; if (GEO.ready) redrawLandTexture(); }

  function pointInCountry(c, lon, lat) {
    const b = c.bbox;
    if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) return false;
    let inside = false;
    for (const ring of c.rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
      }
    }
    return inside;
  }
  function countryAt(lat, lon) {
    for (const c of countries) if (pointInCountry(c, lon, lat)) return c;
    return null;
  }
  function setHoveredCountry(c) {
    if (c === hoveredCountry) return;
    hoveredCountry = c;
    applyHoverOverlay();
    highlightLines.geometry.dispose();
    const geo = new THREE.BufferGeometry();
    if (c) {
      const verts = [];
      c.rings.forEach((ring) => { for (let i = 0; i < ring.length - 1; i++) pushSegments(verts, ring[i], ring[i + 1], GLOBE_R * 1.0025); });
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
    }
    highlightLines.geometry = geo;
  }

  /* -------------------------------------------------------------- markers */
  function makeGroup() { const g = new THREE.Group(); scene.add(g); return g; }
  const sessionsGroup = makeGroup(), oilGroup = makeGroup(), popGroup = makeGroup(),
        citiesGroup = makeGroup(), metalsGroup = makeGroup(), arcsGroup = makeGroup();
  const sessionMarkers = [], oilMarkers = [], cityMarkers = [], metalMarkers = [];
  const arcPulses = [];

  D.SESSIONS_DATA.forEach((s) => {
    const open = isSessionOpen(s);
    const pos = latLonToVec3(s.lat, s.lon, GLOBE_R * 1.01);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: open ? PAL.sessionOpen : PAL.sessionClosed, transparent: true, opacity: open ? 1 : 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.copy(pos); sprite.scale.set(open ? 0.55 : 0.3, open ? 0.55 : 0.3, 1);
    sessionsGroup.add(sprite);
    sessionMarkers.push({ mesh: sprite, data: s, type: "session", open });
  });

  const maxBpd = Math.max.apply(null, D.OIL_DATA.map((o) => o.bpd));
  D.OIL_DATA.forEach((o) => {
    const h = (o.bpd / maxBpd) * 1.6 + 0.15;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, h, 8), new THREE.MeshBasicMaterial({ color: PAL.oil, transparent: true, opacity: 0.85 }));
    const base = latLonToVec3(o.lat, o.lon, GLOBE_R * 1.001);
    const outward = base.clone().normalize();
    mesh.position.copy(base.clone().add(outward.clone().multiplyScalar(h / 2)));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
    oilGroup.add(mesh);
    oilMarkers.push({ mesh, data: o, type: "oil", anchor: base });
  });

  const popMarkers = [];
  D.POP_HEAT.forEach((p) => {
    const pos = latLonToVec3(p.lat, p.lon, GLOBE_R * 1.002);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: PAL.pop, transparent: true, opacity: 0.55 * p.intensity, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.copy(pos); const s = p.radius * 0.16; sprite.scale.set(s, s, 1);
    popGroup.add(sprite);
    popMarkers.push({ mesh: sprite, data: p });
  });

  const maxPop = Math.max.apply(null, D.CITIES_DATA.map((c) => c.pop));
  D.CITIES_DATA.forEach((c) => {
    const base = latLonToVec3(c.lat, c.lon, GLOBE_R * 1.001);
    const outward = base.clone().normalize();
    const beamH = 0.5 + (c.pop / maxPop) * 0.9;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, beamH, 6), new THREE.MeshBasicMaterial({ color: PAL.cityBeam, transparent: true, opacity: 0.55 }));
    beam.position.copy(base.clone().add(outward.clone().multiplyScalar(beamH / 2)));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
    citiesGroup.add(beam);
    const dotSize = 0.05 + (c.pop / maxPop) * 0.09;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: circleTex, color: PAL.cityDot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.copy(base.clone().add(outward.clone().multiplyScalar(beamH)));
    sprite.scale.set(dotSize, dotSize, 1);
    citiesGroup.add(sprite);
    cityMarkers.push({ mesh: sprite, data: c, type: "city", anchor: base, beam });
  });

  D.METALS_DATA.forEach((m) => {
    const pos = latLonToVec3(m.lat, m.lon, GLOBE_R * 1.006);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: circleTex, color: D.METAL_COLORS[m.metal], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.copy(pos); sprite.scale.set(0.14, 0.14, 1);
    metalsGroup.add(sprite);
    metalMarkers.push({ mesh: sprite, data: m, type: "metal", anchor: pos });
  });

  const tradeLines = [];
  D.TRADE_ROUTES.forEach((r) => {
    const a = latLonToVec3(r.from[0], r.from[1], GLOBE_R * 1.01);
    const b = latLonToVec3(r.to[0], r.to[1], GLOBE_R * 1.01);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dist = a.distanceTo(b);
    mid.normalize().multiplyScalar(GLOBE_R * 1.01 + dist * 0.35);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
    const lineMat = new THREE.LineBasicMaterial({ color: PAL.tradeLine, transparent: true, opacity: 0.4 });
    arcsGroup.add(new THREE.Line(geo, lineMat));
    tradeLines.push(lineMat);
    const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: PAL.tradePulse, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pulse.scale.set(0.22, 0.22, 1);
    arcsGroup.add(pulse);
    arcPulses.push({ curve, pulse, t: Math.random() });
  });

  // additively-blended sprites wash out on a light ocean; flip them to
  // normal blending (and a touch more opacity) when the light theme is on
  const additiveSprites = []
    .concat(sessionMarkers.map((m) => ({ mat: m.mesh.material, baseOpacity: m.mesh.material.opacity })))
    .concat(popMarkers.map((m) => ({ mat: m.mesh.material, baseOpacity: m.mesh.material.opacity })))
    .concat(cityMarkers.map((m) => ({ mat: m.mesh.material, baseOpacity: m.mesh.material.opacity })))
    .concat(metalMarkers.map((m) => ({ mat: m.mesh.material, baseOpacity: m.mesh.material.opacity })))
    .concat(arcPulses.map((p) => ({ mat: p.pulse.material, baseOpacity: p.pulse.material.opacity })));

  /* -------------------------------------------------------------- layer system (cross-fade + cap) */
  const LAYERS = [
    { key: "heat",     name: "Market Heatmap",  sub: "25 major indices",        group: null,          on: true,  heavy: false },
    { key: "sessions", name: "Market Sessions", sub: "live open/closed",        group: sessionsGroup, on: true,  heavy: true },
    { key: "oil",      name: "Oil",             sub: "top producing regions",   group: oilGroup,      on: false, heavy: true },
    { key: "pop",      name: "Population",      sub: "density heat",            group: popGroup,      on: false, heavy: true },
    { key: "cities",   name: "Mega-Cities",     sub: "top 20 by population",    group: citiesGroup,   on: false, heavy: true },
    { key: "metals",   name: "Metals & Mining", sub: "gold/copper/lithium/REE", group: metalsGroup,   on: false, heavy: true },
    { key: "trade",    name: "Trade Arcs",      sub: "major shipping lanes",    group: arcsGroup,     on: false, heavy: true },
  ];
  const fades = {}; // key -> {target, cur}
  LAYERS.forEach((L) => {
    if (L.group) {
      L.group.visible = L.on;
      fades[L.key] = { target: L.on ? 1 : 0, cur: L.on ? 1 : 0 };
      setGroupOpacity(L.group, fades[L.key].cur);
    }
  });
  function setGroupOpacity(group, o) {
    group.traverse((obj) => {
      if (obj.material && "opacity" in obj.material) {
        if (obj.userData.baseOpacity === undefined) obj.userData.baseOpacity = obj.material.opacity;
        obj.material.opacity = obj.userData.baseOpacity * o;
      }
    });
  }
  function heavyOnCount() { return LAYERS.filter((l) => l.heavy && l.on).length; }

  const layerListEl = $("layerList");
  function renderLayerList() {
    if (!layerListEl) return;
    const capped = heavyOnCount() >= MAX_CONCURRENT;
    layerListEl.innerHTML = LAYERS.map((L, i) => {
      const locked = L.heavy && !L.on && capped;
      return '<div class="layerRow' + (locked ? " locked" : "") + '">' +
        '<div class="lbl"><div class="lname">' + (i + 1) + ". " + L.name + "</div>" +
        '<div class="k">' + L.sub + "</div></div>" +
        '<button class="switch ' + (L.on ? "on" : "") + '" data-key="' + L.key + '"' +
        (locked ? " disabled" : "") + ' role="switch" aria-checked="' + L.on + '"' +
        ' aria-label="Toggle ' + L.name + '"><span class="knob"></span></button></div>';
    }).join("") + (capped ? '<div class="cap-hint">Max ' + MAX_CONCURRENT + " data layers — turn one off to enable others</div>" : "");
  }
  function toggleLayer(key) {
    const L = LAYERS.find((l) => l.key === key);
    if (!L) return;
    if (L.heavy && !L.on && heavyOnCount() >= MAX_CONCURRENT) {
      toast("Max " + MAX_CONCURRENT + " data layers at once");
      return;
    }
    L.on = !L.on;
    if (key === "heat") setHeatmapOn(L.on);
    else if (L.group) { fades[key].target = L.on ? 1 : 0; if (L.on) L.group.visible = true; }
    renderLayerList();
    updateLegend();
  }
  if (layerListEl) {
    renderLayerList();
    layerListEl.addEventListener("click", (e) => {
      const sw = e.target.closest(".switch");
      if (sw && !sw.disabled) toggleLayer(sw.dataset.key);
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    const map = { "1": "heat", "2": "sessions", "3": "oil", "4": "pop", "5": "cities", "6": "metals", "7": "trade" };
    if (map[e.key]) toggleLayer(map[e.key]);
    if (e.key === "r" || e.key === "R") resetView();
    if (e.key === "Escape") closeProfile();
  });

  const legendEl = $("legend");
  function updateLegend() {
    if (!legendEl) return;
    const rows = [];
    if (LAYERS.find((l) => l.key === "metals").on) {
      Object.entries(D.METAL_COLORS).forEach(([k, c]) => {
        rows.push('<div class="row"><span class="sw" style="background:#' + c.toString(16).padStart(6, "0") + '"></span>' + k + "</div>");
      });
    }
    if (LAYERS.find((l) => l.key === "sessions").on) {
      rows.push('<div class="row"><span class="sw" style="background:var(--green)"></span>session open</div>');
      rows.push('<div class="row"><span class="sw" style="background:' + PAL.legendClosed + '"></span>session closed</div>');
    }
    if (LAYERS.find((l) => l.key === "heat").on) {
      rows.push('<div class="row"><span class="sw" style="background:var(--green)"></span>index up</div>');
      rows.push('<div class="row"><span class="sw" style="background:var(--red)"></span>index down</div>');
    }
    legendEl.innerHTML = rows.join("");
    legendEl.style.display = rows.length ? "flex" : "none";
  }
  updateLegend();

  /* -------------------------------------------------------------- controls */
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.5;
  controls.minDistance = 6.6;
  controls.maxDistance = 34; // headroom so the globe can fit narrow/portrait viewports
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.32;
  let idleTimer = null;
  let autoRotateWanted = true;
  controls.addEventListener("start", () => { controls.autoRotate = false; zoomTarget = null; if (idleTimer) clearTimeout(idleTimer); });
  controls.addEventListener("end", () => { idleTimer = setTimeout(() => { if (autoRotateWanted) controls.autoRotate = true; }, 4000); });

  // frame the globe so it fits the viewport — pull back on narrow/portrait
  // screens where the horizontal field of view is the limiting dimension
  // Immersive framing: keep the globe filling the viewport (edges may crop on
  // narrow/portrait screens — you drag to explore, like Google Earth) rather
  // than shrinking it to fit. Desktop stays at the tuned 13; portrait pulls
  // back just enough that the globe never overflows to near-invisibility.
  function fitDistance() {
    const aspect = window.innerWidth / window.innerHeight;
    const vFov = camera.fov * Math.PI / 180;
    const need = GLOBE_R * 0.82;
    const distH = need / Math.tan(Math.atan(Math.tan(vFov / 2) * aspect));
    return clamp(Math.max(13, distH), controls.minDistance, controls.maxDistance);
  }
  const DEFAULT_CAM = new THREE.Vector3(0, 0, 13);
  let lastPortrait = window.innerHeight > window.innerWidth;
  function reframe() {
    const d = fitDistance();
    DEFAULT_CAM.setLength(d);
    camera.position.setLength(d);
  }
  function animateCameraTo(destCam, destTarget, dur, done) {
    const start = camera.position.clone();
    const startTarget = controls.target.clone();
    const t0 = performance.now();
    (function step() {
      const t = clamp((performance.now() - t0) / dur, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(start, destCam, e);
      if (destTarget) controls.target.lerpVectors(startTarget, destTarget, e);
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    })();
  }
  function resetView() {
    controls.autoRotate = false;
    zoomTarget = null;
    animateCameraTo(DEFAULT_CAM, new THREE.Vector3(0, 0, 0), 900, () => {
      idleTimer = setTimeout(() => { if (autoRotateWanted) controls.autoRotate = true; }, 4000);
    });
  }
  function flyTo(targetPos, dist) {
    controls.autoRotate = false;
    zoomTarget = null;
    if (idleTimer) clearTimeout(idleTimer);
    const dir = targetPos.clone().normalize();
    animateCameraTo(dir.multiplyScalar(dist || 8.6), new THREE.Vector3(0, 0, 0), 1050, () => {
      idleTimer = setTimeout(() => { if (autoRotateWanted) controls.autoRotate = true; }, 5000);
    });
  }
  // zoom is eased in the main render loop (see animate) — driving OrbitControls'
  // radius directly there is more reliable than a competing rAF animation
  let zoomTarget = null;
  function zoomBy(factor) {
    const cur = zoomTarget != null ? zoomTarget : camera.position.length();
    zoomTarget = clamp(cur * factor, controls.minDistance, controls.maxDistance);
  }

  // view control buttons
  const bind = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
  bind("resetBtn", resetView);
  bind("vcReset", resetView);
  bind("vcZoomIn", () => zoomBy(0.8));
  bind("vcZoomOut", () => zoomBy(1.25));
  bind("vcRotate", (e) => {
    autoRotateWanted = !autoRotateWanted;
    controls.autoRotate = autoRotateWanted;
    const btn = $("vcRotate");
    if (btn) { btn.classList.toggle("active", autoRotateWanted); btn.setAttribute("aria-pressed", String(autoRotateWanted)); }
  });
  bind("vcFull", () => {
    const app = $("app");
    if (!document.fullscreenElement) (app.requestFullscreen || app.webkitRequestFullscreen || function () {}).call(app);
    else document.exitFullscreen();
  });
  // panel collapse
  bind("panelCollapse", () => {
    const p = $("layerPanel");
    if (p) p.classList.toggle("collapsed");
  });

  // search
  const searchInput = $("countrySearch");
  const searchResults = $("searchResults");
  function runSearch(q) {
    if (!searchResults) return;
    q = q.trim().toLowerCase();
    if (!q) { searchResults.style.display = "none"; return; }
    const scored = countries
      .map((c) => {
        const n = c.name.toLowerCase();
        let s = -1;
        if (n === q) s = 3; else if (n.startsWith(q)) s = 2; else if (n.indexOf(q) >= 0) s = 1;
        return { c, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.c.name.length - b.c.name.length)
      .slice(0, 6);
    if (!scored.length) { searchResults.innerHTML = '<div class="sr-empty">No match</div>'; searchResults.style.display = "block"; return; }
    searchResults.innerHTML = scored.map((x) => '<div class="sr-item" data-name="' + x.c.name.replace(/"/g, "&quot;") + '">' + x.c.name + "</div>").join("");
    searchResults.style.display = "block";
  }
  function flyToCountry(c) {
    const pos = latLonToVec3(c.centroid[1], c.centroid[0], GLOBE_R);
    flyTo(pos, 8.2);
    setHoveredCountry(c);
    setTimeout(() => { if (hoveredCountry === c) setHoveredCountry(null); }, 2600);
  }
  if (searchInput) {
    searchInput.addEventListener("input", () => runSearch(searchInput.value));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = searchResults && searchResults.querySelector(".sr-item");
        if (first) { const c = countries.find((x) => x.name === first.dataset.name); if (c) { flyToCountry(c); searchResults.style.display = "none"; searchInput.blur(); } }
      }
    });
    searchResults && searchResults.addEventListener("click", (e) => {
      const it = e.target.closest(".sr-item");
      if (it) { const c = countries.find((x) => x.name === it.dataset.name); if (c) { flyToCountry(c); searchResults.style.display = "none"; searchInput.value = c.name; } }
    });
    document.addEventListener("click", (e) => { if (searchResults && !e.target.closest(".search-box")) searchResults.style.display = "none"; });
  }

  /* -------------------------------------------------------------- picking: hover + click */
  const raycaster = new THREE.Raycaster();
  raycaster.params.Sprite = { threshold: 0.15 };
  const mouse = new THREE.Vector2();
  const tooltip = $("tooltip");

  function visibleMarkers() {
    const on = (key) => LAYERS.find((l) => l.key === key).on;
    const out = [];
    if (on("sessions")) out.push.apply(out, sessionMarkers);
    if (on("oil")) out.push.apply(out, oilMarkers);
    if (on("cities")) out.push.apply(out, cityMarkers);
    if (on("metals")) out.push.apply(out, metalMarkers);
    // only markers currently facing the camera are pickable (occlusion)
    return out.filter((m) => facingCamera(m.anchor || m.mesh.position));
  }
  function facingCamera(worldPos) {
    const camDir = camera.position.clone().normalize();
    return worldPos.clone().normalize().dot(camDir) > 0.12;
  }

  function onMove(clientX, clientY) {
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const markers = visibleMarkers();
    const hits = raycaster.intersectObjects(markers.map((m) => m.mesh));
    if (hits.length) {
      const hit = markers.find((m) => m.mesh === hits[0].object);
      setHoveredCountry(null);
      showMarkerTooltip(hit, clientX, clientY);
      canvas.style.cursor = "pointer";
      return;
    }
    let c = null;
    const gHits = raycaster.intersectObject(globeCore);
    if (gHits.length) { const ll = vec3ToLatLon(gHits[0].point); c = countryAt(ll.lat, ll.lon); }
    setHoveredCountry(c);
    if (c) showCountryTooltip(c, clientX, clientY);
    else if (tooltip) tooltip.style.display = "none";
    canvas.style.cursor = c ? "pointer" : "grab";
  }
  renderer.domElement.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
  renderer.domElement.addEventListener("click", () => {
    raycaster.setFromCamera(mouse, camera);
    const markers = visibleMarkers();
    const hits = raycaster.intersectObjects(markers.map((m) => m.mesh));
    if (hits.length) {
      const hit = markers.find((m) => m.mesh === hits[0].object);
      openMarkerProfile(hit);
      flyTo(hit.mesh.position.clone());
      return;
    }
    const gHits = raycaster.intersectObject(globeCore);
    if (gHits.length) {
      const ll = vec3ToLatLon(gHits[0].point);
      const c = countryAt(ll.lat, ll.lon);
      if (c) { openCountryProfile(c); flyToCountry(c); }
    }
  });

  function placeTooltip(html, x, y) {
    if (!tooltip) return;
    tooltip.innerHTML = html;
    tooltip.style.display = "block";
    const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    let left = x + 16, top = y + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 16;
    if (top + h > window.innerHeight - 8) top = y - h - 14;
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }
  function showCountryTooltip(c, x, y) {
    const mk = c.iso ? marketByIso[c.iso] : null;
    let html = '<div class="t-title">' + c.name + "</div>";
    if (mk) { const up = mk.change >= 0; html += '<div class="t-row"><span>' + mk.name + '</span><span style="color:' + (up ? "var(--green)" : "var(--red)") + '">' + (up ? "+" : "") + mk.change.toFixed(2) + "%</span></div>"; }
    placeTooltip(html, x, y);
  }
  function showMarkerTooltip(hit, x, y) {
    const d = hit.data; let html = "";
    if (hit.type === "session") html = '<div class="t-title">' + d.name + " — " + d.city + '</div><div class="t-row"><span>Status</span><span style="color:' + (hit.open ? "var(--green)" : "var(--red)") + '">' + (hit.open ? "OPEN" : "CLOSED") + "</span></div>";
    else if (hit.type === "oil") html = '<div class="t-title">' + d.name + '</div><div class="t-row"><span>Production</span><span>' + d.bpd.toFixed(1) + "M bpd</span></div>";
    else if (hit.type === "city") html = '<div class="t-title">' + d.name + '</div><div class="t-row"><span>Population</span><span>' + d.pop.toFixed(1) + "M</span></div>";
    else if (hit.type === "metal") html = '<div class="t-title">' + d.name + '</div><div class="t-row"><span>Resource</span><span>' + d.metal + "</span></div>";
    placeTooltip(html, x, y);
  }

  /* -------------------------------------------------------------- detail panel */
  const profilePanel = $("profilePanel");
  const profileBody = $("profileBody");
  function closeProfile() { if (profilePanel) profilePanel.classList.remove("show"); }
  bind("profileClose", closeProfile);
  function nearestMarket(lat, lon) {
    let best = null, bd = 1e9;
    D.MARKET_DATA.forEach((m) => { const dd = Math.pow(m.lat - lat, 2) + Math.pow(((m.lon - lon + 540) % 360) - 180, 2); if (dd < bd) { bd = dd; best = m; } });
    return best;
  }
  function renderProfile(title, sub, rows, tags) {
    if (!profileBody) return;
    profileBody.innerHTML =
      "<h2>" + title + "</h2>" +
      '<div class="sub">' + sub + "</div>" +
      rows.map((r) => '<div class="statRow"><span class="k">' + r[0] + '</span><span class="v ' + (r[2] ? "neg" : "") + '">' + r[1] + "</span></div>").join("") +
      (tags && tags.length ? '<div class="resList">' + tags.map((t) => '<span class="tag">' + t + "</span>").join("") + "</div>" : "");
    profilePanel.classList.add("show");
  }
  function openCountryProfile(c) {
    const mk = c.iso ? marketByIso[c.iso] : nearestMarket(c.centroid[1], c.centroid[0]);
    const city = D.CITIES_DATA.slice().sort((a, b) => dist2(a, c) - dist2(b, c))[0];
    const metals = D.METALS_DATA.filter((m) => m.name.toLowerCase().indexOf(c.name.toLowerCase()) >= 0).map((m) => m.metal);
    const rows = [
      ["Primary Index", mk ? mk.name : "—", false],
      ["Index Level", mk ? mk.value : "—", false],
      ["Daily Change", mk ? (mk.change >= 0 ? "+" : "") + mk.change.toFixed(2) + "%" : "—", mk && mk.change < 0],
      ["Nearest Mega-City", city ? city.name + " (" + city.pop.toFixed(1) + "M)" : "—", false],
    ];
    renderProfile(c.name, c.iso ? "TRACKED MARKET · " + c.iso : "COUNTRY", rows, Array.from(new Set(metals)));
  }
  function dist2(cityLike, c) { return Math.pow(cityLike.lat - c.centroid[1], 2) + Math.pow(cityLike.lon - c.centroid[0], 2); }
  function openMarkerProfile(hit) {
    const d = hit.data;
    if (hit.type === "session") {
      const mk = nearestMarket(d.lat, d.lon);
      renderProfile(d.name + " — " + d.city, "EXCHANGE", [
        ["Status", hit.open ? "OPEN" : "CLOSED", !hit.open],
        ["Local Hours", d.open + ":00 – " + d.close + ":00", false],
        ["Nearby Index", mk ? mk.name : "—", false],
        ["Daily Change", mk ? (mk.change >= 0 ? "+" : "") + mk.change.toFixed(2) + "%" : "—", mk && mk.change < 0],
      ]);
    } else if (hit.type === "oil") {
      renderProfile(d.name, "OIL PRODUCTION", [["Production", d.bpd.toFixed(1) + "M bpd", false], ["Type", "Crude Oil Reserve", false]]);
    } else if (hit.type === "city") {
      const mk = nearestMarket(d.lat, d.lon);
      renderProfile(d.name, "MEGA-CITY", [["Population", d.pop.toFixed(1) + "M", false], ["Region Index", mk ? mk.name : "—", false], ["Index Change", mk ? (mk.change >= 0 ? "+" : "") + mk.change.toFixed(2) + "%" : "—", mk && mk.change < 0]]);
    } else if (hit.type === "metal") {
      renderProfile(d.name, "MINING", [["Resource", d.metal, false], ["Classification", "Major Production Zone", false]], [d.metal]);
    }
  }

  /* -------------------------------------------------------------- country name labels (HTML overlay, zoom-gated, collision-capped) */
  const labelLayer = $("countryLabels");
  function updateLabels() {
    if (!labelLayer || !GEO.ready) return;
    const dist = camera.position.length();
    // fade in only once zoomed past ~country level; nothing at full-planet view
    // (default camera distance is 13; labels stay hidden until ~11.5)
    const zoomVis = clamp((11.5 - dist) / (11.5 - 7.5), 0, 1);
    if (zoomVis <= 0.02) { labelLayer.style.display = "none"; return; }
    labelLayer.style.display = "block";
    const camDir = camera.position.clone().normalize();
    // candidates: countries facing camera, prefer larger + tracked, closest to front
    const cand = [];
    for (const c of countries) {
      const v = latLonToVec3(c.centroid[1], c.centroid[0], GLOBE_R * 1.02);
      const facing = v.clone().normalize().dot(camDir);
      if (facing < 0.25) continue;
      const p = v.clone().project(camera);
      if (p.z > 1) continue;
      const x = (p.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
      cand.push({ c, x, y, facing, weight: facing + (c.iso ? 0.4 : 0) + c.span * 0.01 });
    }
    cand.sort((a, b) => b.weight - a.weight);
    // collision cull: drop labels whose screen box overlaps a kept one
    const kept = [];
    for (const it of cand) {
      if (kept.length >= MAX_LABELS) break;
      let ok = true;
      for (const k of kept) { if (Math.abs(k.x - it.x) < 92 && Math.abs(k.y - it.y) < 22) { ok = false; break; } }
      if (ok) kept.push(it);
    }
    const keptNames = new Set(kept.map((k) => k.c.name));
    // reconcile DOM label pool
    labelLayer.querySelectorAll(".c-label").forEach((el) => { if (!keptNames.has(el.dataset.name)) el.remove(); });
    kept.forEach((it) => {
      let el = labelLayer.querySelector('.c-label[data-name="' + CSS.escape(it.c.name) + '"]');
      if (!el) {
        el = document.createElement("div");
        el.className = "c-label";
        el.dataset.name = it.c.name;
        el.textContent = it.c.name;
        if (it.c.iso) el.classList.add("tracked");
        labelLayer.appendChild(el);
      }
      el.style.transform = "translate(-50%,-50%) translate(" + Math.round(it.x) + "px," + Math.round(it.y) + "px)";
      el.style.opacity = String(zoomVis * clamp((it.facing - 0.25) / 0.4, 0.2, 1));
    });
  }

  /* -------------------------------------------------------------- clocks + sun */
  const CLOCKS = [
    { city: "NEW YORK", tz: "America/New_York", session: D.SESSIONS_DATA[0] },
    { city: "LONDON", tz: "Europe/London", session: D.SESSIONS_DATA[1] },
    { city: "TOKYO", tz: "Asia/Tokyo", session: D.SESSIONS_DATA[3] },
    { city: "SYDNEY", tz: "Australia/Sydney", session: D.SESSIONS_DATA[5] },
  ];
  const clocksEl = $("clocks");
  if (clocksEl) {
    CLOCKS.forEach((c) => {
      const div = document.createElement("div");
      div.className = "clock";
      div.innerHTML = '<div class="city">' + c.city + '</div><div class="time" data-tz="' + c.tz + '">--:--</div><div class="pill" data-session="' + c.city + '">--</div>';
      clocksEl.appendChild(div);
    });
  }
  function updateClocks() {
    const now = new Date();
    const utc = $("utcTime"); if (utc) utc.textContent = now.toISOString().substr(11, 8);
    if (clocksEl) {
      clocksEl.querySelectorAll(".time").forEach((el) => { el.textContent = new Intl.DateTimeFormat("en-GB", { timeZone: el.dataset.tz, hour: "2-digit", minute: "2-digit" }).format(now); });
      CLOCKS.forEach((c) => {
        const open = isSessionOpen(c.session);
        const pillEl = clocksEl.querySelector('.pill[data-session="' + c.city + '"]');
        if (pillEl) { pillEl.textContent = open ? "OPEN" : "CLOSED"; pillEl.className = "pill " + (open ? "open" : "closed"); }
      });
    }
  }
  updateClocks(); setInterval(updateClocks, 1000);

  function updateSun() {
    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(Date.UTC(now.getUTCFullYear(), 0, 0))) / 86400000);
    const decl = -23.44 * Math.cos(2 * Math.PI / 365 * (dayOfYear + 10));
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
    const subLon = (12 - utcH) * 15;
    sunDir.copy(latLonToVec3(decl, subLon, 1));
  }
  updateSun(); setInterval(updateSun, 60000);

  /* -------------------------------------------------------------- ticker (pause on hover, click to fly) */
  const tickerEl = $("ticker");
  if (tickerEl) {
    const items = D.TICKER_DATA.concat(D.TICKER_DATA);
    tickerEl.innerHTML = items.map((t) => {
      const up = t.chg >= 0;
      return '<button class="tItem"' + (t.iso ? ' data-iso="' + t.iso + '"' : "") + '><span class="sym">' + t.sym + '</span><span class="val">' + t.val + '</span><span class="chg ' + (up ? "up" : "down") + '">' + (up ? "+" : "") + t.chg.toFixed(2) + "%</span></button>";
    }).join("");
    const wrap = $("tickerWrap");
    if (wrap) {
      wrap.addEventListener("mouseenter", () => { tickerEl.style.animationPlayState = "paused"; });
      wrap.addEventListener("mouseleave", () => { tickerEl.style.animationPlayState = "running"; });
    }
    tickerEl.addEventListener("click", (e) => {
      const it = e.target.closest(".tItem");
      if (!it || !it.dataset.iso) return;
      const mk = marketByIso[it.dataset.iso];
      if (mk) { flyTo(latLonToVec3(mk.lat, mk.lon, GLOBE_R), 8.2); const c = countries.find((x) => x.iso === mk.iso); if (c) openCountryProfile(c); }
    });
  }

  /* -------------------------------------------------------------- theme switching (re-skins live scene) */
  function applyGlobeTheme(themeName) {
    PAL = GLOBE_PALETTE[themeName] || GLOBE_PALETTE.dark;
    renderer.setClearColor(PAL.clear, 1);
    globeMat.uniforms.dayColor.value.setHex(PAL.day);
    globeMat.uniforms.nightColor.value.setHex(PAL.night);
    globeMat.uniforms.deepColor.value.setHex(PAL.deep);
    globeMat.uniforms.shallowColor.value.setHex(PAL.shallow);
    atmoMat.uniforms.glowColor.value.setHex(PAL.atmo);
    atmoMat.uniforms.intensity.value = PAL.atmoIntensity;
    gridMat.color.setHex(PAL.grid);
    borderMat.color.setHex(PAL.border);
    borderGlowMat.color.setHex(PAL.border);
    highlightMat.color.setHex(PAL.highlight);
    stars1.material.color.setHex(PAL.star1);
    stars2.material.color.setHex(PAL.star2);

    LAND_SHADES = PAL.landShades.map(hexCss);
    countries.forEach((c, idx) => { c.shade = LAND_SHADES[idx % LAND_SHADES.length]; });
    if (GEO.ready) redrawLandTexture();

    // additive glow sprites wash out over a light ocean — swap to normal
    // blending (with a floor on opacity) whenever the light theme is active
    const isLight = themeName === "light";
    const blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
    additiveSprites.forEach((s) => {
      s.mat.blending = blending;
      s.mat.opacity = isLight ? Math.max(s.baseOpacity, 0.85) : s.baseOpacity;
      s.mat.needsUpdate = true;
    });
    sessionMarkers.forEach((m) => m.mesh.material.color.setHex(m.open ? PAL.sessionOpen : PAL.sessionClosed));
    oilMarkers.forEach((m) => m.mesh.material.color.setHex(PAL.oil));
    popMarkers.forEach((m) => m.mesh.material.color.setHex(PAL.pop));
    cityMarkers.forEach((m) => { m.mesh.material.color.setHex(PAL.cityDot); if (m.beam) m.beam.material.color.setHex(PAL.cityBeam); });
    tradeLines.forEach((mat) => mat.color.setHex(PAL.tradeLine));
    arcPulses.forEach((p) => p.pulse.material.color.setHex(PAL.tradePulse));

    updateLegend();
  }
  window.addEventListener("somnus-theme-change", (e) => applyGlobeTheme(e.detail.theme));

  /* -------------------------------------------------------------- geometry load (graceful) */
  (async function loadCountryGeometry() {
    try {
      const res = await fetch(GEO_URL);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const topo = await res.json();
      buildCountries(topojson.feature(topo, topo.objects.countries).features);
      buildBorderLines(topojson.mesh(topo, topo.objects.countries));
      redrawLandTexture();
      GEO.ready = true;
    } catch (err) {
      console.warn("SOMNUS: country geometry failed to load.", err);
      GEO.failed = true;
      toast("Country geometry failed to load — globe running without borders.", true);
    }
  })();

  /* -------------------------------------------------------------- resize + render loop */
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // re-fit when the viewport flips between portrait and landscape
    const portrait = window.innerHeight > window.innerWidth;
    if (portrait !== lastPortrait) { lastPortrait = portrait; reframe(); }
  });
  reframe(); // initial framing
  window.__dbg = { dist: () => camera.position.length() };

  let paused = false;
  document.addEventListener("visibilitychange", () => { paused = document.hidden; if (!paused) clock.getDelta(); });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    if (paused) return;
    const dt = clock.getDelta();
    const t = clock.getElapsedTime();

    controls.update();
    starGroup.rotation.y += 0.00006;

    // eased zoom (from +/- buttons) — applied after controls.update so it wins
    if (zoomTarget != null) {
      const cur = camera.position.length();
      const nd = lerp(cur, zoomTarget, clamp(dt * 7, 0, 1));
      camera.position.setLength(nd);
      if (Math.abs(nd - zoomTarget) < 0.02) zoomTarget = null;
    }

    // border opacity eases up when zoomed in
    if (borderLines) {
      const zoomT = clamp((controls.maxDistance - camera.position.length()) / (controls.maxDistance - controls.minDistance), 0, 1);
      borderMat.opacity = lerp(0.42, 0.62, zoomT);
      borderGlowMat.opacity = lerp(0.12, 0.22, zoomT);
    }

    // layer cross-fades + hide fully-faded groups
    LAYERS.forEach((L) => {
      if (!L.group) return;
      const f = fades[L.key];
      if (Math.abs(f.cur - f.target) > 0.001) {
        f.cur += (f.target - f.cur) * clamp(dt * 8, 0, 1);
        if (Math.abs(f.cur - f.target) <= 0.005) f.cur = f.target;
        setGroupOpacity(L.group, f.cur);
        if (f.cur <= 0.001) L.group.visible = false;
      }
    });

    // marker occlusion — hide anything on the far side of the globe
    const camDir = camera.position.clone().normalize();
    [sessionMarkers, oilMarkers, cityMarkers, metalMarkers].forEach((arr) => {
      arr.forEach((m) => {
        const facing = (m.anchor || m.mesh.position).clone().normalize().dot(camDir) > 0.02;
        m.mesh.visible = facing;
        if (m.beam) m.beam.visible = facing;
      });
    });

    // session beacon pulse
    sessionMarkers.forEach((m, i) => { if (m.open && m.mesh.visible) { const s = 0.5 + Math.sin(t * 2.4 + i) * 0.08; m.mesh.scale.set(s, s, 1); } });
    // trade arc pulses
    arcPulses.forEach((p) => { p.t += dt * 0.18; if (p.t > 1) p.t = 0; p.pulse.position.copy(p.curve.getPoint(p.t)); });

    updateLabels();
    renderer.render(scene, camera);
  }
  animate();
})();
