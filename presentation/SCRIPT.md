# Video script — Project B, Section A

**Hard limit: 100 seconds.** Six slides. Both speakers must contribute meaningfully
(3 of the 15 points). Word counts below assume ~2.7 words/second, which is an unhurried
presenting pace. Total ≈ 262 words ≈ 97 s, leaving ~3 s of headroom.

Raz opens and carries the "what we buy" argument; Lior carries the "how we spend and
reweight" argument and closes. Each speaker has two slides plus a shared handoff, so
neither is a narrator for the other.

| Slide | Speaker | Target | Cumulative |
|---|---|---|---|
| 1 — Setup & insight | Raz | 15 s | 0:15 |
| 2 — Acquisition rule | Raz | 20 s | 0:35 |
| 3 — Iterative rounds | Lior | 18 s | 0:53 |
| 4 — Duplication | Lior | 20 s | 1:13 |
| 5 — What failed | Raz | 17 s | 1:30 |
| 6 — Result | Lior | 10 s | 1:40 |

---

## Slide 1 — Raz (15 s, 41 words)

> Fourteen thousand nine hundred unlabeled employees. Five hundred free labels, five
> thousand we can buy, and a Random Forest we're not allowed to change. Two facts decided
> everything: only the positive class scores, and the half threshold is frozen.

## Slide 2 — Raz (20 s, 55 words)

> So we asked what a label is worth. Random sampling buys sixteen-fifty positives — the
> base rate. Textbook uncertainty sampling buys twenty-four hundred. Just asking for the
> most-likely positives buys thirty-one-forty, and wins by point-oh-one-five F1. When the
> metric is minority-class F1, refining the boundary is the wrong instinct.

**Handoff:** "Lior — so when do we spend it?"

## Slide 3 — Lior (18 s, 49 words)

> In five rounds, not one. Retraining the scout between rounds buys two hundred forty extra
> positives for free. But look at the decay — eighty percent yield in round one, forty-four
> by round five, closing on the thirty-three percent base rate. We're running out of vein.

## Slide 4 — Lior (20 s, 55 words)

> Now the threshold. It's frozen, so we move the data instead: duplicate every positive
> once. That's plus point-oh-one-eight — our biggest win. But be careful. Two-x and three-x
> differ by point-oh-six percent, well inside our noise floor. So we claim duplication
> matters — not that two is magic.

**Handoff:** "Raz, what didn't work?"

## Slide 5 — Raz (17 s, 46 words)

> Thirty-two configurations. We pre-declared a plus-point-oh-oh-five bar — our measured
> noise — and nothing cleared it. Our best candidate gained point-oh-oh-one and hurt seed
> one, so we rejected it. Query-by-committee turned out identical to probability: a forest
> already is a committee.

## Slide 6 — Lior (10 s, 26 words)

> Point-six-four-seven-one mean F1, every seed inside thirty-five seconds. The lesson:
> read the metric before you write the algorithm. It quietly rewrote the whole problem.

---

## Delivery notes

- **Say numbers as words, not digits** — "point-six-four-seven-one" reads at a natural pace;
  "0.6471" tempts you to rush it.
- **The two handoffs are scripted on purpose.** A clean verbal pass beats a silent cut, and
  it makes both speakers' participation unmistakable to the grader.
- **Slide 4 is the one to protect if you run long.** The "2x vs 3x is inside the noise"
  point is the single most rubric-aligned sentence in the deck — it is exactly the
  "critical discussion" the 7.5-point empirical criterion asks for. Cut from slide 1 instead.
- **Do not read the takeaway boxes aloud.** They are there so the figures are
  self-interpreting to a grader who pauses the video; the script deliberately says
  something different from the box, so the two channels add rather than repeat.
- Record at 1280x720 or larger, deck at browser zoom 100%, one slide filling the frame.
