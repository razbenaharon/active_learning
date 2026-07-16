"""
Generate authoritative plot data for the Section A video presentation.

Runs entirely through the official framework API (call_oracle / train_model /
evaluate_model). Never reads .pool_labels.pkl or the test pickles directly;
test labels are only ever touched via utils.evaluate_model, after a model is
already trained. This mirrors the discipline used in experiments/RESULTS.md.

Outputs plot_data.json with:
  - dup_sweep:      F1 vs positive-duplication ratio (settles the 1x conflict)
  - rounds_curve:   positives captured + scout precision per acquisition round
  - acquisition:    hunt vs uncertainty vs random  (positives found, F1)
  - oneshot:        1x5000 vs 5x1000 iterative
"""

import json
import warnings

import numpy as np

from utils import (
    TARGET_COLUMN,
    call_oracle,
    evaluate_model,
    get_oracle_usage,
    load_initial_labeled,
    load_pool,
    prepare_xy,
    reset_oracle,
    train_model,
)

SEEDS = [1, 2, 3]


def quiet_train(X, y, ids, seed):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return train_model(X, y, ids, seed=seed)


def setup(seed):
    pool = load_pool()
    pool_ids = pool["Employee ID"].astype(str).to_numpy()
    X_pool, _, _ = prepare_xy(pool.assign(**{TARGET_COLUMN: 0}))
    id_to_row = {eid: i for i, eid in enumerate(pool_ids)}

    initial = load_initial_labeled(seed)
    known_rows = np.array(
        [id_to_row[e] for e in initial["Employee ID"].astype(str)], dtype=int
    )
    known_labels = initial[TARGET_COLUMN].astype(int).to_numpy()
    return X_pool, pool_ids, known_rows, known_labels


def ask(pool_ids, picked):
    df = call_oracle(pool_ids[picked])
    m = dict(
        zip(df["Employee ID"].astype(str), df[TARGET_COLUMN].astype(int))
    )
    return np.array([m[e] for e in pool_ids[picked]])


def acquire(seed, mode="hunt", n_rounds=5, record_rounds=False):
    """Run acquisition. Returns (known_rows, known_labels, per_round_stats)."""
    reset_oracle()
    X_pool, pool_ids, known_rows, known_labels = setup(seed)
    unlabeled = np.ones(len(pool_ids), dtype=bool)
    unlabeled[known_rows] = False
    rng = np.random.RandomState(seed)
    stats = []

    for r in range(n_rounds):
        remaining = get_oracle_usage()["remaining"]
        if remaining <= 0:
            break
        batch = min(max(1, remaining // (n_rounds - r)), remaining)
        cands = np.where(unlabeled)[0]
        batch = min(batch, len(cands))
        if batch == 0:
            break

        if mode == "random":
            picked = cands[rng.choice(len(cands), batch, replace=False)]
        else:
            scout = quiet_train(
                X_pool.iloc[known_rows], known_labels, pool_ids[known_rows], seed
            )
            col = int(np.where(scout.classes_ == 1)[0][0])
            p = scout.predict_proba(X_pool.iloc[cands])[:, col]
            if mode == "hunt":
                order = np.argsort(-p)
            elif mode == "uncertainty":
                order = np.argsort(np.abs(p - 0.5))
            picked = cands[order[:batch]]

        lab = ask(pool_ids, picked)
        known_rows = np.concatenate([known_rows, picked])
        known_labels = np.concatenate([known_labels, lab])
        unlabeled[picked] = False

        if record_rounds:
            stats.append(
                {
                    "round": r + 1,
                    "batch": int(batch),
                    "batch_positives": int(lab.sum()),
                    "batch_precision": float(lab.mean()),
                    "cum_positives": int(known_labels.sum()),
                }
            )

    return X_pool, pool_ids, known_rows, known_labels, stats


def final_f1(X_pool, pool_ids, known_rows, known_labels, seed, dup):
    """Train final model with positive duplication `dup` (may be fractional)."""
    pos = known_rows[known_labels == 1]
    whole = int(np.floor(dup)) - 1
    frac = dup - np.floor(dup)
    extra = np.tile(pos, whole) if whole > 0 else np.array([], dtype=int)
    if frac > 0:
        k = int(round(frac * len(pos)))
        rng = np.random.RandomState(seed)
        extra = np.concatenate(
            [extra, rng.choice(pos, k, replace=False)]
        ).astype(int)
    rows = np.concatenate([known_rows, extra]).astype(int)
    labs = np.concatenate([known_labels, np.ones(len(extra), dtype=int)])
    m = quiet_train(X_pool.iloc[rows], labs, pool_ids[rows], seed)
    return float(evaluate_model(m, seed))


out = {"dup_sweep": {}, "rounds_curve": {}, "acquisition": {}, "oneshot": {}}

# --- Main: hunt acquisition once per seed, reuse for the whole dup sweep ---
DUPS = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 3.0, 4.0]
cache = {}
for s in SEEDS:
    Xp, pids, kr, kl, stats = acquire(s, "hunt", 5, record_rounds=True)
    cache[s] = (Xp, pids, kr, kl)
    out["rounds_curve"][s] = stats
    print(f"seed {s}: acquisition done, {int(kl.sum())} positives", flush=True)

for d in DUPS:
    scores = [final_f1(*cache[s], s, d) for s in SEEDS]
    out["dup_sweep"][str(d)] = {
        "per_seed": scores,
        "mean": float(np.mean(scores)),
    }
    print(f"dup {d}: mean F1 {np.mean(scores):.4f}  {[round(x,4) for x in scores]}", flush=True)

# --- Acquisition rule comparison (at dup=2) ---
for mode in ["hunt", "uncertainty", "random"]:
    f1s, poss = [], []
    for s in SEEDS:
        if mode == "hunt":
            Xp, pids, kr, kl = cache[s]
        else:
            Xp, pids, kr, kl, _ = acquire(s, mode, 5)
        f1s.append(final_f1(Xp, pids, kr, kl, s, 2.0))
        poss.append(int(kl.sum()))
    out["acquisition"][mode] = {
        "f1_per_seed": f1s,
        "f1_mean": float(np.mean(f1s)),
        "positives_per_seed": poss,
        "positives_mean": float(np.mean(poss)),
    }
    print(f"{mode}: F1 {np.mean(f1s):.4f}, positives {np.mean(poss):.0f}", flush=True)

# --- One-shot (1 round of 5000) vs iterative 5x1000 ---
f1s, poss = [], []
for s in SEEDS:
    Xp, pids, kr, kl, _ = acquire(s, "hunt", 1)
    f1s.append(final_f1(Xp, pids, kr, kl, s, 2.0))
    poss.append(int(kl.sum()))
out["oneshot"] = {
    "f1_per_seed": f1s,
    "f1_mean": float(np.mean(f1s)),
    "positives_per_seed": poss,
    "positives_mean": float(np.mean(poss)),
}
print(f"oneshot: F1 {np.mean(f1s):.4f}, positives {np.mean(poss):.0f}", flush=True)

with open("plot_data.json", "w") as f:
    json.dump(out, f, indent=2)
print("WROTE plot_data.json")
