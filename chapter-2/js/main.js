/* Chapter 2 · Geographic differences
 * Each chart is a Vega-Lite JSON file in chapter-2/specs/ that is loaded as-is. This script only
 *   1. embeds them,
 *   2. sets their named params (year, metric, sel) from the page controls,
 *   3. writes the explanatory text from the same CSV files.
 */
(async function () {
  const $ = (id) => document.getElementById(id);
  const AUS = "Australia";
  const CODE = { "New South Wales": "NSW", "Victoria": "VIC", "Queensland": "QLD", "Western Australia": "WA", "South Australia": "SA",
                 "Tasmania": "TAS", "Northern Territory": "NT", "Australian Capital Territory": "ACT" };
  const STATES = ["Northern Territory", "Queensland", "South Australia", "Tasmania", "Western Australia", "New South Wales", "Victoria", "Australian Capital Territory"];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const THE = (s) => (s === "Northern Territory" || s === "Australian Capital Territory" ? "the " + s : s);
  const f1 = (n) => n.toFixed(1);
  const sgn = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(1);
  const list = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  const state = { year: 2026, metric: "so", sel: "Northern Territory" };

  const read = async (n) => vega.read(await vega.loader().load(`chapter-2/data/${n}.csv`), { type: "csv", parse: "auto" });
  const [results, cells, remote, gb] = await Promise.all([read("state_results"), read("state_cells"), read("remoteness"), read("gap_breakdown")]);
  const YEARS = [...new Set(results.map((d) => d.year))].sort();
  state.year = YEARS[YEARS.length - 1];

  /* ---------- embed the JSON specs ---------- */
  const views = {};
  const mount = { map_states: "c2-map", strip_consistency: "c2-strip", remoteness_ladder: "c2-ladder", gap_breakdown: "c2-breakdown", waterfall: "c2-waterfall" };
  await Promise.all(Object.entries(mount).map(async ([spec, el]) => {
    views[spec] = (await vegaEmbed("#" + el, `chapter-2/specs/${spec}.json`, { actions: false, renderer: "svg" })).view;
  }));

  const setSignals = () => {
    Object.values(views).forEach((v) => {
      ["year", "metric", "sel"].forEach((k) => { try { v.signal(k, state[k]); } catch (e) { /* this chart has no such param */ } });
      v.run();
    });
  };
  const annotate = () => {
    const nt = results.find((d) => d.year === state.year && d.state === "Northern Territory" && d.reported);
    const rows = [];
    if (nt) {
      const gap = state.metric === "so" ? nt.gap_so : nt.gap_nas, val = state.metric === "so" ? nt.so : nt.nas;
      const what = state.metric === "so" ? "meeting expectations" : "needing extra support";
      rows.push({ lon: 108.5, lat: -10.8, lon2: 124.5, lat2: -12.6, lon3: 132.8, lat3: -18.8, text: `Northern Territory: ${f1(val)}% ${what},\n${Math.abs(gap).toFixed(0)} points ${gap < 0 ? "below" : "above"} Australia` });
    }
    views.map_states.change("annot", vega.changeset().remove(vega.truthy).insert(rows)).run();
  };

  /* ---------- text ---------- */
  function mapText() {
    const rows = results.filter((d) => d.year === state.year && d.state !== AUS);
    const ok = rows.filter((d) => d.reported), so = state.metric === "so";
    const nat = results.find((d) => d.year === state.year && d.state === AUS);
    const gapOf = (d) => (so ? d.gap_so : d.gap_nas);
    const worst = [...ok].sort((a, b) => (so ? gapOf(a) - gapOf(b) : gapOf(b) - gapOf(a)))[0];
    const others = ok.filter((d) => d !== worst).map((d) => Math.abs(gapOf(d)));
    const val = so ? worst.so : worst.nas;
    let html = `In ${state.year}, <strong>${f1(val)}%</strong> of students in <strong>${THE(worst.state)}</strong> were ${so ? "meeting expectations (Strong or Exceeding)" : "in the lowest level, Needs additional support"}, ` +
      `<strong>${Math.abs(gapOf(worst)).toFixed(0)} points ${so ? "below" : "above"}</strong> the Australian figure of ${f1(so ? nat.so : nat.nas)}%. ` +
      `No other state or territory is more than ${Math.max(...others).toFixed(0)} points away from it.`;
    const miss = rows.filter((d) => !d.reported);
    if (miss.length) html += ` ${list(miss.map((d) => THE(d.state)))} sat the tests, but ${miss.length > 1 ? "their" : "its"} ${state.year} results were not published.`;
    $("c2-map-insight").innerHTML = html;
    $("c2-legend-note").textContent = so
      ? "Colour compares each state's share of students meeting expectations with Australia's."
      : "Colour compares each state's share of students needing additional support with Australia's. More students needing support counts as worse.";
  }

  function stripText() {
    const c = cells.filter((d) => d.year === state.year), by = {};
    c.forEach((d) => { (by[d.state] = by[d.state] || []).push(d); });
    const below = [], above = [], mixed = [];
    Object.entries(by).forEach(([s, a]) => { const b = a.filter((d) => d.gap < 0).length; (b === a.length ? below : b === 0 ? above : mixed).push([s, b, a.length]); });
    const nm = (x) => THE(x[0]);
    const nt = by["Northern Territory"], gaps = nt.map((d) => d.gap), big = [...c].sort((a, b) => a.gap - b.gap)[0];
    let html = `In ${state.year}, <strong>${list(below.map(nm))}</strong> were below Australia in <strong>every</strong> one of the ${c.filter((d) => d.state === below[0][0]).length} results, ` +
      `while <strong>${list(above.map(nm))}</strong> were above in every one.`;
    if (mixed.length) html += ` Only ${list(mixed.map((m) => `${nm(m)} (${m[1]} of ${m[2]} below)`))} had a mixed picture.`;
    html += `<br><br>The Northern Territory's gap hardly changes from one subject or year level to the next, from ${sgn(Math.max(...gaps))} to ${sgn(Math.min(...gaps))} points. ` +
      `That suggests it isn't about one weak subject. The single largest gap is ${big.domain.toLowerCase()} in Year ${big.level} (${sgn(big.gap)} points).`;
    $("c2-strip-insight").innerHTML = html;
  }

  function sceneThreeText() {
    const st = state.sel, name = THE(st);
    $("c2-ladder-title").textContent = `Results by type of area: Australia vs ${st}, ${state.year}`;
    const rows = remote.filter((d) => d.year === state.year);
    const mine = rows.filter((d) => d.state === st), nat = rows.filter((d) => d.state === AUS);
    const g = gb.find((d) => d.year === state.year && d.state === st);
    if (!mine.length || !g) {
      $("c2-ladder-insight").innerHTML = `${name}'s ${state.year} results were not published, so there is nothing to break down for this year. Try another state or an earlier year.`;
      $("c2-wf-insight").innerHTML = ""; $("c2-wf-note").textContent = "";
      return;
    }
    const total = mine.reduce((s, d) => s + d.n, 0);
    const cmp = mine.map((d) => { const a = nat.find((x) => x.remoteness === d.remoteness); return { ...d, nat: a.so, diff: d.so - a.so, share: d.n / total }; });
    const main = [...cmp].sort((a, b) => b.share - a.share)[0], worst = [...cmp].sort((a, b) => a.diff - b.diff)[0];
    const lower = (s) => s.toLowerCase();
    let html = `Australia's students do far better in cities than in remote areas (<strong>${f1(nat.find((d) => d.remoteness === "Major cities").so)}%</strong> in major cities, ` +
      `<strong>${f1(nat.find((d) => d.remoteness === "Very remote").so)}%</strong> in very remote areas). ` +
      `${st === "Australian Capital Territory" ? "All of the ACT's students live in major cities." : `Most of ${name}'s students (${(main.share * 100).toFixed(0)}%) are in <strong>${lower(main.remoteness)}</strong> areas, where they scored ${f1(main.so)}% against ${f1(main.nat)}% for Australia`}` +
      (Math.abs(main.diff) < 2.5 ? ", about level with students in similar areas elsewhere." : ".");
    if (worst.diff < -5 && worst !== main) html += ` In ${lower(worst.remoteness)} areas the gap widens: ${f1(worst.so)}% against ${f1(worst.nat)}%.`;
    $("c2-ladder-insight").innerHTML = html;

    const shareLoc = g.gap !== 0 ? (g.location / g.gap) * 100 : 0;
    const others = gb.filter((d) => d.year === state.year && d.gap < -2 && d.state !== st && g.gap < 0 && d.location / d.gap < 0.35).map((d) => THE(d.state));
    const same = Math.sign(g.location) === Math.sign(g.gap);
    let bt;
    if (Math.abs(g.gap) < 1.5) {
      bt = `${cap(name)} is within ${Math.abs(g.gap).toFixed(1)} points of Australia, so there is little to explain.`;
    } else {
      bt = `${cap(name)} is <strong>${Math.abs(g.gap).toFixed(1)} points ${g.gap < 0 ? "below" : "above"}</strong> Australia. `;
      if (same && Math.abs(g.location) >= Math.abs(g.gap)) {
        bt += `Where its students live accounts for <strong>${sgn(g.location)}</strong> points, all of the gap. ` +
          `Compared with students in similar areas elsewhere, it does ${g.other > 0.5 ? "slightly better" : "about the same"} (${sgn(g.other)} points).`;
      } else {
        bt += `Where its students live accounts for <strong>${sgn(g.location)}</strong> of that` +
          (same ? ` (${Math.round(shareLoc)}%)` : ` (it works the other way)`) + `, and everything else for ${sgn(g.other)}.`;
        if (g.gap < -2 && same && shareLoc >= 50) bt += " Geography does most of the work.";
        else if (g.gap < -2) bt += " Geography explains little: it trails even among students in the same type of area.";
      }
    }
    $("c2-breakdown-insight").innerHTML = bt;

    const step = g.national + g.location;
    $("c2-wf-title").textContent = `${st}: from Australia's result to its own, ${state.year}`;
    $("c2-wf-insight").innerHTML =
      `Start at Australia (<strong>${f1(g.national)}%</strong>). If ${name}'s students did as well as students in the same type of area across Australia, the result would be ` +
      `<strong>${f1(step)}%</strong> (${sgn(g.location)} points). The actual result is <strong>${f1(g.actual)}%</strong>, a further ${sgn(g.other)} points.`;
    $("c2-wf-note").innerHTML =
      `We also checked Indigenous status within each type of area. It changes the picture by only ${sgn(g.indigenous_check)} points, ` +
      `so it adds little once location is taken into account. (Chapter 3 looks at student background in detail.)`;
  }

  /* ---------- controls ---------- */
  const slider = $("c2-year-slider"), ticks = $("c2-year-ticks"), play = $("c2-play");
  slider.min = YEARS[0]; slider.max = YEARS[YEARS.length - 1]; slider.step = 1;
  slider.addEventListener("input", () => update({ year: +slider.value }));
  YEARS.forEach((y) => { const b = document.createElement("button"); b.type = "button"; b.textContent = y; b.dataset.year = y; b.addEventListener("click", () => update({ year: y })); ticks.appendChild(b); });
  let timer = null; const last = YEARS[YEARS.length - 1];
  const stop = () => { clearInterval(timer); timer = null; play.textContent = "▶ Play"; };
  play.addEventListener("click", () => {
    if (timer) return stop();
    if (state.year === last) update({ year: YEARS[0] });
    play.textContent = "❚❚ Pause";
    timer = setInterval(() => { const n = state.year + 1; if (n > last) return stop(); update({ year: n }); if (n === last) stop(); }, 1500);
  });
  [...$("c2-metric").children].forEach((b) => b.addEventListener("click", () => update({ metric: b.dataset.metric })));
  const chips = $("c2-state-chips");
  STATES.forEach((s) => { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = CODE[s]; b.title = s; b.dataset.state = s; b.addEventListener("click", () => update({ sel: s })); chips.appendChild(b); });
  [views.map_states, views.gap_breakdown].forEach((v) => v.addEventListener("click", (e, item) => {
    const d = item && item.datum; if (d && d.state && d.state !== AUS && CODE[d.state]) update({ sel: d.state });
  }));

  function update(patch = {}) {
    Object.assign(state, patch);
    slider.value = state.year;
    [...ticks.children].forEach((b) => b.classList.toggle("active", +b.dataset.year === state.year));
    [...$("c2-metric").children].forEach((b) => { const on = b.dataset.metric === state.metric; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
    [...chips.children].forEach((b) => { const on = b.dataset.state === state.sel; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
    setSignals(); annotate(); mapText(); stripText(); sceneThreeText();
  }
  update();
})();
