# wolf-mass — 12-Week Mass + Hybrid Block

> **Operating system for a 12-week muscle-gain block that keeps the HYROX engine.**
> 23 Nov 2026 → 14 Feb 2027 · 85 → 87–88.5 kg · then 90 kg.

**Philosophy:** Strength + Hypertrophy First · HYROX Conditioning Second · Running Rehabilitation Third.

---

## Live site

`index.html` is a single-file app (GitHub Pages entry point). Tabs:

| Tab | What it does |
|---|---|
| **Today** | Auto-detects week and day, shows the session with week-adjusted sets/RIR, logs kg × reps per set, gives a double-progression hint from your last session |
| **Program** | 12-week map (phases, deloads, holiday moves), weekly direct-set volume vs evidence zone, exercise evidence table |
| **Body** | Morning check-in (weight, waist, sleep, RHR, knee, energy), weight chart vs target corridor, Monday calorie decision |
| **Engine** | Wednesday VO2 gate (2 of 3 rule), BikeErg 4×4 log with spread check and next-week call |
| **Fuel** | Macro targets by phase, workday meal template |
| **Rules** | Knee hard rule, illness, training and recovery rules |
| **Data** | Export JSON / CSV, import, lift history per exercise |

Data is stored in the browser (localStorage). Export weekly and commit to `logs/`.

## Structure

```
wolf-mass/
├── index.html              ← the app (GitHub Pages)
├── CLAUDE.md               ← agent operating manual (read first)
├── STATE.md                ← single source of truth: week, weight, loads, flags
├── README.md               ← you are here
├── reference/
│   ├── program.md          ← full v3 program (sessions, phases, rules)
│   ├── evidence.md         ← research behind exercise and dose choices
│   └── decisions.md        ← approved decisions log
├── trackers/
│   ├── body_tracker.md     ← weekly 7-day averages, waist
│   └── lifts_tracker.md    ← top sets per key lift per week
└── logs/                   ← weekly JSON exports from the app
```

## Weekly loop (Claude Code)

```bash
cd ~/wolf-mass
claude
```

- **After a session:** paste numbers or export → Claude updates trackers and STATE.
- **Sunday:** "Sunday close-out" → Claude reads `logs/` latest export, computes rate, calorie call, lift progress, flags, and writes next week's notes into STATE.
- **Commit and push** → GitHub Pages updates.

## Publish on GitHub Pages

1. Create repo `wolf-mass`. This public version holds no medical notes; they live in the private program doc.
2. Push these files.
3. Settings → Pages → Source: `main` / root. Pages on a private repo requires a paid GitHub plan; otherwise keep the repo public without `reference/program.md` medical section, or use the Claude-hosted copy of the app.
