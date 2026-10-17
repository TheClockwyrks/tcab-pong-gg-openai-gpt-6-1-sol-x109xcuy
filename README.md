# Carom

A browser paddle duel about spin, timing, and bank shots. Two swaying, rotating
obstacles turn a familiar court into a shifting puzzle. Play against the computer
in Solo or share a keyboard in local Versus. First to 11 wins, with a two-point lead.

## Run locally

Requires a current Node.js release compatible with Vite 8.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No backend, accounts, runtime downloads, or
external assets are needed.

## Production

```sh
npm run build
npm run preview
```

The build emits the complete static site into `dist/`. Serve that directory at the
root of any static host.

## Controls

| Input | Effect |
| --- | --- |
| W / S | Left paddle |
| Up / Down | Right paddle in Versus; also left paddle in Solo |
| W / S or Up / Down | Select a menu item |
| Enter / Space | Confirm |
| P / Escape | Pause / resume |
| Escape | Back from instructions or match results |
| M | Mute / unmute |
| Backtick | Engine diagnostic overlay |

Menus also support mouse and touch. Touchscreen play uses the engine's two
vertical sliders and menu controls. Strike while moving to curve the ball; strike
near a paddle's ends for sharper angles. Gold obstacles reflect your shot from
their current orientation.

## Development

- `npm run typecheck`: strict TypeScript checks.
- `npm run lint`: ESLint.
- `npm run format`: Prettier check.
- `npm test`: counted-frame engine tests and Istanbul coverage.

The immutable simulation, collision resolution, controls, debug poses, and drawing
are separate modules under `src/`. The Simple 2D engine owns input, audio,
letterboxing, the frame clock, recording, and diagnostics. Its documentation is
in `engine/`. The returned `engine.debug` surface permits individual state poses
and snapshots without a browser-global API. Tests create their own engine, canvas,
and deterministic clock.

See `showcase/` for screenshots and a draw-command replay captured from the game.
