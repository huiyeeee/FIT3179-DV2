/* Chapter 3 · Student background
 * Each chart is a Vega-Lite JSON file in chapter-3/specs/ that is loaded as-is. This script only
 *   1. embeds them (phones get a lighter version),
 *   2. sets their named params (groups / st / factor / mix) from the page controls,
 *   3. writes the explanatory text from the same CSV files.
 */
(async function () {
  const $ = (id) => document.getElementById(id);
  const f0 = (n) => n.toFixed(0), f1 = (n) => n.toFixed(1);
  const narrow = window.innerWidth < 600;
  const read = async (n, dir = "chapter-3") => vega.read(await vega.loader().load(`${dir}/data/${n}.csv`), { type: "csv", parse: "auto" });
  const [fac, subj, sg, sup, combo, ctx] = await Promise.all([read("factors"), read("subject_gaps"), read("state_gaps"), read("support_groups"), read("support_combo"), read("state_context", "chapter-2")]);
  const F = (k) => fac.find((d) => d.factor === k);
  const state = { gl: "sex", groups: false, st: "" };
  const AB = { "Australian Capital Territory": "ACT", "New South Wales": "NSW", "Northern Territory": "NT", Queensland: "QLD", "South Australia": "SA", Victoria: "VIC", "Western Australia": "WA" };
  const sw = (c, l) => `<span class="lg"><i class="lg-sq" style="background:${c}"></i>${l}</span>`;

  /* ---------- embed the JSON specs ---------- */
  const drop = (spec, words) => { spec.layer = spec.layer.filter((l) => !words.some((w) => JSON.stringify(l).includes(w))); spec.padding.right = 8; };
  const views = {};
  const mount = { gap_overview: "c3-overview", state_gaps: "c3-states", gender_language: "c3-gl", support_groups: "c3-sup" };
  await Promise.all(Object.entries(mount).map(async ([name, el]) => {
    const spec = await (await fetch(`chapter-3/specs/${name}.json`)).json();
    if (narrow && name === "gap_overview") {   // phones: no room for side columns or group names; the gap moves into the row label
      drop(spec, ['"text":{"field":"s"}', "Lower group, share", "LBOTE: a language", "Girls lead in reading", '"text":{"field":"g"}', '"t":"Gap"', '"text":{"field":"low"}', '"text":{"field":"high"}']);
      const sorted = [...fac].sort((x, y) => y.gap - x.gap);
      spec.layer.forEach((l) => {
        const f = l.encoding && l.encoding.text && l.encoding.text.field;
        if (f === "so_low" || f === "so_high") l.transform = [...(l.transform || []), { filter: "datum.gap > 20" }];
        const ax = l.encoding && l.encoding.y && l.encoding.y.axis;
        if (ax && ax.labelExpr) ax.labelExpr = JSON.stringify(sorted.map((d) => [d.label, f0(d.gap) + " pts"])) + "[datum.value]";
        const xa = l.encoding && l.encoding.x && l.encoding.x.axis;
        if (xa && xa.title) xa.title = "Meeting expectations (%)";
      });
    }
    if (narrow && name === "state_gaps") {   // phones: short row names, no spread column or note
      drop(spec, ["Spread across states", '"text":{"field":"rg"}', "Many Territory"]);
      spec.layer.forEach((l) => {
        const a = l.encoding && l.encoding.y && l.encoding.y.axis; if (a && a.labelExpr) a.labelExpr = '["Education","Job","Indigenous","Language","Gender"][datum.value]';
        const xa = l.encoding && l.encoding.x && l.encoding.x.axis; if (xa && xa.title) xa.title = "Gap (percentage points)";
      });
    }
    if (name === "support_groups") {   // two panels side by side; on phones one above the other
      const w = $(el).clientWidth, lab = narrow ? 100 : 170;
      if (narrow) {
        spec.vconcat = spec.hconcat; delete spec.hconcat;
        spec.vconcat.forEach((p) => { p.width = w - lab - 36; p.height.step = 46; p.layer = p.layer.filter((l) => !JSON.stringify(l).includes("fontStyle")); });
        const ya = spec.vconcat[0].layer[0].encoding.y.axis; ya.labelLimit = 100;
        ya.labelExpr = "{'Very remote areas':'Very remote','Indigenous students':'Indigenous','Parents: Year 11 or below':'Parents: Year 11','Parents: not in paid work':'Parents: no job'}[datum.value]";
        spec.vconcat[1].layer[0].encoding.y.axis = ya;
        spec.vconcat[0].layer[0].encoding.x.axis.title = "Needing support (%)"; spec.vconcat[1].layer[0].encoding.x.axis.title = "Of all needing support (%)";
      } else spec.hconcat.forEach((p) => { p.width = Math.floor((w - lab - 70) / 2); });
    }
    if (narrow && name === "gender_language") {
      drop(spec, ["A group lead does not"]);
      spec.layer.forEach((l) => {
        const ax = l.encoding && l.encoding.x && l.encoding.x.axis; if (ax && ax.title) ax.title = "Lead (percentage points)";
        const v = l.data && l.data.values; if (v && v[0] && v[0].t) v.forEach((d) => { d.t = d.t.replace(" ahead", ""); });
      });
    }
    views[name] = (await vegaEmbed("#" + el, spec, { actions: false, renderer: "svg" })).view;
  }));

  /* ---------- scene 1: who is behind? ---------- */
  function gapText() {
    const big = fac.filter((d) => d.gap > 20), small = fac.filter((d) => d.gap <= 20);
    const lo = Math.round(Math.min(...big.map((d) => d.gap))), hi = Math.round(Math.max(...big.map((d) => d.gap)));
    const sm = Math.round(Math.min(...small.map((d) => d.gap))) + " to " + Math.round(Math.max(...small.map((d) => d.gap)));
    $("c3-gap-lede").innerHTML = `Gaps of <strong>${lo} to ${hi} points</strong>, against <strong>${sm}</strong> for gender and language.`;
    const move = Math.max(...fac.map((d) => Math.abs(d.gap - d.gap_2023)));
    const remote = F("area"), edu = F("edu");
    $("c3-gap-foot").innerHTML = `The biggest gaps are between the smallest groups: only <strong>${f1(remote.share_low)}%</strong> of students live in very remote areas, and <strong>${f0(edu.share_low)}%</strong> have parents who finished Year 11 or below. ` +
      `No gap has moved by more than <strong>${f1(move)}</strong> points since 2023.`;
    $("c3-overview-legend").innerHTML = sw("#f0745a", "Lower-scoring group") + sw("#1f6f8b", "Higher-scoring group") + (state.groups ? sw("#8a96b0", "Groups in between") : "");
  }

  /* ---------- scene 2: does the state change the gap? ---------- */
  function stateText() {
    const of = (k) => sg.filter((d) => d.factor === k), range = (k) => { const x = of(k).map((d) => d.gap); return [Math.min(...x), Math.max(...x)]; };
    const at = (k, s) => of(k).find((d) => d.state === s), name = (k, v) => AB[of(k).find((d) => d.gap === v).state];
    const rest = (k) => { const x = of(k).filter((d) => d.state !== "Northern Territory").map((d) => d.gap); return Math.max(...x) - Math.min(...x); };
    const small = Math.ceil(Math.max(rest("edu"), rest("job"), rest("lang"), rest("sex")));
    const ind = of("ind").filter((d) => d.state !== "Northern Territory"), i0 = ind.reduce((a, b) => (a.gap < b.gap ? a : b)), i1 = ind.reduce((a, b) => (a.gap > b.gap ? a : b));
    $("c3-state-lede").innerHTML = `Outside the Northern Territory, states differ by <strong>${small} points or less</strong>, except for the Indigenous gap (<strong>${f0(i0.gap)}</strong> in the ${AB[i0.state]} to <strong>${f0(i1.gap)}</strong> in ${AB[i1.state]}).`;
    const g = (k, s) => { const v = at(k, s).gap; return (v < 0 ? "−" : "") + f0(Math.abs(v)); };
    $("c3-state-guide").innerHTML = state.st
      ? `<strong>${AB[state.st]}:</strong> parents’ education ${g("edu", state.st)}, parents’ job ${g("job", state.st)}, Indigenous ${g("ind", state.st)}, language ${g("lang", state.st)}, gender ${g("sex", state.st)} points.`
      : `<strong>How to read it:</strong> each dot is a state or territory and the dark tick is Australia. Pick one to follow it.`;
    $("c3-state-legend").innerHTML = sw("#1f6f8b", "A state or territory") + `<span class="lg"><i class="lg-tick"></i>Australia</span>` + (state.st ? sw("#f0745a", AB[state.st]) : "");
    const nt = ctx.find((d) => d.state === "Northern Territory"), aus = ctx.find((d) => d.state === "Australia"), ntl = at("lang", "Northern Territory");
    $("c3-state-note").innerHTML = `<span class="ctx-label">Why the Northern Territory stands out</span><div class="two-col">` +
      `<div><p>The Territory has the widest gap for education, job and Indigenous status. <strong>${f0(nt.indigenous_pct)}%</strong> of its students are Indigenous (Australia: ${f0(aus.indigenous_pct)}%), and many live far from towns.</p></div>` +
      `<div><p>For language, English-only students lead by <strong>${f0(Math.abs(ntl.gap))} points</strong>, the only state where they do. The Territory’s education department says about half of its students speak a language other than English, including Aboriginal languages. The data cannot show whether that explains it.</p></div></div>` +
      `<span class="ctx-source">Sources: ACARA NAPLAN results, 2026; <a href="https://education.nt.gov.au/support-for-teachers/student-diversity/english-as-an-additional-language-dialect">NT Department of Education</a>, English as an additional language or dialect.</span>`;
    views.state_gaps.signal("st", state.st).run();
    [...$("c3-state-chips").children].forEach((b) => { const on = b.dataset.st === state.st; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
  }

  /* ---------- scene 3: who leads in which subject? ---------- */
  function glText() {
    const x = subj.filter((d) => d.factor === state.gl), at = (dom) => x.find((d) => d.domain === dom);
    const other = subj.filter((d) => d.factor !== "sex" && d.factor !== "lang").map((d) => d.gap), oLo = Math.round(Math.min(...other) / 10) * 10, oHi = Math.round(Math.max(...other) / 10) * 10;
    const same = `Parents’ education, parents’ job, where students live and Indigenous status favour the same group in every subject, by ${oLo} to ${oHi} points.`;
    if (state.gl === "sex") {
      const w = at("Writing"), n = at("Numeracy");
      $("c3-gl-title").textContent = "Girls lead in four subjects. Boys lead in numeracy.";
      $("c3-gl-lede").innerHTML = `The lead is biggest in writing (<strong>${f0(w.gap)} points</strong>). Boys’ lead in numeracy is <strong>${f0(Math.abs(n.gap))}</strong>.`;
      $("c3-gl-foot").innerHTML = same;
      $("c3-gl-note").innerHTML = "";
    } else {
      const sp = at("Spelling"), rd = at("Reading");
      $("c3-gl-title").textContent = "Students who speak another language at home lead in every subject.";
      $("c3-gl-lede").innerHTML = `The lead is biggest in spelling (<strong>${f0(sp.gap)} points</strong>) and smallest in reading (<strong>${f0(rd.gap)}</strong>).`;
      $("c3-gl-foot").innerHTML = same;
      const l = F("lang");
      $("c3-gl-note").innerHTML = `<span class="ctx-label">A gap that points the other way</span>` +
        `<p>About <strong>${f0(l.share_high)}%</strong> of students speak another language at home.</p>` +
        `<p>ACARA’s chief executive (2020): these families “take their education very seriously”.</p>` +
        `<p>That is one view. The data cannot test it.</p>` +
        `<span class="ctx-source">Sources: ACARA NAPLAN results, 2026; <a href="https://www.sbs.com.au/news/article/australian-school-students-with-english-as-a-second-language-are-outperforming-their-peers/6s0rlth5t">SBS News, 25 Feb 2020</a>, on the 2019 results.</span>`;
    }
    $("c3-gl-term").hidden = state.gl !== "lang";
    views.gender_language.signal("factor", state.gl).run();
    [...$("c3-gl-tabs").children].forEach((b) => b.classList.toggle("active", b.dataset.factor === state.gl));
  }

  /* ---------- scene 4: who needs support? ---------- */
  const SG = (g) => sup.find((d) => d.group === g);
  function supText() {
    const all = SG("All students"), vr = SG("Very remote"), ind = SG("Indigenous"), boys = SG("Boys");
    $("c3-sup-lede").innerHTML = `About <strong>1 in ${f0(100 / ind.rate)}</strong> Indigenous students needs additional support, ${f0(ind.rate / all.rate)} times the average. But they are only <strong>${f0(ind.share_support)}%</strong> of the students who need it. The same is true of every group with a high rate.`;
    const cv = combo.find((d) => d.area === "Very remote"), cc = combo.find((d) => d.area === "Major cities");
    $("c3-sup-note").innerHTML = `<span class="ctx-label">Where the students are</span><div class="two-col">` +
      `<div><p>Small groups are small. Very remote students are <strong>${f1(vr.share)}%</strong> of all students, so even a rate of ${f0(vr.rate)}% is only <strong>${f0(vr.share_support)}%</strong> of those needing support. Boys are the other way round: a modest rate (${f0(boys.rate)}%, girls ${f0(SG("Girls").rate)}%) but <strong>${f0(boys.share_support)}%</strong> of those needing support.</p></div>` +
      `<div><p>Place and Indigenous status add up. In very remote areas, <strong>${f0(cv.ind)} in every 100</strong> Indigenous students need support, against ${f0(cv.non)} in every 100 other students. In major cities the figures are ${f0(cc.ind)} and ${f0(cc.non)}.</p><p>Only <strong>${f0(cv.part_ind)}</strong> in every 100 enrolled Indigenous students in very remote areas sat the tests, so the real need may be higher.</p></div></div>` +
      `<span class="ctx-source">Source: ACARA NAPLAN results and participation, 2026.</span>`;
  }

  function shortText() {
    const big = fac.filter((d) => d.gap > 20), lo = Math.round(Math.min(...big.map((d) => d.gap))), hi = Math.round(Math.max(...big.map((d) => d.gap)));
    const ind = sg.filter((d) => d.factor === "ind"), imin = ind.reduce((a, b) => (a.gap < b.gap ? a : b)), imax = ind.reduce((a, b) => (a.gap > b.gap ? a : b));
    const vr = SG("Very remote"), cityS = SG("Major cities");
    $("c3-short-a").innerHTML = `Where students live, their parents’ education and work, and Indigenous status separate students by <strong>${lo} to ${hi} points</strong>. The gaps have not moved since 2023.`;
    $("c3-short-b").innerHTML = `The Indigenous gap changes most from state to state, from ${f0(imin.gap)} points in ${AB[imin.state]} to ${f0(imax.gap)} in ${AB[imax.state]}. ` +
      `The highest rates of need are in the smallest groups (${f0(vr.rate)}% of very remote students), yet ${f0(cityS.share_support)}% of students needing support live in major cities.`;
  }

  /* ---------- controls ---------- */
  const sc = $("c3-state-chips");
  [["", "All states"], ...Object.entries(AB).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => [k, v])].forEach(([k, label]) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = label; b.dataset.st = k;
    b.addEventListener("click", () => { state.st = k; stateText(); }); sc.appendChild(b);
  });
  [...$("c3-gl-tabs").children].forEach((b) => b.addEventListener("click", () => { state.gl = b.dataset.factor; glText(); }));
  const tog = $("c3-groups");
  tog.addEventListener("click", () => {
    state.groups = tog.getAttribute("aria-pressed") !== "true";
    tog.setAttribute("aria-pressed", state.groups); tog.classList.toggle("active", state.groups);
    tog.textContent = state.groups ? "－ Hide groups in between" : "＋ Show groups in between";
    views.gap_overview.signal("groups", state.groups).run(); gapText();
  });
  let rz = null;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => Object.values(views).forEach((v) => v.resize().run()), 200); });

  window.initTips(document.getElementById("chapter-3")); gapText(); stateText(); glText(); supText(); shortText();
})();
