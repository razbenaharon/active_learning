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
 * Copy rule: the slides carry EVIDENCE, the speakers carry the ARGUMENT. Anything
 * a presenter says out loud lives in addNotes, not on the slide. Nothing on a slide
 * is a sentence the audience has to read while someone talks over it.
 *
 * Layout note: no annotation is positioned relative to a chart's internal plot
 * area. That geometry is decided by PowerPoint at render time, so reference lines
 * are real series and callouts are captions in normal flow.
 *
 * PowerPoint-specific landmines, all found by opening the file, not by the XSD
 * validator (which passes files PowerPoint refuses to open):
 *   - lineDataSymbolLineSize must be an INTEGER; 1.5 corrupts the deck.
 *   - lineDash: ["solid","dash"] corrupts the deck.
 *   - invertedColors as a bare string renders bars near-black; colour per point.
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
  onDark: "C3CEE4",
  onDark2: "8E9CB8",
  rule: "2C3A5C",
};

const F = { head: "Cambria", body: "Calibri" };

// -------------------------------------------------- type scale (pt)
// Sized for a screen recording: legible when the video is watched at half size.
const T = {
  title: 38,     // ~35 char budget at 10.4in in Cambria bold
  sub: 20,
  chartTitle: 16,
  chartSub: 13,
  take: 18,
  body: 18,
  lead: 22,
  stat: 52,
  cap: 13,
  label: 14,
  axis: 13,
};

// -------------------------------------------------- vertical rhythm (inches)
// Slide is 13.333 x 7.5. Content spans x 0.72 -> 12.61.
const L = {
  chipY: 0.5,
  titleY: 0.7, titleH: 0.85,
  subY: 1.62, subH: 0.42,
  cTitleY: 2.16, cTitleH: 0.3,
  cSubY: 2.5, cSubH: 0.26,
  chartY: 2.5, chartH: 3.3,
  capY: 5.9, capH: 0.3,
  takeY: 6.3, takeH: 0.7,
  left: 0.72,
};

const data = {
  acq: { names: ["Random", "Uncertainty", "Hunting"], pos: [1652, 2408, 3140], f1: [0.6124, 0.6316, 0.6471] },
  rounds: { labels: ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5"], prec: [79.5, 78.2, 60.8, 51.2, 44.3] },
  dup: {
    labels: ["1x", "1.25x", "1.5x", "1.75x", "2x", "2.25x", "2.5x", "3x", "4x"],
    f1: [0.6293, 0.6372, 0.6359, 0.6388, 0.6471, 0.641, 0.6411, 0.6465, 0.6424],
  },
  failed: [
    ["Tiered oversampling", 0.001],
    ["Graded batches", -0.0027],
    ["Hard-negative upweight", -0.0037],
    ["10 x 500 rounds", -0.0072],
    ["Balanced scout", -0.0091],
    ["KMeans diversity", -0.0096],
    ["Cluster exploration", -0.0126],
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
    x: 11.16, y: L.chipY, w: 1.04, h: 0.34, rectRadius: 0.17,
    fill: { color: dark ? C.accentLt : C.accent }, line: { type: "none" },
  });
  s.addText(who.toUpperCase(), {
    x: 11.16, y: L.chipY, w: 1.04, h: 0.34, margin: 0,
    fontFace: F.body, fontSize: 12, bold: true, charSpacing: 1,
    color: dark ? C.ground : C.white, align: "center", valign: "middle",
  });
  s.addText(`${n} / 6`, {
    x: 12.28, y: L.chipY, w: 0.55, h: 0.34, margin: 0,
    fontFace: F.body, fontSize: 12, color: dark ? C.onDark2 : C.muted,
    align: "right", valign: "middle",
  });
}

// Titles stay on one line: ~35 chars at 38pt Cambria bold in 10.4in.
function title(s, txt, sub, dark) {
  s.addText(txt, {
    x: L.left, y: L.titleY, w: 10.4, h: L.titleH, margin: 0,
    fontFace: F.head, fontSize: T.title, bold: true,
    color: dark ? C.white : C.ink, valign: "top",
  });
  if (sub)
    s.addText(sub, {
      x: L.left, y: L.subY, w: 11.6, h: L.subH, margin: 0,
      fontFace: F.body, fontSize: T.sub, color: dark ? C.onDark : C.ink2, valign: "top",
    });
}

function chartHead(s, x, w, t, sub) {
  s.addText(t, {
    x, y: L.cTitleY, w, h: L.cTitleH, margin: 0,
    fontFace: F.body, fontSize: T.chartTitle, bold: true, color: C.ink,
  });
  if (sub)
    s.addText(sub, {
      x, y: L.cSubY, w, h: L.cSubH, margin: 0,
      fontFace: F.body, fontSize: T.chartSub, color: C.muted,
    });
}

/**
 * The repeated stat motif: big amber figure over a short caption.
 * Height is derived from the point size rather than hardcoded — at 52pt a fixed
 * 0.82in box clipped the digits.
 */
function stat(s, x, y, w, big, cap, dark, size = T.stat, muteFig = false) {
  const h = (size * 1.22) / 72 + 0.04;
  s.addText(big, {
    x, y, w, h, margin: 0,
    fontFace: F.head, fontSize: size, bold: true,
    color: muteFig ? C.muted : dark ? C.accentLt : C.accent,
  });
  s.addText(cap, {
    x, y: y + h, w, h: 0.3, margin: 0,
    fontFace: F.body, fontSize: 13, color: dark ? C.onDark : C.muted,
  });
  return y + h + 0.3;
}

/** One line only. ~95 char budget at 18pt Calibri in 11.43in. */
function takeaway(s, runs) {
  s.addShape(pptx.ShapeType.roundRect, {
    x: L.left, y: L.takeY, w: 11.89, h: L.takeH, rectRadius: 0.06,
    fill: { color: C.tint }, line: { type: "none" },
  });
  s.addText(runs, {
    x: 0.98, y: L.takeY, w: 11.37, h: L.takeH, margin: 0,
    fontFace: F.body, fontSize: T.take, color: C.ink, valign: "middle",
  });
}

const axis = () => ({
  catAxisLabelColor: C.ink2, catAxisLabelFontFace: F.body, catAxisLabelFontSize: T.axis,
  valAxisLabelColor: C.muted, valAxisLabelFontFace: F.body, valAxisLabelFontSize: 12,
  valGridLine: { color: C.hair, size: 1 },
  catGridLine: { style: "none" },
  showLegend: false, showTitle: false,
  dataLabelFontFace: F.body, dataLabelFontSize: T.label, dataLabelFontBold: true,
  dataLabelColor: C.ink,
});

/* ================================================================= 1 — setup */
{
  const s = slide(true);
  chrome(s, "Raz", 1, true);
  s.addText("Project B  ·  Section A", {
    x: L.left, y: 0.5, w: 6, h: 0.32, margin: 0,
    fontFace: F.body, fontSize: 14, bold: true, charSpacing: 1.6, color: C.accentLt,
  });
  // 36pt, not 42: 'Maximise F1 on "Left".' is 22 glyphs of bold Cambria (~0.56em),
  // which needs 7.2in at 42pt and only has 6.3in before the card at x=7.15.
  s.addText("Buy 5,000 labels.\nMaximise F1 on “Left”.", {
    x: L.left, y: 1.15, w: 6.3, h: 1.55, margin: 0,
    fontFace: F.head, fontSize: 36, bold: true, color: C.white, lineSpacingMultiple: 1.1,
  });

  [
    ["Unlabeled pool", "14,900"],
    ["Free labels", "500"],
    ["Oracle budget", "5,000"],
    ["Classifier", "RandomForest — fixed"],
    ["Metric", "F1 (“Left”) @ 0.5"],
  ].forEach(([k, v], i) => {
    const y = 3.24 + i * 0.6;
    s.addText(k, { x: L.left, y, w: 2.7, h: 0.46, margin: 0,
      fontFace: F.body, fontSize: T.body, color: C.onDark2, valign: "middle" });
    s.addText(v, { x: 3.46, y, w: 3.16, h: 0.46, margin: 0,
      fontFace: F.body, fontSize: T.body, bold: true, color: C.white, valign: "middle" });
    s.addShape(pptx.ShapeType.line, {
      x: L.left, y: y + 0.52, w: 5.9, h: 0, line: { color: C.rule, width: 0.75 },
    });
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 7.15, y: 1.15, w: 5.46, h: 5.4, rectRadius: 0.05,
    fill: { color: C.groundSoft }, line: { type: "none" },
  });
  s.addText("THE METRIC DICTATES THE STRATEGY", {
    x: 7.52, y: 1.5, w: 4.8, h: 0.32, margin: 0,
    fontFace: F.body, fontSize: 13, bold: true, charSpacing: 1.1, color: C.accentLt,
  });

  s.addText("Only the positive class scores.", {
    x: 7.52, y: 2.06, w: 4.8, h: 0.4, margin: 0,
    fontFace: F.body, fontSize: T.lead, bold: true, color: C.white,
  });
  s.addText("True negatives add nothing to F1.", {
    x: 7.52, y: 2.5, w: 4.8, h: 0.36, margin: 0,
    fontFace: F.body, fontSize: T.body, color: C.onDark,
  });

  s.addText("The 0.5 threshold is frozen.", {
    x: 7.52, y: 3.32, w: 4.8, h: 0.4, margin: 0,
    fontFace: F.body, fontSize: T.lead, bold: true, color: C.white,
  });
  s.addText("The grader calls predict(). The only\nlever left is what we train on.", {
    x: 7.52, y: 3.76, w: 4.8, h: 0.7, margin: 0,
    fontFace: F.body, fontSize: T.body, color: C.onDark, lineSpacingMultiple: 1.16,
  });

  s.addShape(pptx.ShapeType.line, {
    x: 7.52, y: 4.78, w: 4.8, h: 0, line: { color: C.rule, width: 1 },
  });
  s.addText("So: hunt positives,\nthen reweight.", {
    x: 7.52, y: 5.0, w: 4.8, h: 0.86, margin: 0,
    fontFace: F.body, fontSize: 24, bold: true, color: C.accentLt, lineSpacingMultiple: 1.12,
  });
  s.addText("Raz Ben Aharon  ·  Lior Malachi", {
    x: 7.52, y: 6.02, w: 4.8, h: 0.32, margin: 0,
    fontFace: F.body, fontSize: 13, color: C.onDark2,
  });

  s.addNotes(
    "Fourteen thousand nine hundred unlabeled employees. Five hundred free labels, five " +
      "thousand we can buy, and a Random Forest we're not allowed to change. Two facts " +
      "decided everything: only the positive class scores, and the half threshold is frozen.  [~15s]"
  );
}

/* ============================================================= 2 — what to buy */
{
  const s = slide(false);
  chrome(s, "Raz", 2, false);
  title(s, "Hunt positives, don’t refine", "Same 5,000-query budget. Three acquisition rules.", false);

  chartHead(s, L.left, 5.9, "True positives bought");
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
  s.addText("Hit rate  33.0%  ·  48.2%  ·  62.8%", {
    x: L.left, y: L.capY, w: 5.9, h: L.capH, margin: 0,
    fontFace: F.body, fontSize: T.cap, color: C.muted,
  });

  chartHead(s, 6.81, 5.8, "Resulting mean F1 (“Left”)");
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
      { text: " vs uncertainty", options: { color: C.muted } },
    ],
    { x: 6.81, y: L.capY, w: 5.8, h: L.capH, margin: 0, fontFace: F.body, fontSize: T.cap }
  );

  takeaway(s, [
    { text: "More positives ⇒ higher F1. ", options: { bold: true } },
    { text: "Uncertainty sampling buys 732 fewer — and loses 0.0155." },
  ]);
  s.addNotes(
    "So we asked what a label is worth. Random sampling buys sixteen-fifty positives — the " +
      "base rate. Textbook uncertainty sampling buys twenty-four hundred. Just asking for the " +
      "most-likely positives buys thirty-one-forty, and wins by point-oh-one-five F1. When the " +
      "metric is minority-class F1, refining the boundary is the wrong instinct.  [~20s]   " +
      "Handoff: “Lior — so when do we spend it?”"
  );
}

/* ============================================================= 3 — when to buy */
{
  const s = slide(false);
  chrome(s, "Lior", 3, false);
  title(s, "5 rounds beat one big order", "Retraining the scout between rounds sharpens its ranking.", false);

  chartHead(s, L.left, 8.4, "Query precision per round — the vein runs out");
  // Base rate is a real series, not a floating overlay. Built as a combo (same
  // axes, no secondary) so the flat reference can carry showValue:false — a
  // chart-level showValue would stamp "33.0%" on all five of its points.
  s.addChart(
    [
      {
        type: pptx.ChartType.line,
        data: [{ name: "Batch precision", labels: data.rounds.labels, values: data.rounds.prec }],
        options: {
          chartColors: [C.accent],
          lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 10,
          lineDataSymbolLineColor: C.white, lineDataSymbolLineSize: 2, // MUST be an integer
          showValue: true, dataLabelPosition: "t", dataLabelFormatCode: '0.0"%"',
          dataLabelFontFace: F.body, dataLabelFontSize: T.label, dataLabelFontBold: true,
          dataLabelColor: C.ink,
        },
      },
      {
        type: pptx.ChartType.line,
        data: [{ name: "Pool base rate (33%)", labels: data.rounds.labels, values: [33, 33, 33, 33, 33] }],
        options: { chartColors: [C.muted], lineSize: 2, lineDataSymbol: "none", showValue: false },
      },
    ],
    {
      x: 0.6, y: L.chartY, w: 8.5, h: L.chartH,
      valAxisMinVal: 25, valAxisMaxVal: 90, valAxisMajorUnit: 15,
      valAxisLabelFormatCode: '0"%"',
      ...axis(),
      showLegend: true, legendPos: "b", legendFontFace: F.body,
      legendFontSize: T.cap, legendColor: C.ink2,
    }
  );

  s.addShape(pptx.ShapeType.roundRect, {
    x: 9.35, y: L.chartY, w: 3.26, h: 1.6, rectRadius: 0.05,
    fill: { color: C.tint }, line: { type: "none" },
  });
  s.addText("Iterative — 5 x 1,000", {
    x: 9.62, y: 2.64, w: 2.72, h: 0.28, margin: 0,
    fontFace: F.body, fontSize: 14, bold: true, color: C.ink2,
  });
  stat(s, 9.62, 2.94, 2.72, "3,140", "positives  ·  F1 0.6471", false, 44);

  s.addShape(pptx.ShapeType.roundRect, {
    x: 9.35, y: 4.24, w: 3.26, h: 1.6, rectRadius: 0.05,
    fill: { color: C.tint }, line: { type: "none" },
  });
  s.addText("One-shot — 1 x 5,000", {
    x: 9.62, y: 4.38, w: 2.72, h: 0.28, margin: 0,
    fontFace: F.body, fontSize: 14, bold: true, color: C.ink2,
  });
  stat(s, 9.62, 4.68, 2.72, "2,900", "positives  ·  F1 0.6408", false, 44, true);

  s.addText("+240 positives, free", {
    x: 9.35, y: 5.94, w: 3.26, h: 0.32, margin: 0,
    fontFace: F.body, fontSize: 16, bold: true, color: C.good,
  });

  takeaway(s, [
    { text: "But the yield decays 79.5% → 44.3%, toward the 33% base rate. ", options: {} },
    { text: "More budget would not save us.", options: { bold: true } },
  ]);
  s.addNotes(
    "In five rounds, not one. Retraining the scout between rounds buys two hundred forty " +
      "extra positives for free. But look at the decay — eighty percent yield in round one, " +
      "forty-four by round five, closing on the thirty-three percent base rate. We're running " +
      "out of vein.  [~18s]"
  );
}

/* ============================================================ 4 — duplication */
{
  const s = slide(false);
  chrome(s, "Lior", 4, false);
  title(s, "Frozen threshold? Move the data", "Duplicating positives is the only recall lever we may pull.", false);

  chartHead(s, L.left, 8.6, "Mean F1 vs positive-duplication ratio");
  s.addChart(
    pptx.ChartType.line,
    [{ name: "Mean F1", labels: data.dup.labels, values: data.dup.f1 }],
    {
      x: 0.6, y: L.chartY, w: 8.6, h: 3.62,
      chartColors: [C.accent],
      lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 10,
      lineDataSymbolLineColor: C.white, lineDataSymbolLineSize: 2, // MUST be an integer
      showValue: true, dataLabelPosition: "t", dataLabelFormatCode: "0.0000",
      valAxisMinVal: 0.625, valAxisMaxVal: 0.65, valAxisMajorUnit: 0.005,
      valAxisLabelFormatCode: "0.000",
      ...axis(),
    }
  );
  s.addText("Copies of each known positive in the final training set", {
    x: L.left, y: 6.0, w: 8.6, h: 0.3, margin: 0,
    fontFace: F.body, fontSize: T.cap, color: C.muted,
  });

  // 40pt, not 52: "+0.0178" is 7 glyphs of bold Cambria (~0.56em each) and wrapped
  // inside the 2.66in card at the larger size.
  s.addShape(pptx.ShapeType.roundRect, {
    x: 9.45, y: L.chartY, w: 3.16, h: 1.6, rectRadius: 0.05,
    fill: { color: C.tint }, line: { type: "none" },
  });
  stat(s, 9.62, 2.74, 2.9, "+0.0178", "1x → 2x — our biggest win", false, 40);

  s.addShape(pptx.ShapeType.roundRect, {
    x: 9.45, y: 4.24, w: 3.16, h: 1.7, rectRadius: 0.05,
    fill: { color: C.tint }, line: { type: "none" },
  });
  stat(s, 9.62, 4.5, 2.9, "0.0006", "2x vs 3x — the gap", false, 40, true);
  s.addText("inside our ±0.005 noise floor", {
    x: 9.62, y: 5.56, w: 2.9, h: 0.3, margin: 0,
    fontFace: F.body, fontSize: 14, bold: true, color: C.ink,
  });

  takeaway(s, [
    { text: "Duplication matters. " },
    { text: "The exact ratio in [2, 3] does not — that gap is noise.", options: { bold: true } },
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
  title(s, "32 configurations. None survived.", "Pre-declared bar: +0.005 — our measured noise floor.", false);

  chartHead(s, L.left, 7.9, "Change in mean F1 vs our 0.6471");
  s.addChart(
    pptx.ChartType.bar,
    [{ name: "Delta vs our 0.6471", labels: data.failed.map((f) => f[0]), values: data.failed.map((f) => f[1]) }],
    {
      x: 0.6, y: L.chartY, w: 8.0, h: 3.9,
      barDir: "bar",
      // Per-point colours in DATA order: the one idea that beat us is amber, the
      // eight that lost are neutral. `invertedColors` as a string renders black.
      varyColors: true,
      chartColors: [C.accent, ...Array(8).fill(C.muted)],
      barGapWidthPct: 45,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "+0.0000;-0.0000",
      valAxisMinVal: -0.04, valAxisMaxVal: 0.005, valAxisMajorUnit: 0.01,
      valAxisLabelFormatCode: "0.000",
      catAxisOrderReverse: true,
      // Negative bars push category labels onto the bars; "low" parks them at the edge.
      catAxisLabelPos: "low",
      ...axis(),
    }
  );

  s.addShape(pptx.ShapeType.roundRect, {
    x: 8.85, y: L.chartY, w: 3.76, h: 2.24, rectRadius: 0.05,
    fill: { color: C.tint }, line: { type: "none" },
  });
  s.addText("THE “WINNER” WE REJECTED", {
    x: 9.15, y: 2.7, w: 3.2, h: 0.3, margin: 0,
    fontFace: F.body, fontSize: 13, bold: true, charSpacing: 0.8, color: C.accent,
  });
  s.addText("+0.0010 — and it hurt seed 1.", {
    x: 9.15, y: 3.08, w: 3.2, h: 0.82, margin: 0,
    fontFace: F.body, fontSize: T.lead, bold: true, color: C.ink, lineSpacingMultiple: 1.14,
  });
  s.addText("One-fifth of the noise floor. Adopting it fits our test set, not the problem.", {
    x: 9.15, y: 3.92, w: 3.2, h: 0.78, margin: 0,
    fontFace: F.body, fontSize: 14, color: C.ink2, lineSpacingMultiple: 1.14,
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 8.85, y: 4.9, w: 3.76, h: 1.66, rectRadius: 0.05,
    fill: { color: C.tint }, line: { type: "none" },
  });
  s.addText("THE SURPRISE", {
    x: 9.15, y: 5.06, w: 3.2, h: 0.3, margin: 0,
    fontFace: F.body, fontSize: 13, bold: true, charSpacing: 0.8, color: C.accent,
  });
  s.addText("Query-by-committee ≡ probability.", {
    x: 9.15, y: 5.4, w: 3.2, h: 0.62, margin: 0,
    fontFace: F.body, fontSize: T.body, bold: true, color: C.ink, lineSpacingMultiple: 1.14,
  });
  s.addText("A forest already is a committee.", {
    x: 9.15, y: 6.06, w: 3.2, h: 0.34, margin: 0,
    fontFace: F.body, fontSize: 14, color: C.ink2,
  });

  s.addText("Ceiling: round-5 precision 44% ≈ the 33% base rate. Not our algorithm — the features.", {
    x: L.left, y: 6.62, w: 7.9, h: 0.34, margin: 0,
    fontFace: F.body, fontSize: T.cap, color: C.muted, italic: true,
  });
  s.addNotes(
    "Thirty-two configurations. We pre-declared a plus-point-oh-oh-five bar — our measured " +
      "noise — and nothing cleared it. Our best candidate gained point-oh-oh-one and hurt seed " +
      "one, so we rejected it. Query-by-committee turned out identical to probability: a forest " +
      "already is a committee.  [~17s]"
  );
}

/* =============================================================== 6 — result */
{
  const s = slide(true);
  chrome(s, "Lior", 6, true);
  title(s, "Result", null, true);

  // Caption sits BELOW the figure. Bold Cambria digits are ~0.55em, so at 80pt in a
  // 3.5in box "0.6471" wrapped and dropped a digit onto the table.
  s.addText("0.6471", {
    x: L.left, y: 1.62, w: 5.4, h: 1.45, margin: 0,
    fontFace: F.head, fontSize: 80, bold: true, color: C.accentLt,
  });
  s.addText("mean F1 (“Left”)  ·  seeds 1, 2, 3", {
    x: L.left, y: 3.08, w: 5.4, h: 0.4, margin: 0,
    fontFace: F.body, fontSize: T.body, color: C.onDark,
  });

  s.addTable(
    [
      ["Seed", "F1", "Precision", "Recall", "Runtime"].map((t) => ({
        text: t,
        options: { bold: true, color: C.onDark2, fontSize: 13, fontFace: F.body },
      })),
      ...data.seeds.map((r) =>
        r.map((c) => ({ text: c, options: { color: C.white, fontSize: 16, fontFace: F.body } }))
      ),
    ],
    {
      x: L.left, y: 3.66, w: 6.6,
      colW: [1.0, 1.4, 1.6, 1.3, 1.3],
      rowH: 0.46,
      border: { type: "solid", color: C.rule, pt: 0.75 },
      fill: { color: C.ground },
      align: "left", valign: "middle", autoPage: false,
    }
  );
  s.addText("5,000 IDs used  ·  34.5 s worst case, cap 60 s  ·  0.55 line cleared by +0.097", {
    x: L.left, y: 5.76, w: 6.9, h: 0.34, margin: 0,
    fontFace: F.body, fontSize: T.cap, color: C.onDark2,
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 7.6, y: 1.5, w: 5.01, h: 5.0, rectRadius: 0.05,
    fill: { color: C.groundSoft }, line: { type: "none" },
  });
  s.addText("WHAT WE’D TELL THE NEXT TEAM", {
    x: 7.95, y: 1.86, w: 4.35, h: 0.32, margin: 0,
    fontFace: F.body, fontSize: 13, bold: true, charSpacing: 1.1, color: C.accentLt,
  });

  s.addText("Read the metric before\nwriting the algorithm.", {
    x: 7.95, y: 2.42, w: 4.35, h: 0.86, margin: 0,
    fontFace: F.body, fontSize: 24, bold: true, color: C.white, lineSpacingMultiple: 1.12,
  });
  s.addText("It rewrote the problem from “label the most informative points” to “find the most positives”.", {
    x: 7.95, y: 3.36, w: 4.35, h: 0.9, margin: 0,
    fontFace: F.body, fontSize: T.body, color: C.onDark, lineSpacingMultiple: 1.18,
  });

  s.addShape(pptx.ShapeType.line, {
    x: 7.95, y: 4.5, w: 4.35, h: 0, line: { color: C.rule, width: 1 },
  });

  s.addText("Measure your noise floor\nfirst.", {
    x: 7.95, y: 4.72, w: 4.35, h: 0.86, margin: 0,
    fontFace: F.body, fontSize: 24, bold: true, color: C.white, lineSpacingMultiple: 1.12,
  });
  s.addText("Ours was ±0.005. Without it we’d have “improved” the model nine times.", {
    x: 7.95, y: 5.66, w: 4.35, h: 0.7, margin: 0,
    fontFace: F.body, fontSize: T.body, color: C.onDark, lineSpacingMultiple: 1.18,
  });

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
