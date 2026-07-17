# RageSoccer

RageSoccer is a small, deterministic HTML Canvas soccer game inspired by Sensible World of Soccer. The application is written in TypeScript and runs entirely in the browser; Node.js provides the development, test, and production-build toolchain.

## Play

[Play RageSoccer on GitHub Pages](https://olahtibi.github.io/ragesoccer-ts/)

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Development

```sh
npm install
npm run dev
```

Open the URL printed by Vite. The options page starts a match in `game.html` and passes the selected team sizes, strengths, kickoff side, and restart rules through the query string.

Useful commands:

```sh
npm run check       # types, lint, formatting, and all 202 tests
npm run build       # type-check and create the static site in dist/
npm run test        # watch mode
npm run format      # format source and tests
```

The production build uses relative URLs and is deployed to GitHub Pages automatically after every push to `main`. Enable it once in the repository settings by selecting **Settings → Pages → Source → GitHub Actions**.

### Test the production build locally

To test the same generated files that GitHub Pages deploys:

```sh
npm run build
npx vite preview
```

Open the URL printed by Vite, usually `http://localhost:4173/`. Stop the preview server with `Ctrl+C`. Run `npm run build` again after changing the source code.

## Testing

```sh
npm run test:run                       # run the complete test suite once
npm run test                           # watch and rerun tests after changes
npm run test:run -- --reporter=verbose # run once and show every test name
npm run test -- --reporter=verbose     # watch mode showing every test name
npm run check                          # types, lint, formatting, and all tests
```

## Controls

- Arrow keys or touch: control the selected home player
- `F`: toggle FPS display
- `Q` / `W`: change viewport ratio
- With debug mode enabled, `C` awards a home corner and `/` pauses and dumps the recent diagnostic log

Mobile play requires landscape orientation. Throw-ins, corners, and goal kicks can be disabled from the options page to restore reflective pitch boundaries.

## Project layout

- `src/`: typed runtime modules and browser entry points
- `tests/`: Vitest behavior suite
- `public/assets/images/`: static game artwork
- `docs/`: architecture and AI extension guidance
- `project-to-port/`: ignored, unchanged reference implementation
