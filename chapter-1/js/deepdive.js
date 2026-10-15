/* Chapter 1 · Scene 3: deep-dive into one domain (chosen with the chips or by clicking the heatmap).
 *  Left : diverging stacked bars, one per year level  -> how the proficiency mix shifts through school
 *  Right: modelled score distributions, one per year level -> how far the whole spread moves, and how much levels overlap
 * The right-hand curves are normal curves drawn from each cell's published average and spread (SD),
 * so they show the shape implied by those two numbers, not the observed distribution.
 */
(function (Ch1) {
  const { state, agg, f1, signed, dlabel, $, C } = Ch1;
  const D = Ch1.diverging;
  const LABEL_W = 62;
  const X_SCORE = [150, 850];
  const LEVEL_COLS = ["#8fc4d4", "#4e9bb5", "#1f6f8b", "#0b3d52"];
  const LEVEL_NAMES = Ch1.LEVELS.map((l) => `Year ${l}`);
  let stackView = null, distView = null;

  const colW = () => ($("dd-stack").parentElement.clientWidth || 460);
  const stackW = () => Math.max(220, Math.min(520, colW() - LABEL_W - 30));
  const distW = () => Math.max(240, Math.min(520, colW() - 24));

  const cellsFor = () => Ch1.LEVELS.map((l) => ({ l, ...agg(state.year, state.domain, l) }));
  const pdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  const Phi = (z) => { // standard normal CDF (Abramowitz-Stegun)
    const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp((-z * z) / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  };

  function stackSegs() {
    return D.segments(cellsFor().map((c) => ({ label: `Year ${c.l}`, ...c, dim: false })), stackW());
  }

  function distData() {
    const dist = [], means = [];
    cellsFor().forEach((c) => {
      const lvl = `Year ${c.l}`;
      for (let x = X_SCORE[0]; x <= X_SCORE[1]; x += 5) dist.push({ level: lvl, x, y: pdf(x, c.mean, c.sd) });
      means.push({ level: lvl, tag: `Y${c.l}`, mean: c.mean, peak: pdf(c.mean, c.mean, c.sd),
                   tLevel: lvl, tMean: c.mean.toFixed(0), tSd: c.sd.toFixed(0) });
    });
    return { dist, means };
  }

  function distSpec(data) {
    const W = distW();
    const AX = { title: "NAPLAN scale score", grid: false, domain: false, ticks: true, tickCount: 7, labelColor: C.muted,
                 titleColor: C.muted, titleFontSize: 11, titleFontWeight: 500, titlePadding: 8, tickColor: "#d8d1c3" };
    const X = { field: "x", type: "quantitative", scale: { domain: X_SCORE, nice: false, zero: false }, axis: AX };
    const Xm = { ...X, field: "mean" };
    const Y = { type: "quantitative", scale: { domain: [0, 0.0066] }, axis: null, stack: null };
    const col = { field: "level", type: "nominal", legend: null, scale: { domain: LEVEL_NAMES, range: LEVEL_COLS } };
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      background: null,
      padding: { left: 6, right: 10, top: 14, bottom: 6 },
      config: { view: { stroke: null }, font: Ch1.font },
      width: W, height: 250,
      layer: [
        { data: { name: "dist", values: data.dist }, mark: { type: "area", opacity: 0.3, line: { strokeWidth: 2 } },
          encoding: { x: X, y: { field: "y", ...Y }, color: col } },
        { data: { name: "means", values: data.means }, mark: { type: "rule", strokeDash: [3, 3], strokeWidth: 1.5, tooltip: true },
          encoding: { x: Xm, y: { field: "peak", ...Y }, y2: { datum: 0 }, color: col,
                      tooltip: [{ field: "tLevel", title: "Year level" }, { field: "tMean", title: "Average score" }, { field: "tSd", title: "Typical distance from the average (points)" }] } },
        // peak labels: Y7 and Y9 often sit close together, so push them apart (Y7 leftwards, Y9 rightwards)
        ...[["Year 3", "center", 0], ["Year 5", "center", 0], ["Year 7", "right", -2], ["Year 9", "left", 2]].map(([lvl, align, dx]) => ({
          data: { name: "means" }, transform: [{ filter: `datum.level === '${lvl}'` }],
          mark: { type: "text", dy: -9, dx, align, fontWeight: 700, fontSize: 11 },
          encoding: { x: Xm, y: { field: "peak", ...Y }, text: { field: "tag" }, color: col },
        })),
      ],
    };
  }

  function renderText() {
    const dm = state.domain, label = dlabel(dm), cs = cellsFor();
    $("dd-title-stack").textContent = `${label}: proficiency mix by year level, ${state.year}`;
    $("dd-title-dist").textContent = `${label}: score spread by year level, ${state.year}`;

    const [c3, c5, c7, c9] = cs;
    const dSo = c9.so - c3.so;
    const gains = [c5.mean - c3.mean, c7.mean - c5.mean, c9.mean - c7.mean];
    const shrinking = gains[0] > gains[1] && gains[1] > gains[2];
    const overlap = (1 - Phi((c9.mean - c7.mean) / c7.sd)) * 100;
    const sdUp = c9.sd / c3.sd;

    let html = `In ${state.year}, <strong>${f1(c3.so)}%</strong> of Year 3 students were at Strong or above in ${label.toLowerCase()}, ` +
      `compared with <strong>${f1(c9.so)}%</strong> in Year 9 (${signed(dSo)}). `;
    html += `Average scores rise by ${gains.map((g) => "+" + g.toFixed(0)).join(", ")} points from one tested year level to the next` +
            (shrinking ? ", so the gains get smaller in later years" : "") + `. `;
    html += `The curves overlap heavily: if scores are roughly bell-shaped, about <strong>${overlap.toFixed(0)}%</strong> of Year 7 students ` +
            `score above the average Year 9 student.`;
    if (sdUp > 1.15) html += ` Scores also spread out more by Year 9 than in Year 3, so the gap between higher and lower scorers grows.`;
    else if (sdUp < 0.87) html += ` Scores bunch closer together by Year 9 than in Year 3.`;
    $("dd-insight").innerHTML = html;

    $("dd-note").innerHTML =
      `The curves are estimated from each year level's average score and how spread out its scores are, assuming a roughly bell shape, so read them as an ` +
      `approximate picture rather than the exact scores. Year levels are different students in the same year, not the same students over time. NAPLAN scores can be compared across year levels ` +
      `within a domain, but not between domains.` +
      (dm === "Writing" && state.year === 2026 ? `<br>ACARA flagged a caveat on 2026 Writing results for Years 5, 7 and 9.` : "");
  }

  async function render() {
    const segs = stackSegs(), dd = distData();
    if (!stackView) {
      const spec = D.spec({ name: "dd-stack", labels: LEVEL_NAMES, segs, plotW: stackW(), step: 52, showAxis: true, header: true, labelW: LABEL_W });
      stackView = (await vegaEmbed("#dd-stack", spec, { actions: false, renderer: "svg" })).view;
    } else {
      stackView.change("dd-stack", vega.changeset().remove(vega.truthy).insert(segs)).run();
    }
    if (!distView) {
      distView = (await vegaEmbed("#dd-dist", distSpec(dd), { actions: false, renderer: "svg" })).view;
    } else {
      distView.change("dist", vega.changeset().remove(vega.truthy).insert(dd.dist))
              .change("means", vega.changeset().remove(vega.truthy).insert(dd.means)).run();
    }
    renderText();
  }

  function init() {
    $("dd-legend").innerHTML = D.legendHTML();
    Ch1.onChange(() => render());
    return render();
  }
  function rebuild() { stackView = null; distView = null; return render(); }

  Ch1.deepdive = { init, rebuild };
})(window.Ch1);
