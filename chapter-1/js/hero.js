/* Chapter 1 · Scene 1 (hero): national proficiency mix as a diverging stacked bar, one bar per year.
 * The selected year is emphasised; KPIs and the text beneath update with it.
 */
(function (Ch1) {
  const { state, agg, f1, signed, $ } = Ch1;
  const D = Ch1.diverging;
  const LABEL_W = 44;
  let view = null;

  const plotW = () => Math.max(260, Math.min(780, ($("hero-chart").parentElement.clientWidth || 900) - LABEL_W - 40));
  const items = () => Ch1.years().map((y) => ({ label: String(y), ...agg(y), dim: y !== state.year }));

  function kpi(id, value, delta, goodDir) {
    $(id).textContent = f1(value);
    const el = $(id + "-d");
    if (delta == null) { el.className = "kpi-delta flat"; el.textContent = "first year in the data"; return; }
    const flat = Math.abs(delta) < 0.05;
    const good = flat ? 0 : delta * goodDir > 0 ? 1 : -1;
    el.className = "kpi-delta " + (good > 0 ? "good" : good < 0 ? "bad" : "flat");
    el.textContent = `${flat ? "▬" : delta > 0 ? "▲" : "▼"} ${signed(delta)} vs ${state.year - 1}`;
  }

  function renderText() {
    const cur = agg(state.year);
    const prev = Ch1.years().includes(state.year - 1) ? agg(state.year - 1) : null;
    kpi("kpi-so", cur.so, prev && cur.so - prev.so, 1);
    kpi("kpi-nas", cur.nas, prev && cur.nas - prev.nas, -1);
    kpi("kpi-exceed", cur.exceed, prev && cur.exceed - prev.exceed, 1);

    const third = cur.so >= 63 && cur.so <= 70 ? "roughly two in three students" : `${f1(cur.so)}% of students`;
    let html = `In ${state.year}, <strong>${f1(cur.so)}%</strong> of students were at Strong or Exceeding (${third}). ` +
               `About 1 in ${Math.round(100 / cur.nas)} (<strong>${f1(cur.nas)}%</strong>) needed additional support.`;

    const base = agg(Ch1.years()[0]);
    if (state.year !== Ch1.years()[0]) {
      const ds = cur.strong - base.strong, dn = cur.nas - base.nas, de = cur.exceed - base.exceed;
      const thin = ds < 0 && dn > 0 && de > 0;
      html += `<br><br>Compared with ${Ch1.years()[0]}: Strong <strong>${signed(ds)}</strong>, Needs additional support <strong>${signed(dn)}</strong>, ` +
              `Exceeding <strong>${signed(de)}</strong>. ` + (thin ? "The overall share meeting expectations has barely moved, but the middle is thinning as both ends grow." : "");
    }
    $("hero-insight").innerHTML = html;
  }

  async function render() {
    const segs = D.segments(items(), plotW());
    if (!view) {
      const spec = D.spec({ name: "hero", labels: Ch1.years().map(String), segs, plotW: plotW(), step: 54, showAxis: true, header: true, labelW: LABEL_W });
      view = (await vegaEmbed("#hero-chart", spec, { actions: false, renderer: "svg" })).view;
    } else {
      view.change("hero", vega.changeset().remove(vega.truthy).insert(segs)).run();
    }
    renderText();
  }

  function init() {
    $("hero-legend").innerHTML = D.legendHTML();
    Ch1.onChange(() => render());
    return render();
  }
  function rebuild() { view = null; return render(); }

  Ch1.hero = { init, rebuild };
})(window.Ch1);
