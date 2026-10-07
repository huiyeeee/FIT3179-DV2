/* Chapter 0 · Participation waffle chart (Vega-Lite)
 * 10 x 10 waffle (1 square = 1% of enrolled students), a change-vs-last-year
 * badge, and a small trend line. Responds to the shared year / filters / region.
 */
(function (Ch0) {
  const { state, aggregate, fmtInt, fmtPct, join, $ } = Ch0;
  const COLOR_IN = "#1f6f8b", COLOR_OUT = "#f0745a", INK = "#14213d", MUTED = "#4a5568";
  const range10 = Array.from({ length: 10 }, (_, i) => i);
  const embedOpts = { actions: false, renderer: "svg" };
  let waffleView = null, trendView = null;

  /* ---------- waffle ---------- */
  function buildCells(cur) {
    const filled = Math.round(cur.pct); // 1 square = 1%
    const unit = state.domains.size === 1 ? "students" : "student assessments";
    const out = cur.enrolled - cur.participated;
    const ctx = `${cur.year} · ${Ch0.contextLabel()}`;
    return Array.from({ length: 100 }, (_, i) => {
      const inGroup = i < filled;
      return {
        col: i % 10,
        y: 9 - Math.floor(i / 10), // fill from the bottom, left to right
        status: inGroup ? "Participated" : "Did not participate",
        count: `${fmtInt(inGroup ? cur.participated : out)} ${unit}`,
        share: `${fmtPct(inGroup ? cur.pct : 100 - cur.pct)}% of enrolled`,
        context: ctx,
      };
    });
  }

  function size() {
    const w = $("waffle").parentElement.clientWidth || 380;
    return Math.max(240, Math.min(380, w));
  }

  function waffleSpec(cells) {
    const s = size();
    const band = { domain: range10, paddingInner: 0.12, paddingOuter: 0 };
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: s, height: s, background: null,
      config: { view: { stroke: null }, font: Ch0.font },
      data: { name: "cells", values: cells },
      params: [{ name: "hl", select: { type: "point", fields: ["status"], on: "pointerover", clear: "pointerout" } }],
      mark: { type: "rect", cornerRadius: 4, tooltip: true },
      encoding: {
        x: { field: "col", type: "ordinal", axis: null, scale: band },
        y: { field: "y", type: "ordinal", axis: null, scale: band },
        color: {
          field: "status", type: "nominal", legend: null,
          scale: { domain: ["Participated", "Did not participate"], range: [COLOR_IN, COLOR_OUT] },
        },
        opacity: { condition: { param: "hl", value: 1 }, value: 0.3 },
        tooltip: [
          { field: "status", title: "Group" },
          { field: "count", title: "Count" },
          { field: "share", title: "Share" },
          { field: "context", title: "Selection" },
        ],
      },
    };
  }

  /* ---------- trend sparkline ---------- */
  function trendSeries() {
    return Ch0.years().map((y) => {
      const a = aggregate(y);
      return { year: String(y), pct: a ? +a.pct.toFixed(2) : null };
    });
  }

  function trendSpec(series, current) {
    const vals = series.map((d) => d.pct).filter((v) => v != null);
    const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
    const x = {
      field: "year", type: "ordinal", scale: { padding: 0.4 },
      axis: { title: null, labelColor: MUTED, labelPadding: 6, domain: false, ticks: false, labelAngle: 0 },
    };
    const y = {
      field: "pct", type: "quantitative", scale: { domain: [lo, hi], nice: false },
      axis: { title: null, tickCount: 3, labelColor: MUTED, grid: true, gridColor: "#eee8dc", domain: false, ticks: false, format: ".0f" },
    };
    const tip = [{ field: "year", title: "Year" }, { field: "pct", title: "Participation (%)", format: ".1f" }];
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: "container", height: 120, background: null,
      config: { view: { stroke: null }, font: Ch0.font },
      layer: [
        { data: { values: series }, mark: { type: "line", color: COLOR_IN, strokeWidth: 2, opacity: 0.6 }, encoding: { x, y } },
        { data: { values: series }, mark: { type: "point", filled: true, color: "#fff", stroke: COLOR_IN, strokeWidth: 1.5, size: 50, tooltip: true }, encoding: { x, y, tooltip: tip } },
        { data: { name: "current", values: [current] }, mark: { type: "point", filled: true, color: COLOR_IN, stroke: "#fff", strokeWidth: 2, size: 190, tooltip: true }, encoding: { x, y, tooltip: tip } },
        { data: { name: "current" }, mark: { type: "text", dy: -15, fontWeight: 700, fontSize: 12, color: INK }, encoding: { x, y, text: { field: "pct", type: "quantitative", format: ".1f" } } },
      ],
    };
  }

  /* ---------- stat panel text ---------- */
  function sentence(cur) {
    const where = cur.region === Ch0.AUS ? "" : ` in ${Ch0.regionName(cur.region)}`;
    const who = state.levels.size ? `Year ${join(Ch0.levelsArr())} students` : "students across Years 3, 5, 7 and 9";
    const what = state.domains.size
      ? `the ${join(Ch0.domainsArr())} ${state.domains.size > 1 ? "tests" : "test"}`
      : "the NAPLAN tests";
    const missing = 100 - cur.pct;
    const tail = missing >= 0.5 ? ` Roughly 1 in ${Math.max(2, Math.round(100 / missing))} did not.` : " Nearly everyone took part.";
    return `In ${cur.year}, ${fmtPct(cur.pct)}% of enrolled ${who}${where} took part in ${what}.${tail}`;
  }

  function renderStat(cur) {
    $("stat-context").textContent = `${cur.year} · ${Ch0.contextLabel()}`;
    $("stat-pct").textContent = fmtPct(cur.pct);
    $("stat-sentence").textContent = sentence(cur);
    $("waffle").setAttribute("aria-label", `Waffle chart: ${fmtPct(cur.pct)}% of enrolled students in ${cur.region} participated in ${cur.year}`);

    const el = $("stat-delta");
    const prev = Ch0.years().includes(cur.year - 1) ? aggregate(cur.year - 1) : null;
    el.className = "delta";
    if (!prev) {
      el.innerHTML = `First year in the data <span>(baseline)</span>`;
    } else {
      const d = cur.pct - prev.pct, flat = Math.abs(d) < 0.05;
      el.classList.add(flat ? "flat" : d > 0 ? "up" : "down");
      const arrow = flat ? "▬" : d > 0 ? "▲" : "▼";
      const sign = d > 0 ? "+" : d < 0 ? "−" : "";
      el.innerHTML = `${arrow} ${sign}${Math.abs(d).toFixed(1)} pp <span>vs ${prev.year} (${fmtPct(prev.pct)}%)</span>`;
    }

    $("footnote").textContent =
      state.domains.size === 1
        ? "Participation = students who sat the test ÷ students enrolled in that year level. Source: ACARA NAPLAN."
        : "Several domains are combined, so counts are student assessments (one student can sit more than one test). The percentage is a participation rate across them. Source: ACARA NAPLAN.";
  }

  /* ---------- render ---------- */
  async function render(type) {
    const cur = aggregate(state.year);
    if (!cur) return;
    renderStat(cur);

    if (!waffleView) {
      waffleView = (await vegaEmbed("#waffle", waffleSpec(buildCells(cur)), embedOpts)).view;
    } else {
      waffleView.change("cells", vega.changeset().remove(vega.truthy).insert(buildCells(cur))).run();
    }

    const point = { year: String(cur.year), pct: +cur.pct.toFixed(2) };
    if (!trendView || type !== "year") {
      trendView = (await vegaEmbed("#trend", trendSpec(trendSeries(), point), embedOpts)).view;
    } else {
      trendView.change("current", vega.changeset().remove(vega.truthy).insert([point])).run();
    }
  }

  async function init() {
    Ch0.onChange(render);
    await render("filter");
  }
  function rebuild() { waffleView = null; trendView = null; return render("filter"); }

  Ch0.waffle = { init, rebuild };
})(window.Ch0);
