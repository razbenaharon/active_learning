"""Preserved baseline snapshot from strategy.py before the controlled experiments."""

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
POSITIVE_DUPLICATION = 2


def _train_quietly(X, y, ids, seed: int):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return train_model(X, y, ids, seed=seed)


def run_active_learning(seed: int):
    pool = load_pool()
    pool_ids = pool["Employee ID"].astype(str).to_numpy()

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

    positive_rows = known_rows[known_labels == 1]
    extra = np.tile(positive_rows, POSITIVE_DUPLICATION - 1)
    train_rows = np.concatenate([known_rows, extra])
    train_labels = np.concatenate([known_labels, np.ones(len(extra), dtype=int)])

    return _train_quietly(
        X_pool.iloc[train_rows], train_labels, pool_ids[train_rows], seed
    )
