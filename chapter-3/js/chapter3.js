/* Chapter 3 – Who is being left behind?
   Renders six Vega-Lite specs (chapter-3/specs/*.json), wires the shared controls
   (year level / domain / gap comparison) and writes the data-driven captions.
   Requires vega, vega-lite and vega-embed to be loaded on the page (index.html). */
(function () {
  const BASE = "chapter-3/";
  const state = { level: 9, domain: "Numeracy", measure: "Indigenous status" };

  // reserve = horizontal space (px) the chart needs outside its plot area (labels, legend)
  const CHARTS = [
    { el: "c3-ladder",      file: "3-1-ladder",              signals: ["level", "domain"], reserve: 290 },
    { el: "c3-proficiency", file: "3-2-proficiency",         signals: ["level", "domain"], reserve: 280 },
    { el: "c3-heatmap",     file: "3-3-gap-heatmap",         signals: ["measure"],         reserve: 270 },
    { el: "c3-remoteness",  file: "3-4-remoteness-dumbbell", signals: ["level", "domain"], reserve: 140 },
    { el: "c3-tiles",       file: "3-5-state-tile-map",      signals: ["level", "domain"], reserve: 0, square: true },
    { el: "c3-trend",       file: "3-6-gaps-over-time",      signals: [],                  reserve: 190 }
  ];
  const MEASURES = {
    "Indigenous status":   { hi: "non-Indigenous students", lo: "Indigenous students" },
    "Parental education":  { hi: "students whose parents hold a bachelor degree or above", lo: "students whose parents finished Year 11 or below" },
    "Parental occupation": { hi: "students whose parents are senior managers or professionals", lo: "students whose parents were not in paid work" },
    "Remoteness":          { hi: "students in major cities", lo: "students in very remote areas" }
  };
  const views = {}, cache = {}, data = {};
  const $ = (id) => document.getElementById(id);
  const r0 = (v) => Math.round(v);

  async function spec(file) {
    if (!cache[file]) cache[file] = await (await fetch(BASE + "specs/" + file + ".json")).json();
    return JSON.parse(JSON.stringify(cache[file]));
  }

  async function mount(c) {
    const host = $(c.el); if (!host) return;
    const s = await spec(c.file);
    const avail = host.clientWidth;
    s.width = c.square ? Math.max(260, Math.min(s.width, avail - 8))
                       : Math.max(220, Math.min(s.width, avail - c.reserve));
    if (c.square) s.height = s.width;
    (s.params || []).forEach((p) => { if (state[p.name] !== undefined) p.value = state[p.name]; });
    s.config.font = getComputedStyle(document.body).fontFamily || s.config.font;
    const res = await vegaEmbed(host, s, { actions: false, renderer: "svg", loader: { baseURL: BASE } });
    views[c.el] = { view: res.view, signals: c.signals };
  }

  function setSignal(name, value) {
    state[name] = value;
    Object.values(views).forEach((v) => { if (v.signals.includes(name)) v.view.signal(name, value).run(); });
    captions();
  }

  // ---- captions computed from the same CSV files the charts use ----
  const pick = (rows, f) => rows.find(f);
  function captions() {
    const L = state.level, D = state.domain;
    const nat = data.national.filter((r) => r.year === 2026 && r.level === L && r.domain === D);
    const v = (g) => pick(nat, (r) => r.group === g);
    const hi = v("Bachelor degree or above"), lo = v("Year 11 or below"), m = v("Male"), f = v("Female");
    $("c3-cap-ladder").innerHTML =
      `In <strong>${D}, Year ${L}</strong>, ${r0(hi.strongPlus)}% of students whose parents hold a degree reach “Strong or above”, ` +
      `against ${r0(lo.strongPlus)}% of those whose parents finished Year 11 or below – a <strong>${r0(hi.strongPlus - lo.strongPlus)}-point gap</strong>. ` +
      `Boys and girls are only ${Math.abs(r0(m.strongPlus - f.strongPlus))} points apart.`;

    const ratio = (lo.needs / hi.needs).toFixed(1);
    $("c3-cap-proficiency").innerHTML =
      `${r0(lo.needs)}% of students whose parents finished Year 11 or below <strong>need additional support</strong> in ${D}, ` +
      `compared with ${r0(hi.needs)}% of students whose parents hold a degree – <strong>${ratio}× as many</strong>.`;

    const rem = data.remote.filter((r) => r.year === 2026 && r.level === L && r.domain === D);
    const rv = (s, a) => pick(rem, (r) => r.status === s && r.remoteness === a);
    const iDrop = rv("Indigenous", "Major cities").strongPlus - rv("Indigenous", "Very remote").strongPlus;
    const nDrop = rv("Non-Indigenous", "Major cities").strongPlus - rv("Non-Indigenous", "Very remote").strongPlus;
    $("c3-cap-remoteness").innerHTML =
      `Moving from major cities to very remote areas, the share of Indigenous students at “Strong or above” falls by <strong>${r0(iDrop)} points</strong>; ` +
      `for non-Indigenous students it falls by <strong>${r0(nDrop)} points</strong>. Remoteness alone does not explain the gap.`;

    const st = data.states.filter((r) => r.year === 2026 && r.level === L && r.domain === D && r.gap !== null)
                          .sort((a, b) => b.gap - a.gap);
    const w = st[0], n = st[st.length - 1];
    $("c3-cap-tiles").innerHTML =
      `The gap is widest in the <strong>${w.state}</strong> (${r0(w.gap)} points) and narrowest in <strong>${n.state}</strong> (${r0(n.gap)} points). ` +
      `Tasmania’s results for this comparison are not published.`;

    const g = data.gaps.filter((r) => r.year === 2026 && r.measure === state.measure).sort((a, b) => b.gap - a.gap);
    const M = MEASURES[state.measure];
    $("c3-cap-heatmap").innerHTML =
      `Gap = share of ${M.hi} at “Strong or above” minus the share of ${M.lo}. ` +
      `Widest: <strong>Year ${g[0].level} ${g[0].domain}</strong> (${r0(g[0].gap)} pts). ` +
      `Narrowest: <strong>Year ${g[g.length - 1].level} ${g[g.length - 1].domain}</strong> (${r0(g[g.length - 1].gap)} pts).`;
  }

  function trendCards() {
    const mean = (m, y) => { const r = data.gaps.filter((x) => x.measure === m && x.year === y); return r.reduce((a, b) => a + b.gap, 0) / r.length; };
    $("c3-trend-cards").innerHTML = Object.keys(MEASURES).map((m) => {
      const a = mean(m, 2023), b = mean(m, 2026), d = b - a;
      return `<div class="c3-stat"><span class="c3-stat-name">${m}</span>` +
             `<span class="c3-stat-val">${a.toFixed(1)} → ${b.toFixed(1)}</span>` +
             `<span class="c3-stat-chg">${d < 0 ? "▼" : "▲"} ${Math.abs(d).toFixed(1)} pts since 2023</span></div>`;
    }).join("");
  }

  function bindControls() {
    document.querySelectorAll("[data-c3-control]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.c3Control;
        const val = name === "level" ? +btn.dataset.value : btn.dataset.value;
        document.querySelectorAll(`[data-c3-control="${name}"]`).forEach((b) => b.setAttribute("aria-pressed", b === btn));
        setSignal(name, val);
      });
    });
  }

  async function load(file) {
    const txt = await (await fetch(BASE + "data/" + file)).text();
    return vega.read(txt, { type: "csv", parse: "auto" });
  }

  async function init() {
    [data.national, data.remote, data.gaps, data.states] =
      await Promise.all(["equity_national.csv", "equity_remoteness.csv", "equity_gaps.csv", "equity_states.csv"].map(load));
    data.states.forEach((r) => { if (r.gap === "" || r.gap === undefined) r.gap = null; });
    bindControls(); captions(); trendCards();
    await Promise.all(CHARTS.map(mount));
    let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => CHARTS.forEach(mount), 250); });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
