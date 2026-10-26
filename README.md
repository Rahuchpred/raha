# raha

Agent skills I wrote for Claude Code. Each one records every correction I had to make, so the agent stops making the same mistakes.

| Skill | What it does |
|---|---|
| [grid](skills/grid) | Lays out a page on the Stripe and Mintlify grid: two rails, calm gutters, one line weight. |
| [webgl-form](skills/webgl-form) | Builds Stripe's folded hero wave in Three.js, with five tuned presets. |

## Install

Copy a skill's folder into `~/.claude/skills/`:

```bash
git clone https://github.com/Rahuchpred/raha.git
cp -R raha/skills/grid ~/.claude/skills/
```

Each skill is its `SKILL.md` plus a `reference/` folder of working code it points to.
