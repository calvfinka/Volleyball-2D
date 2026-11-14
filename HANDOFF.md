# Volleyball 2D — Engineering Handoff

## 1. Architecture & File Structure
Pure static HTML + CSS + ES Modules (`<script type="module">`) with zero frameworks, zero build steps, and zero external image, audio, or font assets. Deployable directly to GitHub Pages.

```
/
├── index.html                  # Semantic UI shell, 1280x720 canvas, structured panels & onboarding overlay
├── css/style.css               # Responsive landscape layout, safe-area padding, sticky panel headers, touch variants
├── js/
│   ├── main.js                 # Bootstrap, loop, first-launch onboarding trigger, Pause<->Settings routing
│   ├── core/
│   │   ├── loop.js             # Fixed-step delta clamp (~1/30s max dt) 60fps loop
│   │   ├── input.js            # Keyboard + virtual joystick (Compact/Normal/Large) + Arc/Row buttons
│   │   ├── audio.js            # Procedural WebAudio synth with user-gesture unlock & master volume
│   │   ├── save.js             # Versioned localStorage persistence (v0->v1->v2), onboardingSeen, records
│   │   └── screen.js           # Screen & modal router + mobile-only fullscreen/orientation lock
│   ├── data/
│   │   └── stats.js            # 2v2 team rosters (SOLARIS DUO vs COASTAL APEX) + smash/receive/block/serve/speed curves
│   ├── game/
│   │   ├── ball.js             # Gravity, speed-proportional air drag, Magnus spin, spin decay, net/floor collisions
│   │   ├── player.js           # Acceleration/deceleration, reduced air control, speed-driven jump, landing recovery, net touch
│   │   ├── ai.js               # Setter & Attacker roles, reaction interval (Casual/Pro), positioning noise, Casual mistakes
│   │   ├── rules.js            # Pure state machine: serve baseline, 3-touch, double-touch, block exemption, rotation, scoring
│   │   └── renderer.js         # Cached arena backdrop, keyframe poses, squash/stretch, airborne smash timing ring
│   └── screen/
│       ├── menu.js             # Play Match, How to Play, Settings, Records + 5-stat roster preview
│       ├── onboarding.js       # Non-blocking 5-step tutorial highlighting live controls over practice serve
│       ├── settings.js         # Grouped Audio, Controls, Gameplay, Data sections + inline confirm-reset
│       ├── records.js          # Wins, losses, win rate, best rally, longest match, matches played
│       └── match.js            # HUD (rally/rotation/server/target), touch layout sync, Pause/Result table
└── tests/
    └── game.test.mjs           # Node native unit + 40-match AI-vs-AI simulation suite
```

## 2. Design Decisions
- **Pure Logic Separation**: `js/data/stats.js`, `js/core/save.js`, `js/game/ball.js`, `js/game/player.js`, `js/game/ai.js`, and `js/game/rules.js` have zero DOM/Canvas imports and run directly under Node (`node --test tests/game.test.mjs`).
- **Realistic 2v2 Rules**:
  - **Serve**: Server starts behind baseline (`COURT.LEFT_X - 32` or `COURT.RIGHT_X + 32`); legal serve clears net and lands in opponent court (untouched = Ace); net hit or out = Service Error.
  - **Touch Limit & Double Touch**: Maximum 3 touches per side (4th touch = fault); same player cannot touch consecutively unless their previous touch was a net block.
  - **Block Exemption**: Valid only when jumping near the net (`|x - NET_X| <= 95`); block does not count toward the 3-touch limit.
  - **Rotation**: Clockwise rotation (`1 <-> 2`) and server swap occur only when the receiving team wins the rally (side-out).
- **Non-Cheating AI**: Both `Casual` and `Pro` share `predictBallLandingX` sampled only at reaction intervals (`0.24s` vs `0.07s`) with positioning noise (`±44px` vs `±12px`), plus occasional `Casual` mistakes (late jumps, off-target smashes, rare net lunge).
- **Non-Blocking Onboarding**: First launch runs `practiceMode: true` underneath the dimmed tutorial overlay and forces touch buttons visible while highlighting `#touch-joystick`, `#touch-btn-jump`, `#touch-btn-receive`, `#onboarding-ball-ring`, and `#touch-btn-smash`.

## 3. Adjustable Constants
- `js/game/ball.js`: `COURT` (`1280x720`, `FLOOR_Y=620`, `LEFT_X=90`, `RIGHT_X=1190`, `NET_X=640`, `NET_TOP_Y=380`), `BALL_CFG` (`GRAVITY=1080`, `AIR_DRAG_K=0.00016`, `MAGNUS_K=0.022`, `SPIN_DECAY=0.65`, `MAX_SPEED=1360`).
- `js/game/player.js`: `PLAYER_CFG` (`GRAVITY=1760`, `NET_BUFFER=26`, `NET_FAULT_ZONE=18`, `AIR_CONTROL_MULT=0.45`, `LANDING_RECOVERY_DURATION=0.11`).
- `js/data/stats.js`: `TEAMS` player attributes (`smash`, `receive`, `block`, `serve`, `speed`) and profile scaling functions.
- `js/game/ai.js`: Reaction interval (`0.07s` Pro / `0.24s` Casual), landing noise (`12px` Pro / `44px` Casual), `wantNetMistake` probability (`0.06` Casual).
- `js/core/save.js`: `CURRENT_SAVE_VERSION = 2`, default settings (`volume=0.8`, `joystickSize='normal'`, `buttonLayout='arc'`, `targetPoints=15`).

## 4. Verification Summary
- Automated tests: `node --test tests/game.test.mjs` (11 tests including 40 full AI-vs-AI match simulations).
- Headless browser check: Verified `1280x720`, `844x390` mobile landscape, and `390x844` portrait fallback with 0 console/page errors.

## 5. Recommended Next Steps
- Add character/team selector on Main Menu (swap teams or customize Kai/Mina stats).
- Add Best-of-3 sets option alongside single-set 11/15/21.
- Add dive-save visual animation for desperate low receives near the floor.
