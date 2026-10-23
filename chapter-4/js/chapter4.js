/* Chapter 4 – Is the picture changing?  Renders five Vega-Lite specs (chapter-4/specs/*.json),
   wires the controls and writes data-driven captions from the same CSV files.
   Requires vega, vega-lite and vega-embed on the page (index.html). */
(function () {
  const BASE = "chapter-4/";
  const state = { pdomain: "All", metric: "strongPlus" };
  const DOMS = ["Reading", "Writing", "Spelling", "Grammar and punctuation", "Numeracy"];
  const CHARTS = [
    { el: "c4-slope",     file: "4-1-slope-change",       signals: ["metric"] },
    { el: "c4-scatter",   file: "4-2-connected-scatter",  signals: ["pdomain"], reserve: 90 },
    { el: "c4-waterfall", file: "4-3-waterfall",          signals: [],          reserve: 70 },
    { el: "c4-bands",     file: "4-4-score-change-bands", signals: [] },
    { el: "c4-tiles",     file: "4-5-state-tile-change",  signals: ["pdomain"], square: true }
  ];
  const views = {}, cache = {}, data = {};
  const $ = (id) => document.getElementById(id);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const fx = (v, d = 1) => v.toFixed(d);
  const sgn = (v, d = 1) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d);
  const pretty = (d) => (d === "All" ? "all domains" : d === "Grammar and punctuation" ? "grammar and punctuation" : d.toLowerCase());

  async function spec(file) {
    if (!cache[file]) cache[file] = await (await fetch(BASE + "specs/" + file + ".json")).json();
    return JSON.parse(JSON.stringify(cache[file]));
  }

  async function mount(c) {
    const host = $(c.el); if (!host) return;
    const s = await spec(c.file), W = host.clientWidth;
    if (c.file === "4-1-slope-change") {                       // facet: 4 panels, labels on the left
      s.padding.left = W < 640 ? 100 : 135;
      s.spec.width = Math.max(60, Math.min(170, (W - s.padding.left - 10 - 3 * 28 - 45) / 4));
    } else if (c.file === "4-4-score-change-bands") {           // facet: 2 x 2 (1 column on narrow screens)
      s.columns = W < 640 ? 1 : 2;
      s.spec.width = Math.max(150, Math.min(300, (W - (s.columns === 2 ? 36 : 0) - s.columns * 115) / s.columns));
    } else if (c.square) {
      s.width = s.height = Math.max(260, Math.min(s.width, W - 8));
    } else {
      s.width = Math.max(240, Math.min(s.width, W - (c.reserve || 0)));
    }
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

  // ---------- captions and stat cards (computed from the same data as the charts) ----------
  function glance() {
    const avg = (y, k) => mean(data.nat.filter((r) => r.year === y).map((r) => r[k]));
    const card = (label, k, goodUp) => {
      const a = avg(2023, k), b = avg(2026, k), d = b - a, good = goodUp ? d >= 0 : d <= 0;
      return `<div class="c4-stat"><span class="c4-stat-name">${label}</span><span class="c4-stat-val">${fx(a)}% → ${fx(b)}%</span>` +
             `<span class="c4-stat-chg ${good ? "good" : "bad"}">${sgn(d)} pts since 2023</span></div>`;
    };
    $("c4-glance").innerHTML = card("Strong or above", "strongPlus", true) + card("Needs additional support", "needs", false) + card("Exceeding", "exceeding", true);
  }

  function captions() {
    const nat = data.nat, dom = state.pdomain;
    // 4.1 slope
    const k = state.metric, up = k === "strongPlus";
    const rows = [];
    DOMS.forEach((d) => [3, 5, 7, 9].forEach((l) => {
      const a = nat.find((r) => r.year === 2023 && r.level === l && r.domain === d)[k];
      const b = nat.find((r) => r.year === 2026 && r.level === l && r.domain === d)[k];
      rows.push({ d, l, chg: b - a, good: up ? b - a >= 0 : b - a <= 0 });
    }));
    const best = rows.slice().sort((x, y) => (up ? y.chg - x.chg : x.chg - y.chg))[0];
    const worst = rows.slice().sort((x, y) => (up ? x.chg - y.chg : y.chg - x.chg))[0];
    const nm = (r) => `Year ${r.l} ${r.d.toLowerCase()}`;
    $("c4-cap-slope").innerHTML =
      `Of 20 domain and year-level combinations, <strong>${rows.filter((r) => r.good).length} improved</strong> and <strong>${rows.filter((r) => !r.good).length} declined</strong>. ` +
      `Biggest improvement: <strong>${nm(best)}</strong> (${sgn(best.chg)} pts). Biggest decline: <strong>${nm(worst)}</strong> (${sgn(worst.chg)} pts).`;

    // 4.2 scatter
    const sel = nat.filter((r) => dom === "All" || r.domain === dom);
    const av = (y, f) => mean(sel.filter((r) => r.year === y).map((r) => r[f]));
    $("c4-cap-scatter").innerHTML =
      `In <strong>${pretty(dom)}</strong>, the share needing additional support went from ${fx(av(2023, "needs"))}% to <strong>${fx(av(2026, "needs"))}%</strong>, ` +
      `while the share exceeding expectations went from ${fx(av(2023, "exceeding"))}% to <strong>${fx(av(2026, "exceeding"))}%</strong>.`;

    // 4.3 waterfall
    const w = data.wf.filter((r) => r.kind !== "total"), net = data.wf.find((r) => r.kind === "total");
    const dl = (r) => r.end - r.start, drag = w.slice().sort((a, b) => dl(a) - dl(b))[0], lift = w.slice().sort((a, b) => dl(b) - dl(a))[0];
    $("c4-cap-waterfall").innerHTML =
      `Net change: <strong>${sgn(net.end, 2)} points</strong> – less than half a point. <strong>${drag.step}</strong> pulled the average down the most (${sgn(dl(drag), 2)}); ` +
      `<strong>${lift.step}</strong> lifted it the most (${sgn(dl(lift), 2)}).`;

    // 4.4 bands
    const g = (m) => data.sc.find((r) => r.measure === m && r.year === 2026);
    const pe = g("Parental education"), rm = g("Remoteness");
    $("c4-cap-bands").innerHTML =
      `Students whose parents hold a degree are about level with 2023 (${sgn(pe.adv)} points), but students whose parents finished Year 11 or below are <strong>${sgn(pe.dis)} points</strong> lower – ` +
      `a gap that has widened by <strong>${fx(pe.adv - pe.dis)} points</strong>. In very remote areas the fall is ${sgn(rm.dis)} points.`;

    // 4.5 tiles
    const st = data.states.filter((r) => (dom === "All" || r.domain === dom) && Number.isFinite(r.strongPlus));
    const ch = [];
    [...new Set(st.map((r) => r.state))].forEach((s) => {
      const a = st.filter((r) => r.state === s && r.year === 2023).map((r) => r.strongPlus), b = st.filter((r) => r.state === s && r.year === 2026).map((r) => r.strongPlus);
      if (a.length && b.length) ch.push({ s, c: mean(b) - mean(a) });
    });
    ch.sort((a, b) => b.c - a.c);
    $("c4-cap-tiles").innerHTML =
      `For <strong>${pretty(dom)}</strong>, the biggest rise is in <strong>${ch[0].s}</strong> (${sgn(ch[0].c)} pts) and the biggest fall in <strong>${ch[ch.length - 1].s}</strong> (${sgn(ch[ch.length - 1].c)} pts). ` +
      `Tasmania’s 2026 results are not published, so it is left grey.`;
  }

  function bindControls() {
    document.querySelectorAll("[data-c4-control]").forEach((btn) => btn.addEventListener("click", () => {
      const name = btn.dataset.c4Control;
      document.querySelectorAll(`[data-c4-control="${name}"]`).forEach((b) => b.setAttribute("aria-pressed", b === btn));
      setSignal(name, btn.dataset.value);
    }));
  }

  const load = async (f) => vega.read(await (await fetch(BASE + "data/" + f)).text(), { type: "csv", parse: "auto" });
  async function init() {
    [data.nat, data.wf, data.sc, data.states] = await Promise.all(["progress_national.csv", "progress_waterfall.csv", "progress_score_change.csv", "progress_states.csv"].map(load));
    bindControls(); glance(); captions();
    await Promise.all(CHARTS.map(mount));
    let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => CHARTS.forEach(mount), 250); });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
