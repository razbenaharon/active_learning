# Active Learning for Employee Attrition — Solution Walkthrough & Tutorial

This document explains, in depth, the solution implemented in `strategy.py`, and
teaches the underlying machine-learning concepts as it goes. Read it top to bottom:
each section introduces an idea, shows why it matters *for this specific problem*,
and connects it to a concrete design decision or experiment.

> **Every number here is measured, not remembered.** All figures come from runs through the
> official framework (`call_oracle` / `train_model` / `evaluate_model`) on seeds 1–3.
> Regenerate them with `python experiments/make_plot_data.py` (raw output:
> `experiments/plot_data.json`); the 32-configuration sweep lives in
> `experiments/RESULTS.md`. Nothing in this document required reading
> `data/.pool_labels.pkl` or the test pickles directly — where that limited what we could
> claim, we say so explicitly rather than quoting a number we could not re-derive.

---

## 1. The Problem in One Paragraph

We must predict whether an employee **Left** (positive class, `y = 1`) or **Stayed**
(`y = 0`). We start with a **pool of ~14,900 unlabeled** employees and only **500
labeled** examples (given free). We may pay an **oracle** to reveal the true label of
any pool employee, but only for **5,000 unique employees total**. The final model is a
**fixed `RandomForestClassifier`** (100 trees) that we are not allowed to swap or
re-tune. We are scored by the **F1 score of the "Left" class** on a hidden test set,
averaged over 3 seeds, and everything must run in **under 60 seconds per seed**.

The central question of the whole project: **given a tiny labeling budget, which 5,000
employees should we pay to label so that the resulting Random Forest scores the highest
F1 on "Left"?** That is exactly what *active learning* studies.

---

## 2. What Is Active Learning?

In ordinary ("passive") supervised learning you are handed a fixed labeled dataset and
you train on it. In **active learning** the learner is allowed to *choose which
examples get labeled*, under a budget. The premise is that **not all labels are equally
useful** — a well-chosen 5,000 labels can beat a random 50,000.

The generic active-learning loop is:

```
1. Train a model on the currently labeled data.
2. Use the model to score every unlabeled example with an "acquisition function"
   (a number saying how useful it would be to label this example).
3. Query the oracle for the top-scoring examples (spend some budget).
4. Add the new labels to the training set.
5. Repeat until the budget runs out.
6. Train the final model on everything you labeled.
```

The model in step 1 is often called a **scout** or **surrogate**: its only job is to
*guide the next query*, not to be the final product.

**Classic acquisition functions** you should know:

| Name | Picks examples where… | Intuition |
|------|-----------------------|-----------|
| **Uncertainty sampling** | the model is least sure, i.e. `P(y=1) ≈ 0.5` | Labels near the decision boundary refine where the boundary sits. |
| **Query-by-committee** | an ensemble *disagrees* most | High disagreement = the region is genuinely ambiguous. |
| **Diversity / density** | examples are representative of dense, unexplored regions | Avoids wasting budget on outliers or on one tight cluster. |
| **Expected model change** | labeling would most change the model | Directly targets impact, but expensive to compute. |

A big part of this project was discovering **which of these actually helps here** — and
the answer is surprising, because of the metric we optimize. That is the next section.

---

## 3. The Metric Decides the Strategy: Why F1 Changes Everything

We are **not** scored on accuracy. We are scored on **F1 of the positive class**:

```
precision = TP / (TP + FP)      "of those I predicted Left, how many really Left?"
recall    = TP / (TP + FN)      "of those who really Left, how many did I catch?"
F1        = 2 · precision · recall / (precision + recall)   (harmonic mean)
```

Two consequences drive the entire design:

**(a) Only the positive class counts.** True negatives (correctly predicting "Stayed")
contribute *nothing* to F1. So the labels that matter most are the **positives**
("Left" employees) and the examples that help us tell positives from negatives.

**(b) The threshold is fixed at 0.5.** The grader calls `model.predict()`, which
labels an example "Left" only if the forest's vote share for class 1 exceeds 0.5. We
**cannot** move this threshold. In a normal project you would tune the threshold to
trade precision for recall; here that lever is welded shut.

Since we can't move the threshold, the only way to shift the precision/recall balance
is to **change what the model is trained on** — specifically, the **class ratio** in
the training set. That insight is the key to the final trick (Section 6).

**Class balance of this dataset.** We estimated it two independent ways: the free 500-label
split is 31.5% positive, and a uniform random 5,000-query draw came back 33.4% positive.
So about **33% of the pool is "Left"** — roughly **4,950 of 14,900**. This is a *mild*
imbalance — not the extreme 1%-positive case, but enough that a naively trained forest
leans toward predicting the majority "Stayed", which quietly suppresses recall and
therefore F1.

---

## 4. The Baselines (Know Your Numbers Before You Optimize)

Before writing a clever strategy, always establish reference points. We measured these
through the official framework (local test F1 of "Left", mean over seeds 1–3):

| Setup | Mean F1 | Per-seed | What it tells us |
|-------|---------|----------|------------------|
| Initial 500 labels only | **0.4068** | 0.420 / 0.401 / 0.400 | The free data alone is weak. |
| 500 + **5,000 random** labels, no reweighting | **0.5580** | 0.547 / 0.568 / 0.559 | Random labeling already gets you most of the way. |
| 500 + 5,000 random + **2× positive duplication** | **0.6124** | 0.598 / 0.625 / 0.614 | Reweighting alone is worth **+0.054** — on *random* data. |
| 500 + 5,000 **hunted** + 2× duplication (ours) | **0.6471** | 0.638 / 0.649 / 0.654 | Choosing *which* labels adds a further **+0.035**. |

Three lessons jump out:

1. **Random labeling is a strong baseline.** 0.558 from 5,000 blind labels. Any strategy
   that cannot beat this is not earning its complexity.
2. **Class composition is a bigger lever than acquisition.** Simply duplicating positives
   on *randomly* acquired data (+0.054) beats everything our acquisition rule adds on top
   (+0.035). If you only had time to do one thing, you would fix the class ratio.
3. **The two compose.** Hunting *and* reweighting together reach 0.647; neither alone does.

This reframes the whole task: it is less "collect the most labels" and more "**collect
the right positives and train on the right class ratio**".

> **A caveat we owe you.** An earlier draft of this document quoted a "train on all 14,900
> true labels" ceiling row. We removed it: reproducing it requires reading
> `data/.pool_labels.pkl` directly, which the brief tells us not to do, and we could not
> re-derive it within the rules. The ceiling argument in §8 rests instead on the
> per-round yield decay, which is fully measurable through `call_oracle`.

---

## 5. The Acquisition Strategy: Iterative Positive Hunting

Because F1 only rewards the positive class, and because positives are the minority, the
most valuable thing budget can buy is **true positives**. So instead of classic
uncertainty sampling (which spends budget near the 0.5 boundary), we do **positive
hunting**: query the employees the scout thinks are *most likely to have Left*.

But we don't spend all 5,000 queries at once. We spend them in **5 rounds of 1,000**,
retraining the scout between rounds:

```
labeled ← initial 500
repeat 5 times:
    scout ← RandomForest.fit(labeled)                 # retrain with all we know
    scores ← scout.P(Left) for every unlabeled employee
    batch  ← the 1,000 highest-scoring unlabeled employees
    labels ← oracle(batch)                            # spend 1,000 of the budget
    labeled ← labeled + (batch, labels)
```

**Why iterate instead of one big shot?** The very first scout is trained on only 500
examples, so its ranking is noisy. After each round it has hundreds more positives to
learn from, so its next ranking is sharper. Measured on seeds 1–3:

| Schedule | Positives bought (of 5,000 queries) | Mean F1 |
|---|---|---|
| One-shot — 1 × 5,000 | 2,900 | 0.6408 |
| **Iterative — 5 × 1,000** | **3,140** | **0.6471** |

Same budget, same model, **+240 positives (+8.3%) and +0.0063 F1 for free**. This is the
active-learning principle in action: **feedback between rounds compounds**.

**But watch the yield decay.** Query precision within each batch, averaged over seeds:

| Round | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Batch precision | 79.5% | 78.2% | 60.8% | 51.2% | 44.3% |
| Positives bought | 795 | 782 | 608 | 512 | 443 |

Round 1 is nearly 80% accurate; by round 5 we are at 44%, closing on the pool's ~33% base
rate. Each round strips out the easy positives and leaves a harder remainder. This curve is
both the *justification* for iterating and the *warning* that the well runs dry — see §8.

**Why not uncertainty sampling?** We tested it. Replacing hunting with uncertainty
(querying near `P=0.5`) bought **2,408** positives instead of 3,140 — **732 fewer** — and
scored **0.6316**, a loss of **0.0155**. When the metric is F1 of a minority class,
spending budget to refine the boundary is worse than spending it to find more positives.
**The right acquisition function depends on the metric**, and here positive-hunting wins.

For scale, here are all three rules on the same budget:

| Acquisition rule | Positives bought | Query hit rate | Mean F1 |
|---|---|---|---|
| Random | 1,652 | 33.0% (= base rate) | 0.6124 |
| Uncertainty (`P≈0.5`) | 2,408 | 48.2% | 0.6316 |
| **Positive hunting (ours)** | **3,140** | **62.8%** | **0.6471** |

F1 rises monotonically with positives bought. That single fact is the spine of the solution.

**Why not query-by-committee?** A Random Forest *is* a committee of 100 trees, so we
tried ranking by tree-vote disagreement. It produced an **identical** ranking to the
probability score (because the RF probability already *is* the fraction of trees voting
"Left"). No extra signal — a good reminder to check whether a fancy method actually
differs from the simple one before adopting it.

---

## 6. The Final Trick: Rebalancing via Positive Duplication

After hunting, our labeled set has ~3,300 positives and ~1,700 negatives (the scout's
false alarms). We now train the **final** forest — but with one modification: we
**duplicate every known positive once**, so each positive appears twice in the training
data.

Why does copying rows help? Recall from Section 3 that we **cannot move the 0.5
threshold**. Duplicating positives is a back-door way to achieve the same effect:

- More positive rows → more trees see positives in their bootstrap sample → the forest
  votes "Left" more readily → **recall goes up**.
- Recall rising faster than precision falls → **F1 goes up** (up to a point).

This is a form of **oversampling**, the standard remedy for class imbalance. We swept the
ratio on a *fixed* labeled set — so the only thing changing is the training composition:

| Positive duplication | Mean F1 | Per-seed |
|----------------------|---------|----------|
| 1× (no duplication) | 0.6293 | 0.622 / 0.635 / 0.631 |
| 1.25× | 0.6372 | 0.626 / 0.640 / 0.645 |
| 1.5× | 0.6359 | 0.628 / 0.646 / 0.634 |
| 1.75× | 0.6388 | 0.633 / 0.640 / 0.644 |
| **2× (our choice)** | **0.6471** | 0.638 / 0.649 / 0.654 |
| 2.25× | 0.6410 | 0.628 / 0.652 / 0.643 |
| 2.5× | 0.6411 | 0.630 / 0.645 / 0.648 |
| 3× | 0.6465 | 0.640 / 0.652 / 0.649 |
| 4× | 0.6424 | 0.628 / 0.646 / 0.653 |

**How to read this honestly.** There are two very different claims here, and only one of
them is supported:

- **Supported: duplication works.** 1× → 2× is **+0.0178**, roughly 3½× our noise floor
  (±0.005, §8). Every seed improves. This is the single biggest gain in the project — bigger
  than everything our acquisition rule bought us.
- **Not supported: "2× is optimal."** 2× and 3× differ by **0.0006**. The dip at 2.25–2.5×
  is *larger* than the gap between the two "best" points. That is a noise pattern, not a
  peak. Re-running with a different row order would likely reorder them.

So the defensible statement is: **F1 is flat across roughly 2×–3×, and we picked 2× as the
centre of that plateau.** Note also that 4× only costs 0.005 — the forest does *not* fall
off a cliff, contrary to what we assumed before measuring it. Precision does decay
(0.584 at 2×), but recall (0.725) rises enough to hold F1 nearly level.

This is the kind of place where it is easy to fool yourself: a sweep with a visible maximum
*looks* like it found something, and reporting "we tuned it to 2×" would sound more
impressive than "anything in 2–3 works". The second sentence is the true one.

---

## 7. Putting It Together — Annotated Code

```python
N_ROUNDS = 5
POSITIVE_DUPLICATION = 2

def run_active_learning(seed):
    pool = load_pool()
    # Encode the whole pool ONCE (one-hot) and reuse it everywhere.
    # This is the single biggest runtime optimization: we never re-encode.
    X_pool, _, _ = prepare_xy(pool.assign(Attrition=0))

    # Start from the free 500 labels.
    known_rows, known_labels = <rows of the initial labeled set>

    for round in range(N_ROUNDS):
        # (1) Retrain the scout on everything labeled so far.
        scout = train_model(X_pool[known_rows], known_labels, ...)
        # (2) Score every still-unlabeled employee by P(Left).
        left_scores = scout.predict_proba(X_pool[unlabeled])[:, left_col]
        # (3) Query the top ~1,000 most-likely-positive employees.
        picked = unlabeled[argsort(-left_scores)[:batch]]
        picked_labels = call_oracle(picked)       # spend budget
        # (4) Fold them into the labeled set.
        known_rows, known_labels += picked, picked_labels

    # (5) Duplicate positives to bias the fixed forest toward recall.
    positives = known_rows[known_labels == 1]
    train_rows   = known_rows + positives          # positives now appear 2×
    train_labels = known_labels + [1]*len(positives)

    return train_model(X_pool[train_rows], train_labels, ...)
```

Design choices worth noting:

- **Encode once.** `prepare_xy` (one-hot encoding) is the slow step; doing it a single
  time for the whole pool keeps every seed far under the 60s limit. Measured wall-clock
  varies a lot with machine load — we have seen 8s/seed on an idle machine and 19–35s/seed
  under load. Even the worst case leaves ~25s of headroom, but it is *not* the 50s of margin
  an idle benchmark suggests. Budget accordingly.
- **Budget-driven batch sizes.** The batch size is computed from
  `get_oracle_usage()["remaining"]`, so the code still works if the grading machine's
  budget differs from ours — it never assumes exactly 5,000.
- **Everything stays inside the rules.** Only allowed imports (`numpy`, `pandas`,
  `sklearn`, `utils`), the fixed forest, no training on test IDs (the framework enforces
  this), no threshold tampering.

**Result:** mean F1 = **0.6471** (seeds: 0.638 / 0.649 / 0.654), up from the 0.6408
one-shot starting point, comfortably above the 0.55 guarantee line.

---

## 8. How Far Can This Go? A Ceiling Analysis

A good engineer proves *when to stop*. We asked: is 0.647 near the best achievable, or
are we leaving points on the table?

**(a) How many positives can we possibly buy?** With the full 5,000 budget:

- Greedy positive-hunting: **3,140** positives bought (62.8% query hit rate).
- Adding uncertainty rounds: **fewer** — 2,408.
- Random: **1,652** — exactly the base rate.

How many exist? Our random 5,000-query baseline returned 33.4% positives, and a uniform
random draw is an unbiased estimate of the pool rate, so the pool holds roughly
**0.334 × 14,900 ≈ 4,950** positives. (We estimate rather than count: counting means reading
`data/.pool_labels.pkl`, which the brief forbids.)

So we buy ~3,140 of ~4,950, and **~1,800 stay invisible**.

**(b) Why can't we get them?** The per-round decay in §5 is the evidence. By round 5 the
scout — now trained on ~2,700 positives and ranking the pool by P(Left) — is right only
**44.3%** of the time, versus a 33% base rate for guessing. It has almost exhausted its
edge. The remaining positives have feature profiles that look like "Stayed" *to this forest*,
and buying more of them would cost nearly the same as random sampling.

That is the key insight: **more budget would not rescue us.** Extrapolating the decay, a
6th and 7th round would return ~40% and ~37% — the forest is asymptoting to the base rate.
**Positive recall is hard-capped by the features, not by the budget or the algorithm.**

**(c) What about the last 0.002?** We could not construct a legitimate upper bound on F1
for a given composition without reading the pool labels, so we make no claim about how close
0.6471 is to a theoretical optimum. What we *can* say is that 32 configurations failed to
beat it by more than noise (§9), which is evidence of a plateau rather than a proof of one.

In fact we found that the fixed forest's **bootstrap sampling depends on the row order**
of the training data, so two arrangements of the *same* examples can differ by ±0.005 in
F1. That means chasing anything smaller than ~0.005 on the local test is chasing
**randomness that will not transfer** to the hidden test set. Knowing this is what keeps
you from overfitting your own validation score.

---

## 9. Things We Tried That *Didn't* Work (and Why)

Negative results are results. Each of these taught something:

Negative results are results. We ran **32 configurations** and pre-declared an acceptance
bar of **+0.005** — our measured noise floor — so that we could not talk ourselves into
adopting noise. **Nothing cleared it.** The measured table (Δ vs our 0.6471):

| Idea | Mean F1 | Δ | Lesson |
|------|--------:|--:|--------|
| Tiered hard-positive oversampling | 0.6481 | **+0.0010** | Our best result — and still rejected. See below. |
| Graded batch schedule | 0.6443 | −0.0027 | Round schedule barely matters. |
| Hard-negative upweighting | 0.6434 | −0.0037 | Precision gain did not repay the recall loss. |
| 10 × 500 rounds | 0.6398 | −0.0072 | More scout updates bought slightly more positives, no F1 gain. |
| Balanced scout | 0.6379 | −0.0091 | A better-calibrated scout did not transfer to a better final model. |
| KMeans diversity in top-3× | 0.6375 | −0.0096 | Diversity inside the high-probability set reduced positive yield. |
| Cluster exploration (5% random) | 0.6345 | −0.0126 | Exploration cost positives and bought nothing. |
| **Uncertainty sampling** | 0.6316 | −0.0155 | For minority-class F1, hunt positives; don't refine the boundary. |
| **Random acquisition** | 0.6124 | −0.0347 | The floor. Everything above this is what acquisition earned. |

Plus three qualitative findings:

| Idea | Outcome | Lesson |
|------|---------|--------|
| **Query-by-committee (tree votes)** | Ranking identical to probability | An RF *is* a committee — `predict_proba` already *is* the tree vote share. Check whether your fancy method differs from the simple one before building it. |
| **Pseudo-labeling** confident rows | Hurt | Our "confident negatives" contained real positives (§8: ~1,800 look like Stayed), so pseudo-labeling injects exactly the errors we cannot detect. |
| **Feature engineering** | Impossible | `evaluate_model` → `prepare_xy` reindexes to a fixed `feature_columns` set, so training columns must match exactly. A real constraint worth finding early. |

**The most instructive result is the one we rejected.** Tiered hard-positive oversampling
*won* — by +0.0010. It is one-fifth of the noise floor, and it made seed 1 worse. Adopting
it would have been fitting our own local test set. On a hidden test set, a +0.001 local gain
is a coin flip. **The discipline of pre-declaring the bar is what made this an easy call
instead of a temptation.**

The second most instructive: **dropping "hard" negatives**. In an early experiment on the
*full* pool it helped; in the *actual* budget-constrained pipeline it hurt (0.647 → 0.627).
Same idea, opposite result — because our labeled set is already ~60% positive, so those
boundary negatives are the only thing teaching precision. **Always validate on the real
pipeline, not a convenient proxy.**

---

## 10. Concept Glossary (Quick Reference)

- **Active learning** — learning where the model chooses which examples to get labeled,
  under a budget.
- **Oracle** — the (paid, budgeted) source of ground-truth labels.
- **Acquisition function** — the score that ranks unlabeled examples by how useful
  labeling them would be.
- **Scout / surrogate model** — the intermediate model whose only job is to guide the
  next query.
- **Uncertainty sampling** — acquisition rule: query where `P(y=1) ≈ 0.5`.
- **Query-by-committee** — acquisition rule: query where an ensemble disagrees most.
- **Precision / Recall / F1** — positive-class correctness / positive-class coverage /
  their harmonic mean.
- **Class imbalance** — one class much rarer than the other; here ~33% positive.
- **Oversampling (duplication)** — repeating minority rows to rebalance training.
- **Pseudo-labeling** — treating a confident model prediction as if it were a true label.
- **Bootstrap sampling** — each Random Forest tree trains on a random resample (with
  replacement) of the rows; order-dependent given a fixed seed.
- **Decision threshold** — the cutoff on `P(y=1)` for predicting the positive class;
  fixed at 0.5 here.

---

## 11. Summary

The winning recipe is short: **hunt positives over 5 retraining rounds, then duplicate
them 2× to lean the fixed forest toward recall.** Everything else — pseudo-labeling,
uncertainty sampling, diversity, negative pruning — was tested and rejected on evidence.
The solution scores **mean F1 = 0.6471** (0.6381 / 0.6491 / 0.6539), using exactly 5,000
unique queries and finishing well inside the 60s cap.

Where the score comes from, decomposed:

| Step | Mean F1 | Gain |
|---|---:|---:|
| Initial 500 labels only | 0.4068 | — |
| + 5,000 random labels | 0.5580 | +0.151 |
| + 2× positive duplication | 0.6124 | +0.054 |
| + hunt instead of random | 0.6408 | +0.028 |
| + iterate over 5 rounds | **0.6471** | +0.006 |

Two honest caveats. **First**, we do not claim 0.647 is optimal — we could not build a
legitimate upper bound without reading the pool labels. We claim only that ~1,800 positives
are invisible to this forest (§8), that our round-5 yield has decayed to near the base rate,
and that 32 alternatives failed to beat us by more than noise. **Second**, our own noise
floor is ±0.005, so expect the hidden test set to land somewhere around 0.642–0.652 rather
than exactly 0.6471.

The deepest lesson is that **the evaluation metric — F1 of a fixed-threshold minority class
— dictates the strategy**. It turns "label the most informative points" into "find the most
positives and train on the right class ratio." Every gain in the table above came from
taking that sentence seriously; every idea we rejected came from ignoring it. Read the
metric before you write the algorithm.
