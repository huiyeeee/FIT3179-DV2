/* Chapter 0 · Participation by student background (Vega-Lite)
 *
 * Two linked questions, one layout (small multiples, one panel per attribute):
 *   "rate"  -> how likely is each group to sit the test?
 *              Lollipop: dot position = participation rate, stem = gap from the
 *              overall rate (dashed line), dot area = group's share of enrolment,
 *              hollow dot = small group.
 *   "share" -> who makes up the cohort? One 100% stacked bar per attribute (part-to-whole);
 *              segments run in category order, labelled directly where they fit.
 * Responds to the shared year, year-level / domain filters and selected state.
 */
(function (Ch0) {
  const { state, aggregate, fmtInt, fmtPct, $ } = Ch0;
  const INK = "#14213d", MUTED = "#4a5568", TEAL = "#1f6f8b", CORAL = "#f0745a", NEAR = "#9aa3b2", GREY = "#c8c3b8";
  const DATA_URL = "chapter-0/data/participation_by_group.csv";
  const STEP = 28;
const STACK_STEP = 66, STACK_PAD = 0.26; // 100% stacked bars: row height and padding between bars
  const X_RATE = [30, 100];
    const TONES = { below: "Below overall rate", near: "About the same", above: "Above overall rate" };

  // raw = value in the CSV, label = what we show, ns = a "not stated" category (excluded from gap insights)
  const ATTRS = [
    { key: "Indigeneity", label: "Indigenous status", notRec: true, subs: [
      { raw: "Indigenous", label: "Indigenous" },
      { raw: "Non-Indigenous", label: "Non-Indigenous" } ] },
    { key: "ABS remoteness", label: "Remoteness", subs: [
      { raw: "Major cities", label: "Major cities" },
      { raw: "Inner regional", label: "Inner regional" },
      { raw: "Outer regional", label: "Outer regional" },
      { raw: "Remote", label: "Remote" },
      { raw: "Very remote", label: "Very remote" } ] },
    { key: "Parental education", label: "Parental education", subs: [
      { raw: "Parental education: bachelor", label: "Bachelor degree or above", short: "Bachelor degree or above" },
      { raw: "Parental education: diploma", label: "Diploma" },
      { raw: "Parental education: certificate", label: "Certificate I–IV" },
      { raw: "Parental education: Year 12", label: "Year 12" },
      { raw: "Parental education: Year 11", label: "Year 11 or below", short: "Year 11 or below" },
      { raw: "Parental education: not stated", label: "Not stated", ns: true } ] },
    { key: "Parental occupation", label: "Parental occupation", subs: [
      { raw: "Senior managers and professionals", label: "Senior managers & professionals" },
      { raw: "Other managers and associate professionals", label: "Other managers & associates", short: "Other managers", full: "Other managers and associate professionals" },
      { raw: "Skilled trades, clerical and sales", label: "Skilled trades, clerical & sales", short: "Skilled trades" },
      { raw: "Unskilled manual, office & sales", label: "Unskilled manual, office & sales", short: "Unskilled manual" },
      { raw: "Not in paid work for 12 months", label: "Not in paid work (12 months)", short: "No paid work" },
      { raw: "Parental occupation not stated/unknown", label: "Not stated / unknown", short: "Not stated", ns: true } ] },
    { key: "Language background", label: "Language background", notRec: true, subs: [
      { raw: "LBOTE", label: "LBOTE" },
      { raw: "Non-LBOTE", label: "Non-LBOTE" } ] },
    { key: "Gender", label: "Gender", subs: [
      { raw: "Female", label: "Female" },
      { raw: "Male", label: "Male" } ] },
  ];

  let mode = "rate";
  let view = null;
  const index = new Map(); // "year|state|attribute|subgroup" -> rows

  const signed = (d) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)} pp`;
  const keyOf = (y, s, a, g) => `${y}|${s}|${a}|${g}`;

  /* ---------- data ---------- */
  async function loadData() {
    const text = await vega.loader().load(DATA_URL);
    vega.read(text, { type: "csv", parse: "auto" }).forEach((r) => {
      const k = keyOf(r.year, r.state, r.attribute, r.subgroup);
      if (!index.has(k)) index.set(k, []);
      index.get(k).push(r);
    });
  }

  // enrolled / participated for one subgroup under the current year-level + domain filters
  function sumFor(year, region, attr, sub) {
    const rows = (index.get(keyOf(year, region, attr, sub)) || []).filter(
      (d) => (!state.levels.size || state.levels.has(d.year_level)) && (!state.domains.size || state.domains.has(d.domain))
    );
    if (!rows.length) return null;
    const enrolled = rows.reduce((s, d) => s + d.enrolled, 0);
    const participated = rows.reduce((s, d) => s + d.participated, 0);
    return enrolled > 0 ? { enrolled, participated, pct: (participated / enrolled) * 100 } : null;
  }

  function buildRows() {
    const total = aggregate(state.year, state.region);
    if (!total) return { rows: [], total: null };
    const nDom = state.domains.size || 5;
    const hasPrev = Ch0.years().includes(state.year - 1);
    const rows = [];

    ATTRS.forEach((a) => {
      let known = 0;
      a.subs.forEach((s) => {
        const base = { attribute: a.key, label: s.label, short: s.short || s.label, notStated: !!s.ns, notRec: false, missing: false, ref: total.pct, barColor: TEAL };
        const cur = sumFor(state.year, state.region, a.key, s.raw);
        if (!cur) { rows.push({ ...base, missing: true, share: 0, pct: total.pct }); return; }
        known += cur.enrolled;
        const prev = hasPrev ? sumFor(state.year - 1, state.region, a.key, s.raw) : null;
        const diff = cur.pct - total.pct;
        const share = (cur.enrolled / total.enrolled) * 100;
        const small = cur.enrolled / nDom < 150; // fewer than ~150 students per domain
        rows.push({
          ...base, pct: cur.pct, diff, share, small,
          tone: diff <= -1 ? TONES.below : diff >= 1 ? TONES.above : TONES.near,
          rateLabel: `${fmtPct(cur.pct)}%`,
          shareLabel: `${share < 0.1 ? "<0.1" : share.toFixed(1)}%`,
          tipName: s.full || s.label,
          tRate: `${fmtPct(cur.pct)}%`,
          tGap: `${signed(diff)} (overall ${fmtPct(total.pct)}%)`,
          tShare: `${share.toFixed(1)}% of enrolled`,
          tEnrolled: small ? `${fmtInt(cur.enrolled)} (small group: read with caution)` : fmtInt(cur.enrolled),
          tPrev: prev ? signed(cur.pct - prev.pct) : "n/a (first year)",
        });
      });
      // students whose background is not recorded (only shown in the "share" view)
      if (a.notRec) {
        const rem = Math.max(0, total.enrolled - known);
        const share = (rem / total.enrolled) * 100;
        rows.push({
          attribute: a.key, label: "Not recorded", notRec: true, notStated: true, missing: false, small: false,
          ref: total.pct, pct: total.pct, diff: 0, tone: TONES.near, share, barColor: GREY,
          rateLabel: "", shareLabel: `${share.toFixed(1)}%`, tipName: "Not recorded",
          tRate: "n/a", tGap: "n/a", tShare: `${share.toFixed(1)}% of enrolled`, tEnrolled: fmtInt(rem), tPrev: "n/a",
        });
      }
    });
    return { rows, total };
  }

  /* ---------- layout ---------- */
  function layout() {
    const w = $("groups-chart").parentElement.clientWidth || 900;
    const compact = w < 640;
    const labelW = compact ? 130 : 220;
    // Vega-Lite already counts the text columns that sit right of the plot, so reserve their width here only
    const extent = mode === "rate" ? (compact ? 70 : 190) : 40;
    // the stacked bars need room for their labels, so on narrow screens the chart scrolls sideways instead of shrinking further
    const plotW = Math.max(mode === "share" ? 320 : 150, Math.min(mode === "share" ? 700 : 560, w - labelW - extent - 30));
    return { compact, labelW, plotW };
  }

  /* ---------- specs ---------- */
  function spec(data) {
    if (mode === "share") return stackedSpec(data);
    const L = layout();
    const attrs = ATTRS;
    const charts = attrs.map((a, i) => rateChart(a, i === attrs.length - 1, L, i === 0));
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      background: null,
      padding: { left: 6, right: 6, top: 6, bottom: 6 },
      config: { view: { stroke: null }, font: Ch0.font, title: { font: Ch0.font } },
      data: { name: "groups", values: data },
      spacing: 22,
      vconcat: charts,
    };
  }

  const yEnc = (labels, L, padding) => ({
    field: "label", type: "ordinal",
    scale: { domain: labels, padding },
    axis: { title: null, ticks: false, domain: false, labelLimit: L.labelW - 14, minExtent: L.labelW, maxExtent: L.labelW, labelFontSize: 12, labelColor: INK, labelPadding: 10 },
  });
  const axisX = (isLast, title) => ({
    title: isLast ? title : null, labels: isLast, grid: true, gridColor: "#eee8dc", domain: false, ticks: false,
    tickCount: 7, format: ".0f", labelColor: MUTED, titleColor: MUTED, titleFontSize: 11, titleFontWeight: 500, titlePadding: 8,
  });
  const titleOf = (a, L) => ({ text: a.label, anchor: "start", frame: "bounds", offset: 8, fontSize: 13, fontWeight: 700, color: TEAL });
  const missingText = {
    transform: [{ filter: "datum.missing" }],
    mark: { type: "text", align: "left", baseline: "middle", fontSize: 11, fontStyle: "italic", color: "#8a93a3", dx: 0 },
    encoding: { text: { value: "no students recorded in this group" }, x: { value: 8 } },
  };

  function rateChart(a, isLast, L, isFirst) {
    const labels = a.subs.map((s) => s.label);
    const AX = axisX(isLast, "Participation rate (%)");
    const X = (field) => ({ field, type: "quantitative", scale: { domain: X_RATE, nice: false, zero: false }, axis: AX });
    const tone = { field: "tone", type: "nominal", legend: null, scale: { domain: Object.values(TONES), range: [CORAL, NEAR, TEAL] } };
    const live = [{ filter: "!datum.missing && !datum.notRec" }];
    return {
      title: titleOf(a, L),
      width: L.plotW, height: { step: STEP },
      transform: [{ filter: `datum.attribute === '${a.key}'` }],
      encoding: { y: yEnc(labels, L, 0.5) },
      layer: [
        { // dashed line = overall rate for the current selection
          transform: [{ aggregate: [{ op: "max", field: "ref", as: "ref" }] }],
          mark: { type: "rule", color: INK, strokeDash: [4, 3], opacity: 0.6 },
          encoding: { x: X("ref"), y: { value: 0 }, y2: { value: STEP * labels.length } },
        },
        { // stem: gap between overall rate and the group's rate
          transform: live,
          mark: { type: "rule", strokeWidth: 2.5, opacity: 0.6 },
          encoding: { x: X("pct"), x2: { field: "ref" }, color: tone },
        },
        { // dot: position = rate, area = share of enrolment, hollow = small group
          transform: live,
          mark: { type: "point", filled: true, strokeWidth: 2, opacity: 1, tooltip: true },
          encoding: {
            x: X("pct"),
            size: { field: "share", type: "quantitative", legend: null, scale: { domain: [0, 75], range: [28, 600], clamp: true } },
            stroke: tone,
            fill: { condition: { test: "datum.small", value: "#ffffff" }, ...tone },
            tooltip: [
              { field: "tipName", title: "Group" },
              { field: "tRate", title: "Participation" },
              { field: "tGap", title: "Gap vs overall rate" },
              { field: "tShare", title: "Share of enrolment" },
              { field: "tEnrolled", title: "Enrolled" },
              { field: "tPrev", title: "Change vs previous year" },
            ],
          },
        },
        { // value columns on the right
          transform: live,
          mark: { type: "text", align: "left", baseline: "middle", fontWeight: 700, fontSize: 12, color: INK },
          encoding: { text: { field: "rateLabel" }, x: { value: L.plotW + 14 } },
        },
        ...(L.compact ? [] : [{
          transform: live,
          mark: { type: "text", align: "left", baseline: "middle", fontSize: 11, color: MUTED },
          encoding: { text: { field: "shareLabel" }, x: { value: L.plotW + 68 } },
        }]),
        ...(isFirst ? [
          { data: { values: [{}] }, mark: { type: "text", align: "left", fontSize: 10, fontWeight: 600, color: MUTED },
            encoding: { text: { value: "RATE" }, x: { value: L.plotW + 14 }, y: { value: -10 } } },
          ...(L.compact ? [] : [{ data: { values: [{}] }, mark: { type: "text", align: "left", fontSize: 10, fontWeight: 600, color: MUTED },
            encoding: { text: { value: "SHARE OF ENROLMENT" }, x: { value: L.plotW + 68 }, y: { value: -10 } } }]),
        ] : []),
        missingText,
      ],
    };
  }

  /* ---------- 100% stacked bars (part-to-whole) ---------- */
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (p, q, t) => "#" + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, "0")).join("");
  const RAMP = ["#0e4a62", "#2f7d9a", "#bcdbe5"].map(hex); // dark -> light
  const ramp = (t) => (t <= 0.5 ? mix(RAMP[0], RAMP[1], t * 2) : mix(RAMP[1], RAMP[2], (t - 0.5) * 2));

  // Greedy word-wrap into at most 2 lines of `cpl` characters; null if it can't fit.
  function wrap(text, cpl) {
    if (cpl < 4) return null;
    const lines = [];
    let cur = "";
    for (const w of text.split(" ")) {
      if (w.length > cpl) return null;
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= cpl) cur += " " + w;
      else { lines.push(cur); cur = w; }
    }
    lines.push(cur);
    return lines.length <= 2 ? lines : null;
  }

  // One segment per group: start/end/mid are positions along the 0-100% bar.
  function segments(rows, plotW) {
    const segs = [];
    ATTRS.forEach((a) => {
      const real = a.subs.filter((s) => !s.ns).map((s) => s.label);
      let cum = 0;
      rows
        .filter((r) => r.attribute === a.key && !r.missing && r.share >= 0.05)
        .forEach((r) => {
          const idx = real.indexOf(r.label);
          const t = idx < 0 ? null : real.length > 1 ? idx / (real.length - 1) : 0;
          const px = (r.share / 100) * plotW;
          const showPct = px >= 30;
          const nameLines = showPct ? wrap(r.short || r.label, Math.floor((px - 8) / 6)) : null;
          segs.push({
            attribute: a.key, attrLabel: a.label, label: r.label,
            tipName: r.tipName || r.label,
            start: cum, end: cum + r.share, mid: cum + r.share / 2, share: r.share,
            color: t === null ? GREY : ramp(t),
            ink: t === null || t >= 0.45 ? INK : "#ffffff",
            showPct, showName: !!nameLines,
            lines: nameLines ? [...nameLines, r.shareLabel] : [r.shareLabel], // multi-line text: name, then %
            nLines: nameLines ? nameLines.length + 1 : 1,
            outLabel: r.short || r.label,
            outside: "",
            shareLabel: r.shareLabel,
            tShare: `${r.share.toFixed(1)}% of enrolled`,
            tEnrolled: r.tEnrolled,
          });
          cum += r.share;
        });
      // wide enough for a % but not a name: put the name just outside the bar, alternating above/below
      segs.filter((x) => x.attribute === a.key && x.showPct && !x.showName)
          .forEach((x, k) => { x.outside = k % 2 === 0 ? "above" : "below"; });
    });
    return segs;
  }

  function stackedSpec(segs) {
    const L = layout();
    const X = {
      type: "quantitative", scale: { domain: [0, 100], nice: false, zero: true },
      axis: { title: "% of enrolled students", format: ".0f", grid: true, gridColor: "#eee8dc", domain: false, ticks: false,
              tickCount: 5, labelColor: MUTED, titleColor: MUTED, titleFontSize: 11, titleFontWeight: 500, titlePadding: 8 },
    };
    const ink = { field: "ink", type: "nominal", scale: null, legend: null };
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      background: null,
      padding: { left: 6, right: 6, top: 6, bottom: 6 },
      config: { view: { stroke: null }, font: Ch0.font },
      data: { name: "groups", values: segs },
      width: L.plotW, height: { step: STACK_STEP },
      encoding: {
        y: {
          field: "attrLabel", type: "ordinal", scale: { domain: ATTRS.map((a) => a.label), padding: STACK_PAD },
          axis: { title: null, ticks: false, domain: false, labelLimit: L.labelW - 14, minExtent: L.labelW, maxExtent: L.labelW,
                  labelFontSize: 12, labelFontWeight: 700, labelColor: TEAL, labelPadding: 10 },
        },
      },
      layer: [
        {
          params: [{ name: "hl", select: { type: "point", fields: ["attribute", "label"], on: "pointerover", clear: "pointerout" } }],
          mark: { type: "bar", cornerRadius: 3, stroke: "#ffffff", strokeWidth: 1.5, tooltip: true },
          encoding: {
            x: { field: "start", ...X }, x2: { field: "end" },
            color: { field: "color", type: "nominal", scale: null, legend: null },
            opacity: { condition: { param: "hl", value: 1 }, value: 0.5 },
            tooltip: [
              { field: "attrLabel", title: "Attribute" },
              { field: "tipName", title: "Group" },
              { field: "tShare", title: "Share of enrolment" },
              { field: "tEnrolled", title: "Enrolled" },
            ],
          },
        },
        // name (wrapped) + percentage inside each segment; the block is shifted up by half its extra lines to centre it
        ...[1, 2, 3].map((n) => ({
          transform: [{ filter: `datum.showPct && datum.nLines === ${n}` }],
          mark: { type: "text", baseline: "middle", align: "center", fontSize: 11, fontWeight: 600, lineHeight: 13, dy: -6.5 * (n - 1) },
          encoding: { x: { field: "mid", ...X }, text: { field: "lines", type: "nominal" }, color: ink },
        })),
        // name just outside the bar for segments that fit a % but not a name
        ...[["above", -1], ["below", 1]].map(([side, sign]) => ({
          transform: [{ filter: `datum.outside === '${side}'` }],
          mark: { type: "text", baseline: "middle", align: "center", fontSize: 10, fontWeight: 600, color: MUTED, dy: sign * (STACK_STEP * (1 - STACK_PAD) / 2 + 8) },
          encoding: { x: { field: "mid", ...X }, text: { field: "outLabel" } },
        })),
      ],
    };
  }

  /* ---------- text, legend ---------- */
  const whereTxt = () => (state.region === Ch0.AUS ? "" : ` in ${Ch0.regionName(state.region)}`);
  const find = (rows, attr, label) => rows.find((r) => r.attribute === attr && r.label === label && !r.missing);

  function renderText(rows, total, segs) {
    const where = whereTxt();
    const refName = state.region === Ch0.AUS ? "Australia" : state.region;
    let html = "";

    if (mode === "rate") {
      const ok = rows.filter((r) => !r.missing && !r.notStated && !r.notRec && !r.small);
      const spreads = ATTRS.map((a) => {
        const g = ok.filter((r) => r.attribute === a.key).sort((x, y) => x.pct - y.pct);
        if (g.length < 2) return null;
        const lo = g[0], hi = g[g.length - 1];
        return { a, lo, hi, gap: +fmtPct(hi.pct) - +fmtPct(lo.pct) };
      }).filter(Boolean).sort((x, y) => y.gap - x.gap);

      if (!spreads.length) {
        html = `Not enough data to compare groups${where} for this selection.`;
      } else {
        const w = spreads[0];
        const low = [...ok].sort((x, y) => x.pct - y.pct)[0];
        html =
          `In ${state.year}${where}, participation differs most by <strong>${w.a.label.toLowerCase()}</strong>: ` +
          `${w.hi.label} students took part at <strong>${fmtPct(w.hi.pct)}%</strong> versus ` +
          `<strong>${fmtPct(w.lo.pct)}%</strong> for ${w.lo.label}, a gap of ${w.gap.toFixed(1)} percentage points. `;
        html +=
          `The lowest rate overall is for <strong>${low.label}</strong> (${fmtPct(low.pct)}%), ` +
          `a group that makes up ${low.share < 0.1 ? "<0.1" : low.share.toFixed(1)}% of enrolled students` +
          (low.share < 2 ? ", so it barely moves the overall rate." : ".");
      }
      $("groups-note").textContent =
        "Each row is one group. The dot's position is its participation rate, the stem shows the gap from the overall rate " +
        "(dashed line), and the dot's area shows how many enrolled students are in the group. Hollow dots are small groups " +
        "(under about 150 students per domain), so read them with caution. " +
        "Parental education and occupation categories follow ACARA's definitions; LBOTE = language background other than English.";
    } else {
      const parts = [];
      const mc = find(rows, "ABS remoteness", "Major cities");
      const bach = find(rows, "Parental education", "Bachelor degree or above");
      const ind = find(rows, "Indigeneity", "Indigenous");
      const lb = find(rows, "Language background", "LBOTE");
      if (mc) parts.push(`<strong>${mc.share.toFixed(0)}%</strong> live in major cities`);
      if (bach) parts.push(`<strong>${bach.share.toFixed(0)}%</strong> have a parent with a bachelor degree or above`);
      if (lb) parts.push(`<strong>${lb.share.toFixed(0)}%</strong> have a language background other than English`);
      if (ind) parts.push(`<strong>${ind.share.toFixed(1)}%</strong> are Indigenous`);
      html = parts.length
        ? `Of students enrolled${where} in ${state.year}, ${Ch0.join(parts)}.`
        : `No enrolment data for this selection${where}.`;
      const noName = ATTRS.map((at) => {
        const g = (segs || []).filter((x) => x.attribute === at.key && !x.showPct);
        return g.length ? `${at.label}: ${g.map((x) => `${x.label} ${x.share.toFixed(1)}%`).join(", ")}` : null;
      }).filter(Boolean);
      $("groups-note").textContent =
        "Each bar is 100% of enrolled students under the current filters, split by group. Shading follows the category order " +
        "(darker = first listed); grey = not stated or not recorded." +
        (noName.length ? ` Too narrow to label (hover for details), left to right: ${noName.join(". ")}.` : "");
    }
    $("groups-insight").innerHTML = html;

    // legend
    const dot = (c, hollow) => `<i class="lg-dot${hollow ? " hollow" : ""}" style="${hollow ? "border-color" : "background"}:${c}"></i>`;
    $("groups-legend").innerHTML =
      mode === "rate"
        ? `<span class="lg"><i class="lg-line"></i>${refName} overall: <b>${fmtPct(total.pct)}%</b></span>` +
          `<span class="lg">${dot(CORAL)}1+ pp below</span>` +
          `<span class="lg">${dot(NEAR)}within ±1 pp</span>` +
          `<span class="lg">${dot(TEAL)}1+ pp above</span>` +
          `<span class="lg">${dot(MUTED, true)}small group</span>` +
          `<span class="lg"><i class="lg-dot sz1"></i><i class="lg-dot sz2"></i><i class="lg-dot sz3"></i>dot area = share of enrolment</span>`
        : `<span class="lg">Segment width = share of enrolled students</span>` +
          `<span class="lg"><i class="lg-dot" style="background:${GREY}"></i>Not stated / not recorded</span>`;
  }

  function syncToggle() {
    [...$("groups-mode").children].forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
  }

  /* ---------- render ---------- */
  async function render() {
    const { rows, total } = buildRows();
    if (!total) return;
    const segs = mode === "share" ? segments(rows, layout().plotW) : null;
    const data = mode === "share" ? segs : rows;
    if (!view) {
      view = (await vegaEmbed("#groups-chart", spec(data), { actions: false, renderer: "svg" })).view;
    } else {
      view.change("groups", vega.changeset().remove(vega.truthy).insert(data)).run();
    }
    renderText(rows, total, segs);
  }

  async function init() {
    await loadData();
    [...$("groups-mode").children].forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.mode === mode) return;
        mode = b.dataset.mode;
        syncToggle();
        view = null; // layers and scales differ per view, so rebuild
        render();
      })
    );
    syncToggle();
    Ch0.onChange(render);
    await render();
  }
  function rebuild() { view = null; return render(); }

  Ch0.groups = { init, rebuild };
})(window.Ch0);
