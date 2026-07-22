# Player Sprite Sheet Layout

The home and away player images must use the same layout. The game currently
loads:

- `public/assets/images/player-sprite-home-v2.png`
- `public/assets/images/player-sprite-away-v2.png`

## Image and frame dimensions

| Property            |   Value |
| ------------------- | ------: |
| Sprite-sheet width  |  320 px |
| Sprite-sheet height | 1536 px |
| Frame width         |   40 px |
| Frame height        |   64 px |
| Columns             |       8 |
| Rows                |      24 |

Every source frame starts at:

```text
sourceX = frameNumber * 40
sourceY = rowNumber * 64
```

`frameNumber` and `rowNumber` are zero-based.

## Direction order

All three animation sections use this direction order:

| Direction index | Facing X | Facing Y | Direction            |
| --------------: | -------: | -------: | -------------------- |
|               0 |        0 |       -1 | North (back view)    |
|               1 |        1 |       -1 | Northeast            |
|               2 |        1 |        0 | East (right profile) |
|               3 |        1 |        1 | Southeast            |
|               4 |        0 |        1 | South (front view)   |
|               5 |       -1 |        1 | Southwest            |
|               6 |       -1 |        0 | West (left profile)  |
|               7 |       -1 |       -1 | Northwest            |

## Complete row layout

| Sheet row | Animation | Direction | Valid frame numbers |
| --------: | --------- | --------- | ------------------- |
|         0 | Idle      | North     | 0                   |
|         1 | Idle      | Northeast | 0                   |
|         2 | Idle      | East      | 0                   |
|         3 | Idle      | Southeast | 0                   |
|         4 | Idle      | South     | 0                   |
|         5 | Idle      | Southwest | 0                   |
|         6 | Idle      | West      | 0                   |
|         7 | Idle      | Northwest | 0                   |
|         8 | Run       | North     | 0–7                 |
|         9 | Run       | Northeast | 0–7                 |
|        10 | Run       | East      | 0–7                 |
|        11 | Run       | Southeast | 0–7                 |
|        12 | Run       | South     | 0–7                 |
|        13 | Run       | Southwest | 0–7                 |
|        14 | Run       | West      | 0–7                 |
|        15 | Run       | Northwest | 0–7                 |
|        16 | Kick      | North     | 0–3                 |
|        17 | Kick      | Northeast | 0–3                 |
|        18 | Kick      | East      | 0–3                 |
|        19 | Kick      | Southeast | 0–3                 |
|        20 | Kick      | South     | 0–3                 |
|        21 | Kick      | Southwest | 0–3                 |
|        22 | Kick      | West      | 0–3                 |
|        23 | Kick      | Northwest | 0–3                 |

Unused cells must remain transparent:

- Idle rows: columns 1–7 are unused.
- Kick rows: columns 4–7 are unused.

## Visual grid

```text
Columns / frame number ->   0     1     2     3     4     5     6     7

Row  0  Idle N             [X]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]
Row  1  Idle NE            [X]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]
Row  2  Idle E             [X]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]
Row  3  Idle SE            [X]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]
Row  4  Idle S             [X]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]
Row  5  Idle SW            [X]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]
Row  6  Idle W             [X]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]
Row  7  Idle NW            [X]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]

Row  8  Run N              [0]   [1]   [2]   [3]   [4]   [5]   [6]   [7]
Row  9  Run NE             [0]   [1]   [2]   [3]   [4]   [5]   [6]   [7]
Row 10  Run E              [0]   [1]   [2]   [3]   [4]   [5]   [6]   [7]
Row 11  Run SE             [0]   [1]   [2]   [3]   [4]   [5]   [6]   [7]
Row 12  Run S              [0]   [1]   [2]   [3]   [4]   [5]   [6]   [7]
Row 13  Run SW             [0]   [1]   [2]   [3]   [4]   [5]   [6]   [7]
Row 14  Run W              [0]   [1]   [2]   [3]   [4]   [5]   [6]   [7]
Row 15  Run NW             [0]   [1]   [2]   [3]   [4]   [5]   [6]   [7]

Row 16  Kick N             [0]   [1]   [2]   [3]   [ ]   [ ]   [ ]   [ ]
Row 17  Kick NE            [0]   [1]   [2]   [3]   [ ]   [ ]   [ ]   [ ]
Row 18  Kick E             [0]   [1]   [2]   [3]   [ ]   [ ]   [ ]   [ ]
Row 19  Kick SE            [0]   [1]   [2]   [3]   [ ]   [ ]   [ ]   [ ]
Row 20  Kick S             [0]   [1]   [2]   [3]   [ ]   [ ]   [ ]   [ ]
Row 21  Kick SW            [0]   [1]   [2]   [3]   [ ]   [ ]   [ ]   [ ]
Row 22  Kick W             [0]   [1]   [2]   [3]   [ ]   [ ]   [ ]   [ ]
Row 23  Kick NW            [0]   [1]   [2]   [3]   [ ]   [ ]   [ ]   [ ]
```

## Animation behavior

### Idle

- The game uses frame 0 of the correct direction.
- Idle does not erase the saved run phase, so running can resume naturally.

### Run

- Run frames advance from 0 through 7 and then wrap to 0.
- Animation is distance-driven rather than time-driven.
- The phase advances after every 6 world pixels traveled.
- Direction changes are filtered briefly to prevent rapid row flickering.

### Kick

- A successful player-to-ball physics impulse starts the kick animation.
- The kick direction is captured and locked when contact occurs.
- Frames 0 through 3 play over 0.24 seconds (0.06 seconds per frame).
- Kicking does not stop player movement.
- After frame 3, rendering returns to the current run or idle animation.

## Alignment requirements

- Use an RGBA PNG with transparent unused space.
- Keep every figure fully inside its 40×64 cell.
- Keep the player's ground/contact point at the same position in every frame.
- The current sheets use an approximate horizontal center of `x = 20` and a
  ground anchor near `y = 60` inside each cell.
- Include the player's contact shadow inside each frame.
- Do not let artwork bleed into adjacent cells.

The runtime layout values are configured in `src/core/configuration.ts`, and
the source rectangle is selected in `src/world/player.ts`.
