# The Full Weasel - AI Coding Guidelines

## Project Overview
A birthday-themed rhythm game PWA built with React + Vite. Single-player mobile-first game where players catch items and dodge hazards in sync with music.

## Architecture

### Game State Machine
All gameplay lives in [src/App.jsx](../src/App.jsx). The game uses a phase-based state machine:
- `PHASE_LAUNCH` → Title screen, PWA install prompt
- `PHASE_RHYTHM` → Main gameplay: lane-based item catching/dodging
- `PHASE_POPOFF` → Rapid-tap bonus phase at 100% party meter
- `PHASE_VICTORY` → Celebration with confetti

### Asset Pipeline
Assets flow: `assets_raw/` → `scripts/prepare-assets.mjs` → `public/assets/`

**Critical**: Always run `npm run prepare-assets` or use `npm run dev`/`npm run build` (which run it automatically). The pipeline:
1. Copies and organizes sprites, backgrounds (MP4), and music
2. Generates `public/assets/manifest.json` with role→URL mappings
3. Creates `ASSET_REPORT.json` for debugging/auditing
4. Generates PWA icons in `public/icons/`

### Role-Based Asset References
Never hardcode asset paths. Use the role system in [scripts/prepare-assets.mjs](../scripts/prepare-assets.mjs):
```javascript
// Define in spriteDefinitions array:
{ role: "my_sprite", sourceRel: "assets_raw/my_sprite.png", destinationRel: "assets/sprites/..." }

// Access at runtime via manifest:
const url = roleMap.get("my_sprite");
```

## Key Patterns

### Game Loop Timing
- `clockMs` state drives all timing via 33ms intervals
- `BEAT_MS` (650ms) defines rhythm for item spawning
- `FALL_MS` (2500ms) is item travel time from top to catch zone
- `HIT_WINDOW_MS` (430ms) / `PERFECT_WINDOW_MS` (140ms) for timing accuracy

### Refs for Mutable State
Performance-critical game state uses refs, not useState:
- `nextBeatRef`, `beatCountRef` - rhythm timing
- `musicRef` - audio player state and crossfade logic
- `idRef` - sequential ID generator for items/effects
- `itemsRef`, `clockRef` - synchronous access to items/clock for hit detection

**CRITICAL PATTERN**: When checking items in event handlers, read from `itemsRef.current` and `clockRef.current` instead of state variables. React's `setState` is async, so closures capturing state values will be stale. The refs are kept in sync via `useEffect`.

### Debug Hooks
Exposed on `window` for testing:
```javascript
window.advanceTime(ms)       // Manually advance game clock
window.render_game_to_text() // Serialize game state to JSON
```

## Developer Workflow

### Commands
```bash
npm run dev      # prepare-assets + vite dev server
npm run build    # prepare-assets + production build → dist/
npm run preview  # serve production build locally
```

### Adding New Assets
1. Place source files in `assets_raw/`, `assets_backgrounds/`, or `assets_music/`
2. Add entry to `spriteDefinitions` in [scripts/prepare-assets.mjs](../scripts/prepare-assets.mjs)
3. Run `npm run prepare-assets`
4. Access via `roleMap.get("your_role")` in App.jsx

### PWA Considerations
- Service worker ([public/sw.js](../public/sw.js)) uses cache-first for sprites, network-first for media
- Audio/video are NOT cached (too large) - handle offline gracefully with `showOfflineMediaHint`
- `beforeinstallprompt` captured for in-app install button

## Code Conventions

### CSS
Mobile-first responsive design in [src/App.css](../src/App.css):
- `vh`/`vw` units for game elements
- CSS custom properties: `--ink`, `--panel`, `--warm`, `--sun`, `--blue`
- Touch handling: `touch-action: none` on game root

### Lane System
Three lanes with fixed positions (percentage-based):
```javascript
const LANE_X = { left: 22, center: 50, right: 78 };   // Item positions
const PLAYER_X = { left: 28, center: 50, right: 72 }; // Player positions
```

## Deployment
Build outputs to `dist/`. Deploy via Netlify Drop per [DEPLOY.md](../DEPLOY.md).
