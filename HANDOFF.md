# Volleyball 2D — Handoff & Architecture Guide

## 1. Project Structure

Pure static HTML + CSS + JavaScript ES Modules designed for direct GitHub Pages deployment with zero build steps, zero frameworks, and zero external assets.

```text
/
├── index.html             # Viewport shell, SVG title emblem, HUD, touch controls, modals, portrait overlay
├── css/
│   └── style.css          # Landscape-first responsive UI, safe-area padding, touch pad, portrait fallback
├── js/
│   ├── main.js            # Entry point wiring core services, screens, and 60fps loop
│   ├── core/
│   │   ├── audio.js       # Procedural WebAudio sound effects (serve, receive, set, smash, block, whistle)
│   │   ├── input.js       # Unified keyboard (Arrows + Space) + Touch virtual joystick & action buttons
│   │   ├── loop.js        # Clamped delta-time requestAnimationFrame loop
│   │   ├── save.js        # Versioned localStorage persistence (v1) + v0->v1 migration
│   │   └── screen.js      # Screen/modal state machine + landscape fullscreen orientation lock helper
│   ├── data/
│   │   └── stats.js       # 2v2 team rosters and stat-to-physics modifiers (smash, receive, block, serve)
│   ├── game/
│   │   ├── ai.js          # Teammate auto-feed AI & Away opponent 2v2 AI
│   │   ├── ball.js        # Ball kinematics, net/floor collision, and landing prediction
│   │   ├── player.js      # Player physics, jump buffering, variable jump cut, squash & stretch
│   │   ├── renderer.js    # Canvas 2D renderer (1280x720 logical space, cached offscreen backdrop, particles)
│   │   └── rules.js       # 2v2 rules: serve, receive, auto-feed, smash timing, block, rally point to 15
│   └── screen/
│       ├── match.js       # In-match HUD sync, pause/result modals, audio event dispatch
│       ├── menu.js        # Main menu roster stats display and record readout
│       └── settings.js    # Sound, touch controls mode, difficulty, and record reset
└── HANDOFF.md
```

## 2. Design Decisions

- **Pure DOM-Free Simulation**: Everything inside `js/game/` and `js/data/` operates purely on state objects with zero DOM or Canvas references, making rules/physics unit-testable in Node and portable.
- **Logical 1280x720 Uniform Scaling**: `renderer.js` scales the 1280x720 court uniformly into the live viewport (`Math.min(viewW / 1280, viewH / 720)`) and paints seamless sky/floor-apron wings on wider mobile aspect ratios (such as `844x390`) so circles and characters never stretch.
- **Mobile 60 FPS Performance**: Static sky, bleachers, and court markings are cached once onto an offscreen canvas (`bgCanvas`). Particles use a pre-allocated 48-slot ring buffer to prevent GC spikes during rallies. No CSS `backdrop-filter` is used over the canvas.
- **2v2 Auto-Feed Flow**: Touch 1 (`Receive`) pops the ball cleanly to the setter (`Mina`), who automatically sets Touch 2 (`AUTO-FEED!`) into the attack lane with a smash timing ring, letting the human player focus on jump timing and `Smash` execution (while still allowing quick Touch 2 hits).
- **Landscape Enforcement**: CSS `@media (orientation: portrait)` immediately displays `#rotate-overlay` ("Rotate your phone"). Pressing Play also attempts `requestFullscreen()` + `screen.orientation.lock('landscape')` safely inside `try/catch`.
- **Offline & Safe-Area Ready**: Uses `viewport-fit=cover`, `env(safe-area-inset-*)`, `touch-action: none`, `user-select: none`, and system fonts + procedural Canvas/WebAudio so it works 100% offline.

## 3. Adjustable Constants

- **Court & Net (`js/game/ball.js`)**:
  - `COURT.FLOOR_Y` (`620`), `COURT.LEFT_X` (`90`), `COURT.RIGHT_X` (`1190`), `COURT.NET_X` (`640`), `COURT.NET_TOP_Y` (`380`)
  - `BALL_CFG.RADIUS` (`20`), `BALL_CFG.GRAVITY` (`1080`), `BALL_CFG.MAX_SPEED` (`1380`)
- **Player Movement (`js/game/player.js`)**:
  - `PLAYER_CFG.SPEED` (`370`), `PLAYER_CFG.AI_SPEED` (`335`), `PLAYER_CFG.JUMP_VY` (`-650`), `PLAYER_CFG.GRAVITY` (`1760`)
- **Match Rules (`js/game/rules.js`)**:
  - `TARGET_POINTS` (`15`, win by 2)
  - `evaluateSmashTiming`: `PERFECT` vertical window (`<= 28 + bonus`), `GOOD` (`<= 58`)
- **Stat Curves (`js/data/stats.js`)**:
  - `TEAMS.home.players` (`Kai #7`, `Mina #4`) and `TEAMS.away.players` (`Ren #11`, `Sora #2`)
  - `getServeProfile`, `getReceiveProfile`, `getSmashProfile`, `getBlockProfile`

## 4. Next Steps (Stage 2+ Roadmap)

1. **Team & Athlete Selection**: Allow picking between multiple preset 2v2 clubs or customizing player stats before starting a match.
2. **Tournament / Best-of-3 Sets**: Add multi-set match structure and a 3-round coastal tournament ladder saved in `save.js` (incrementing `CURRENT_SAVE_VERSION` to `2` with migration).
3. **Service Worker (Offline Cache)**: Register a lightweight `sw.js` in `index.html` for full Add-to-Home-Screen offline play on GitHub Pages.
4. **Diving Save & Jump Serve**: Add a directional dash/dive-dig animation on double-tap or dedicated gesture, plus a timed toss-and-jump serve mechanic.
5. **Local 2-Player / Match Replay**: Add optional split-keyboard controls or rally highlight replay buffer.
