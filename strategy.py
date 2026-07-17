"""
Student implementation file — submit this file only.

Implement run_active_learning(seed) to run your active learning strategy and return
a trained RandomForestClassifier. You may add helper functions in this file only.

Allowed imports: numpy, pandas, sklearn, scipy, collections, warnings, typing, utils

Strategy: iterative positive hunting.

We are scored on F1 for the minority "Left" class at a fixed 0.5 threshold, and we
cannot touch the forest itself. That leaves two things we control: how many true
positives end up in the labeled set, and the class ratio we train on.

For the first, we spend the 5,000-query budget over 5 rounds instead of all at once.
Each round trains a scout on what we know so far and queries the pool samples it ranks
highest for Left. Retraining in between helps: batch precision starts at ~80% and the
iterative version buys ~240 more positives than a single-shot scout on the same budget
(0.6471 vs 0.6408 mean F1).

For the second, we duplicate each known positive once before the final fit. With the
threshold frozen we cannot trade precision for recall directly, so we do it through the
training distribution instead. This is worth about +0.018 F1 over no duplication. F1 is
flat between 2x and 3x (0.6471 vs 0.6465, within run-to-run noise), so the duplication
is what matters here, not the exact ratio.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import warnings

from utils import (
    TARGET_COLUMN,
    call_oracle,
    get_oracle_usage,
    load_initial_labeled,
    load_pool,
    prepare_xy,
    train_model,
)

N_ROUNDS = 5
POSITIVE_DUPLICATION = 2  # copies of each known positive in the final training set


def _train_quietly(X, y, ids, seed: int):
    """Train, silencing the duplicate-ID warning: the duplication is intentional."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return train_model(X, y, ids, seed=seed)


def run_active_learning(seed: int):
    """
    Run active learning for the given seed and return a trained RandomForestClassifier.

    seed is one of {1, 2, 3}; it controls randomness and picks the initial labeled set.
    """
    pool = load_pool()
    pool_ids = pool["Employee ID"].astype(str).to_numpy()

    # Encode the pool once and index into it, rather than re-encoding every round.
    X_pool, _, _ = prepare_xy(pool.assign(**{TARGET_COLUMN: 0}))
    id_to_row = {eid: i for i, eid in enumerate(pool_ids)}

    initial = load_initial_labeled(seed)
    known_rows = np.array(
        [id_to_row[eid] for eid in initial["Employee ID"].astype(str)], dtype=int
    )
    known_labels = initial[TARGET_COLUMN].astype(int).to_numpy()

    unlabeled_mask = np.ones(len(pool_ids), dtype=bool)
    unlabeled_mask[known_rows] = False

    for round_idx in range(N_ROUNDS):
        remaining_budget = get_oracle_usage()["remaining"]
        if remaining_budget <= 0:
            break
        rounds_left = N_ROUNDS - round_idx
        batch_size = min(max(1, remaining_budget // rounds_left), remaining_budget)

        scout = _train_quietly(
            X_pool.iloc[known_rows], known_labels, pool_ids[known_rows], seed
        )
        candidate_rows = np.where(unlabeled_mask)[0]
        left_col = int(np.where(scout.classes_ == 1)[0][0])
        left_scores = scout.predict_proba(X_pool.iloc[candidate_rows])[:, left_col]

        batch_size = min(batch_size, len(candidate_rows))
        if batch_size == 0:
            break
        picked = candidate_rows[np.argsort(-left_scores)[:batch_size]]

        oracle_df = call_oracle(pool_ids[picked])
        labels_by_id = dict(
            zip(
                oracle_df["Employee ID"].astype(str),
                oracle_df[TARGET_COLUMN].astype(int),
            )
        )
        picked_labels = np.array([labels_by_id[eid] for eid in pool_ids[picked]])

        known_rows = np.concatenate([known_rows, picked])
        known_labels = np.concatenate([known_labels, picked_labels])
        unlabeled_mask[picked] = False

    # Duplicate the positives so the forest leans toward recall at the fixed
    # 0.5 threshold, which is the only way left to move that tradeoff.
    positive_rows = known_rows[known_labels == 1]
    extra = np.tile(positive_rows, POSITIVE_DUPLICATION - 1)
    train_rows = np.concatenate([known_rows, extra])
    train_labels = np.concatenate([known_labels, np.ones(len(extra), dtype=int)])

    return _train_quietly(
        X_pool.iloc[train_rows], train_labels, pool_ids[train_rows], seed
    )
