"""Controlled Section A experiment harness.

This file is deliberately outside strategy.py.  Acquisition never reads test data;
the local test set is loaded only after a completed model is returned, for external
comparison exactly as evaluation.py does.
"""

from __future__ import annotations

import argparse
import json
import time
import warnings

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.model_selection import StratifiedKFold

from utils import (
    TARGET_COLUMN,
    call_oracle,
    get_oracle_usage,
    load_initial_labeled,
    load_pool,
    load_test,
    prepare_xy,
    reset_oracle,
    set_active_seed,
    train_model,
)


def _train(X, y, ids, seed):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return train_model(X, y, ids, seed=seed)


def _positive_probability(model, X):
    col = int(np.where(model.classes_ == 1)[0][0])
    return model.predict_proba(X)[:, col]


def _normalized_features(X):
    values = np.asarray(X, dtype=np.float32)
    scale = values.std(axis=0)
    scale[scale < 1e-6] = 1.0
    return (values - values.mean(axis=0)) / scale


def _scout_scores(X_pool, rows, labels, candidates, seed, round_idx, mode):
    def fit_predict(train_rows):
        model = _train(
            X_pool.iloc[train_rows], labels[np.searchsorted(rows, train_rows)]
            if False else labels_for(train_rows),
            pool_ids_global[train_rows], seed,
        )
        return _positive_probability(model, X_pool.iloc[candidates])

    # rows are not sorted, so labels must be looked up by row explicitly.
    row_to_label = dict(zip(rows.tolist(), labels.tolist()))

    def labels_for(train_rows):
        return np.asarray([row_to_label[int(row)] for row in train_rows], dtype=int)

    def all_rows(shuffle_index=0):
        if shuffle_index == 0:
            return rows
        rng = np.random.RandomState(seed * 1000 + round_idx * 31 + shuffle_index)
        return rows[rng.permutation(len(rows))]

    def balanced_rows():
        pos = rows[labels == 1]
        neg = rows[labels == 0]
        if len(pos) == len(neg):
            return rows
        rng = np.random.RandomState(seed * 1000 + round_idx)
        if len(pos) > len(neg):
            pos = rng.choice(pos, size=len(neg), replace=False)
        else:
            neg = rng.choice(neg, size=len(pos), replace=False)
        combined = np.concatenate([pos, neg])
        return combined[rng.permutation(len(combined))]

    if mode == "balanced":
        return fit_predict(balanced_rows())
    if mode == "all_plus_balanced":
        return (fit_predict(all_rows()) + fit_predict(balanced_rows())) / 2.0
    if mode == "two_all":
        return (fit_predict(all_rows()) + fit_predict(all_rows(1))) / 2.0
    if mode == "three_all":
        return (
            fit_predict(all_rows())
            + fit_predict(all_rows(1))
            + fit_predict(all_rows(2))
        ) / 3.0
    return fit_predict(all_rows())


def _kmeans_pick(X_pool, candidates, scores, batch_size, factor, seed, round_idx):
    count = min(len(candidates), factor * batch_size)
    order = np.argsort(-scores)[:count]
    candidate_rows = candidates[order]
    candidate_scores = scores[order]
    features = _normalized_features(X_pool.iloc[candidate_rows])
    clusters = min(batch_size, len(candidate_rows))
    labels = KMeans(
        n_clusters=clusters,
        n_init=1,
        max_iter=25,
        random_state=seed * 100 + round_idx,
    ).fit_predict(features)
    chosen_local = []
    for cluster in range(clusters):
        members = np.where(labels == cluster)[0]
        if len(members):
            chosen_local.append(members[np.argmax(candidate_scores[members])])
    if len(chosen_local) < batch_size:
        used = set(chosen_local)
        chosen_local.extend(i for i in range(len(candidate_rows)) if i not in used)
    return candidate_rows[np.asarray(chosen_local[:batch_size], dtype=int)]


def _greedy_pick(
    X_pool, candidates, scores, batch_size, factor, alpha, seed, round_idx
):
    count = min(len(candidates), factor * batch_size)
    order = np.argsort(-scores)[:count]
    candidate_rows = candidates[order]
    probabilities = scores[order]
    if probabilities.max() > probabilities.min():
        probabilities = (probabilities - probabilities.min()) / (
            probabilities.max() - probabilities.min()
        )
    else:
        probabilities = np.ones_like(probabilities)
    features = _normalized_features(X_pool.iloc[candidate_rows])
    selected = np.zeros(count, dtype=bool)
    first = int(np.argmax(probabilities))
    picked = [first]
    selected[first] = True
    min_distance = np.sum((features - features[first]) ** 2, axis=1)
    for _ in range(1, min(batch_size, count)):
        available = ~selected
        diversity = min_distance.copy()
        div_available = diversity[available]
        lo, hi = div_available.min(), div_available.max()
        if hi > lo:
            diversity = (diversity - lo) / (hi - lo)
        else:
            diversity.fill(0.0)
        combined = alpha * probabilities + (1.0 - alpha) * diversity
        combined[selected] = -np.inf
        nxt = int(np.argmax(combined))
        picked.append(nxt)
        selected[nxt] = True
        distance = np.sum((features - features[nxt]) ** 2, axis=1)
        min_distance = np.minimum(min_distance, distance)
    return candidate_rows[np.asarray(picked, dtype=int)]


def _cluster_exploration_pick(
    candidates, scores, exploit_rows, explore_count, cluster_labels, covered_counts
):
    if explore_count <= 0:
        return np.empty(0, dtype=int)
    exploit_set = set(exploit_rows.tolist())
    available = np.asarray([row for row in candidates if row not in exploit_set], dtype=int)
    by_probability = available[np.argsort(-scores[[candidate_index_global[r] for r in available]])]
    picked = []
    used = set()
    working_counts = covered_counts.copy()
    while len(picked) < explore_count:
        progress = False
        cluster_order = np.argsort(working_counts)
        for cluster in cluster_order:
            for row in by_probability:
                if row not in used and cluster_labels[row] == cluster:
                    picked.append(int(row))
                    used.add(int(row))
                    working_counts[cluster] += 1
                    progress = True
                    break
            if len(picked) >= explore_count:
                break
        if not progress:
            break
    return np.asarray(picked, dtype=int)


def acquire(seed, config):
    global pool_ids_global, candidate_index_global
    t0 = time.perf_counter()
    reset_oracle()
    set_active_seed(seed)
    pool = load_pool()
    pool_ids_global = pool["Employee ID"].astype(str).to_numpy()
    X_pool, _, _ = prepare_xy(pool.assign(**{TARGET_COLUMN: 0}))
    id_to_row = {eid: i for i, eid in enumerate(pool_ids_global)}
    initial = load_initial_labeled(seed)
    rows = np.asarray(
        [id_to_row[eid] for eid in initial["Employee ID"].astype(str)], dtype=int
    )
    labels = initial[TARGET_COLUMN].astype(int).to_numpy()
    initial_count = len(labels)
    unlabeled = np.ones(len(pool_ids_global), dtype=bool)
    unlabeled[rows] = False

    schedule = config.get("schedule", [1000] * 5)
    scout_mode = config.get("scout", "all")
    selection = config.get("selection", "probability")
    early_scout_rounds = config.get("early_scout_rounds")

    cluster_labels = None
    covered_counts = None
    if selection == "exploration":
        features = _normalized_features(X_pool)
        cluster_labels = KMeans(
            n_clusters=60, n_init=1, max_iter=25, random_state=seed
        ).fit_predict(features)
        covered_counts = np.bincount(cluster_labels[rows], minlength=60).astype(int)

    for round_idx, requested_batch in enumerate(schedule):
        remaining = get_oracle_usage()["remaining"]
        if remaining <= 0:
            break
        candidates = np.where(unlabeled)[0]
        batch_size = min(requested_batch, remaining, len(candidates))
        if batch_size <= 0:
            break
        active_mode = scout_mode
        if early_scout_rounds is not None and round_idx >= early_scout_rounds:
            active_mode = "all"
        scores = _scout_scores(
            X_pool, rows, labels, candidates, seed, round_idx, active_mode
        )
        candidate_index_global = {int(row): i for i, row in enumerate(candidates)}

        if selection == "kmeans":
            picked = _kmeans_pick(
                X_pool, candidates, scores, batch_size,
                config.get("candidate_factor", 3), seed, round_idx,
            )
        elif selection == "greedy":
            picked = _greedy_pick(
                X_pool, candidates, scores, batch_size,
                config.get("candidate_factor", 3), config["alpha"], seed, round_idx,
            )
        elif selection == "exploration":
            explore_count = int(round(batch_size * config["exploration_fraction"]))
            exploit_count = batch_size - explore_count
            exploit_rows = candidates[np.argsort(-scores)[:exploit_count]]
            explore_rows = _cluster_exploration_pick(
                candidates, scores, exploit_rows, explore_count,
                cluster_labels, covered_counts,
            )
            picked = np.concatenate([exploit_rows, explore_rows])
            if len(picked) < batch_size:
                picked_set = set(picked.tolist())
                fill = [row for row in candidates[np.argsort(-scores)] if row not in picked_set]
                picked = np.concatenate([picked, np.asarray(fill[:batch_size-len(picked)], dtype=int)])
            covered_counts += np.bincount(cluster_labels[picked], minlength=60)
        else:
            picked = candidates[np.argsort(-scores)[:batch_size]]

        oracle = call_oracle(pool_ids_global[picked])
        label_map = dict(zip(
            oracle["Employee ID"].astype(str),
            oracle[TARGET_COLUMN].astype(int),
        ))
        new_labels = np.asarray([label_map[eid] for eid in pool_ids_global[picked]])
        rows = np.concatenate([rows, picked])
        labels = np.concatenate([labels, new_labels])
        unlabeled[picked] = False

    acquisition_runtime = time.perf_counter() - t0
    return {
        "X_pool": X_pool,
        "pool_ids": pool_ids_global,
        "rows": rows,
        "labels": labels,
        "initial_count": initial_count,
        "acquisition_runtime": acquisition_runtime,
        "oracle_queries": get_oracle_usage()["unique_queried"],
    }


def _oof_probabilities(state, seed):
    rows = state["rows"]
    labels = state["labels"]
    probabilities = np.zeros(len(rows), dtype=float)
    splitter = StratifiedKFold(n_splits=5, shuffle=True, random_state=seed)
    for train_idx, valid_idx in splitter.split(rows, labels):
        model = _train(
            state["X_pool"].iloc[rows[train_idx]], labels[train_idx],
            state["pool_ids"][rows[train_idx]], seed,
        )
        probabilities[valid_idx] = _positive_probability(
            model, state["X_pool"].iloc[rows[valid_idx]]
        )
    return probabilities


def _duplicate_positive_rows(state, factor, method, seed, oof=None):
    rows = state["rows"]
    labels = state["labels"]
    positives = rows[labels == 1]
    extra_count = int(round((factor - 1.0) * len(positives)))
    whole, remainder = divmod(extra_count, len(positives))
    extras = [np.tile(positives, whole)] if whole else []
    if remainder:
        if method == "difficulty":
            positive_scores = oof[labels == 1]
            subset = positives[np.argsort(positive_scores)[:remainder]]
        else:
            rng = np.random.RandomState(seed * 1009 + int(round(factor * 100)))
            subset = positives[rng.permutation(len(positives))[:remainder]]
        extras.append(subset)
    return np.concatenate([rows] + extras) if extras else rows.copy()


def final_model(state, seed, spec, oof=None):
    rows = state["rows"]
    labels = state["labels"]
    method = spec.get("method", "random")
    if method in {"random", "difficulty"}:
        train_rows = _duplicate_positive_rows(
            state, spec.get("factor", 2.0), method, seed, oof=oof
        )
    elif method == "easy1_hard3":
        positives = rows[labels == 1]
        scores = oof[labels == 1]
        hard = positives[np.argsort(scores)[:len(positives)//2]]
        train_rows = np.concatenate([rows, hard, hard])
    elif method == "tiers123":
        positives = rows[labels == 1]
        scores = oof[labels == 1]
        ordered = positives[np.argsort(scores)]
        hard, medium, easy = np.array_split(ordered, 3)
        train_rows = np.concatenate([rows, hard, hard, medium])
    else:
        train_rows = _duplicate_positive_rows(
            state, spec.get("positive_factor", 2.0), "random", seed
        )
        negative_rows = rows[labels == 0]
        negative_scores = oof[labels == 0]
        count = int(round(len(negative_rows) * spec["hard_negative_fraction"]))
        hard_negatives = negative_rows[np.argsort(-negative_scores)[:count]]
        train_rows = np.concatenate([train_rows, hard_negatives])

    row_to_label = dict(zip(rows.tolist(), labels.tolist()))
    train_labels = np.asarray([row_to_label[int(row)] for row in train_rows], dtype=int)
    t0 = time.perf_counter()
    model = _train(
        state["X_pool"].iloc[train_rows], train_labels,
        state["pool_ids"][train_rows], seed,
    )
    final_runtime = time.perf_counter() - t0
    return model, final_runtime, train_labels


def evaluate_completed_model(model, seed):
    test = load_test(seed)
    X_test, y_test, _ = prepare_xy(test)
    predictions = model.predict(X_test)
    return {
        "f1": float(f1_score(y_test, predictions, pos_label=1)),
        "precision": float(precision_score(y_test, predictions, pos_label=1)),
        "recall": float(recall_score(y_test, predictions, pos_label=1)),
    }


GROUPS = {
    "A": [
        ("A", "5x1000", {"schedule": [1000] * 5}),
        ("A", "10x500", {"schedule": [500] * 10}),
        ("A", "20x250", {"schedule": [250] * 20}),
        ("A", "graded_250_500_750_1000_1250_1250", {"schedule": [250, 500, 750, 1000, 1250, 1250]}),
    ],
    "B": [
        ("B", "kmeans_top3x", {"selection": "kmeans", "candidate_factor": 3}),
        ("B", "greedy_top3x_alpha0.75", {"selection": "greedy", "candidate_factor": 3, "alpha": 0.75}),
        ("B", "greedy_top3x_alpha0.9", {"selection": "greedy", "candidate_factor": 3, "alpha": 0.9}),
    ],
    "C": [
        ("C", "scout_all_data", {"scout": "all"}),
        ("C", "scout_balanced", {"scout": "balanced"}),
        ("C", "scout_no_positive_dup_hard_negatives_full", {"scout": "all"}),
        ("C", "two_scouts_all_plus_balanced", {"scout": "all_plus_balanced"}),
    ],
    "F": [
        ("F", "two_scouts_first_two_rounds", {"scout": "two_all", "early_scout_rounds": 2}),
        ("F", "two_scouts_all_rounds", {"scout": "two_all"}),
        ("F", "three_scouts_first_two_rounds", {"scout": "three_all", "early_scout_rounds": 2}),
    ],
    "G": [
        ("G", "95pct_hunt_5pct_cluster_explore", {"selection": "exploration", "exploration_fraction": 0.05}),
        ("G", "90pct_hunt_10pct_cluster_explore", {"selection": "exploration", "exploration_fraction": 0.10}),
    ],
}


def result_record(experiment, configuration, seed, state, metrics, runtime, train_labels):
    queried_labels = state["labels"][state["initial_count"]:]
    before_pos = int(state["labels"].sum())
    before_neg = int(len(state["labels"]) - before_pos)
    return {
        "experiment": experiment,
        "configuration": configuration,
        "seed": seed,
        **metrics,
        "runtime_sec": float(runtime),
        "oracle_queries": int(state["oracle_queries"]),
        "positives_found": int(queried_labels.sum()),
        "negatives_found": int(len(queried_labels) - queried_labels.sum()),
        "before_positive_fraction": before_pos / (before_pos + before_neg),
        "after_positive_fraction": float(train_labels.mean()),
    }


def run_acquisition_group(group):
    for experiment, name, config in GROUPS[group]:
        for seed in (1, 2, 3):
            state = acquire(seed, config)
            model, final_time, train_labels = final_model(
                state, seed, {"method": "random", "factor": 2.0}
            )
            metrics = evaluate_completed_model(model, seed)
            record = result_record(
                experiment, name, seed, state, metrics,
                state["acquisition_runtime"] + final_time, train_labels,
            )
            print(json.dumps(record), flush=True)


def run_final_group(group):
    for seed in (1, 2, 3):
        state = acquire(seed, {})
        oof = None
        oof_runtime = 0.0
        if group in {"D", "E", "H"}:
            t0 = time.perf_counter()
            oof = _oof_probabilities(state, seed)
            oof_runtime = time.perf_counter() - t0

        if group == "D":
            specs = []
            for factor in (1.0, 1.5, 1.75, 2.0, 2.25, 2.5, 3.0):
                specs.append((f"dup_{factor:g}x_random", {"method": "random", "factor": factor}, 0.0))
                specs.append((f"dup_{factor:g}x_difficulty", {"method": "difficulty", "factor": factor}, oof_runtime))
        elif group == "E":
            specs = [
                ("easy1_hard3_oof", {"method": "easy1_hard3"}, oof_runtime),
                ("easy1_medium2_hard3_oof", {"method": "tiers123"}, oof_runtime),
            ]
        else:
            specs = [
                ("dup2x_plus_top10pct_hard_negatives", {"method": "hard_negative", "positive_factor": 2.0, "hard_negative_fraction": 0.10}, oof_runtime),
                ("dup2x_plus_top20pct_hard_negatives", {"method": "hard_negative", "positive_factor": 2.0, "hard_negative_fraction": 0.20}, oof_runtime),
            ]

        for name, spec, extra_runtime in specs:
            model, final_time, train_labels = final_model(state, seed, spec, oof=oof)
            metrics = evaluate_completed_model(model, seed)
            record = result_record(
                group, name, seed, state, metrics,
                state["acquisition_runtime"] + extra_runtime + final_time, train_labels,
            )
            print(json.dumps(record), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("group", choices=list(GROUPS) + ["D", "E", "H"])
    args = parser.parse_args()
    if args.group in GROUPS:
        run_acquisition_group(args.group)
    else:
        run_final_group(args.group)
