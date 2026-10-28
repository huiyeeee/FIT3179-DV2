/* Chapter 2 · Geographic differences
 * Each chart is a Vega-Lite JSON file in chapter-2/specs/ that is loaded as-is. This script only
 *   1. embeds them,
 *   2. sets their named param (sel = the state being followed) from the map, the dot strip and the chips; view = what the dots are coloured by,
 *   3. writes the explanatory text from the same CSV files.
 */
(async function () {
  const $ = (id) => document.getElementById(id);
  const AUS = "Australia";
  const CODE = { "New South Wales": "NSW", "Victoria": "VIC", "Queensland": "QLD", "Western Australia": "WA", "South Australia": "SA",
                 "Tasmania": "TAS", "Northern Territory": "NT", "Australian Capital Territory": "ACT" };
  const STATES = ["Northern Territory", "Queensland", "South Australia", "Western Australia", "New South Wales", "Victoria", "Australian Capital Territory"];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const THE = (s) => (s === "Northern Territory" || s === "Australian Capital Territory" ? "the " + s : s);
  const f0 = (n) => n.toFixed(0), f1 = (n) => n.toFixed(1);
  const sgn = (n) => (Math.abs(n) < 0.05 ? "" : n > 0 ? "+" : "−") + Math.abs(n).toFixed(1);
  const list = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  const state = { sel: "Northern Territory", mode: "all" };
  const narrow = window.innerWidth < 600;

  const read = async (n) => vega.read(await vega.loader().load(`chapter-2/data/${n}.csv`), { type: "csv", parse: "auto" });
  const [results, cells, remote, gb, latest, ctx] = await Promise.all([read("state_results"), read("state_cells"), read("remoteness"), read("gap_breakdown"), read("map_latest"), read("state_context")]);
  const C = (st) => ctx.find((d) => d.state === st);
  const YEAR = Math.max(...results.map((d) => d.year));
  const YEARS = [...new Set(results.map((d) => d.year))].sort();
  const nat = results.find((d) => d.year === YEAR && d.state === AUS);
  const published = (s, y = YEAR) => results.find((d) => d.year === y && d.state === s && d.reported);

  /* ---------- embed the JSON specs ---------- */
  const views = {};
  const mount = { map_symbols: "c2-sym", map_support: "c2-sup", strip_consistency: "c2-strip", remoteness_ladder: "c2-ladder", gap_breakdown: "c2-breakdown" };
  await Promise.all(Object.entries(mount).map(async ([name, el]) => {
    let spec = await (await fetch(`chapter-2/specs/${name}.json`)).json();
    if (name === "strip_consistency" && narrow) {   // phones: no room for the side columns and notes
      const tas = spec.layer.find((l) => l.encoding && l.encoding.text && l.encoding.text.value);
      tas.encoding.text.value = "not published";
      spec.padding.right = 8;
      spec.layer = spec.layer.filter((l) => !((l.data && l.data.name === "annot") || (l.encoding && l.encoding.text && l.encoding.text.field === "summary") ||
        (l.data && l.data.url && /state_context/.test(l.data.url)) || (l.data && l.data.values && l.data.values[0] && l.data.values[0].t)));
    }
    if (name === "map_symbols" && narrow) {   // phones: smaller circles (area 2200 px² for 2 million students)
      spec.layer.forEach((l) => {
        if (l.encoding && l.encoding.size) l.encoding.size.scale.range = [0, 2200];
      });
    }
    views[name] = (await vegaEmbed("#" + el, spec, { actions: false, renderer: "svg" })).view;
  }));
  Object.values(views).forEach((v) => { try { v.signal("year", YEAR).run(); } catch (e) { /* no such param */ } });

  const remShare = (st) => { const r = remote.filter((d) => d.year === YEAR && d.state === st); return r.filter((d) => ["Remote", "Very remote"].includes(d.remoteness)).reduce((t, d) => t + d.n, 0) / r.reduce((t, d) => t + d.n, 0) * 100; };
  const annotate = () => {
    const nt = published("Northern Territory"), lt = latest.find((d) => d.state === "Northern Territory");
    const big3 = latest.filter((d) => ["New South Wales", "Victoria", "Queensland"].includes(d.state)).reduce((t, d) => t + d.n, 0);
    const big3pct = (big3 / nat.n) * 100;
    const ntLowest = YEARS.every((y) => { const r = results.filter((d) => d.year === y && d.state !== AUS && d.reported); return r.sort((a, b) => a.so - b.so)[0].state === "Northern Territory"; });
    const tas = results.find((d) => d.state === "Tasmania" && d.year === YEAR - 1 && d.reported);
    // Notes are placed in screen pixels and converted back to longitude/latitude with the same projection the map spec uses,
    // so each leader line starts at its note and ends on the state it explains.
    const box = $("c2-sym").getBoundingClientRect(), w = box.width, h = box.height;
    const sc = w < 600 ? Math.min(w * 1.05, h * 1.05) : Math.min(w * 1.3, h * 1.3);
    const proj = vega.projection("conicEqualArea")().rotate([-134, 0, 0]).parallels([-18, -36]).center([0, -27]).scale(sc).translate([w / 2, h / 2]);
    const px = (x, y) => proj.invert([x, y]), at = (lon, lat) => proj([lon, lat]);
    const CH = 6.3, LH = 14;   // rough width of a character and height of a line, in pixels
    const note = (x, y, text, color, target, side) => {
      const lines = text.split("\n"), wd = Math.max(...lines.map((l) => l.length)) * CH, [lon, lat] = px(x, y);
      const row = { lon, lat, text, color };
      if (target) {
        const from = side === "left" ? px(x - 6, y + (lines.length * LH) / 2) : px(x + wd + 6, y + (lines.length * LH) / 2);
        row.lon2 = from[0]; row.lat2 = from[1]; row.lon3 = target[0]; row.lat3 = target[1];
      }
      return row;
    };
    const rows = [], nc = C("Northern Territory"), tc = C("Tasmania");
    if (narrow) {
      rows.push(note(w * 0.03, h * 0.03, `NT: lowest result\nevery year since ${YEARS[0]}`, "#c2410c", [132.2, -16.5]));
      rows.push(note(w * 0.03, h * 0.86, `${f0(big3pct)}% of students:\nNSW, VIC and QLD`, "#4a5568"));
    } else {
      rows.push(note(w * 0.02, h * 0.1,
        `Northern Territory: lowest result\n${ntLowest ? `in every year since ${YEARS[0]}.\n` : ""}${f0(nc.indigenous_pct)}% of its students are Indigenous\n(Australia: ${f0(C(AUS).indigenous_pct)}%).`, "#c2410c", [129.4, -16.5]));
      const e = at(154, -24);
      rows.push(note(e[0] + 30, e[1] - 50, `${f0(big3pct)}% of students live in NSW,\nVictoria and Queensland, so they\nsteer the national result.\nThe Territory has ${f1((lt.n / nat.n) * 100)}%.`, "#4a5568"));
      const t = at(155.5, -41);
      rows.push(note(t[0] + 8, t[1] - 14, `Tasmania: no ${YEAR} result. A union\nboycott of public-school testing\ncut participation to ${f0(tc.participation_pct)}%, below\nthe reporting threshold.`, "#4a5568", [148.8, -42.2], "left"));
    }
    views.map_symbols.change("annot", vega.changeset().remove(vega.truthy).insert(rows)).run();
    // the support map gets the Territory note only (its Tasmania label is drawn by the map itself)
    const nsup = published("Northern Territory"), sRows = [];
    if (narrow) sRows.push(note(w * 0.03, h * 0.03, `NT: ${f0(nsup.nas)}% need support\n(Australia: ${f0(nat.nas)}%)`, "#c2410c", [132.2, -16.5]));
    else sRows.push(note(w * 0.02, h * 0.1, `Northern Territory: ${f0(nsup.nas)}% need support,\nagainst ${f0(nat.nas)}% across Australia.\n${f0(remShare("Northern Territory"))}% of its students live in remote\nor very remote areas (Australia: ${f1(remShare(AUS))}%).`, "#c2410c", [129.4, -16.5]));
    views.map_support.change("annot", vega.changeset().remove(vega.truthy).insert(sRows)).run();

    if (!narrow) {
      const rows = [{ x: -19, yi: 7, text: `${f0(remShare("Northern Territory"))}% of its students live in remote or very\nremote areas (Australia: ${f1(remShare(AUS))}%)` }];
      if (state.mode !== "subject") rows.push({ x: -33.5, yi: 3, text: "WA: Year 3 trails, Year 9 leads.\nDifferent students at each year\nlevel, not one group improving." });
      views.strip_consistency.change("annot", vega.changeset().remove(vega.truthy).insert(rows)).run();
    }
  };

  /* ---------- scene 1: map ---------- */
  function mapText() {
    const ok = results.filter((d) => d.year === YEAR && d.state !== AUS && d.reported);
    const worst = [...ok].sort((a, b) => a.gap_so - b.gap_so)[0];
    const others = ok.filter((d) => d !== worst).map((d) => Math.abs(d.gap_so));
    $("c2-map-insight").innerHTML = `${cap(THE(worst.state))} is <strong>${f0(Math.abs(worst.gap_so))} points below</strong> Australia (${f0(worst.so)}% against ${f0(nat.so)}%). ` +
      `Among the states with published results, none other is more than ${f0(Math.max(...others))} points away.`;
  }

  function symText() {
    const ok = results.filter((d) => d.year === YEAR && d.state !== AUS && d.reported);
    const worst = [...ok].sort((a, b) => b.nas - a.nas)[0], rest = ok.filter((d) => d !== worst);
    $("c2-sup-insight").innerHTML = `<strong>${f0(worst.nas)}%</strong> of Territory students need additional support, against ${f0(nat.nas)}% across Australia. ` +
      `No other state is more than ${f0(Math.max(...rest.map((d) => Math.abs(d.nas - nat.nas))))} points away.`;
  }

  /* ---------- scene 2: dot strip ---------- */
  const mean = (a) => a.reduce((t, d) => t + d, 0) / a.length;
  const SUBJ = ["Reading", "Writing", "Spelling", "Grammar and Punctuation", "Numeracy"];
  const LVL = ["Year 3", "Year 5", "Year 7", "Year 9"];
  const nm = (x) => (x === "Australian Capital Territory" ? "the ACT" : THE(x));
  function stripText() {
    const c = cells.filter((d) => d.year === YEAR), by = {};
    c.forEach((d) => { (by[d.state] = by[d.state] || []).push(d); });
    const states = Object.keys(by);
    let t;
    if (state.mode === "all") {
      const mixed = states.filter((x) => !by[x].every((d) => d.gap < 0) && !by[x].every((d) => d.gap > 0));
      t = `<strong>Everywhere, not one weak subject:</strong> each state’s 20 results sit in a narrow band.` + (mixed.length ? ` Only ${list(mixed.map(nm))} crosses Australia’s line.` : "");
    } else if (state.mode === "level") {
      const lv = (x, l) => mean(by[x].filter((d) => d.level === +l.slice(5)).map((d) => d.gap));
      const move = states.map((x) => ({ x, y3: lv(x, "Year 3"), y9: lv(x, "Year 9") })).map((o) => ({ ...o, d: o.y9 - o.y3 }));
      const top = [...move].sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
      t = `<strong>Year level barely matters</b>, except in ${nm(top.x)}: <strong>${sgn(top.y3)}</strong> points in Year 3, <strong>${sgn(top.y9)}</strong> in Year 9.`.replace("</b>", "</strong>");
    } else {
      t = `<strong>Subject barely matters:</strong> each state’s gap is about the same in all five subjects.`;
    }
    $("c2-heat-title").innerHTML = t;
    const sw = (c, l) => `<span class="lg"><i class="lg-sq" style="background:${c}"></i>${l}</span>`;
    const hollow = `<span class="lg"><i class="lg-hollow"></i>Hollow dot: too close to call</span>`;
    $("c2-strip-legend").innerHTML = (state.mode === "all" ? sw("#1f6f8b", "Above Australia") + sw("#f0745a", "Below Australia")
      : state.mode === "level" ? LVL.map((l, i) => sw(["#cbd5e1", "#94a3b8", "#556987", "#1e2f4d"][i], l)).join("")
      : ["Reading", "Writing", "Spelling", "Grammar & punct.", "Numeracy"].map((l, i) => sw(["#c2410c", "#1f6f8b", "#7b5ea7", "#b8860b", "#4b5563"][i], l)).join("")) + hollow;
    [...$("c2-view").children].forEach((b) => { const on = b.dataset.mode === state.mode; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
    views.strip_consistency.signal("mode", state.mode).run();
    annotate();
  }
  function stripNote() {
    const tas = results.find((d) => d.state === "Tasmania" && d.year === YEAR - 1 && d.reported);
    const natPrev = results.find((d) => d.state === AUS && d.year === YEAR - 1);
    const pd = (st) => f0(C(st).parents_degree_pct) + "%";
    $("c2-heat-note").innerHTML = `<span class="ctx-label">What may sit behind the order</span><div class="two-col">` +
      `<div><p>The states line up with <strong>parent education</strong>. Among tested students whose parents’ education is known, ${pd("Australian Capital Territory")} in the ACT and ${pd("Victoria")} in Victoria have a parent with a degree, against ${pd("Queensland")} in Queensland and ${pd("Northern Territory")} in the Territory.</p>` +
      `<p>That fits the order but does not prove a cause. Use “Compare with parents’ education” above to see it beside the dots. Chapter 3 looks at student background.</p></div>` +
      `<div><p><strong>Fewer students sat the tests</strong> in two places. Territory participation fell to ${f0(C("Northern Territory").participation_pct)}% after floods closed 15 remote schools. ` +
      `In Tasmania, a union boycott of public-school testing cut it to ${f0(C("Tasmania").participation_pct)}%, below the reporting threshold, so its ${YEAR} results were not published (in ${tas.year}: ${f0(tas.so)}%, ${f0(natPrev.so - tas.so)} points below Australia).</p></div></div>` +
      `<span class="ctx-source">Sources: ACARA NAPLAN results and state comparison tables, ${YEAR}; ` +
      `<a href="https://nit.com.au/24-08-2026/26094/call-for-systemic-change-to-address-indigenous-education-gap">National Indigenous Times, 24 Aug 2026</a>; ` +
      `<a href="https://pulsetasmania.com.au/news/tasmania-has-no-naplan-results-after-unions-test-boycott/">Pulse Tasmania, 5 Aug 2026</a>.</span>`;
  }

  /* ---------- scene 3: why? ---------- */
  function whyText() {
    const st = state.sel, name = THE(st);
    $("c2-showing").textContent = `${st}, ${YEAR}`;
    const rows = remote.filter((d) => d.year === YEAR);
    const mine = rows.filter((d) => d.state === st), natR = rows.filter((d) => d.state === AUS);
    const g = gb.find((d) => d.year === YEAR && d.state === st);
    const total = mine.reduce((s, d) => s + d.n, 0), natTotal = natR.reduce((s, d) => s + d.n, 0);
    const cmp = mine.map((d) => { const a = natR.find((x) => x.remoteness === d.remoteness); return { ...d, nat: a.so, diff: d.so - a.so, share: d.n / total }; });

    if (Math.abs(g.gap) < 1.5) $("c2-breakdown-insight").innerHTML = `${cap(name)} is within <strong>${f1(Math.abs(g.gap))} points</strong> of Australia, so there is little to explain.`;
    else if (g.gap < 0 && Math.abs(g.location) / Math.abs(g.gap) >= 0.5)
      $("c2-breakdown-insight").innerHTML = `${cap(name)} is <strong>${f1(Math.abs(g.gap))} points below</strong> Australia. Where its students live explains <strong>${f1(Math.abs(g.location))}</strong> of that.`;
    else if (g.gap < 0)
      $("c2-breakdown-insight").innerHTML = `${cap(name)} is <strong>${f1(Math.abs(g.gap))} points below</strong> Australia. Where its students live explains only <strong>${f1(Math.abs(g.location))}</strong> of that.`;
    else $("c2-breakdown-insight").innerHTML = `${cap(name)} is <strong>${f1(g.gap)} points above</strong> Australia. Where its students live adds <strong>${f1(Math.max(g.location, 0))}</strong> of that.`;

    const worst = [...cmp].sort((a, b) => a.diff - b.diff)[0], low = (s) => s.toLowerCase();
    const farShare = (arr, tot) => arr.filter((d) => ["Outer regional", "Remote", "Very remote"].includes(d.remoteness)).reduce((s, d) => s + d.n, 0) / tot * 100;
    const ORDER = ["Major cities", "Inner regional", "Outer regional", "Remote", "Very remote"];
    const phrase = (arr) => {
      if (arr.length === cmp.length) return "every type of area";
      const names = [...arr].sort((x, y) => ORDER.indexOf(x.remoteness) - ORDER.indexOf(y.remoteness)).map((d) => low(d.remoteness));
      return list(names) + (names[names.length - 1] === "major cities" ? "" : " areas");
    };
    const lag = cmp.filter((d) => d.diff < -2.5), lead = cmp.filter((d) => d.diff > 2.5);
    $("c2-ladder-title").innerHTML = cmp.length === 1
      ? `All of ${name}’s students live in major cities, where <strong>${f0(cmp[0].so)}%</strong> meet expectations.`
      : (lag.length && lead.length)
        ? `${cap(name)}’s students <strong>trail</strong> Australia in ${phrase(lag)}, but <strong>lead</strong> in ${phrase(lead)}.`
        : lag.length ? `${cap(name)}’s students <strong>trail</strong> Australia in ${phrase(lag)}.`
        : lead.length ? `${cap(name)}’s students <strong>lead</strong> Australia in ${phrase(lead)}.`
        : `${cap(name)}’s students do about as well as students in the same type of area across Australia.`;
    $("c2-ladder-hint").textContent = cmp.length === 1 ? "" :
      `${f0(farShare(mine, total))}% of ${st === "Northern Territory" ? "its" : name + "’s"} students live in outer regional, remote or very remote areas, against ${f0(farShare(natR, natTotal))}% of Australia’s.`;

    views.map_symbols.signal("sel", st).run(); views.map_support.signal("sel", st).run();
    ["strip_consistency", "remoteness_ladder", "gap_breakdown"].forEach((k) => views[k].signal("sel", st).run());
    [...$("c2-state-chips").children].forEach((b) => { const on = b.dataset.state === st; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
  }

  function whyNote() {
    const natR = remote.filter((d) => d.year === YEAR && d.state === AUS), r = (n) => natR.find((d) => d.remoteness === n).so;
    const ntR = remote.filter((d) => d.year === YEAR && d.state === "Northern Territory");
    const farNT = ntR.filter((d) => ["Remote", "Very remote"].includes(d.remoteness)).reduce((s, d) => s + d.n, 0) / ntR.reduce((s, d) => s + d.n, 0) * 100;
    const q = gb.find((d) => d.year === YEAR && d.state === "Queensland"), sa = gb.find((d) => d.year === YEAR && d.state === "South Australia");
    const act = gb.find((d) => d.year === YEAR && d.state === "Australian Capital Territory");
    const ntRem = ntR.find((d) => d.remoteness === "Remote"), natRem = natR.find((d) => d.remoteness === "Remote");
    const nt0 = gb.find((d) => d.year === YEAR && d.state === "Northern Territory");
    const major = (rows) => rows.find((d) => d.remoteness === "Major cities") ? rows.find((d) => d.remoteness === "Major cities").n / rows.reduce((s, d) => s + d.n, 0) * 100 : 0;
    const others = [...new Set(remote.filter((d) => d.year === YEAR).map((d) => d.state))].filter((s) => ![AUS, "Northern Territory", "Australian Capital Territory"].includes(s));
    const shares = others.map((s) => major(remote.filter((d) => d.year === YEAR && d.state === s)));
    const maxLoc = Math.max(...others.map((s) => Math.abs(gb.find((d) => d.year === YEAR && d.state === s).location)));
    $("c2-why-note").innerHTML = `<span class="ctx-label">Where students live matters at the two extremes</span><div class="two-col">` +
      `<div><p>Results fall with distance in every state. Across Australia, <strong>${f0(r("Major cities"))}%</strong> of students in major cities meet expectations, against <strong>${f0(r("Very remote"))}%</strong> in very remote areas. Reporting on the 2025 results made the same point, while noting that “many students and schools in remote areas are doing well”.</p>` +
      `<p>That only moves a state’s overall result when many of its students live far out. Every Territory student lives in an outer regional, remote or very remote area, and ${f0(farNT)}% in the last two. Every ACT student lives in a city.</p></div>` +
      `<div><p>So location explains <strong>${f1(Math.abs(nt0.location))} of the Territory’s ${f1(Math.abs(nt0.gap))} points</strong> and ${f1(act.location)} of the ACT’s ${f1(act.gap)}-point lead. The rest of the Territory’s gap is partly a remote-area gap: ${f0(ntRem.so)}% of its remote students meet expectations, against ${f0(natRem.so)}% elsewhere.</p>` +
      `<p>In the other states, ${f0(Math.min(...shares))}–${f0(Math.max(...shares))}% of students live in major cities (Australia: ${f0(major(natR))}%), so location explains ${f1(maxLoc)} points or less. Their gaps come from elsewhere. Chapter 3 looks at student background.</p></div></div>` +
      `<span class="ctx-source">Source: <a href="https://educationmattersmag.com.au/naplan-participation-bounces-back-amid-early-signs-of-potential-improvements/">Education Matters</a>, on the 2025 results; ACARA NAPLAN results, ${YEAR}.</span>`;
    const nt = gb.find((d) => d.year === YEAR && d.state === "Northern Territory");
    $("c2-short").innerHTML = `Only the Northern Territory is far from the Australian result: <strong>${f0(Math.abs(nt.gap))} points below</strong>, in every subject and year level. ` +
      `About <strong>${f0(Math.abs(nt.location / nt.gap) * 100)}%</strong> of that gap comes from where its students live. Queensland and South Australia trail by smaller, steady margins that location does not explain.`;
  }

  /* ---------- map tabs: meeting expectations (symbols) / needing support (colours) ---------- */
  const showTab = (tab) => {
    [...$("c2-maptab").children].forEach((x) => { const on = x.dataset.tab === tab; x.classList.toggle("active", on); x.setAttribute("aria-pressed", on); });
    ["meet", "need"].forEach((t) => { const p = $("c2-panel-" + t); p.classList.toggle("on", t === tab); p.setAttribute("aria-hidden", t !== tab); });
  };
  [...$("c2-maptab").children].forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  document.querySelectorAll("#chapter-2 .c2-switch").forEach((b) => b.addEventListener("click", () => { showTab(b.dataset.tab); $("c2-maptab").scrollIntoView({ block: "start", behavior: "smooth" }); }));

  /* ---------- controls ---------- */
  const chips = $("c2-state-chips");
  STATES.forEach((s) => { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = CODE[s]; b.title = s; b.dataset.state = s; b.addEventListener("click", () => update(s)); chips.appendChild(b); });
  [...$("c2-view").children].forEach((b) => b.addEventListener("click", () => { state.mode = b.dataset.mode; stripText(); }));
  const pick = (e, item) => { const d = item && item.datum; if (d && d.state && STATES.includes(d.state)) update(d.state); };
  ["map_symbols", "map_support", "strip_consistency", "gap_breakdown"].forEach((k) => views[k].addEventListener("click", pick));
  function update(s) { state.sel = s; whyText(); if (barsView) barsView.signal("sel", s).run(); }
  let barsView = null;
  const grid = $("c2-strip-grid"), tog = $("c2-parents-toggle");
  tog.addEventListener("click", async () => {
    const on = tog.getAttribute("aria-pressed") !== "true";
    tog.setAttribute("aria-pressed", on); tog.classList.toggle("active", on);
    tog.textContent = on ? "－ Hide parents’ education" : "＋ Compare with parents’ education";
    grid.classList.toggle("with-bars", on); $("c2-bars-wrap").hidden = !on;
    if (on && !barsView) { barsView = (await vegaEmbed("#c2-bars", "chapter-2/specs/parents_bars.json", { actions: false, renderer: "svg" })).view; barsView.signal("sel", state.sel).run(); }
    const rs = () => window.dispatchEvent(new Event("resize")); requestAnimationFrame(rs); setTimeout(rs, 120); setTimeout(rs, 400);
  });
  let rz = null;
  if (window.ResizeObserver) { let ro; new ResizeObserver(() => { clearTimeout(ro); ro = setTimeout(() => { views.strip_consistency.resize().run(); if (barsView) barsView.resize().run(); }, 80); }).observe($("c2-strip-grid") || document.querySelector(".c2-strip-grid")); }
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { annotate(); Object.values(views).forEach((v) => v.resize().run()); if (barsView) barsView.resize().run(); }, 200); });

  annotate(); mapText(); symText(); if (window.initTips) window.initTips($("chapter-2")); stripText(); stripNote(); whyNote(); update("Northern Territory");
})();
