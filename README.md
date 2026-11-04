# raha

Agent skills I wrote for Claude Code. Each one records every correction I had to make, so the agent stops making the same mistakes.

| Skill | What it does |
|---|---|
| [borderless](skills/borderless) | Borderless: builds or de-borders UI with surface steps instead of outlines, and keeps only the lines that do a job. |
| [svg-vector](skills/svg-vector) | SVG Vector: draws any object as a Linear-style isometric line figure in plain SVG, with one hover gesture each. |
| [grid](skills/grid) | Lays out a page on the Stripe and Mintlify grid: two rails, calm gutters, one line weight. |
| [silk](skills/silk) | Silk: builds Stripe's folded hero wave in Three.js, with five tuned presets. |

## Install

Install one skill with its name:

```bash
npx skills add Rahuchpred/raha --skill silk
```

Or all of them:

```bash
npx skills add Rahuchpred/raha
```

Each skill is its `SKILL.md` plus a `reference/` folder of working code it points to.
