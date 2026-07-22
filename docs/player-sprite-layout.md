# Player Sprite Sheet Layout

The game loads the generated sheets:

- `public/assets/images/soccer_player_for_arcade_style/sprite-map-home.png`
- `public/assets/images/soccer_player_for_arcade_style/sprite-map-away.png`

Run `npm run assets:players` to rebuild both maps from the directional images
in that directory.

## Dimensions

| Property            |   Value |
| ------------------- | ------: |
| Sprite-sheet width  |  320 px |
| Sprite-sheet height | 1024 px |
| Frame width         |   40 px |
| Frame height        |   64 px |
| Columns             |       8 |
| Rows                |      16 |

Rows 0–7 contain idle poses and rows 8–15 contain the eight running phases.
Both sections use this direction order:

1. North
2. Northeast
3. East
4. Southeast
5. South
6. Southwest
7. West
8. Northwest

Idle artwork is repeated across all eight columns. Running rows contain phases
0–7. Kick animation is intentionally absent until suitable artwork is added.

Every figure must remain inside its 40×64 cell, with its horizontal center near
`x = 20` and ground contact near `y = 60`. Runtime layout values are configured
in `src/core/configuration.ts`, and source rectangles are selected in
`src/world/player.ts`.
