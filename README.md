# Project B — Section A: Active Learning for Employee Attrition

Technion Project B, Section A. Given ~14,900 unlabeled employee records, 500 free labels,
and an oracle that will sell **5,000 more**, choose which employees to pay for so that a
**fixed** RandomForest maximises **F1 on the minority "Left" class**.

**Result: mean F1 = 0.6471** (seeds 1/2/3 = 0.6381 / 0.6491 / 0.6539), using exactly 5,000
unique queries, well inside the 60s-per-seed cap.

| | |
|---|---|
| **Team** | Raz Ben Aharon (211623251) · Lior Malachi (322409376) |
| **Deadline** | 23 July 2026, 22:55 |
| **Submitted for Section A** | `strategy.py` + `video_link.txt` only |

## The short version

The metric decides the strategy. Two facts about F1-on-"Left"-at-a-frozen-0.5-threshold
drive every choice we made:

1. **Only the positive class scores.** True negatives contribute nothing, so budget spent
   finding "Left" employees is worth more than budget spent refining a decision boundary.
   → **Positive hunting** beats uncertainty sampling by 0.0155.
2. **The 0.5 threshold cannot be tuned.** The grader calls `predict()`. The only remaining
   lever on precision/recall is the *training composition*.
   → **Duplicating each positive once** is worth +0.0178, our single biggest gain.

Where the score comes from:

| Step | Mean F1 | Gain |
|---|---:|---:|
| Initial 500 labels only | 0.4068 | — |
| + 5,000 random labels | 0.5580 | +0.151 |
| + 2× positive duplication | 0.6124 | +0.054 |
| + hunt instead of random | 0.6408 | +0.028 |
| + iterate over 5 rounds | **0.6471** | +0.006 |

## Repository layout

| Path | What it is |
|---|---|
| `strategy.py` | **The submission.** The only Section A code file we hand in. |
| `SOLUTION_EXPLAINED.md` | Full write-up: the problem, the AL concepts, why this metric forces this strategy, the ceiling analysis, and what failed. |
| `presentation/index.html` | The 6-slide video deck. Open in a browser; Ctrl+P → Save as PDF to export. |
| `presentation/SCRIPT.md` | The 100-second script with speaker turns and timings. |
| `experiments/RESULTS.md` | All 32 configurations tried, with the decision record. |
| `experiments/make_plot_data.py` | Regenerates every figure in the deck. Not submitted. |
| `experiments/plot_data.json` | Raw measurements behind the deck. |
| `experiments/experiment_lab.py` | The sweep harness. Not submitted. |
| `utils.py`, `run.py`, `evaluation.py` | Course-provided framework. Unmodified. |
| `video_link.txt` | **Placeholder — paste the real URL before submitting.** |

`data/` and `constants.yaml` are deliberately **not** in this repo. They are course-provided,
they are not part of the submission, and `data/.pool_labels.pkl` is the pool answer key.
Drop the course's `Section A/student/` copies of both in place to run anything here.

## Reproducing

```bash
python evaluation.py                    # official self-eval, prints per-seed F1
python experiments/make_plot_data.py    # regenerates plot_data.json
```

Both need `data/` and `constants.yaml` present. Runtime is machine-dependent — we have seen
8s/seed idle and 35s/seed under load, against a 60s cap.

## Two things we want to be honest about

**We do not claim 0.6471 is optimal.** We could not build a legitimate upper bound without
reading the pool labels, which the brief forbids. What we can show is that ~1,800 positives
are invisible to this forest, that per-round query precision has decayed to 44% against a
33% base rate, and that 32 alternatives failed to beat us by more than noise.

**Our noise floor is ±0.005**, driven by training row order alone. Expect the hidden test
set to land nearer 0.642–0.652 than exactly 0.6471. That number is also why we rejected our
own best experiment: tiered oversampling "won" by +0.0010, one-fifth of the noise floor,
while making seed 1 worse. Adopting it would have been fitting our own test set.
