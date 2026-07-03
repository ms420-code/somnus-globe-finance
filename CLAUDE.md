# SOMNUS — Global Financial Command Center

Interactive 3D Earth for monitoring global financial markets: live exchange
sessions, country heatmaps, and resource layers in a futuristic WebGL command
center. Codename TERRA in the UI.

## Deployment — every push goes live

The site is published with GitHub Pages from the `main` branch (root).
**Anything pushed to `main` is live within ~a minute** at:

https://ms420-code.github.io/somnus-globe-finance/

Publish flow:
```
git add -A
git commit -m "describe the change"
git push
```

Because Pages serves from a subpath (`/somnus-globe-finance/`), never write
root-absolute asset paths (`/file.js`). Use relative paths (`./file.js`) or
full CDN URLs. Currently every dependency is a CDN URL, so there are no local
assets to break.

## Architecture

- **Single file**: `index.html` contains all CSS, JS, and mock data. No build
  step, no bundler, no framework — keep it that way.
- **Three.js r128** (classic script build) + OrbitControls from CDN.
- **Country geometry**: real Natural Earth borders via world-atlas TopoJSON
  from CDN, parsed with topojson-client. `GEO_RESOLUTION` is '110m'; swap to
  '50m' for finer borders (also makes Singapore/Hong Kong polygons exist).
- **Fills** are painted into an equirectangular canvas sampled by the globe
  shader (one texture = heatmap tint + hover lighten, zero extra meshes).
  **Borders** are ONE merged `THREE.LineSegments` — never one mesh per country.
- All data is embedded mock data; the header comment in `index.html` documents
  the API shape each block expects when a live backend replaces it.
- `.claude/serve.js` + `.claude/launch.json`: tiny dev static server on port
  8123 (macOS sandbox blocks Python's http.server). Dev-only, not part of the
  site.

## Visual identity — holographic night-mode, not realistic map

- Palette (CSS vars in `index.html`): background `#05070D`, green `#00FF88`,
  purple `#7B00FF`, red `#FF3B5C`, amber `#FFB000`, cyan `#00E5FF`.
  Borders are soft ice blue `rgba(180,220,255,…)`; land fill deep navy `#0A1020`.
- **No realistic textures** — no satellite imagery, no terrain, no roads.
  Clean vector borders + dark fills only. Monospace type, scanlines, glow.
- No country labels, state lines, or city detail unless explicitly requested.

## Conventions

- Confirm before anything destructive or history-rewriting; never force-push.
- Market heatmap matches countries by ISO code (`ISO_N3_TO_A2` maps
  world-atlas numeric ids → the alpha-2 codes used in `MARKET_DATA`).
