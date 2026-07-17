/**
 * Builds ProjectB_SectionA.pptx — the 6-slide video deck.
 *
 * Slide count is capped at 6 by the brief; SLIDES is asserted against that below.
 * Every number comes from experiments/plot_data.json (regenerate with
 * experiments/make_plot_data.py). Charts are native PowerPoint charts — editable,
 * crisp at any zoom, nothing rasterised.
 *
 *   NODE_PATH=<global node_modules> node build_pptx.js
 *
 * Layout note: no annotation is positioned relative to a chart's internal plot
 * area. That geometry is decided by PowerPoint at render time and cannot be
 * predicted here, so a "floating" reference line or per-bar caption would land
 * wherever it liked. Anything that must sit next to a value is either a real
 * chart series (see the base-rate line on slide 3) or a caption in normal flow.
 */

const PptxGenJS = require("pptxgenjs");

// ---------------------------------------------------------------- palette
// Single-hue amber accent = "the positives we hunt"; everything else neutral, so
// the boldness sits in one place. Amber ordinal ramp validated light->dark on a
// white surface (2.23:1 light end, monotone L, 16 deg hue spread).
const C = {
  ground: "14213D",
  groundSoft: "22304F",
  white: "FFFFFF",
  tint: "F4F6F9",
  ink: "1B2436",
  ink2: "4A5568",
  muted: "7C8797",
  hair: "E2E6EC",
  accent: "B45309",
  accentLt: "E3A140",
  ramp1: "E3A140",
  ramp2: "C4761C",
  ramp3: "8A4A0B",
  good: "15803D",
  bad: "B91C1C",
  onDark: "C3CEE4",
  onDark2: "8E9CB8",
  rule: "2C3A5C",
};

const F = { head: "Cambria", body: "Calibri" };

// -------------------------------------------------- vertical rhythm (inches)
// Slide is 13.333 x 7.5. Content spans x 0.72 -> 12.61 (0.72 margins).
const L = {
  chipY: 0.5, // clears the 0.5in margin; sits right of the title box, never over it
  titleY: 0.72, titleH: 0.75,
  subY: 1.52, subH: 0.5,
  cTitleY: 2.1, cTitleH: 0.24,
  cSubY: 2.32, cSubH: 0.22,
  chartY: 2.56, chartH: 3.2,
  capY: 5.82, capH: 0.24,
  takeY: 6.3, takeH: 0.7,
  left: 0.72, right: 12.61,
};

const data = {
  acq: { names: ["Random", "Uncertainty", "Hunting"], pos: [1652, 2408, 3140], f1: [0.6124, 0.6316, 0.6471] },
  rounds: {
    labels: ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5"],
    prec: [79.5, 78.2, 60.8, 51.2, 44.3],
  },
  dup: {
    labels: ["1x", "1.25x", "1.5x", "1.75x", "2x", "2.25x", "2.5x", "3x", "4x"],
    f1: [0.6293, 0.6372, 0.6359, 0.6388, 0.6471, 0.641, 0.6411, 0.6465, 0.6424],
  },
  failed: [
    ["Tiered hard-positive oversampling", 0.001],
    ["Graded batch schedule", -0.0027],
    ["Hard-negative upweighting", -0.0037],
    ["10 x 500 rounds", -0.0072],
    ["Balanced scout", -0.0091],
    ["KMeans diversity", -0.0096],
    ["Cluster exploration (5%)", -0.0126],
    ["Uncertainty sampling", -0.0155],
    ["Random acquisition", -0.0347],
  ],
  seeds: [
    ["1", "0.6381", "0.573", "0.720", "19.3 s"],
    ["2", "0.6491", "0.588", "0.725", "31.3 s"],
    ["3", "0.6539", "0.592", "0.730", "34.5 s"],
  ],
};

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Raz Ben Aharon; Lior Malachi";
pptx.title = "Project B Section A - Active Learning for Employee Attrition";

let SLIDES = 0;
const slide = (dark) => {
  SLIDES++;
  const s = pptx.addSlide();
  s.background = { color: dark ? C.ground : C.white };
  return s;
};

/** Speaker chip + slide number — the one motif repeated on every slide. */
function chrome(s, who, n, dark) {
  s.addShape(pptx.ShapeType.roundRect, {
    x: 11.25, y: L.chipY, w: 0.95, h: 0.3, rectRadius: 0.15,
    fill: { color: dark ? C.accentLt : C.accent }, line: { type: "none" },
  });
  s.addText(who.toUpperCase(), {
    x: 11.25, y: L.chipY, w: 0.95, h: 0.3, margin: 0,
    fontFace: F.body, fontSize: 10, bold: true, charSpacing: 1,
    color: dark ? C.ground : C.white, align: "center", valign: "middle",
  });
  s.addText(`${n} / 6`, {
    x: 12.32, y: L.chipY, w: 0.51, h: 0.3, margin: 0,
    fontFace: F.body, fontSize: 10, color: dark ? C.onDark2 : C.muted,
    align: "right", valign: "middle",
  });
}

// Titles are kept short enough to stay on one line at 30pt Cambria in 10.4in
// (~50 chars). titleH still carries slack for a wrap rather than clipping.
function title(s, txt, sub, dark) {
  s.addText(txt, {
    x: L.left, y: L.titleY, w: 10.4, h: L.titleH, margin: 0,
    fontFace: F.head, fontSize: 30, bold: true,
    color: dark ? C.white : C.ink, valign: "top",
  });
  if (sub)
    s.addText(sub, {
      x: L.left, y: L.subY, w: 11.6, h: L.subH, margin: 0,
      fontFace: F.body, fontSize: 14, color: dark ? C.onDark : C.ink2,
      valign: "top",
    });
}

function chartHead(s, x, w, t, sub) {
  s.addText(t, {
    x, y: L.cTitleY, w, h: L.cTitleH, margin: 0,
    fontFace: F.body, fontSize: 12, bold: true, color: C.ink,
  });
  if (sub)
    s.addText(sub, {
      x, y: L.cSubY, w, h: L.cSubH, margin: 0,
      fontFace: F.body, fontSize: 10.5, color: C.muted,
    });
}

/** The repeated stat motif: big amber figure over a small caption. */
function stat(s, x, y, w, big, cap, dark, size = 38) {
  s.addText(big, {
    x, y, w, h: 0.6, margin: 0,
    fontFace: F.head, fontSize: size, bold: true,
    color: dark ? C.accentLt : C.accent,
  });
  s.addText(cap, {
    x, y: y + 0.58, w, h: 0.52, margin: 0,
    fontFace: F.body, fontSize: 11, color: dark ? C.onDark : C.muted,
  });
}

function takeaway(s, runs) {
  s.addShape(pptx.ShapeType.roundRect, {
    x: L.left, y: L.takeY, w: 11.89, h: L.takeH, rectRadius: 0.06,
    fill: { color: C.tint }, line: { type: "none" },
  });
  s.addText(runs, {
    x: 0.95, y: L.takeY, w: 11.43, h: L.takeH, margin: 0,
    fontFace: F.body, fontSize: 12.5, color: C.ink, valign: "middle",
    lineSpacingMultiple: 1.12,
  });
}

const axis = () => ({
  catAxisLabelColor: C.ink2, catAxisLabelFontFace: F.body, catAxisLabelFontSize: 11,
  valAxisLabelColor: C.muted, valAxisLabelFontFace: F.body, valAxisLabelFontSize: 10,
  valGridLine: { color: C.hair, size: 1 },
  catGridLine: { style: "none" },
  showLegend: false, showTitle: false,
  dataLabelFontFace: F.body, dataLabelFontSize: 11, dataLabelFontBold: true,
  dataLabelColor: C.ink,
});

/* ================================================================= 1 — setup */
{
  const s = slide(true);
  chrome(s, "Raz", 1, true);
  s.addText("Project B  ·  Section A", {
    x: L.left, y: 0.5, w: 6, h: 0.28, margin: 0,
    fontFace: F.body, fontSize: 11.5, bold: true, charSpacing: 1.6, color: C.accentLt,
  });
  s.addText("Buy 5,000 labels.\nMaximise F1 on “Left”.", {
    x: L.left, y: 1.0, w: 6.2, h: 1.5, margin: 0,
    fontFace: F.head, fontSize: 34, bold: true, color: C.white,
    lineSpacingMultiple: 1.06,
  });
  s.addText(
    "An oracle sells labels one employee at a time. The classifier is fixed. " +
      "The only real decision is which employees to pay for.",
    { x: L.left, y: 2.56, w: 5.9, h: 0.7, margin: 0,
      fontFace: F.body, fontSize: 13.5, color: C.onDark, lineSpacingMultiple: 1.2 }
  );

  [
    ["Unlabeled pool", "14,900"],
    ["Free initial labels", "500"],
    ["Oracle budget", "5,000 unique IDs"],
    ["Classifier", "RandomForest — fixed"],
    ["Metric", "F1 (“Left”), threshold 0.5"],
  ].forEach(([k, v], i) => {
    const y = 3.46 + i * 0.5;
    s.addText(k, { x: L.left, y, w: 2.9, h: 0.4, margin: 0,
      fontFace: F.body, fontSize: 12.5, color: C.onDark2, valign: "middle" });
    s.addText(v, { x: 3.66, y, w: 2.96, h: 0.4, margin: 0,
      fontFace: F.body, fontSize: 12.5, bold: true, color: C.white, valign: "middle" });
    s.addShape(pptx.ShapeType.line, {
      x: L.left, y: y + 0.44, w: 5.9, h: 0, line: { color: C.rule, width: 0.75 },
    });
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 7.15, y: 1.0, w: 5.46, h: 5.55, rectRadius: 0.05,
    fill: { color: C.groundSoft }, line: { type: "none" },
  });
  s.addText("THE METRIC DICTATES THE STRATEGY", {
    x: 7.47, y: 1.3, w: 4.82, h: 0.3, margin: 0,
    fontFace: F.body, fontSize: 11, bold: true, charSpacing: 1.1, color: C.accentLt,
  });
  s.addText(
    [
      { text: "Only the positive class scores. ", options: { bold: true, color: C.white } },
      { text: "True negatives contribute nothing to F1, so a label is worth buying mainly if it is — or teaches us about — a “Left”.", options: { color: C.onDark } },
    ],
    { x: 7.47, y: 1.74, w: 4.82, h: 1.2, margin: 0,
      fontFace: F.body, fontSize: 13, lineSpacingMultiple: 1.22 }
  );
  s.addText(
    [
      { text: "The 0.5 threshold is welded shut. ", options: { bold: true, color: C.white } },
      { text: "The grader calls predict(). We cannot tune it, so the only lever on precision/recall is what the forest is trained on.", options: { color: C.onDark } },
    ],
    { x: 7.47, y: 3.04, w: 4.82, h: 1.2, margin: 0,
      fontFace: F.body, fontSize: 13, lineSpacingMultiple: 1.22 }
  );
  s.addText(
    [
      { text: "Those two facts produced our two design choices: ", options: { color: C.onDark } },
      { text: "hunt positives", options: { bold: true, color: C.accentLt } },
      { text: ", then ", options: { color: C.onDark } },
      { text: "reweight by duplication", options: { bold: true, color: C.accentLt } },
      { text: ".", options: { color: C.onDark } },
    ],
    { x: 7.47, y: 4.36, w: 4.82, h: 0.95, margin: 0,
      fontFace: F.body, fontSize: 13, lineSpacingMultiple: 1.22 }
  );
  s.addText("Raz Ben Aharon   ·   Lior Malachi", {
    x: 7.47, y: 5.78, w: 4.82, h: 0.3, margin: 0,
    fontFace: F.body, fontSize: 11.5, color: C.onDark2,
  });
  s.addNotes(
    "Fourteen thousand nine hundred unlabeled employees. Five hundred free labels, five " +
      "thousand we can buy, and a Random Forest we're not allowed to change. Two facts " +
      "decided everything: only the positive class scores, and the half threshold is " +
      "frozen.  [~15s]"
  );
}

/* ============================================================= 2 — what to buy */
{
  const s = slide(false);
  chrome(s, "Raz", 2, false);
  title(
    s,
    "Hunt positives, don’t refine the boundary",
    "Same 5,000-query budget, three acquisition rules. Textbook uncertainty sampling loses to simply asking for the most-likely positives.",
    false
  );

  chartHead(s, L.left, 6.0, "True positives bought with 5,000 queries",
    "Hit rate — Random 33.0% (= base rate) · Uncertainty 48.2% · Hunting 62.8%");
  s.addChart(
    pptx.ChartType.bar,
    [{ name: "Positives bought", labels: data.acq.names, values: data.acq.pos }],
    {
      x: 0.6, y: L.chartY, w: 5.9, h: L.chartH,
      chartColors: [C.ramp1, C.ramp2, C.ramp3], varyColors: true, barGapWidthPct: 55,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "#,##0",
      valAxisMaxVal: 4000, valAxisMajorUnit: 1000,
      ...axis(),
    }
  );
  s.addText("A blind 5,000 queries returns ~1,650 — hunting nearly doubles the yield.", {
    x: L.left, y: L.capY, w: 5.8, h: L.capH, margin: 0,
    fontFace: F.body, fontSize: 10.5, color: C.muted, italic: true,
  });

  chartHead(s, 6.81, 5.8, "Resulting mean F1 (“Left”), seeds 1–3",
    "Final model, identical 2x duplication in all three");
  s.addChart(
    pptx.ChartType.bar,
    [{ name: "Mean F1", labels: data.acq.names, values: data.acq.f1 }],
    {
      x: 6.7, y: L.chartY, w: 5.9, h: L.chartH,
      chartColors: [C.ramp1, C.ramp2, C.ramp3], varyColors: true, barGapWidthPct: 55,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0000",
      valAxisMinVal: 0.58, valAxisMaxVal: 0.66, valAxisMajorUnit: 0.02,
      valAxisLabelFormatCode: "0.00",
      ...axis(),
    }
  );
  s.addText(
    [
      { text: "+0.0155", options: { bold: true, color: C.good } },
      { text: " over uncertainty sampling  ·  ", options: { color: C.muted } },
      { text: "+0.0347", options: { bold: true, color: C.good } },
      { text: " over random", options: { color: C.muted } },
    ],
    { x: 6.81, y: L.capY, w: 5.8, h: L.capH, margin: 0, fontFace: F.body, fontSize: 10.5 }
  );

  takeaway(s, [
    { text: "More positives ⇒ higher F1, monotonically. ", options: { bold: true } },
    { text: "Uncertainty sampling spends the budget near P=0.5, where labels are ambiguous but cheap to be wrong about — it buys " },
    { text: "732 fewer positives", options: { bold: true } },
    { text: " and loses " },
    { text: "0.0155", options: { bold: true } },
    { text: " F1. When the metric is minority-class F1, the classic rule is the wrong rule." },
  ]);
  s.addNotes(
    "So we asked what a label is worth. Random sampling buys sixteen-fifty positives — the " +
      "base rate. Textbook uncertainty sampling buys twenty-four hundred. Just asking for " +
      "the most-likely positives buys thirty-one-forty, and wins by point-oh-one-five F1. " +
      "When the metric is minority-class F1, refining the boundary is the wrong instinct.  " +
      "[~20s]   Handoff: “Lior — so when do we spend it?”"
  );
}

/* ============================================================= 3 — when to buy */
{
  const s = slide(false);
  chrome(s, "Lior", 3, false);
  title(
    s,
    "5 rounds beat one big order",
    "Retraining the scout between rounds sharpens its ranking — but each round strips the pool of easy positives, and the yield decays toward the base rate.",
    false
  );

  chartHead(s, L.left, 8.4, "Query precision per round — the vein runs out",
    "Share of each 1,000-query batch that came back “Left”. Mean of seeds 1–3.");
  // Base rate is a real series, not a floating overlay, so it lands on the axis
  // correctly. Built as a combo (same axes, no secondary) purely so the flat
  // reference line can carry showValue:false — a chart-level showValue would stamp
  // "33.0%" on all five of its points, which is noise.
  // NB: no per-series lineDash. `lineDash: ["solid","dash"]` builds and passes the
  // XSD, but PowerPoint refuses to open the file. Colour + legend carry identity.
  s.addChart(
    [
      {
        type: pptx.ChartType.line,
        data: [{ name: "Batch precision", labels: data.rounds.labels, values: data.rounds.prec }],
        options: {
          chartColors: [C.accent],
          lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 9,
          lineDataSymbolLineColor: C.white, lineDataSymbolLineSize: 2, // MUST be an integer: 1.5 emits XML PowerPoint refuses to open
          showValue: true, dataLabelPosition: "t", dataLabelFormatCode: '0.0"%"',
          dataLabelFontFace: F.body, dataLabelFontSize: 11, dataLabelFontBold: true,
          dataLabelColor: C.ink,
        },
      },
      {
        type: pptx.ChartType.line,
        data: [{ name: "Pool base rate (33%)", labels: data.rounds.labels, values: [33, 33, 33, 33, 33] }],
        options: {
          chartColors: [C.muted],
          lineSize: 2, lineDataSymbol: "none",
          showValue: false,
        },
      },
    ],
    {
      x: 0.6, y: L.chartY, w: 8.5, h: L.chartH,
      valAxisMinVal: 25, valAxisMaxVal: 90, valAxisMajorUnit: 15,
      valAxisLabelFormatCode: '0"%"',
      ...axis(),
      showLegend: true, legendPos: "b", legendFontFace: F.body,
      legendFontSize: 10.5, legendColor: C.ink2,
    }
  );
  s.addText("Positives bought per round: 795 · 782 · 608 · 512 · 443", {
    x: L.left, y: L.capY, w: 8.4, h: L.capH, margin: 0,
    fontFace: F.body, fontSize: 10.5, color: C.muted, italic: true,
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 9.35, y: L.chartY, w: 3.26, h: 1.5, rectRadius: 0.05,
    fill: { color: C.tint }, line: { type: "none" },
  });
  s.addText("Iterative — 5 x 1,000", {
    x: 9.6, y: 2.7, w: 2.76, h: 0.26, margin: 0,
    fontFace: F.body, fontSize: 11.5, bold: true, color: C.ink2,
  });
  stat(s, 9.6, 2.96, 2.76, "3,140", "positives  ·  mean F1 0.6471", false);

  s.addShape(pptx.ShapeType.roundRect, {
    x: 9.35, y: 4.2, w: 3.26, h: 1.5, rectRadius: 0.05,
    fill: { color: C.tint }, line: { type: "none" },
  });
  s.addText("One-shot — 1 x 5,000", {
    x: 9.6, y: 4.34, w: 2.76, h: 0.26, margin: 0,
    fontFace: F.body, fontSize: 11.5, bold: true, color: C.ink2,
  });
  s.addText("2,900", {
    x: 9.6, y: 4.6, w: 2.76, h: 0.6, margin: 0,
    fontFace: F.head, fontSize: 38, bold: true, color: C.muted,
  });
  s.addText("positives  ·  mean F1 0.6408", {
    x: 9.6, y: 5.18, w: 2.76, h: 0.44, margin: 0,
    fontFace: F.body, fontSize: 11, color: C.muted,
  });
  s.addText(
    [
      { text: "+240 positives (+8.3%)  ·  +0.0063 F1\n", options: { bold: true, color: C.good, fontSize: 12.5 } },
      { text: "Same budget. Only the feedback differs.", options: { color: C.ink2, fontSize: 10.5 } },
    ],
    { x: 9.35, y: 5.74, w: 3.26, h: 0.52, margin: 0, fontFace: F.body, lineSpacingMultiple: 1.12 }
  );

  takeaway(s, [
    { text: "The first scout sees only 500 labels, so its ranking is noisy; each round it learns from hundreds more positives and ranks better — worth " },
    { text: "+240 positives for free", options: { bold: true } },
    { text: ". But precision falling 79.5% → 44.3% is also the " },
    { text: "warning", options: { bold: true } },
    { text: ": by round 5 we are nearly guessing, which is why more budget would not save us." },
  ]);
  s.addNotes(
    "In five rounds, not one. Retraining the scout between rounds buys two hundred forty " +
      "extra positives for free. But look at the decay — eighty percent yield in round one, " +
      "forty-four by round five, closing on the thirty-three percent base rate. We're " +
      "running out of vein.  [~18s]"
  );
}

/* ============================================================ 4 — duplication */
{
  const s = slide(false);
  chrome(s, "Lior", 4, false);
  title(
    s,
    "The threshold is frozen — so move the data",
    "Duplicating each known positive shifts the forest’s vote share toward “Left”. It is the only recall lever we are allowed to pull.",
    false
  );

  chartHead(s, L.left, 8.5, "Mean F1 vs positive-duplication ratio — seeds 1–3",
    "Identical labeled set at every point; only the final training composition changes.");
  s.addChart(
    pptx.ChartType.line,
    [{ name: "Mean F1", labels: data.dup.labels, values: data.dup.f1 }],
    {
      x: 0.6, y: L.chartY, w: 8.6, h: 3.5,
      chartColors: [C.accent],
      lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 9,
      lineDataSymbolLineColor: C.white, lineDataSymbolLineSize: 2, // MUST be an integer: 1.5 emits XML PowerPoint refuses to open
      showValue: true, dataLabelPosition: "t", dataLabelFormatCode: "0.0000",
      valAxisMinVal: 0.625, valAxisMaxVal: 0.65, valAxisMajorUnit: 0.005,
      valAxisLabelFormatCode: "0.000",
      valAxisTitle: "Mean F1 (“Left”)", showValAxisTitle: true, valAxisTitleColor: C.muted,
      valAxisTitleFontFace: F.body, valAxisTitleFontSize: 10.5,
      catAxisTitle: "Copies of each known positive in the final training set",
      showCatAxisTitle: true, catAxisTitleColor: C.muted,
      catAxisTitleFontFace: F.body, catAxisTitleFontSize: 10.5,
      ...axis(),
    }
  );

  s.addShape(pptx.ShapeType.roundRect, {
    x: 9.45, y: L.chartY, w: 3.16, h: 1.62, rectRadius: 0.05,
    fill: { color: C.tint }, line: { type: "none" },
  });
  stat(s, 9.7, 2.74, 2.66, "+0.0178", "1x → 2x — the biggest single win in the project", false);

  s.addText(
    [
      { text: "…but 2x vs 3x = 0.0006\n", options: { bold: true, color: C.ink, fontSize: 13 } },
      { text: "Our noise floor is ±0.005, from training row order alone. The dip at 2.25–2.5x is larger than the gap between the two best points. That is a noise pattern, not a peak.", options: { color: C.ink2, fontSize: 11.5 } },
    ],
    { x: 9.45, y: 4.4, w: 3.16, h: 1.55, margin: 0, fontFace: F.body, lineSpacingMultiple: 1.18 }
  );
  s.addText("At 2x — precision 0.584  ·  recall 0.725", {
    x: 9.45, y: 6.0, w: 3.16, h: 0.24, margin: 0,
    fontFace: F.body, fontSize: 10.5, color: C.muted,
  });

  takeaway(s, [
    { text: "Honest reading: ", options: { bold: true } },
    { text: "the 1x → 2x jump (+0.0178) is 3½× the noise floor — real. But 2x and 3x differ by 0.0006, so we claim only what the data supports: " },
    { text: "duplication matters; the exact ratio in [2, 3] does not.", options: { bold: true, italic: true } },
    { text: " We picked 2x as the flat, robust centre — not because 0.6471 “won”." },
  ]);
  s.addNotes(
    "Now the threshold. It's frozen, so we move the data instead: duplicate every positive " +
      "once. That's plus point-oh-one-eight — our biggest win. But be careful. Two-x and " +
      "three-x differ by point-oh-six percent, well inside our noise floor. So we claim " +
      "duplication matters — not that two is magic.  [~20s]   Handoff: “Raz, what didn't work?”"
  );
}

/* =========================================================== 5 — what failed */
{
  const s = slide(false);
  chrome(s, "Raz", 5, false);
  title(
    s,
    "32 configurations tried. None survived.",
    "We pre-declared a +0.005 acceptance threshold — the measured noise floor — and held every idea to it. That is why strategy.py is still the simple one.",
    false
  );

  chartHead(s, L.left, 7.9, "Change in mean F1 vs our 0.6471 — every idea we tested",
    "Bars right of zero beat us; only one does, and by less than the noise floor.");
  s.addChart(
    pptx.ChartType.bar,
    [{ name: "Delta vs our 0.6471", labels: data.failed.map((f) => f[0]), values: data.failed.map((f) => f[1]) }],
    {
      x: 0.6, y: L.chartY, w: 8.0, h: 3.6,
      barDir: "bar",
      // Per-point colours in DATA order: the one idea that beat us is amber, the
      // eight that lost are neutral. Colour encodes "cleared zero or not", which is
      // a real distinction, not rank.
      // NB: `invertedColors` as a bare string renders every bar near-black — it
      // wants an array. Colouring per point instead sidesteps it entirely.
      varyColors: true,
      chartColors: [C.accent, ...Array(8).fill(C.muted)],
      barGapWidthPct: 45,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "+0.0000;-0.0000",
      valAxisMinVal: -0.04, valAxisMaxVal: 0.005, valAxisMajorUnit: 0.01,
      valAxisLabelFormatCode: "0.000",
      catAxisOrderReverse: true,
      // With negative bars the category labels default to the zero line, landing on
      // top of the bars. "low" parks them at the axis edge.
      catAxisLabelPos: "low",
      ...axis(),
    }
  );

  s.addShape(pptx.ShapeType.roundRect, {
    x: 8.85, y: L.chartY, w: 3.76, h: 1.9, rectRadius: 0.05,
    fill: { color: C.tint }, line: { type: "none" },
  });
  s.addText("WHY THE BEST “WINNER” WAS REJECTED", {
    x: 9.1, y: 2.74, w: 3.26, h: 0.26, margin: 0,
    fontFace: F.body, fontSize: 10, bold: true, charSpacing: 0.8, color: C.accent,
  });
  s.addText(
    [
      { text: "Tiered oversampling gained +0.0010 — one-fifth of the noise floor — and it ", options: { color: C.ink } },
      { text: "hurt seed 1", options: { bold: true, color: C.ink } },
      { text: ". Adopting it would be fitting our own test set, not improving the method.", options: { color: C.ink } },
    ],
    { x: 9.1, y: 3.04, w: 3.26, h: 1.3, margin: 0,
      fontFace: F.body, fontSize: 12, lineSpacingMultiple: 1.18 }
  );

  s.addShape(pptx.ShapeType.roundRect, {
    x: 8.85, y: 4.6, w: 3.76, h: 2.4, rectRadius: 0.05,
    fill: { color: C.tint }, line: { type: "none" },
  });
  s.addText("TWO RESULTS THAT SURPRISED US", {
    x: 9.1, y: 4.78, w: 3.26, h: 0.26, margin: 0,
    fontFace: F.body, fontSize: 10, bold: true, charSpacing: 0.8, color: C.accent,
  });
  s.addText(
    [
      { text: "Query-by-committee ≡ probability. ", options: { bold: true, color: C.ink } },
      { text: "A forest already is a committee — predict_proba is the tree vote share. Identical ranking, zero gain.\n", options: { color: C.ink2 } },
      { text: "Dropping hard negatives backfired ", options: { bold: true, color: C.ink } },
      { text: "(0.647 → 0.627). Our labeled set is already 60% positive; those boundary negatives are the only thing teaching precision.", options: { color: C.ink2 } },
    ],
    { x: 9.1, y: 5.08, w: 3.26, h: 1.8, margin: 0,
      fontFace: F.body, fontSize: 11, lineSpacingMultiple: 1.14 }
  );

  s.addText(
    "Where the ceiling comes from: round-5 precision is 44%, closing on the 33% base rate. " +
      "The ~1,800 positives we never catch look like “Stayed” to this forest — not our algorithm, the features.",
    { x: L.left, y: 6.42, w: 7.9, h: 0.56, margin: 0,
      fontFace: F.body, fontSize: 11, color: C.muted, italic: true, lineSpacingMultiple: 1.14 }
  );
  s.addNotes(
    "Thirty-two configurations. We pre-declared a plus-point-oh-oh-five bar — our measured " +
      "noise — and nothing cleared it. Our best candidate gained point-oh-oh-one and hurt " +
      "seed one, so we rejected it. Query-by-committee turned out identical to probability: " +
      "a forest already is a committee.  [~17s]"
  );
}

/* =============================================================== 6 — result */
{
  const s = slide(true);
  chrome(s, "Lior", 6, true);
  title(s, "Result", null, true);

  // Caption sits BELOW the figure, not beside it. Bold Cambria digits are wider than
  // they look (~0.55em, not 0.5em) — at 80pt in a 3.5in box "0.6471" wrapped and
  // dropped its last digit onto the table. Stacking removes the width constraint.
  s.addText("0.6471", {
    x: L.left, y: 1.55, w: 5.0, h: 1.35, margin: 0,
    fontFace: F.head, fontSize: 72, bold: true, color: C.accentLt,
  });
  s.addText("mean F1 (“Left”)  ·  over seeds 1, 2, 3", {
    x: L.left, y: 2.92, w: 5.0, h: 0.34, margin: 0,
    fontFace: F.body, fontSize: 13.5, color: C.onDark,
  });

  s.addTable(
    [
      ["Seed", "F1", "Precision", "Recall", "Runtime"].map((t) => ({
        text: t,
        options: { bold: true, color: C.onDark2, fontSize: 11, fontFace: F.body },
      })),
      ...data.seeds.map((r) =>
        r.map((c) => ({ text: c, options: { color: C.white, fontSize: 12.5, fontFace: F.body } }))
      ),
    ],
    {
      x: L.left, y: 3.4, w: 6.3,
      colW: [0.9, 1.3, 1.5, 1.3, 1.3],
      rowH: 0.38,
      border: { type: "solid", color: C.rule, pt: 0.75 },
      fill: { color: C.ground },
      align: "left", valign: "middle", autoPage: false,
    }
  );
  s.addText(
    "Budget used: exactly 5,000 unique IDs.  ·  Runtime cap 60 s/seed — worst case 34.5 s.  ·  " +
      "Guarantee line 0.55 cleared by +0.097.",
    { x: L.left, y: 5.3, w: 6.3, h: 0.6, margin: 0,
      fontFace: F.body, fontSize: 11.5, color: C.onDark2, lineSpacingMultiple: 1.15 }
  );

  s.addShape(pptx.ShapeType.roundRect, {
    x: 7.6, y: 1.66, w: 5.01, h: 4.86, rectRadius: 0.05,
    fill: { color: C.groundSoft }, line: { type: "none" },
  });
  s.addText("WHAT WE WOULD TELL THE NEXT TEAM", {
    x: 7.92, y: 1.96, w: 4.37, h: 0.28, margin: 0,
    fontFace: F.body, fontSize: 11, bold: true, charSpacing: 1.1, color: C.accentLt,
  });
  s.addText(
    [
      { text: "Read the metric before writing the algorithm. ", options: { bold: true, color: C.white } },
      { text: "“F1 of a minority class at a frozen threshold” quietly rewrites the problem from “label the most informative points” to “find the most positives and train on the right class ratio.” Every gain we made came from that sentence; every idea that ignored it lost.", options: { color: C.onDark } },
    ],
    { x: 7.92, y: 2.4, w: 4.37, h: 2.1, margin: 0,
      fontFace: F.body, fontSize: 13, lineSpacingMultiple: 1.22 }
  );
  s.addText(
    [
      { text: "Measure your noise floor first. ", options: { bold: true, color: C.white } },
      { text: "Ours was ±0.005 — from training row order alone. Without it we would have “improved” the model nine times and shipped nothing but overfitting.", options: { color: C.onDark } },
    ],
    { x: 7.92, y: 4.68, w: 4.37, h: 1.6, margin: 0,
      fontFace: F.body, fontSize: 13, lineSpacingMultiple: 1.22 }
  );
  s.addNotes(
    "Point-six-four-seven-one mean F1, every seed inside thirty-five seconds. The lesson: " +
      "read the metric before you write the algorithm. It quietly rewrote the whole problem.  [~10s]"
  );
}

// The brief caps Section A at 6 slides. Fail loudly rather than ship a 7th.
if (SLIDES !== 6) throw new Error(`Deck must be exactly 6 slides, built ${SLIDES}`);

pptx.writeFile({ fileName: "ProjectB_SectionA.pptx" }).then((f) =>
  console.log(`OK  wrote ${f}  (${SLIDES} slides)`)
);
