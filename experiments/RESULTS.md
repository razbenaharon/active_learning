# Section A controlled experiment results

Run date: 2026-07-16  
Seeds: 1, 2, 3  
Oracle budget: 5,000 unique IDs per seed  
Baseline: 5 rounds x 1,000 queries, final positive duplication 2x

The acquisition code never loads test data. Test labels are loaded only after a
completed model is returned, in the external evaluation step used for this report.
All configurations use the framework's fixed `RandomForestClassifier`.

## Baseline reproduction

The baseline reproduced exactly with mean F1 `0.6470538`.

| Seed | F1 | Precision | Recall | Runtime | Queries | Oracle positives | Oracle negatives | Before duplication (P/N) | After duplication (P/N) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.6381 | 0.5731 | 0.7198 | 12.1s | 5,000 | 3,119 | 1,881 | 3,277 / 2,223 (59.58% P) | 6,554 / 2,223 (74.67% P) |
| 2 | 0.6491 | 0.5879 | 0.7246 | 13.5s | 5,000 | 3,143 | 1,857 | 3,305 / 2,195 (60.09% P) | 6,610 / 2,195 (75.07% P) |
| 3 | 0.6539 | 0.5920 | 0.7303 | 14.7s | 5,000 | 3,158 | 1,842 | 3,310 / 2,190 (60.18% P) | 6,620 / 2,190 (75.14% P) |

## Complete comparison

`Std` is population standard deviation across the three seeds. Precision, recall,
positives found, and runtime are means. `Delta` is relative to baseline mean F1.
`All improved` compares every seed to its corresponding baseline seed.

| Exp | Configuration | Seed 1 F1 | Seed 2 F1 | Seed 3 F1 | Mean F1 | Std | Delta | Precision | Recall | Positives Found | Runtime | Worst Seed | All improved |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| A | 5x1000 | 0.6381 | 0.6491 | 0.6539 | 0.6471 | 0.0066 | +0.0000 | 0.5843 | 0.7249 | 3140.0 | 13.4s | 0.6381 | no |
| A | 10x500 | 0.6303 | 0.6381 | 0.6511 | 0.6398 | 0.0086 | -0.0072 | 0.5815 | 0.7118 | 3157.3 | 13.7s | 0.6303 | no |
| A | 20x250 | 0.6389 | 0.6495 | 0.6385 | 0.6423 | 0.0051 | -0.0048 | 0.5828 | 0.7155 | 3167.3 | 17.2s | 0.6385 | no |
| A | graded batches | 0.6425 | 0.6385 | 0.6519 | 0.6443 | 0.0056 | -0.0027 | 0.5804 | 0.7244 | 3136.0 | 14.7s | 0.6385 | no |
| B | KMeans, top 3x | 0.6393 | 0.6444 | 0.6288 | 0.6375 | 0.0065 | -0.0096 | 0.5915 | 0.6914 | 3008.0 | 21.9s | 0.6288 | no |
| B | Greedy, top 3x, alpha=.75 | 0.6280 | 0.6406 | 0.6444 | 0.6377 | 0.0070 | -0.0094 | 0.5831 | 0.7042 | 3127.0 | 18.8s | 0.6280 | no |
| B | Greedy, top 3x, alpha=.90 | 0.6348 | 0.6403 | 0.6408 | 0.6386 | 0.0027 | -0.0084 | 0.5828 | 0.7064 | 3139.3 | 21.8s | 0.6348 | no |
| C | Scout on all data | 0.6381 | 0.6491 | 0.6539 | 0.6471 | 0.0066 | +0.0000 | 0.5843 | 0.7249 | 3140.0 | 16.4s | 0.6381 | no |
| C | Balanced scout | 0.6265 | 0.6384 | 0.6488 | 0.6379 | 0.0091 | -0.0091 | 0.5719 | 0.7211 | 3126.3 | 17.4s | 0.6265 | no |
| C | No positive scout duplication; full hard negatives | 0.6381 | 0.6491 | 0.6539 | 0.6471 | 0.0066 | +0.0000 | 0.5843 | 0.7249 | 3140.0 | 15.0s | 0.6381 | no |
| C | All-data + balanced scouts | 0.6396 | 0.6343 | 0.6475 | 0.6404 | 0.0054 | -0.0066 | 0.5690 | 0.7324 | 3161.7 | 17.3s | 0.6343 | no |
| D | 1x, deterministic random | 0.6222 | 0.6346 | 0.6311 | 0.6293 | 0.0052 | -0.0177 | 0.6505 | 0.6095 | 3140.0 | 13.8s | 0.6222 | no |
| D | 1x, OOF difficulty | 0.6222 | 0.6346 | 0.6311 | 0.6293 | 0.0052 | -0.0177 | 0.6505 | 0.6095 | 3140.0 | 15.3s | 0.6222 | no |
| D | 1.5x, deterministic random | 0.6217 | 0.6474 | 0.6375 | 0.6355 | 0.0106 | -0.0115 | 0.6085 | 0.6651 | 3140.0 | 13.8s | 0.6217 | no |
| D | 1.5x, OOF difficulty | 0.6316 | 0.6493 | 0.6462 | 0.6423 | 0.0077 | -0.0047 | 0.5801 | 0.7195 | 3140.0 | 15.4s | 0.6316 | no |
| D | 1.75x, deterministic random | 0.6308 | 0.6453 | 0.6509 | 0.6423 | 0.0085 | -0.0047 | 0.5987 | 0.6930 | 3140.0 | 13.9s | 0.6308 | no |
| D | 1.75x, OOF difficulty | 0.6357 | 0.6466 | 0.6440 | 0.6421 | 0.0046 | -0.0050 | 0.5732 | 0.7300 | 3140.0 | 15.4s | 0.6357 | no |
| D | 2x, deterministic random | 0.6381 | 0.6491 | 0.6539 | 0.6471 | 0.0066 | +0.0000 | 0.5843 | 0.7249 | 3140.0 | 13.9s | 0.6381 | no |
| D | 2x, OOF difficulty | 0.6381 | 0.6491 | 0.6539 | 0.6471 | 0.0066 | +0.0000 | 0.5843 | 0.7249 | 3140.0 | 15.4s | 0.6381 | no |
| D | 2.25x, deterministic random | 0.6299 | 0.6527 | 0.6426 | 0.6417 | 0.0093 | -0.0053 | 0.5769 | 0.7230 | 3140.0 | 13.9s | 0.6299 | no |
| D | 2.25x, OOF difficulty | 0.6443 | 0.6465 | 0.6471 | 0.6460 | 0.0012 | -0.0011 | 0.5717 | 0.7426 | 3140.0 | 15.4s | 0.6443 | no |
| D | 2.5x, deterministic random | 0.6390 | 0.6394 | 0.6449 | 0.6411 | 0.0027 | -0.0060 | 0.5732 | 0.7273 | 3140.0 | 13.9s | 0.6390 | no |
| D | 2.5x, OOF difficulty | 0.6297 | 0.6451 | 0.6493 | 0.6414 | 0.0084 | -0.0057 | 0.5610 | 0.7488 | 3140.0 | 15.5s | 0.6297 | no |
| D | 3x, deterministic random | 0.6395 | 0.6515 | 0.6485 | 0.6465 | 0.0051 | -0.0006 | 0.5737 | 0.7405 | 3140.0 | 13.9s | 0.6395 | no |
| D | 3x, OOF difficulty | 0.6395 | 0.6515 | 0.6485 | 0.6465 | 0.0051 | -0.0006 | 0.5737 | 0.7405 | 3140.0 | 15.5s | 0.6395 | no |
| E | Easy 1x, hard 3x (OOF) | 0.6415 | 0.6476 | 0.6433 | 0.6441 | 0.0025 | -0.0029 | 0.5571 | 0.7636 | 3140.0 | 15.1s | 0.6415 | no |
| E | Easy/medium/hard 1x/2x/3x (OOF) | 0.6401 | 0.6518 | 0.6522 | 0.6481 | 0.0056 | +0.0010 | 0.5624 | 0.7646 | 3140.0 | 15.1s | 0.6401 | no |
| F | 2 scouts, first 2 rounds | 0.6373 | 0.6423 | 0.6486 | 0.6427 | 0.0046 | -0.0043 | 0.5819 | 0.7182 | 3142.0 | 15.8s | 0.6373 | no |
| F | 2 scouts, all rounds | 0.6422 | 0.6404 | 0.6360 | 0.6395 | 0.0026 | -0.0075 | 0.5759 | 0.7190 | 3164.0 | 16.9s | 0.6360 | no |
| F | 3 scouts, first 2 rounds | 0.6341 | 0.6433 | 0.6321 | 0.6365 | 0.0049 | -0.0106 | 0.5831 | 0.7008 | 3138.3 | 13.9s | 0.6321 | no |
| G | 95% hunt + 5% cluster exploration | 0.6271 | 0.6323 | 0.6441 | 0.6345 | 0.0071 | -0.0126 | 0.5840 | 0.6946 | 3135.3 | 15.8s | 0.6271 | no |
| G | 90% hunt + 10% cluster exploration | 0.6416 | 0.6453 | 0.6385 | 0.6418 | 0.0028 | -0.0053 | 0.5878 | 0.7072 | 3133.3 | 14.8s | 0.6385 | no |
| H | 2x + top 10% hard negatives | 0.6387 | 0.6461 | 0.6454 | 0.6434 | 0.0033 | -0.0037 | 0.5784 | 0.7249 | 3140.0 | 12.6s | 0.6387 | no |
| H | 2x + top 20% hard negatives | 0.6303 | 0.6419 | 0.6375 | 0.6365 | 0.0048 | -0.0105 | 0.5738 | 0.7147 | 3140.0 | 12.6s | 0.6303 | no |

## Interpretation and decision

- More frequent scout updates found slightly more positives in A, but did not improve
  F1. The extra positives did not preserve the final precision/recall tradeoff.
- Diversity inside high-probability candidates hurt. KMeans reduced positive yield;
  greedy diversity largely preserved yield but still reduced final F1.
- Balancing the scout or averaging it with a balanced scout did not transfer to a
  better final classifier. The two-scout variant found more positives on average but
  lost precision.
- Duplication controls the fixed-threshold precision/recall tradeoff. Ratios above 2x
  raised recall, but their precision loss offset it. The stable optimum remains 2x.
- OOF hard-positive oversampling produced the clearest recall increase. The tiered
  variant reached mean F1 0.6481, only +0.0010, while harming seed 1. This is below the
  predeclared 0.005 noise threshold and is not accepted.
- Multi-scout averaging and cluster exploration did not improve stability or mean F1.
- Hard-negative weighting did not raise precision enough to compensate for lower
  recall and reduced mean F1.

No tested configuration improved all three seeds, and no configuration produced a
stable mean gain of at least 0.005. Therefore `strategy.py` remains unchanged. The
selected final configuration is the original 5x1000 positive-hunting strategy with
2x positive duplication.

## Artifact notes

- `baseline_strategy.py` preserves the pre-experiment baseline logic.
- `baseline_results.json` preserves the detailed original baseline run.
- `experiment_lab.py` is the external experiment harness and is not submitted.
- No prohibited data file is read directly. The harness uses `call_oracle` for pool
  labels and uses `load_test` only after training for external comparison.

## Final framework validation

The unchanged final `strategy.py` was rerun through `evaluation.py`:

| Seed | Final F1 | Framework runtime |
|---:|---:|---:|
| 1 | 0.6381 | 7.84s |
| 2 | 0.6491 | 8.03s |
| 3 | 0.6539 | 8.11s |
| Mean | 0.6471 | 7.99s |

Validation checks:

- allowed imports: pass
- syntax/compile: pass
- returned class: `RandomForestClassifier`
- oracle usage: exactly 5,000 unique IDs, zero remaining
- runtime: pass. Margin is machine-load dependent: the idle-machine run above recorded
  ~8s/seed, but a later run on a loaded machine recorded 19.3 / 31.3 / 34.5s. Worst
  observed margin is therefore ~25s, not ~50s. Still a comfortable pass, but do not
  quote the idle figure as the safety margin.
- normalized AST versus preserved baseline: identical

## Addendum — baseline and acquisition measurements (2026-07-16, later run)

Added while preparing the video deck, to ground every figure we present. Produced by
`make_plot_data.py` (raw: `plot_data.json`) through the framework API only.

### Reference points

| Setup | Seed 1 | Seed 2 | Seed 3 | Mean F1 |
|---|---:|---:|---:|---:|
| Initial 500 labels only | 0.4198 | 0.4009 | 0.3998 | 0.4068 |
| 500 + 5,000 random, no duplication | 0.5471 | 0.5679 | 0.5591 | 0.5580 |
| 500 + 5,000 random, 2x duplication | 0.5984 | 0.6247 | 0.6141 | 0.6124 |
| 500 + 5,000 hunted one-shot, 2x | 0.6381 | 0.6383 | 0.6459 | 0.6408 |
| **Final (5x1000 hunt, 2x)** | 0.6381 | 0.6491 | 0.6539 | **0.6471** |

The random draw returned 1,669 positives on average (33.4%), which is our unbiased estimate
of the pool positive rate and implies ~4,950 positives in the 14,900-row pool.

### Acquisition rules, equal 5,000 budget

| Rule | Positives bought | Hit rate | Mean F1 |
|---|---:|---:|---:|
| Random | 1,652 | 33.0% | 0.6124 |
| Uncertainty (P~0.5) | 2,408 | 48.2% | 0.6316 |
| Positive hunting | 3,140 | 62.8% | 0.6471 |

### Per-round query precision (mean over seeds)

| Round | 1 | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|
| Precision | 79.5% | 78.2% | 60.8% | 51.2% | 44.3% |
| Positives | 795 | 782 | 608 | 512 | 443 |

Decay toward the 33% base rate is the evidence that the budget, not the algorithm, is not
the binding constraint: the forest is running out of separable positives.

### Duplication sweep on a fixed labeled set

| Ratio | 1.0 | 1.25 | 1.5 | 1.75 | **2.0** | 2.25 | 2.5 | 3.0 | 4.0 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mean F1 | 0.6293 | 0.6372 | 0.6359 | 0.6388 | **0.6471** | 0.6410 | 0.6411 | 0.6465 | 0.6424 |

### Corrections to earlier documentation

Two figures previously quoted in `SOLUTION_EXPLAINED.md` did not survive re-measurement and
have been corrected there:

- **1x duplication: was quoted as ~0.585, actually 0.6293.** Confirmed twice (experiment D
  above and the fresh sweep). The real 1x -> 2x gain is +0.0178, not +0.062.
- **Uncertainty sampling positives: was quoted as ~3,040, actually 2,408.** The direction of
  the finding was right; the magnitude understated it.

Also corrected: "4x+ causes precision to collapse" — 4x measures 0.6424, only 0.005 below
peak. The curve is a broad plateau, not a cliff. And 2.0 vs 3.0 differ by 0.0006, well
inside the +/-0.005 noise floor, so "2x is optimal" is not a supportable claim; "F1 is flat
across 2x-3x" is.
