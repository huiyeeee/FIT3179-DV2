/* Chapter 1 · Scene 2: heatmap of domain x year level (with "All" marginals).
 * Colour = how far each cell is from the overall national figure for the chosen metric
 * (diverging classes; for "Needs additional support" colours are flipped so coral always = worse).
 * Click a row to send that domain to the deep-dive below.
 */
(function (Ch1) {
  const { state, agg, f1, signed, dlabel, $, C } = Ch1;
  const EDGES = [-6, -2, 2, 6]; // percentage points better/worse than overall
  const COLS = ["#c2410c", "#f4a58f", "#ece8df", "#9fc9d8", "#0e5a78"];
  const WHITE = [0, 4];
  const LABEL_W = 150;
  let view = null;

  const binIdx = (g) => EDGES.filter((e) => g >= e).length;
  const xList = () => Ch1.LEVELS.map((l) => ({ key: l, label: `Year ${l}` })).concat([{ key: "ALL", label: "All years" }]);
  const yList = () => [{ key: "ALL", label: "All domains" }].concat(Ch1.DOMAINS.map((d) => ({ key: d, label: dlabel(d) })));

  function cells() {
    const m = state.metric, M = Ch1.METRICS[m];
    const overall = agg(state.year)[m];
    const out = [];
    yList().forEach((yd) => xList().forEach((xl) => {
      const a = agg(state.year, yd.key === "ALL" ? null : yd.key, xl.key === "ALL" ? null : xl.key);
      const v = a[m], diff = v - overall, idx = binIdx(diff * M.good);
      const star = yd.key === "Writing" && state.year === 2026 && xl.key !== 3; // ACARA caveat on 2026 Years 5/7/9 writing
      out.push({
        domainKey: yd.key, levelKey: xl.key, domainLabel: yd.label, levelLabel: xl.label,
        value: v, diff, label: f1(v) + (star ? "*" : ""),
        color: COLS[idx], ink: WHITE.includes(idx) ? "#ffffff" : C.ink,
        marginal: yd.key === "ALL" || xl.key === "ALL", selRow: yd.key === state.domain,
        tMetric: `${f1(v)}%${star ? " (ACARA caveat applies)" : ""}`,
        tVs: `${signed(diff)} vs overall (${f1(overall)}%)`,
        tNas: `${f1(a.nas)}%`, tDev: `${f1(a.dev)}%`, tStrong: `${f1(a.strong)}%`, tEx: `${f1(a.exceed)}%`,
        tScore: a.mean != null ? `${a.mean.toFixed(0)} (spread ${a.sd.toFixed(0)})` : "n/a across domains / year levels",
      });
    }));
    return out;
  }

  function plotW() {
    const w = $("heat-chart").parentElement.clientWidth || 800;
    return Math.max(250, Math.min(640, w - LABEL_W - 30));
  }

  function spec(data) {
    const xl = xList().map((x) => x.label), yl = yList().map((y) => y.label);
    const W = plotW();
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      background: null,
      padding: { left: 6, right: 6, top: 6, bottom: 6 },
      config: { view: { stroke: null }, font: Ch1.font },
      width: W, height: { step: Math.max(40, Math.min(54, W / 8)) },
      data: { name: "heat", values: data },
      encoding: {
        x: { field: "levelLabel", type: "ordinal", scale: { domain: xl, padding: 0.06 },
             axis: { orient: "top", title: null, ticks: false, domain: false, labelFontWeight: 600, labelFontSize: 12, labelColor: C.ink, labelPadding: 8, labelAngle: 0 } },
        y: { field: "domainLabel", type: "ordinal", scale: { domain: yl, padding: 0.06 },
             axis: { title: null, ticks: false, domain: false, labelFontWeight: 600, labelFontSize: 12, labelColor: C.ink, labelPadding: 10, minExtent: LABEL_W, maxExtent: LABEL_W } },
      },
      layer: [
        {
          mark: { type: "rect", cornerRadius: 5, cursor: "pointer", tooltip: true },
          encoding: {
            fill: { field: "color", type: "nominal", scale: null, legend: null },
            stroke: { condition: [{ test: "datum.selRow && !datum.marginal", value: C.ink }, { test: "datum.marginal", value: "rgba(20,33,61,0.45)" }], value: "transparent" },
            strokeWidth: { condition: [{ test: "datum.selRow && !datum.marginal", value: 2.5 }, { test: "datum.marginal", value: 1 }], value: 0 },
            tooltip: [
              { field: "domainLabel", title: "Domain" }, { field: "levelLabel", title: "Year level" },
              { field: "tMetric", title: "Selected measure" }, { field: "tVs", title: "Compared with overall" },
              { field: "tNas", title: "Needs additional support" }, { field: "tDev", title: "Developing" },
              { field: "tStrong", title: "Strong" }, { field: "tEx", title: "Exceeding" },
              { field: "tScore", title: "Average score" },
            ],
          },
        },
        {
          mark: { type: "text", baseline: "middle", fontSize: 13, fontWeight: 700, cursor: "pointer" },
          encoding: { text: { field: "label" }, color: { field: "ink", type: "nominal", scale: null, legend: null } },
        },
      ],
    };
  }

  function renderText(data) {
    const m = state.metric, M = Ch1.METRICS[m], overall = agg(state.year)[m];
    const core = data.filter((d) => !d.marginal);
    const sorted = [...core].sort((a, b) => b.value * M.good - a.value * M.good);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    const cellName = (d) => `${d.domainLabel}, ${d.levelLabel}`;

    // biggest change between Year 3 and Year 9 for each domain
    const moves = Ch1.DOMAINS.map((dm) => {
      const a = core.find((d) => d.domainKey === dm && d.levelKey === 3), b = core.find((d) => d.domainKey === dm && d.levelKey === 9);
      return { dm, a: a.value, b: b.value, d: b.value - a.value };
    }).sort((x, y) => y.d - x.d);
    const down = moves[moves.length - 1], up = moves[0];

    let html = `For <strong>${M.label.toLowerCase()}</strong> in ${state.year}, the overall figure is <strong>${f1(overall)}%</strong>. ` +
      `The ${M.good > 0 ? "highest" : "lowest"} cell is <strong>${cellName(best)}</strong> (${f1(best.value)}%) and the ` +
      `${M.good > 0 ? "lowest" : "highest"} is <strong>${cellName(worst)}</strong> (${f1(worst.value)}%), a gap of ${Math.abs(best.value - worst.value).toFixed(1)} percentage points.`;
    if (Math.abs(down.d) > 4 || Math.abs(up.d) > 4) {
      html += `<br><br>Look along the rows: <strong>${dlabel(down.dm)}</strong> goes from ${f1(down.a)}% in Year 3 to ${f1(down.b)}% in Year 9 (${signed(down.d)})`;
      html += up.d > 2 ? `, while <strong>${dlabel(up.dm)}</strong> moves the other way (${signed(up.d)}).` : ".";
    }
    $("heat-insight").innerHTML = html;

    $("heat-legend").innerHTML =
      `<span class="lg">Overall: <b>${f1(overall)}%</b></span>` +
      ["≥ 6 pp worse", "2–6 pp worse", "within ±2 pp", "2–6 pp better", "≥ 6 pp better"]
        .map((t, i) => `<span class="lg"><i class="lg-sq" style="background:${COLS[i]};border:1px solid rgba(20,33,61,.18)"></i>${t}</span>`).join("");

    $("heat-note").innerHTML =
      `Colours compare each cell with the overall figure above, and are flipped for "Needs additional support" so coral always means worse. ` +
      `Thinly outlined cells are averages across year levels or domains (weighted by students). Click a row to explore that domain below. ` +
      (state.year === 2026 ? `<br>* ACARA flagged a caveat on the 2026 Writing results for Years 5, 7 and 9 because of disruption to the tests.` : "");
  }

  async function render() {
    const data = cells();
    if (!view) {
      view = (await vegaEmbed("#heat-chart", spec(data), { actions: false, renderer: "svg" })).view;
      view.addEventListener("click", (e, item) => {
        const d = item && item.datum;
        if (d && d.domainKey && d.domainKey !== "ALL") Ch1.setDomain(d.domainKey);
      });
    } else {
      view.change("heat", vega.changeset().remove(vega.truthy).insert(data)).run();
    }
    renderText(data);
  }

  function init() { Ch1.onChange(() => render()); return render(); }
  function rebuild() { view = null; return render(); }

  Ch1.heatmap = { init, rebuild };
})(window.Ch1);
