/* Chapter 0 · Participation waffle chart (Vega-Lite)
 * ------------------------------------------------------------------
 * - 10 x 10 waffle: each square = 1% of enrolled students
 * - Controls: year slider, year-level filter, domain filter
 * - Shows change (percentage points) vs the previous year
 * - Small trend line for the current filter selection
 */
(async function () {
  const DATA_URL = "chapter-0/data/participation_all.csv";
  const LEVELS = [3, 5, 7, 9];
  const DOMAINS = ["Reading", "Writing", "Spelling", "Grammar and Punctuation", "Numeracy"];
  const COLOR_IN = "#1f6f8b";
  const COLOR_OUT = "#f0745a";
  const INK = "#14213d";
  const MUTED = "#4a5568";

  /* ---------------- Load data ---------------- */
  const csvText = await vega.loader().load(DATA_URL);
  const rows = vega
    .read(csvText, { type: "csv", parse: "auto" })
    .filter((d) => d.state === "Australia"); // map chapter will use the state rows

  const YEARS = [...new Set(rows.map((d) => d.year))].sort((a, b) => a - b);

  const state = {
    year: YEARS[YEARS.length - 1], // default: latest year (2026)
    levels: new Set(), // empty set = all
    domains: new Set(), // empty set = all
    timer: null,
  };

  /* ---------------- Aggregation ---------------- */
  // Participation for a year under the current filters. Weighted by enrolment:
  // sum(participated) / sum(enrolled), so multi-select is a true rate.
  function aggregate(year) {
    const sel = rows.filter(
      (d) =>
        d.year === year &&
        (!state.levels.size || state.levels.has(d.year_level)) &&
        (!state.domains.size || state.domains.has(d.domain))
    );
    if (!sel.length) return null;
    const enrolled = sel.reduce((s, d) => s + d.enrolled, 0);
    const participated = sel.reduce((s, d) => s + d.participated, 0);
    return { year, enrolled, participated, pct: (participated / enrolled) * 100 };
  }

  /* ---------------- Text helpers ---------------- */
  const fmtInt = (n) => Math.round(n).toLocaleString("en-AU");
  const fmtPct = (n) => n.toFixed(1);
  const join = (arr) =>
    arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];

  const levelsArr = () => LEVELS.filter((l) => state.levels.has(l));
  const domainsArr = () => DOMAINS.filter((d) => state.domains.has(d));

  function contextLabel() {
    const l = state.levels.size ? "Year " + levelsArr().join(", ") : "All year levels";
    const d = state.domains.size ? domainsArr().join(", ") : "All domains";
    return `${l} · ${d}`;
  }

  function sentence(cur) {
    const who = state.levels.size
      ? `Year ${join(levelsArr())} students`
      : "students across Years 3, 5, 7 and 9";
    const what = state.domains.size
      ? `the ${join(domainsArr())} ${state.domains.size > 1 ? "tests" : "test"}`
      : "the NAPLAN tests";
    const missing = 100 - cur.pct;
    const tail =
      missing >= 0.5
        ? ` Roughly 1 in ${Math.max(2, Math.round(100 / missing))} did not.`
        : " Nearly everyone took part.";
    return `In ${cur.year}, ${fmtPct(cur.pct)}% of enrolled ${who} took part in ${what}.${tail}`;
  }

  /* ---------------- Waffle data & spec ---------------- */
  function buildCells(cur) {
    const filled = Math.round(cur.pct); // 1 square = 1%
    const multiDomain = state.domains.size !== 1;
    const unit = multiDomain ? "student assessments" : "students";
    const out = cur.enrolled - cur.participated;
    const ctx = contextLabel();
    const cells = [];
    for (let i = 0; i < 100; i++) {
      const inGroup = i < filled;
      cells.push({
        col: i % 10,
        y: 9 - Math.floor(i / 10), // fill from the bottom, left to right
        status: inGroup ? "Participated" : "Did not participate",
        count: `${fmtInt(inGroup ? cur.participated : out)} ${unit}`,
        share: `${fmtPct(inGroup ? cur.pct : 100 - cur.pct)}% of enrolled`,
        context: `${cur.year} · ${ctx}`,
      });
    }
    return cells;
  }

  function waffleSize() {
    const w = document.querySelector("#waffle").parentElement.clientWidth || 380;
    return Math.max(240, Math.min(380, w));
  }

  function waffleSpec(cells) {
    const size = waffleSize();
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: size,
      height: size,
      background: null,
      config: { view: { stroke: null } },
      data: { name: "cells", values: cells },
      params: [
        {
          name: "hl",
          select: { type: "point", fields: ["status"], on: "pointerover", clear: "pointerout" },
        },
      ],
      mark: { type: "rect", cornerRadius: 4, tooltip: true },
      encoding: {
        x: {
          field: "col", type: "ordinal", axis: null,
          scale: { domain: d3Range(10), paddingInner: 0.12, paddingOuter: 0 },
        },
        y: {
          field: "y", type: "ordinal", axis: null,
          scale: { domain: d3Range(10), paddingInner: 0.12, paddingOuter: 0 },
        },
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
  const d3Range = (n) => Array.from({ length: n }, (_, i) => i);

  /* ---------------- Trend (sparkline) spec ---------------- */
  function trendSeries() {
    return YEARS.map((y) => {
      const a = aggregate(y);
      return { year: String(y), pct: a ? +a.pct.toFixed(2) : null };
    });
  }

  function trendSpec(series, currentPoint) {
    const vals = series.map((d) => d.pct).filter((v) => v != null);
    const lo = Math.floor(Math.min(...vals) - 1);
    const hi = Math.ceil(Math.max(...vals) + 1);
    const x = {
      field: "year", type: "ordinal",
      axis: { title: null, labelColor: MUTED, labelPadding: 6, domain: false, ticks: false, labelAngle: 0 },
      scale: { padding: 0.4 },
    };
    const y = {
      field: "pct", type: "quantitative", scale: { domain: [lo, hi], nice: false },
      axis: { title: null, tickCount: 3, labelColor: MUTED, grid: true, gridColor: "#eee8dc", domain: false, ticks: false, format: ".0f" },
    };
    const tip = [
      { field: "year", title: "Year" },
      { field: "pct", title: "Participation (%)", format: ".1f" },
    ];
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: "container",
      height: 120,
      background: null,
      config: { view: { stroke: null } },
      layer: [
        {
          data: { values: series },
          mark: { type: "line", color: COLOR_IN, strokeWidth: 2, opacity: 0.6 },
          encoding: { x, y },
        },
        {
          data: { values: series },
          mark: { type: "point", filled: true, color: "#fff", stroke: COLOR_IN, strokeWidth: 1.5, size: 50, tooltip: true },
          encoding: { x, y, tooltip: tip },
        },
        {
          data: { name: "current", values: [currentPoint] },
          mark: { type: "point", filled: true, color: COLOR_IN, stroke: "#fff", strokeWidth: 2, size: 190, tooltip: true },
          encoding: { x, y, tooltip: tip },
        },
        {
          data: { name: "current" },
          mark: { type: "text", dy: -15, fontWeight: 700, fontSize: 12, color: INK },
          encoding: { x, y, text: { field: "pct", type: "quantitative", format: ".1f" } },
        },
      ],
    };
  }

  /* ---------------- Embed ---------------- */
  let waffleView = null;
  let trendView = null;
  const embedOpts = { actions: false, renderer: "svg" };

  async function mountWaffle(cur) {
    const res = await vegaEmbed("#waffle", waffleSpec(buildCells(cur)), embedOpts);
    waffleView = res.view;
  }
  async function mountTrend(series, cur) {
    const res = await vegaEmbed("#trend", trendSpec(series, { year: String(cur.year), pct: +cur.pct.toFixed(2) }), embedOpts);
    trendView = res.view;
  }

  /* ---------------- DOM refs ---------------- */
  const $ = (id) => document.getElementById(id);
  const slider = $("year-slider");
  const ticks = $("year-ticks");
  const playBtn = $("play-btn");

  /* ---------------- UI builders ---------------- */
  slider.min = YEARS[0];
  slider.max = YEARS[YEARS.length - 1];
  slider.step = 1;
  slider.value = state.year;

  YEARS.forEach((y) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = y;
    b.dataset.year = y;
    b.addEventListener("click", () => setYear(y));
    ticks.appendChild(b);
  });

  function buildChips(containerId, options, set, labelFn) {
    const box = $(containerId);
    const make = (label, value) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = label;
      b.dataset.value = value === null ? "all" : value;
      b.addEventListener("click", () => {
        if (value === null) set.clear();
        else if (set.has(value)) set.delete(value);
        else set.add(value);
        if (set.size === options.length) set.clear(); // everything selected = "All"
        syncChips();
        refresh({ rebuildTrend: true });
      });
      return b;
    };
    box.appendChild(make("All", null));
    options.forEach((o) => box.appendChild(make(labelFn(o), o)));
    return box;
  }

  function syncChips() {
    [["level-chips", state.levels, LEVELS], ["domain-chips", state.domains, DOMAINS]].forEach(([id, set, opts]) => {
      [...$(id).children].forEach((b) => {
        const isAll = b.dataset.value === "all";
        const val = isAll ? null : opts.find((o) => String(o) === b.dataset.value);
        const active = isAll ? set.size === 0 : set.has(val);
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", active);
      });
    });
  }

  buildChips("level-chips", LEVELS, state.levels, (l) => `Year ${l}`);
  buildChips("domain-chips", DOMAINS, state.domains, (d) => d);

  /* ---------------- Update loop ---------------- */
  function renderStat(cur) {
    $("stat-context").textContent = `${cur.year} · ${contextLabel()}`;
    $("stat-pct").textContent = fmtPct(cur.pct);
    $("stat-sentence").textContent = sentence(cur);
    $("waffle").setAttribute(
      "aria-label",
      `Waffle chart: ${fmtPct(cur.pct)}% of enrolled students participated in ${cur.year}`
    );

    // change vs previous year
    const deltaEl = $("stat-delta");
    const prev = YEARS.includes(cur.year - 1) ? aggregate(cur.year - 1) : null;
    deltaEl.className = "delta";
    if (!prev) {
      deltaEl.innerHTML = `First year in the data <span>(baseline)</span>`;
    } else {
      const d = cur.pct - prev.pct;
      const flat = Math.abs(d) < 0.05;
      deltaEl.classList.add(flat ? "flat" : d > 0 ? "up" : "down");
      const arrow = flat ? "▬" : d > 0 ? "▲" : "▼";
      const sign = d > 0 ? "+" : d < 0 ? "−" : "";
      deltaEl.innerHTML = `${arrow} ${sign}${Math.abs(d).toFixed(1)} pp <span>vs ${prev.year} (${fmtPct(prev.pct)}%)</span>`;
    }

    $("footnote").textContent =
      state.domains.size === 1
        ? "Participation = students who sat the test ÷ students enrolled in that year level. Source: ACARA NAPLAN."
        : "Several domains are combined, so counts are student assessments (one student can sit more than one test). The percentage is a participation rate across them. Source: ACARA NAPLAN.";
  }

  function syncYearUI() {
    slider.value = state.year;
    [...ticks.children].forEach((b) => b.classList.toggle("active", +b.dataset.year === state.year));
  }

  async function refresh({ rebuildTrend = false } = {}) {
    const cur = aggregate(state.year);
    if (!cur) return;
    syncYearUI();
    renderStat(cur);

    if (!waffleView) await mountWaffle(cur);
    else waffleView.change("cells", vega.changeset().remove(vega.truthy).insert(buildCells(cur))).run();

    const currentPoint = { year: String(cur.year), pct: +cur.pct.toFixed(2) };
    if (!trendView || rebuildTrend) await mountTrend(trendSeries(), cur);
    else trendView.change("current", vega.changeset().remove(vega.truthy).insert([currentPoint])).run();
  }

  function setYear(y) {
    state.year = +y;
    refresh();
  }

  slider.addEventListener("input", () => setYear(slider.value));

  /* Play through the years */
  function stopPlay() {
    clearInterval(state.timer);
    state.timer = null;
    playBtn.textContent = "▶ Play";
  }
  playBtn.addEventListener("click", () => {
    if (state.timer) return stopPlay();
    if (state.year === YEARS[YEARS.length - 1]) setYear(YEARS[0]);
    playBtn.textContent = "❚❚ Pause";
    state.timer = setInterval(() => {
      const next = state.year + 1;
      if (next > YEARS[YEARS.length - 1]) return stopPlay();
      setYear(next);
      if (next === YEARS[YEARS.length - 1]) stopPlay();
    }, 1400);
  });

  /* Rebuild at the new size when the window is resized */
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      waffleView = null;
      trendView = null;
      refresh({ rebuildTrend: true });
    }, 200);
  });

  /* ---------------- Go ---------------- */
  syncChips();
  await refresh({ rebuildTrend: true });
})();
