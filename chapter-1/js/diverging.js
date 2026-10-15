/* Chapter 1 · diverging stacked bar (Vega-Lite spec builder)
 * Ordered proficiency levels with the "expectation line" at zero:
 *   left  = not yet meeting expectations (Developing next to the line, Needs additional support outside it)
 *   right = meeting or exceeding expectations (Strong next to the line, Exceeding outside it)
 * Used by the hero chart and the domain deep-dive.
 */
(function (Ch1) {
  const { C } = Ch1;
  const X_DOM = [-50, 80];
  const CATS = [
    { key: "Needs additional support", field: "nas",    color: C.nas,    ink: "#ffffff" },
    { key: "Developing",               field: "dev",    color: C.dev,    ink: C.ink },
    { key: "Strong",                   field: "strong", color: C.strong, ink: C.ink },
    { key: "Exceeding",                field: "exceed", color: C.exceed, ink: "#ffffff" },
  ];

  // items: [{ label, nas, dev, strong, exceed, so, dim }] -> one segment row per bar piece
  function segments(items, plotW) {
    const segs = [];
    items.forEach((it) => {
      const pos = {
        dev:    [-it.dev, 0],
        nas:    [-(it.dev + it.nas), -it.dev],
        strong: [0, it.strong],
        exceed: [it.strong, it.strong + it.exceed],
      };
      CATS.forEach((c) => {
        const [x1, x2] = pos[c.field];
        const v = it[c.field];
        const px = (v / (X_DOM[1] - X_DOM[0])) * plotW;
        segs.push({
          label: it.label, cat: c.key, value: v, x1, x2, mid: (x1 + x2) / 2,
          color: c.color, ink: c.ink, dim: !!it.dim,
          showVal: px >= 26, valLabel: `${v.toFixed(0)}`,
          tRow: it.label, tCat: c.key, tVal: `${v.toFixed(1)}% of students`,
          tMeet: `${it.so.toFixed(1)}% Strong or above`,
        });
      });
    });
    return segs;
  }

  function spec({ name, labels, segs, plotW, step, showAxis, header, labelW }) {
    const AXIS = {
      values: [-40, -20, 0, 20, 40, 60, 80], labelExpr: "abs(datum.value) + '%'",
      grid: true, gridColor: "#eee8dc", domain: false, ticks: false, labels: showAxis,
      title: showAxis ? "% of students" : null, titleColor: C.muted, titleFontSize: 11, titleFontWeight: 500,
      labelColor: C.muted, titlePadding: 8,
    };
    const X = { type: "quantitative", scale: { domain: X_DOM, nice: false, zero: false }, axis: AXIS };
    const Y = {
      field: "label", type: "ordinal", scale: { domain: labels, padding: 0.22 },
      axis: { title: null, ticks: false, domain: false, labelFontSize: 12, labelFontWeight: 600, labelColor: C.ink,
              labelPadding: 10, minExtent: labelW, maxExtent: labelW },
    };
    const dim = { condition: { test: "datum.dim", value: 0.55 }, value: 1 };
    const ink = { field: "ink", type: "nominal", scale: null, legend: null };
    const layers = [
      {
        mark: { type: "bar", stroke: "#ffffff", strokeWidth: 1.5, cornerRadius: 2, tooltip: true },
        encoding: {
          y: Y, x: { field: "x1", ...X }, x2: { field: "x2" },
          color: { field: "color", type: "nominal", scale: null, legend: null },
          opacity: dim,
          tooltip: [
            { field: "tRow", title: "Group" }, { field: "tCat", title: "Proficiency level" },
            { field: "tVal", title: "Share" }, { field: "tMeet", title: "Meeting expectations" },
          ],
        },
      },
      { data: { values: [{ x: 0 }] }, mark: { type: "rule", color: C.ink, strokeWidth: 1.5 }, encoding: { x: { field: "x", ...X } } },
      {
        transform: [{ filter: "datum.showVal" }],
        mark: { type: "text", baseline: "middle", fontSize: 11, fontWeight: 700 },
        encoding: { y: Y, x: { field: "mid", ...X }, text: { field: "valLabel" }, color: ink, opacity: dim },
      },
    ];
    if (header) {
      layers.push({
        data: { values: plotW >= 520
          ? [{ x: -25, t: "NOT YET MEETING EXPECTATIONS" }, { x: 40, t: "MEETING OR EXCEEDING EXPECTATIONS" }]
          : [{ x: -25, t: "NOT YET MEETING" }, { x: 40, t: "MEETING OR ABOVE" }] },
        mark: { type: "text", fontSize: 10, fontWeight: 700, color: C.muted, align: "center" },
        encoding: { x: { field: "x", ...X }, y: { value: -12 }, text: { field: "t" } },
      });
    }
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      background: null,
      padding: { left: 6, right: 10, top: header ? 24 : 6, bottom: 6 },
      config: { view: { stroke: null }, font: Ch1.font },
      width: plotW, height: { step },
      data: { name, values: segs },
      layer: layers,
    };
  }

  // Legend: coloured keys in order, split by the expectation line
  function legendHTML() {
    const key = (c) => `<span class="lg"><i class="lg-sq" style="background:${c.color}"></i>${c.key}</span>`;
    return key(CATS[0]) + key(CATS[1]) + `<span class="lg-sep" title="Expectation line"></span>` + key(CATS[2]) + key(CATS[3]);
  }

  Ch1.diverging = { segments, spec, legendHTML, X_DOM };
})(window.Ch1);
