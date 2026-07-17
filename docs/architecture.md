# Architecture

RageSoccer keeps gameplay logic independent from its two browser entry points. `src/menu.ts` owns match setup and navigation; `src/main.ts` owns DOM assets, input listeners, the Canvas context, and the animation-frame loop. Vite bundles both `index.html` and `game.html` as a static multi-page application.

## Ownership

Mutable state has one owner:

- `Team` owns its players, selected human player, and score.
- `HumanController` owns keyboard state, touch targets, and player-selection hysteresis.
- `MatchFlow` owns the top-level match state.
- `RestartController` owns the active restart session.
- Each restart strategy owns the rules unique to that restart type.
- `Game` is the composition root and frame-level orchestrator.

Components receive dependencies directly and do not coordinate through browser globals or an event bus. Rule detectors return synchronous values to `MatchFlow`, which makes ordering explicit and replay deterministic.

## State hierarchy

```text
MatchFlow [normalPlay | outOfPlay | restart | paused]
  -> RestartSession [positioning | waitingForInput | inProgress | complete]
    -> TeamAi [restart state | attack | defense]
      -> IndividualAi [inactive | attackBall | moveToPosition]
        -> command-specific state
```

`RestartController` implements the shared lifecycle. `KickoffRestart`, `ThrowInRestart`, `CornerRestart`, and `GoalKickRestart` provide scene creation, movement permissions, enforcement, input interpretation, and completion policy.

## Frame order

During normal play, `Game.update()` always performs:

1. Human-player selection and team AI updates.
2. Human movement input.
3. Physics.
4. Restart enforcement.
5. Goal detection, followed by boundary detection if no goal occurred.
6. Debug snapshot recording.

Paused and waiting states reset the physics clock. Out-of-play delay advances only the ball. Restart positioning advances only players while keeping the ball locked. Tests protect these ordering contracts.

## Configuration and testing

`Configuration` groups tuning under `pitch`, `viewport`, `physics`, `ball`, `player`, `teams`, `ai`, `restarts`, `cutscene`, `input`, `assets`, and `debug`. Browser asset lookup is isolated in `loadBrowserAssets()`, allowing tests to construct the game with DOM stubs.

Vitest runs the original 202 behavioral scenarios in jsdom. The suite covers math, world state, physics, AI, every restart, browser input, configuration, debug replay, page structure, and orchestration.
