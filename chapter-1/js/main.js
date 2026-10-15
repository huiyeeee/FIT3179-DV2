/* Chapter 1 · entry point: controls + wiring */
(async function (Ch1) {
  const { state, $ } = Ch1;
  await Ch1.load();
  const YEARS = Ch1.years();

  /* ---- year slider + play ---- */
  const slider = $("c1-year-slider"), ticks = $("c1-year-ticks"), play = $("c1-play");
  slider.min = YEARS[0]; slider.max = YEARS[YEARS.length - 1]; slider.step = 1; slider.value = state.year;
  slider.addEventListener("input", () => Ch1.setYear(slider.value));
  YEARS.forEach((y) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = y; b.dataset.year = y;
    b.addEventListener("click", () => Ch1.setYear(y));
    ticks.appendChild(b);
  });
  let timer = null;
  const last = YEARS[YEARS.length - 1];
  const stop = () => { clearInterval(timer); timer = null; play.textContent = "▶ Play"; };
  play.addEventListener("click", () => {
    if (timer) return stop();
    if (state.year === last) Ch1.setYear(YEARS[0]);
    play.textContent = "❚❚ Pause";
    timer = setInterval(() => {
      const next = state.year + 1;
      if (next > last) return stop();
      Ch1.setYear(next);
      if (next === last) stop();
    }, 1500);
  });

  /* ---- metric toggle (heatmap) ---- */
  [...$("heat-metric").children].forEach((b) => b.addEventListener("click", () => { if (b.dataset.metric !== state.metric) Ch1.setMetric(b.dataset.metric); }));

  /* ---- domain chips (deep-dive) ---- */
  const chips = $("dd-domain-chips");
  Ch1.DOMAINS.forEach((d) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = Ch1.dlabel(d); b.dataset.domain = d;
    b.addEventListener("click", () => { if (d !== state.domain) Ch1.setDomain(d); });
    chips.appendChild(b);
  });

  function sync() {
    slider.value = state.year;
    [...ticks.children].forEach((b) => b.classList.toggle("active", +b.dataset.year === state.year));
    [...$("heat-metric").children].forEach((b) => { const on = b.dataset.metric === state.metric; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
    [...chips.children].forEach((b) => { const on = b.dataset.domain === state.domain; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
  }
  Ch1.onChange(sync);
  sync();

  await Ch1.hero.init();
  await Ch1.heatmap.init();
  await Ch1.deepdive.init();

  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => { Ch1.hero.rebuild(); Ch1.heatmap.rebuild(); Ch1.deepdive.rebuild(); }, 200);
  });
})(window.Ch1);
