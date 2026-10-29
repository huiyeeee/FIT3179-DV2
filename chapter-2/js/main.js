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
  const [results, cells, remote, gb, latest, ctx, cLabels] = await Promise.all([read("state_results"), read("state_cells"), read("remoteness"), read("gap_breakdown"), read("map_latest"), read("state_context"), read("cartogram_labels")]);
  const C = (st) => ctx.find((d) => d.state === st);
  const YEAR = Math.max(...results.map((d) => d.year));
  const YEARS = [...new Set(results.map((d) => d.year))].sort();
  const nat = results.find((d) => d.year === YEAR && d.state === AUS);
  const published = (s, y = YEAR) => results.find((d) => d.year === y && d.state === s && d.reported);

  /* ---------- embed the JSON specs ---------- */
  const views = {};
  const mount = { map_cartogram: "c2-carto", map_symbols: "c2-sym", map_support: "c2-sup", strip_consistency: "c2-strip", remoteness_ladder: "c2-ladder", gap_breakdown: "c2-breakdown" };
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
        if (l.encoding && l.encoding.size) l.encoding.size.scale.range = [0, 1700];
      });
    }
    views[name] = (await vegaEmbed("#" + el, spec, { actions: false, renderer: "svg" })).view;
  }));
  Object.values(views).forEach((v) => { try { v.signal("year", YEAR).run(); } catch (e) { /* no such param */ } });

  const remShare = (st) => { const r = remote.filter((d) => d.year === YEAR && d.state === st); return r.filter((d) => ["Remote", "Very remote"].includes(d.remoteness)).reduce((t, d) => t + d.n, 0) / r.reduce((t, d) => t + d.n, 0) * 100; };
  /* Notes on the three maps are placed in screen pixels and measured, so every leader line starts at the edge of its note's text
     and ends on the state it explains, at any window width. Pixels are turned back into map coordinates with each map's own projection. */
  const FONT = '600 11.5px Inter, system-ui, -apple-system, "Segoe UI", sans-serif', LH = 14;
  const ruler = document.createElement("canvas").getContext("2d");
  const textW = (s) => { ruler.font = FONT; return ruler.measureText(s).width; };
  const projOf = (name) => views[name]._runtime.scales.projection.value;
  /* items: { x, y (top-left of the note, px), text, color, to: [{ x, y, r?, row? }] }  ->  rows for the "annot" dataset */
  const buildRows = (P, items) => {
    const rows = [];
    items.forEach((it) => {
      const lines = it.text.split("\n"), ws = lines.map(textW), W = Math.max(...ws), H = lines.length * LH, [lon, lat] = P.invert([it.x, it.y]);
      rows.push({ lon, lat, text: it.text, color: it.color });
      (it.to || []).forEach((t) => {
        const below = t.y > it.y + H / 2, i = t.row !== undefined ? t.row : below ? lines.length - 1 : 0, cy = it.y + i * LH + LH / 2 + 1;
        let sx, sy;
        if (t.x > it.x + ws[i] + 10) { sx = it.x + ws[i] + 5; sy = cy; }          // target to the right: leave from the end of the line
        else if (t.x < it.x - 10) { sx = it.x - 5; sy = cy; }                        // target to the left: leave from the start of the line
        else { sx = Math.min(it.x + W - 4, Math.max(it.x + 6, t.x)); sy = t.y > it.y ? it.y + H + 3 : it.y - 3; }   // target above or below
        let ex = t.x, ey = t.y;
        if (t.r) { const d = Math.hypot(t.x - sx, t.y - sy) || 1; ex = t.x - ((t.x - sx) / d) * (t.r + 1.5); ey = t.y - ((t.y - sy) / d) * (t.r + 1.5); }
        const a1 = P.invert([sx, sy]), a2 = P.invert([ex, ey]);
        rows.push({ lon2: a1[0], lat2: a1[1], lon3: a2[0], lat3: a2[1], color: it.color });
      });
    });
    return rows;
  };
  const setNotes = (name, rows) => views[name].change("annot", vega.changeset().remove(vega.truthy).insert(rows)).run();
  const annotate = () => {
    const lt = latest.find((d) => d.state === "Northern Territory");
    const big3 = latest.filter((d) => ["New South Wales", "Victoria", "Queensland"].includes(d.state)).reduce((t, d) => t + d.n, 0);
    const big3pct = (big3 / nat.n) * 100;
    const ntLowest = YEARS.every((y) => { const r = results.filter((d) => d.year === y && d.state !== AUS && d.reported); return r.sort((a, b) => a.so - b.so)[0].state === "Northern Territory"; });
    const tc = C("Tasmania"), nc = C("Northern Territory");
    const RED = "#c2410c", GREY = "#4a5568";

    /* tab 1: contiguous cartogram (identity projection: units are the cartogram's own) */
    const wide = (el) => $(el).getBoundingClientRect().width >= 560;
    {
      const P = projOf("map_cartogram"), L = (c) => cLabels.find((d) => d.code === c), pt = (c) => P([L(c).cx, L(c).cy]);
      const items = [];
      if (wide("c2-carto")) {
        const ntp = pt("NT"), tas = pt("TAS"), left = P([12, 0])[0], top = P([0, 8])[1];
        items.push({ x: left, y: top, color: RED, to: [{ x: ntp[0] + 50 * P.scale(), y: ntp[1] - 65 * P.scale() }],
          text: `Northern Territory: lowest result\n${ntLowest ? `in every year since ${YEARS[0]}.\n` : ""}${f0(nc.indigenous_pct)}% of its students are Indigenous\n(Australia: ${f0(C(AUS).indigenous_pct)}%).` });
        items.push({ x: left, y: P([0, 690])[1], color: GREY,
          text: `${f0(big3pct)}% of students live in NSW,\nVictoria and Queensland, so they\nsteer the national result.\nThe Territory has ${f1((lt.n / nat.n) * 100)}%.` });
        const tw = 195, th = 4 * LH;
        items.push({ x: Math.max(left, tas[0] - 150 - tw), y: tas[1] - th / 2 + 6, color: GREY, to: [{ x: tas[0], y: tas[1], r: 7 }],
          text: `Tasmania: no ${YEAR} result. A union\nboycott of public-school testing\ncut participation to ${f0(tc.participation_pct)}%, below\nthe reporting threshold.` });
      }
      setNotes("map_cartogram", buildRows(P, items));
    }

    /* tab 2: choropleth */
    {
      const P = projOf("map_support"), box = $("c2-sup").getBoundingClientRect(), w = box.width, h = box.height, at = (lon, lat) => P([lon, lat]);
      const nsup = published("Northern Territory"), nt = at(129.4, -16.5), items = [];
      if (narrow) items.push({ x: w * 0.03, y: h * 0.03, color: RED, to: [{ x: at(132.2, -16.5)[0], y: at(132.2, -16.5)[1] }], text: `NT: ${f0(nsup.nas)}% need support\n(Australia: ${f0(nat.nas)}%)` });
      else items.push({ x: w * 0.02, y: h * 0.1, color: RED, to: [{ x: nt[0], y: nt[1] }],
        text: `Northern Territory: ${f0(nsup.nas)}% need support,\nagainst ${f0(nat.nas)}% across Australia.\n${f0(remShare("Northern Territory"))}% of its students live in remote\nor very remote areas (Australia: ${f1(remShare(AUS))}%).` });
      setNotes("map_support", buildRows(P, items));
    }

    /* tab 3: proportional symbols (circle area = students exceeding expectations; 400,000 students = 6,500 square pixels) */
    {
      const P = projOf("map_symbols"), items = [];
      if (wide("c2-sym")) {
        const row = (c) => latest.find((d) => d.code === c), cnt = (c) => (row(c).n * row(c).exceed) / 100;
        const circle = (c, lon, lat) => { const p = P([lon, lat]); return { x: p[0], y: p[1], r: Math.sqrt(((cnt(c) / 400000) * 6500) / Math.PI) }; };
        const exTotal = latest.filter((d) => d.reported === 1).reduce((t, d) => t + (d.n * d.exceed) / 100, 0);
        const two = ((cnt("NSW") + cnt("VIC")) / exTotal) * 100, ntR = row("NT"), natEx = results.find((d) => d.year === YEAR && d.state === AUS).exceed;
        const a = P([110.5, -12.5]), b = P([110.5, -35]), c = P([153.5, -40]);
        items.push({ x: a[0], y: a[1], color: RED, to: [circle("NT", ntR.lon, ntR.lat)],
          text: `Northern Territory: ${f0(ntR.exceed)}% exceed expectations,\nless than half Australia’s ${f0(natEx)}%.` });
        items.push({ x: b[0], y: b[1], color: GREY, to: [{ ...circle("VIC", 143.6, -37.6), row: 1 }, ((n) => ({ x: n.x - n.r * 0.99, y: n.y - 6, row: 0 }))(circle("NSW", 148.6, -32.2))],
          text: `NSW and Victoria hold ${f0(two)}% of all\nstudents exceeding expectations.` });
        items.push({ x: c[0], y: c[1], color: GREY, to: [circle("ACT", 155.0, -36.6)],
          text: `${f0(C("Australian Capital Territory").parents_degree_pct)}% of ACT students’ parents have\na degree, the highest of any state\n(Australia: ${f0(C(AUS).parents_degree_pct)}%).` });
      }
      setNotes("map_symbols", buildRows(P, items));
    }

    if (!narrow) {
      const rows = [{ x: -19, yi: 7, text: `${f0(remShare("Northern Territory"))}% of its students live in remote or very\nremote areas (Australia: ${f1(remShare(AUS))}%)` }];
      if (state.mode !== "subject") rows.push({ x: -33.5, yi: 3, text: "WA: Year 3 trails, Year 9 leads.\nDifferent students at each year\nlevel, not one group improving." });
      views.strip_consistency.change("annot", vega.changeset().remove(vega.truthy).insert(rows)).run();
    }
  };

  /* ---------- scene 1: map ---------- */
  function mapText() { /* the takeaway sentence is now fixed text in index.html; the numbers live in the map notes */ }

  function symText() { /* same: no paragraph to fill */ }

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

    ["map_cartogram", "map_symbols", "map_support"].forEach((k) => views[k].signal("sel", st).run());
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
    ["meet", "need", "top"].forEach((t) => { const p = $("c2-panel-" + t); p.classList.toggle("on", t === tab); p.setAttribute("aria-hidden", t !== tab); });
  };
  [...$("c2-maptab").children].forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  document.querySelectorAll("#chapter-2 .c2-switch").forEach((b) => b.addEventListener("click", () => { showTab(b.dataset.tab); $("c2-maptab").scrollIntoView({ block: "start", behavior: "smooth" }); }));

  /* ---------- controls ---------- */
  const chips = $("c2-state-chips");
  STATES.forEach((s) => { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = CODE[s]; b.title = s; b.dataset.state = s; b.addEventListener("click", () => update(s)); chips.appendChild(b); });
  [...$("c2-view").children].forEach((b) => b.addEventListener("click", () => { state.mode = b.dataset.mode; stripText(); }));
  const pick = (e, item) => { const d = item && item.datum; if (d && d.state && STATES.includes(d.state)) update(d.state); };
  ["map_cartogram", "map_symbols", "map_support", "strip_consistency", "gap_breakdown"].forEach((k) => views[k].addEventListener("click", pick));
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
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { Object.values(views).forEach((v) => v.resize().run()); if (barsView) barsView.resize().run(); annotate(); }, 200); });

  annotate(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(annotate); mapText(); symText(); if (window.initTips) window.initTips($("chapter-2")); stripText(); stripNote(); whyNote(); update("Northern Territory");
})();
