/* Chapter 1 · Overall performance
 * Three Vega-Lite JSON charts (chapter-1/specs) tell one story:
 *   1. headline  - diverging bars: how many students meet expectations, 2023 to 2026
 *   2. heatmap   - the same measure for every subject x year level (click a row to pick a subject)
 *   3. zoom      - the four levels and the average score for the picked subject at Years 3, 5, 7 and 9
 * This script only sets the charts' named params and writes the short text from the same CSV file.
 */
(async function () {
  const $ = (id) => document.getElementById(id);
  const f0 = (n) => n.toFixed(0), f1 = (n) => n.toFixed(1);
  const rows = vega.read(await vega.loader().load("chapter-1/data/outcomes.csv"), { type: "csv", parse: "auto" });
  const YEAR = Math.max(...rows.map((d) => d.year));
  const LEVELS = ["Year 3", "Year 5", "Year 7", "Year 9"];
  const SUBJECTS = ["Writing", "Spelling", "Reading", "Numeracy", "Grammar & punctuation"];
  const get = (domain, level, year = YEAR) => rows.find((d) => d.year === year && d.domain === domain && d.level === level);
  const state = { sel: "Writing", focus: "All subjects" };   // sel = subject in the zoom chart; focus = what the score chart and heatmap outline show

  const mount = { hero_levels_by_year: "c1-hero", heatmap_subject_year_level: "c1-heat", zoom_subject_by_year_level: "c1-zoom", cohort_same_students: "c1-cohort", scores_by_year_level: "c1-scores" };
  const views = {};
  await Promise.all(Object.entries(mount).map(async ([spec, el]) => {
    views[spec] = (await vegaEmbed("#" + el, `chapter-1/specs/${spec}.json`, { actions: false, renderer: "svg" })).view;
  }));
  ["heatmap_subject_year_level", "zoom_subject_by_year_level", "cohort_same_students", "scores_by_year_level"].forEach((k) => views[k].signal("year", YEAR).run());

  /* ---------- headline ---------- */
  (function () {
    const all = [2023, 2024, 2025, 2026].filter((y) => get("All subjects", "All years", y)).map((y) => get("All subjects", "All years", y));
    const last = all[all.length - 1], first = all[0];
    const lo = Math.round(Math.min(...all.map((d) => d.so))), hi = Math.round(Math.max(...all.map((d) => d.so)));
    const cells = (y) => SUBJECTS.flatMap((d) => LEVELS.map((l) => get(d, l, y)));
    const now = cells(YEAR), then = cells(first.year);
    const move = Math.max(...now.map((d, i) => Math.abs(d.so - then[i].so)));
    $("c1-numbers").innerHTML = `<span class="ctx-label">The numbers behind the chart</span><div class="two-col">` +
      `<p>In ${YEAR}, <strong>${f0(last.so)} of every 100</strong> students met expectations (Strong or Exceeding) and <strong>${f0(last.needs)}</strong> needed additional support. About ${f0(last.exempt)} in 100 are exempt and not shown.</p>` +
      `<p>Neither has moved much since ${first.year}: ${lo === hi ? lo : `${lo} or ${hi}`} meeting expectations each year, and ${f0(first.needs)} to ${f0(last.needs)} needing support. For single subjects and year levels, no result moved by more than <strong>${f0(move)} points</strong>.</p></div>`;
  })();

  // the ⓘ for "new scale" is an HTML button, placed next to that axis label inside the chart
  function placeNewScale() {
    const wrap = $("c1-hero").parentElement, t = [...wrap.querySelectorAll("svg .role-axis-label text")].find((x) => /new scale/.test(x.textContent));
    if (!t) return;
    const r = t.getBoundingClientRect(), w = wrap.getBoundingClientRect(), tip = $("c1-newscale");
    tip.style.left = Math.max(0, r.left - w.left - 22) + "px"; tip.style.top = (r.bottom - w.top - 22) + "px";
  }
  // centre the plot in the card: the y-axis labels take space on the left, so give the right side the same amount (wide screens only)
  function centreHero() {
    const v = views.hero_levels_by_year, pad = v.padding(), want = $("c1-hero").clientWidth >= 640 ? Math.round(v.origin()[0] + pad.left) : 8;
    if (Math.abs(want - pad.right) > 1) v.padding({ ...pad, right: want }).resize().run();
  }
  const refreshHero = () => { centreHero(); placeNewScale(); };
  refreshHero();
  views.hero_levels_by_year.addSignalListener("width", () => setTimeout(refreshHero, 80));
  window.addEventListener("resize", () => setTimeout(refreshHero, 150));

  /* ---------- heatmap + score chart ---------- */
  const ACARA = `<a href="https://www.acara.edu.au/docs/default-source/media-releases/naplan-proficiency-standards-media-release-2023-02-10.pdf">ACARA (2023)</a>`;
  (function () {
    const lv = LEVELS.map((l) => get("All subjects", l)).sort((a, b) => b.so - a.so);
    $("c1-heat-title").innerHTML = `<strong>${lv[0].level}</strong> does best across all subjects (${f0(lv[0].so)} of every 100), <strong>${lv[lv.length - 1].level}</strong> does worst (${f0(lv[lv.length - 1].so)}).`;
    $("c1-year-b").textContent = YEAR;
  })();

  // everything beside / under the score chart changes with the heatmap focus
  function scoreText() {
    const f = state.focus, one = SUBJECTS.includes(f);
    let title, hint, a, b, label = "A falling share is not falling skills";
    if (one) {
      const m = LEVELS.map((l) => get(f, l).mean), g = [1, 2, 3].map((i) => m[i] - m[i - 1]), gains = g.map((x) => "+" + f0(x)).join(", ");
      const shrinking = g[0] > g[1] && g[1] > g[2], y3 = get(f, "Year 3").so, y9 = get(f, "Year 9").so;
      title = `${f} scores rise at every year level${shrinking ? ", but by less each time" : ""}.`;
      hint = "Labels: score and gain on the level before. Click again for all.";
      const rule = "“Meeting expectations” is judged against the standard for each year level";
      if (y9 < y3 - 1) {
        a = `For ${f}, the heatmap suggests students fall behind with age: ${f0(y3)} of every 100 meet expectations in Year 3, but only ${f0(y9)} in Year 9. But average scores rise at every step (${gains} points).`;
        b = `That is because “meeting expectations” is judged against the standard for each year level. A lower share in Year 9 means fewer students reach a higher bar, not that older students know less.`;
      } else {
        label = "Reading the share and the scores together";
        a = `For ${f}, the heatmap shows ${y9 > y3 + 1 ? "students pulling ahead" : "little change"} with age: ${f0(y3)} of every 100 meet expectations in Year 3, and ${f0(y9)} in Year 9. Average scores rise at every step too (${gains} points).`;
        b = `${rule}, so ${y9 > y3 + 1 ? "a rising share means more students reach a higher bar, not just that they are older" : "a steady share means students are keeping pace with a higher bar"}.`;
      }
    } else {
      const d = SUBJECTS.map((s) => get(s, "Year 9").mean - get(s, "Year 3").mean), y5 = get("All subjects", "Year 5").so, y9 = get("All subjects", "Year 9").so;
      title = "Scores rise at every year level, in every subject.";
      hint = "The lines nearly overlap: scores differ little between subjects.";
      a = `From the heatmap, it can look as if older students are doing worse: the share meeting expectations falls from ${f0(y5)} of every 100 in Year 5 to ${f0(y9)} in Year 9.`;
      b = `That is because “meeting expectations” is judged against the standard for each year level. A lower share in Year 9 means fewer students reach a higher bar, not that older students know less.`;
      a += ` But average scores rise at every step, by ${f0(Math.min(...d))} to ${f0(Math.max(...d))} points between Year 3 and Year 9.`;
    }
    $("c1-scores-title").textContent = title; $("c1-scores-hint").textContent = hint;
    $("c1-scale-note").innerHTML = `<span class="ctx-label">${label}</span><div class="two-col"><p>${a}</p><p>${b}</p></div>` +
      `<span class="ctx-source">Source: ${ACARA} (standards are set for each year level); scores from the same data.</span>`;
    $("c1-scores-label").textContent = one ? f : "all subjects";
    $("c1-scores-legend").style.visibility = one ? "hidden" : "visible";
  }

  /* ---------- zoom ---------- */
  const EDUCATOR = `<a href="https://www.theeducatoronline.com/k12/news/tackling-the-writing-slump-in-australias-schools/281237">The Educator, 20 Oct 2022</a>, reporting AERO’s analysis`;
  const CONTEXT = {   // one short note per subject: something the data cannot show, with its source
    "Writing": { label: "Why might writing slide?", src: `Source: ${EDUCATOR}.`,
      lead: "AERO’s 2022 analysis of more than 10 million NAPLAN writing results (2011 to 2018) found that by Year 9, 85% of students were writing sentences at or below the level expected of Year 7.",
      rest: "Experts quoted in the coverage pointed to how writing is taught and to teacher workload." },
    "Spelling": { label: "Why does spelling climb?", src: `Source: ${EDUCATOR}.`,
      lead: "In the same AERO analysis, spelling was the only writing measure that improved across the years studied.",
      rest: "One expert linked this to better teaching of phonics and word structure." },
    "Grammar & punctuation": { label: "A known weak spot", src: `Source: ${EDUCATOR}.`,
      lead: "AERO’s writing analysis found that most Year 9 students could only show punctuation at the level expected of Year 3 students.",
      rest: "In these results, grammar and punctuation has the lowest share meeting expectations at every year level." },
    "Numeracy": { label: "Why might numeracy be rising?", src: `Source: The Educator, 30 Jul 2025, on the national results release; scores from the same data.`,
      lead: "ACARA’s chief executive said the 2025 results showed higher average numeracy scores in Years 5, 7 and 9, particularly among stronger students.",
      rest: () => { const g = (l, y) => f0(get("Numeracy", l, y).so); return `In our data, the share meeting expectations went from ${g("Year 5", 2023)}% to ${g("Year 5", YEAR)}% in Year 5, and from ${g("Year 7", 2023)}% to ${g("Year 7", YEAR)}% in Year 7, between 2023 and ${YEAR}.`; } },
    "Reading": { label: "Why might reading slow down?", src: `Source: <a href="https://www.theeducatoronline.com/k12/news/whats-holding-back-students-reading-progress/268138">The Educator, 15 Nov 2019</a>. This is an older report, so treat it as background.`,
      lead: "A 2019 analysis found that students made about six months less reading progress between Years 5 and 7.",
      rest: "Researchers quoted say reading for pleasure and library visits fall sharply in the teenage years. The causes are still guesses." },
  };
  function zoom() {
    const dom = state.sel, r = LEVELS.map((l) => get(dom, l)), y3 = r[0], y9 = r[3];
    const peak = r.reduce((a, b) => (b.so > a.so ? b : a));
    views.zoom_subject_by_year_level.signal("sel", dom).run();
    $("c1-showing").textContent = `${dom}, ${YEAR}`;
    [...$("c1-chips").children].forEach((b) => { const on = b.dataset.v === dom; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });

    const s = peak.level === "Year 3"
      ? `In <strong>${dom}</strong>, ${f0(y3.so)} of every 100 Year 3 students meet expectations, but only <strong>${f0(y9.so)}</strong> in Year 9.`
      : peak.level === "Year 9"
        ? `In <strong>${dom}</strong>, ${f0(y3.so)} of every 100 Year 3 students meet expectations, rising to <strong>${f0(y9.so)}</strong> in Year 9.`
        : `In <strong>${dom}</strong>, ${f0(y3.so)} of every 100 students meet expectations in Year 3, <strong>${f0(peak.so)}</strong> at the ${peak.level} peak, and ${f0(y9.so)} in Year 9.`;
    $("c1-zoom-insight").innerHTML = s;

    // same students, two years apart: does each step point the same way as the snapshot?
    views.cohort_same_students.signal("sel", dom).run();
    const steps = LEVELS.slice(1).map((l, i) => {
      const prev = LEVELS[i], from = get(dom, prev, YEAR - 2).so, to = get(dom, l).so;
      return { l, prev, same: to - from, snap: get(dom, l).so - get(dom, prev).so };
    });
    const rose = steps.filter((x) => x.same >= 0).length, fell = steps.length - rose;
    $("c1-cohort-title").innerHTML = fell === 0 ? `Following the <strong>same students</strong>, the share meeting expectations <strong>rose</strong> at every step.`
      : rose === 0 ? `Following the <strong>same students</strong>, the share meeting expectations <strong>fell</strong> at every step.`
      : `Following the <strong>same students</strong>, the share <strong>rose</strong> at ${rose} of 3 steps and <strong>fell</strong> at ${fell}.`;
    const apart = steps.filter((x) => (x.same >= 0) !== (x.snap >= 0));
    $("c1-cohort-hint").textContent = apart.length === 0 ? "Each step points the same way as the snapshot on the left."
      : `The two views differ for ${apart.map((x) => `Year ${x.prev.slice(5)} to ${x.l.slice(5)}`).join(" and ")}.`;

    // blue box: sourced note for every subject, plus what our own data adds
    const n = CONTEXT[dom], ends3 = y3.needs + y3.exceeding, ends9 = y9.needs + y9.exceeding;
    const extra = ends9 - ends3 >= 10 ? `<p>Results also spread out: ${f0(ends3)} of every 100 Year 3 students are Exceeding or need additional support, against <strong>${f0(ends9)}</strong> in Year 9.</p>` : "";
    $("c1-zoom-note").innerHTML = `<span class="ctx-label">${n.label}</span><div class="two-col"><p>${n.lead}</p><div><p>${typeof n.rest === "function" ? n.rest() : n.rest}</p>${extra}</div></div><span class="ctx-source">${n.src}</span>`;
  }

  function focusChanged() {
    views.heatmap_subject_year_level.signal("sel", state.focus).run();
    views.scores_by_year_level.signal("focus", state.focus).run();
    scoreText();
  }
  SUBJECTS.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = s; b.dataset.v = s;
    b.addEventListener("click", () => { state.sel = s; state.focus = s; zoom(); focusChanged(); });
    $("c1-chips").appendChild(b);
  });
  views.heatmap_subject_year_level.addEventListener("click", (e, item) => {
    const d = item && item.datum;
    if (!d || !d.domain) return;
    if (d.domain === "All subjects" || d.domain === state.focus) state.focus = "All subjects";     // click again to go back to all lines
    else { state.sel = d.domain; state.focus = d.domain; zoom(); }
    focusChanged();
  });
  $("c1-year-a").textContent = YEAR;
  focusChanged();
  window.initTips(document.getElementById("chapter-1"));
  zoom();
})();
