/* Chapter 0 · State / territory tile-grid map (Vega-Lite)
 * Idiom: equal-sized tiles arranged to echo Australia's geography, so small
 * jurisdictions (ACT, TAS) are as visible as huge ones (WA, NT).
 * Two views (toggle):
 *   rate -> sequential classes of the participation rate (light = low, dark = high)
 *   diff -> diverging classes of the difference from Australia (coral below, teal above)
 * Click a tile to focus the waffle chart on that state.
 */
(function (Ch0) {
  const { state, aggregate, fmtInt, fmtPct, $ } = Ch0;
  const INK = "#14213d";
  const BORDER = "rgba(20, 33, 61, 0.18)";

  // col/row place each tile roughly where the state sits on the map
  const REGIONS = [
    { name: "Northern Territory",           code: "NT",  col: 1, row: 0 },
    { name: "Queensland",                   code: "QLD", col: 2, row: 0 },
    { name: "Western Australia",            code: "WA",  col: 0, row: 1 },
    { name: "South Australia",              code: "SA",  col: 1, row: 1 },
    { name: "New South Wales",              code: "NSW", col: 2, row: 1 },
    { name: "Australian Capital Territory", code: "ACT", col: 3, row: 1 },
    { name: "Victoria",                     code: "VIC", col: 2, row: 2 },
    { name: "Tasmania",                     code: "TAS", col: 2, row: 3 },
  ];

  // Fixed classes (never re-scaled per filter) so colours stay comparable across years/filters.
  const MODES = {
    rate: {
      edges: [70, 85, 90, 95],
      colors: ["#e6f1f5", "#b3d4df", "#78b0c4", "#2f7d9a", "#0e4a62"],
      whiteText: [3, 4], // class indexes that need white text
      labels: ["< 70%", "70–85%", "85–90%", "90–95%", "≥ 95%"],
      legendTitle: "Participation",
    },
    diff: {
      edges: [-10, -3, -1, 1, 3],
      colors: ["#c2410c", "#f0745a", "#f8cbbd", "#ebe7df", "#9fc9d8", "#1f6f8b"],
      whiteText: [0, 5],
      labels: ["≤ −10 pp", "−10 to −3", "−3 to −1", "within ±1", "+1 to +3", "≥ +3 pp"],
      legendTitle: "vs Australia",
    },
  };

  let mode = "rate";
  let view = null;
  const binIdx = (v) => MODES[mode].edges.filter((e) => v >= e).length;
  const signed = (d) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)} pp`;

  function tilesData() {
    const m = MODES[mode];
    const aus = aggregate(state.year, Ch0.AUS);
    const hasSel = state.region !== Ch0.AUS;
    return REGIONS.map((r) => {
      const cur = aggregate(state.year, r.name);
      const prev = aggregate(state.year - 1, r.name);
      const diff = cur.pct - aus.pct;
      const value = mode === "rate" ? cur.pct : diff;
      const selected = r.name === state.region;
      return {
        ...r,
        region: r.name,
        pct: cur.pct,
        diff,
        value,                                              // field that drives colour
        label: mode === "rate" ? `${fmtPct(cur.pct)}%` : signed(diff).replace(" pp", ""),
        ink: m.whiteText.includes(binIdx(value)) ? "#ffffff" : INK,
        selected,
        dim: hasSel && !selected,
        participation: `${fmtPct(cur.pct)}%`,
        enrolled: fmtInt(cur.enrolled),
        vsAus: signed(diff),
        vsPrev: prev ? signed(cur.pct - prev.pct) : "n/a (first year)",
        context: `${state.year} · ${Ch0.levelPhrase()} · ${Ch0.domainPhrase()}`,
      };
    });
  }

  function size() {
    const w = $("map").parentElement.clientWidth || 380;
    return Math.max(260, Math.min(400, w));
  }

  function spec(tiles) {
    const s = size();
    const step = s / 4;
    const m = MODES[mode];
    const band = (n) => ({ domain: Array.from({ length: n }, (_, i) => i), paddingInner: 0.08, paddingOuter: 0 });
    const dim = { condition: { test: "datum.dim", value: 0.5 }, value: 1 };
    const textColor = { field: "ink", type: "nominal", scale: null, legend: null };
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: s, height: s, background: null,
      config: { view: { stroke: null }, font: Ch0.font },
      data: { name: "tiles", values: tiles },
      encoding: {
        x: { field: "col", type: "ordinal", axis: null, scale: band(4) },
        y: { field: "row", type: "ordinal", axis: null, scale: band(4) },
      },
      layer: [
        {
          mark: { type: "rect", cornerRadius: 8, cursor: "pointer", tooltip: true },
          encoding: {
            fill: {
              field: "value", type: "quantitative", legend: null,
              scale: { type: "threshold", domain: m.edges, range: m.colors },
            },
            stroke: { condition: { test: "datum.selected", value: INK }, value: BORDER },
            strokeWidth: { condition: { test: "datum.selected", value: 3 }, value: 1 },
            opacity: dim,
            tooltip: [
              { field: "region", title: "State / territory" },
              { field: "participation", title: "Participation" },
              { field: "vsAus", title: "vs Australia" },
              { field: "vsPrev", title: "vs previous year" },
              { field: "enrolled", title: "Enrolled" },
              { field: "context", title: "Selection" },
            ],
          },
        },
        {
          mark: { type: "text", dy: -step * 0.2, fontSize: Math.max(10, step * 0.14), fontWeight: 600, opacity: 0.85, cursor: "pointer" },
          encoding: { text: { field: "code" }, color: textColor, opacity: dim },
        },
        {
          mark: { type: "text", dy: step * 0.14, fontSize: Math.max(13, step * 0.22), fontWeight: 700, cursor: "pointer" },
          encoding: { text: { field: "label" }, color: textColor, opacity: dim },
        },
      ],
    };
  }

  /* ---------- text around the map ---------- */
  function renderText(tiles) {
    const ctx = `In ${state.year} (${Ch0.levelPhrase()}, ${Ch0.domainPhrase()})`;
    const byPct = [...tiles].sort((a, b) => b.pct - a.pct);
    const hi = byPct[0], lo = byPct[byPct.length - 1];

    if (mode === "rate") {
      const gap = +fmtPct(hi.pct) - +fmtPct(lo.pct); // from the displayed (rounded) values
      $("map-insight").innerHTML =
        `${ctx}, participation ranged from <strong>${fmtPct(lo.pct)}% in ${lo.region}</strong> to ` +
        `<strong>${fmtPct(hi.pct)}% in ${hi.region}</strong>, a gap of ${gap.toFixed(1)} percentage points.`;
      $("map-note").textContent =
        "Each square is one state or territory, drawn the same size so small ones like the ACT and Tasmania aren't lost. " +
        "Squares are placed to roughly mirror the map. Colour classes are fixed, so shades are comparable across years and filters.";
    } else {
      const aus = aggregate(state.year, Ch0.AUS);
      const below = tiles.filter((t) => t.diff <= -1).length;
      const above = tiles.filter((t) => t.diff >= 1).length;
      $("map-insight").innerHTML =
        `${ctx}, Australia's overall rate was <strong>${fmtPct(aus.pct)}%</strong>. ` +
        `<strong>${lo.region}</strong> sat ${signed(Math.abs(lo.diff)).replace("+", "")} below it` +
        (hi.diff >= 1 ? `, while <strong>${hi.region}</strong> was ${signed(hi.diff).replace("+", "")} above` : "") +
        `. ${below} ${below === 1 ? "jurisdiction is" : "jurisdictions are"} more than 1 pp below and ${above} more than 1 pp above.`;
      $("map-note").textContent =
        "Colour shows each state's rate minus Australia's overall rate, in percentage points (pp). The baseline includes every state, " +
        "so it moves when one state moves: a large fall in one place pulls the national rate down and nudges the others up. " +
        "Hover for the actual rates.";
    }

    $("map-callout").hidden = state.year !== 2026;

    const sel = state.region !== Ch0.AUS;
    $("map-selected").innerHTML = sel
      ? `Waffle chart now shows <strong>${state.region}</strong>. <a href="#waffle-card">Jump to it ↑</a>`
      : `Click a square to focus the waffle chart above on that state or territory.`;
    $("map-clear").hidden = !sel;
  }

  function buildLegend() {
    const m = MODES[mode];
    $("map-legend").innerHTML =
      `<span class="map-legend-title">${m.legendTitle}</span>` +
      m.colors.map((c, i) => `<span class="map-legend-item"><i style="background:${c}"></i>${m.labels[i]}</span>`).join("");
  }

  function syncToggle() {
    [...$("map-mode").children].forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
  }

  async function render() {
    const tiles = tilesData();
    if (!view) {
      view = (await vegaEmbed("#map", spec(tiles), { actions: false, renderer: "svg" })).view;
      view.addEventListener("click", (evt, item) => {
        const d = item && item.datum;
        if (d && d.region) Ch0.setRegion(d.region === state.region ? Ch0.AUS : d.region);
      });
    } else {
      view.change("tiles", vega.changeset().remove(vega.truthy).insert(tiles)).run();
    }
    renderText(tiles);
  }

  async function init() {
    [...$("map-mode").children].forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.mode === mode) return;
        mode = b.dataset.mode;
        syncToggle();
        buildLegend();
        view = null;      // colour scale changes with the mode, so rebuild the chart
        render();
      })
    );
    syncToggle();
    buildLegend();
    $("map-clear").addEventListener("click", () => Ch0.setRegion(Ch0.AUS));
    Ch0.onChange(render);
    await render();
  }
  function rebuild() { view = null; return render(); }

  Ch0.map = { init, rebuild };
})(window.Ch0);
