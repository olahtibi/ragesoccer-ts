# AI System

The AI is split into team decisions, per-player command dispatch, and command-local behavior.

`TeamAi` selects a relative team state and assigns one command to each player. The human-controlled home player remains inactive in AI terms so browser input can apply the final velocity after AI updates. During restarts, the active strategy decides which teams may move and supplies takers, positioning targets, and optional attack targets.

`IndividualAi` provides shared movement, aiming, and debug helpers. Command-local state remains inside command instances created by `createIndividualAiCommandRegistry()`:

- `inactive`: leaves movement under another controller.
- `moveToPosition`: approaches a formation target with personal pace and arrival easing.
- `attackBall`: approaches behind the ball, detours for alignment, and commits to a shot using angular hysteresis.

`Formation` maps team state, side, and team size to positions for teams from 1 through 11. It also creates kickoff and layered corner plans. Open-play targets add deterministic pace, wandering, ball response, smoothing, and teammate separation; goalkeepers and restart targets remain exact.

## Adding a command

1. Add a command module under `src/ai/commands/` with `update`, optional `reset`, and optional `debugSnapshot` behavior.
2. Register one instance per player in `commandRegistry.ts` so command state cannot leak between players.
3. Assign it from the appropriate team-level decision.
4. Add focused Vitest scenarios under `tests/ai/commands/`.

Use radians for all angle calculations and the helpers in `src/math/math.ts`. Keep match and restart transitions outside individual commands.
