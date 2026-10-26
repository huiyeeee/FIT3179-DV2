/* Chapter 0 · Before the results
 * Four Vega-Lite JSON charts (chapter-0/specs) tell one story:
 *   1. waffle   - of 100 enrolled students, how many have a result that counts?     (follows the picked state)
 *   2. tile map - pick a state or territory                                        (the only "overview then detail" control)
 *   3. area     - why are students going missing over time?                        (follows the picked state)
 *   4. bars     - which groups of students are missing most?                       (chips choose the type of group)
 * This script only sets the charts' named params and writes the short explanatory text from the same CSV files.
 */
(async function () {
  const $ = (id) => document.getElementById(id);
  const AUS = "Australia";
  const f0 = (n) => n.toFixed(0), f1 = (n) => n.toFixed(1);
  const THE = (s) => (s === "Northern Territory" || s === "Australian Capital Territory" ? "the " + s : s);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const read = async (n) => vega.read(await vega.loader().load(`chapter-0/data/${n}.csv`), { type: "csv", parse: "auto" });
  const [trend, groups] = await Promise.all([read("outcomes_trend"), read("outcomes_groups")]);
  const YEAR = Math.max(...trend.map((d) => d.year));
  const state = { sel: AUS, attr: groups[0].attribute };

  /* ---------- embed the JSON specs ---------- */
  const mount = { waffle_outcomes: "c0-waffle", tile_map_selector: "c0-tiles", trend_missing: "c0-trend", who_is_missing: "c0-groups" };
  const views = {};
  await Promise.all(Object.entries(mount).map(async ([spec, el]) => {
    views[spec] = (await vegaEmbed("#" + el, `chapter-0/specs/${spec}.json`, { actions: false, renderer: "svg" })).view;
  }));

  const row = (st, yr = YEAR) => trend.find((d) => d.state === st && d.year === yr);

  /* ---------- context notes that depend on the picked state (verified sources) ---------- */
  const TAS_SRC = `<a href="https://pulsetasmania.com.au/news/tasmania-has-no-naplan-results-after-unions-test-boycott/">Pulse Tasmania, 5 Aug 2026</a>`;
  const AERO = `<a href="https://www.edresearch.edu.au/research/analytical-insights-papers/naplan-participation-post-covid-19-improvements-and-remaining-challenges">AERO (2025)</a>`;
  // each note is two short sentences-worth: lead (left column) and rest (right column)
  const NOTES = {
    "Tasmania": { warm: true, label: "Why so few?", src: `Source: ${TAS_SRC}.`,
      lead: "Tasmania’s public-school teachers’ union (the AEU) took industrial action during the 2026 testing period.",
      rest: "Students were recorded as absent rather than withdrawn, and too few sat the tests for ACARA to publish Tasmania’s results, the first time any state has been left out." },
    "Northern Territory": { warm: true, label: "Why so many?", src: `Source: ${AERO}.`,
      lead: "In the Northern Territory the cause is mostly absence: in 2024 about 85% of Year 9 students without a result were absent.",
      rest: "More than 1 in 5 NT Year 9 students live in very remote areas, where attendance is far lower." },
    "Queensland": { warm: true, label: "Why Queensland?", src: `Source: ${AERO}.`,
      lead: "Queensland has the highest rate of withdrawals.",
      rest: "In 2024 about half (51%) of its Year 9 students without a result had been withdrawn by a parent or carer, well above any other state or territory." },
  };
  function stateNote() {
    const el = $("c0-state-note");
    el.className = "context wide-note";
    let n;
    if (state.sel === AUS) {
      const a = row(AUS), took = a.assessed + a.nores;
      n = { label: "Is that enough?", src: `Source: ${AERO}.`,
        lead: "ACARA’s technical standard is a participation rate of 90%, counting students who were excused or unscored as taking part, so that results are not biased.",
        rest: `Nationally ${f0(took)}% took part, so the standard is met. Some places and groups fall far short of it.` };
    } else if (NOTES[state.sel]) {
      n = NOTES[state.sel]; el.classList.toggle("warm", !!n.warm);
    } else {
      const r = row(state.sel), a = row(AUS);
      n = { label: THE(state.sel).replace(/^the /, "The "), lead: `${f0(r.c_assessed)} of every 100 students had a result counted, close to the national ${f0(a.c_assessed)}.`,
        rest: "Try Tasmania, the Northern Territory or Queensland to see what unusual looks like." };
    }
    el.innerHTML = `<span class="ctx-label">${n.label}</span><div class="two-col"><p>${n.lead}</p><p>${n.rest}</p></div>` + (n.src ? `<span class="ctx-source">${n.src}</span>` : "");
  }

  // headline for the tile map, written from the data (lowest share of results counted)
  (function () {
    const rows = trend.filter((d) => d.year === YEAR && d.state !== AUS).sort((a, b) => a.c_assessed - b.c_assessed);
    $("c0-tile-title").innerHTML = `${rows[0].state} stands out in ${YEAR}: only <strong>${rows[0].c_assessed} of every 100</strong> students had a result counted.`;
  })();

  /* ---------- scene A: waffle + picker ---------- */
  function sceneA() {
    const r = row(state.sel), name = THE(state.sel);
    const c = [r.c_assessed, r.c_nores, r.c_absent, r.c_withdrawn];   // whole numbers from prepare_data.py (add to 100)
    views.waffle_outcomes.signal("counts", c).signal("pcts", [r.assessed, r.nores, r.absent, r.withdrawn]).run();
    const parts = [`${c[2]} absent`, `${c[3]} withdrawn by a parent`, `${c[1]} took part without a result`];
    $("c0-caption").innerHTML = state.sel === AUS
      ? `In ${YEAR}, <strong>${c[0]} of every 100</strong> enrolled students had a result counted. The other ${100 - c[0]}: ${parts[0]}, ${parts[1]} and ${parts[2]}.`
      : `In <strong>${name}</strong> in ${YEAR}, ${c[0] < 80 ? "only " : ""}<strong>${c[0]} of every 100</strong> enrolled students had a result counted. The other ${100 - c[0]}: ${parts[0]}, ${parts[1]} and ${parts[2]}.`;
    $("h-took").textContent = c[0] + c[1]; $("h-assessed").textContent = c[0]; $("h-nores").textContent = c[1];
    $("h-missed").textContent = c[2] + c[3]; $("h-absent").textContent = c[2]; $("h-withdrawn").textContent = c[3];
    $("c0-reset").hidden = state.sel === AUS;
    stateNote();
  }

  /* ---------- scene B: over time ---------- */
  function sceneB() {
    const rows = trend.filter((d) => d.state === state.sel).sort((a, b) => a.year - b.year), first = rows[0], last = rows[rows.length - 1], prev = rows[rows.length - 2];
    const name = THE(state.sel);
    const peak = Math.max(...rows.map((d) => d.missing), ...(state.sel === AUS ? [] : trend.filter((d) => d.state === AUS).map((d) => d.missing)));
    views.trend_missing.signal("sel", state.sel).signal("ymax", Math.max(10, Math.ceil(peak / 0.64 / 2) * 2)).run();
    $("c0-dash-key").hidden = state.sel === AUS;

    let html;
    if (last.missing > 2 * prev.missing && last.missing - prev.missing > 8) {
      html = `<strong>${cap(name)}</strong> tracked the national picture until ${last.year}, when the share without a result jumped from <strong>${f1(prev.missing)}%</strong> to <strong>${f1(last.missing)}%</strong>. ` +
        `Nearly all of it is absences (${f1(prev.absent)}% to ${f1(last.absent)}%); withdrawals barely moved.`;
    } else {
      const d = { absent: last.absent - first.absent, withdrawn: last.withdrawn - first.withdrawn, nores: last.nores - first.nores };
      const total = last.missing - first.missing, key = Object.keys(d).sort((a, b) => d[b] - d[a])[0];
      const word = { absent: "absences", withdrawn: "withdrawals", nores: "students who took part without a result" }[key];
      const share = total > 0 ? Math.round((d[key] / total) * 100) : 0;
      html = `Between ${first.year} and ${last.year}, the share of ${name}’s enrolled students without a result went from <strong>${f1(first.missing)}%</strong> to <strong>${f1(last.missing)}%</strong>. ` +
        (total > 1 && share >= 50
          ? `<strong>${cap(word)}</strong> account for ${share}% of the rise (${f1(first[key])}% to ${f1(last[key])}%).`
          : `The mix of reasons has changed little.`);
      if (state.sel === AUS && last.withdrawn / first.withdrawn > 5) html += ` Withdrawals are up about ${Math.round(last.withdrawn / first.withdrawn)}-fold, while absences barely moved (${f1(first.absent)}% to ${f1(last.absent)}%).`;
    }
    $("c0-trend-insight").innerHTML = html;
  }

  /* ---------- scene C: who is missing ---------- */
  // "Very remote" -> "students in very remote areas", "Year 11 or below" -> "students whose parents finished Year 11 or below" ...
  function who(attr, group) {
    const l = group.toLowerCase();
    if (attr === "Where students live") return /cities/.test(l) ? `students in ${l}` : `students in ${l} areas`;
    if (attr === "Indigenous status") return group === "Indigenous" ? "Indigenous students" : "non-Indigenous students";
    if (attr === "Parents’ education") return /^year/.test(l) ? `students whose parents finished ${group}` : `students whose parents have a ${l}`.replace("a diploma", "a diploma").replace("a certificate i–iv", "a Certificate I–IV");
    if (attr === "Parents’ work") return /not in paid/.test(l) ? "students whose parents are not in paid work" : `students whose parents are ${l}`;
    return `${group} students`;
  }
  function sceneC() {
    const rows = groups.filter((d) => d.attribute === state.attr), s = [...rows].sort((a, b) => b.missing - a.missing), hi = s[0], lo = s[s.length - 1];
    const xmax = Math.max(10, Math.ceil((hi.missing * 1.2) / 5) * 5);
    views.who_is_missing.signal("attr", state.attr).signal("xmax", xmax).run();
    const key = ["absent", "withdrawn", "nores"].sort((a, b) => hi[b] - hi[a])[0];
    const why = { absent: "mostly because they were absent", withdrawn: "mostly because they were withdrawn", nores: "mostly because they took part without a result" }[key];
    const ratio = hi.missing / lo.missing;
    $("c0-groups-insight").innerHTML = `Among <strong>${who(state.attr, hi.group)}</strong>, <strong>${f0(hi.missing)}%</strong> had no result in ${YEAR}, ${why}. ` +
      (ratio >= 1.5 ? `That is ${ratio.toFixed(1)} times the rate for ${who(state.attr, lo.group)} (${f0(lo.missing)}%).` : `Not far from the ${f0(lo.missing)}% for ${who(state.attr, lo.group)}.`);
    const g = (a, n) => groups.find((d) => d.attribute === a && d.group === n), vr = g("Where students live", "Very remote"), ind = g("Indigenous status", "Indigenous");
    $("c0-std").innerHTML = `ACARA’s technical standard is a 90% participation rate. In ${YEAR}, only <strong>${f0(vr.assessed + vr.nores)}%</strong> of very remote students and <strong>${f0(ind.assessed + ind.nores)}%</strong> of Indigenous students took part.`;
  }

  /* ---------- controls ---------- */
  const attrs = [...new Set(groups.map((d) => d.attribute))];
  attrs.forEach((a) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = a; b.dataset.v = a;
    b.addEventListener("click", () => update({ attr: a }));
    $("c0-attr-chips").appendChild(b);
  });
  const sel = $("c0-state-select");
  [AUS, ...trend.filter((d) => d.year === YEAR && d.state !== AUS).map((d) => d.state).sort()].forEach((s) => sel.add(new Option(s, s)));
  sel.addEventListener("change", () => update({ sel: sel.value }));

  /* ⓘ buttons: show on hover, keyboard focus and tap; Escape closes */
  const tips = [...document.querySelectorAll("#chapter-0 .tip")];
  const setTip = (t, on) => { t.querySelector(".info").setAttribute("aria-expanded", on); t.querySelector(".tip-pop").hidden = !on; };
  tips.forEach((t) => {
    const btn = t.querySelector(".info");
    let pinned = false;                                   // opened by a click or tap, so hovering away does not close it
    const close = () => { pinned = false; setTip(t, false); };
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (pinned) return close();
      tips.forEach((o) => o !== t && setTip(o, false));
      pinned = true; setTip(t, true);
    });
    t.addEventListener("mouseenter", () => setTip(t, true));
    t.addEventListener("mouseleave", () => { if (!pinned && document.activeElement !== btn) setTip(t, false); });
    btn.addEventListener("focus", () => setTip(t, true));
    btn.addEventListener("blur", close);
    t.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); btn.focus(); } });
    t.closeTip = close;
  });
  document.addEventListener("click", () => tips.forEach((o) => o.closeTip()));
  $("c0-reset").addEventListener("click", () => update({ sel: AUS }));
  views.tile_map_selector.addEventListener("click", (e, item) => {
    const d = item && item.datum;
    if (d && d.state && d.state !== AUS) update({ sel: d.state === state.sel ? AUS : d.state });
  });

  function update(patch = {}) {
    Object.assign(state, patch);
    views.tile_map_selector.signal("sel", state.sel).run();
    $("c0-state-select").value = state.sel; $("c0-showing").textContent = state.sel;
    [...$("c0-attr-chips").children].forEach((b) => { const on = b.dataset.v === state.attr; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
    sceneA(); sceneB(); sceneC();
  }
  update();
})();
