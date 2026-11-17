# Token Launch Radar — radar-4

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/icallshelby/makefun-token-radar-03/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/icallshelby/makefun-token-radar-03/reward.svg)](https://make.fun/bounty/token-radar-01/bounty?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Systematic valuation of pre-token DeFi & infrastructure protocols using log-log size curves with per-category intercept calibration, two-layer blind out-of-sample testing, bootstrap uncertainty bands, and netted farm economics with verdicts.

## What's New in radar-4 (v3)

- **Size Curve with Category Intercepts**: Replaces flat category-median multiples with a log-log Ordinary Least Squares (OLS) regression (`log10(mcap) = a + b · log10(TVL)`) combined with per-category median residual intercept shifts (clamped to `[-0.30, +0.30]` dex).
- **Two-Layer Out-of-Sample Blind Testing**: Validated via time-split and random 80/20 held-out evaluation across baseline models, demonstrating superior predictive power (`within ×1.48` median error).
- **Bootstrap Uncertainty Bands**: 200 resamples using deterministic PRNG (mulberry32) seeded from the snapshot date, yielding `[p10, p90]` valuation bounds per protocol.
- **Netted Farm Economics & Verdicts**: Complete costed farm ledgers (chain-specific gas fees + 5% annual opportunity cost) paired with expected airdrop value (`implied × P(airdrop) × P(qualify) × 5% FDV`), resulting in explicit `FARM`, `THIN`, or `SKIP` verdicts per row.
- **Interactive Dashboard & Evidence Section**: Built-in OOS validation table and inline SVG size-curve scatter plot directly above the board, sortable Net farm $ and Verdict columns, effective multiple display, and protocol detail drawers.

## How to Run

Requires Node 22 (standard library only).

```bash
# Generate the radar output
node --experimental-strip-types main.ts --input /home/hatch/workspace/makefun/token-radar-01-kit/token-radar-01-kit/input/snapshot.json --output out

# The output will be in the out/ directory:
# - board.json: Full ranked list
# - data.js: Frontend data bundle
# - dashboard/: Interactive web UI with OOS evidence & size curve
# - screenshots/: Visual verification (1440x900)
# - dossier.json: State proof
```

## Methodology

Implied valuation = `max(1, round(10^(a + b · log10(TVL) + shift) × GrowthMult × MaturityMult × BreadthMult))` bounded to `[0.03 TVL, 0.80 TVL]`.

---
*Built for the token-radar-01 make.fun competition.*

---

<sub>Entered on [make.fun](https://make.fun/?ref=0kh7811r&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
