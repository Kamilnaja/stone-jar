# Stone Jar — AGENTS.md

## What this is

A vanilla JS browser extension (Manifest V3) — a physics-simulated stone jar. No build step, no dependencies, no package.json.

## Entrypoints

- `manifest.json` — extension config, declares `"storage"` permission, popup = `index.html`
- `index.html` — loads `style.css` and `script.js` directly (no bundler)
- `script.js` — all logic: canvas physics, localStorage + browser.storage.sync persistence, DOM event wiring

## How to run

- **Dev (browser)**: load `index.html` directly via `file://` or a local server. No build needed.
- **Extension**: load `manifest.json` as an unpacked extension in Chrome/Firefox.
- **No tests, no linter, no typechecker** — there is no CI or test infrastructure.

## Project structure

```
index.html        — popup HTML shell
script.js         — all application logic (~434 lines, no modules)
style.css         — all styles
manifest.json     — MV3 extension manifest
icons/            — SVG icons (16, 48, 96)
AGENTS.md         — this file
```

## Persistence

- Uses `browser.storage.sync` (WebExtensions) with fallback to `localStorage`.
- Key: `"stonejar_data"`.
- State auto-saves when stones settle; loads on startup.

## Key logic

- Physics loop: `requestAnimationFrame`, gravity/ collision / settling detection (substep: `SUBS = 6`)
- Date → color via golden-angle hue rotation (`dateToHue` uses `dayCount * 137.508 % 360`)
- Controls: +Add / -Remove buttons, click-on-jar placement, keyboard shortcuts (`A` = add, `R` = remove)
- Cap: 300 stones (`MAX_STONES`)
- Particle burst on stone removal (~22-38 particles)
- No external libraries, no dependencies, no TypeScript, no CSS preprocessor

## Conventions

- Single-file JS, no classes exported, no modules — everything is in global scope
- Camera-agnostic (canvas-sized, no zoom/pan)
- Adding to this repo means editing the existing files directly; no codegen or build step involved
