/* Chapter 0 · controls: year slider, play button, year-level + domain chips */
(function (Ch0) {
  const { state, LEVELS, DOMAINS, $ } = Ch0;
  let timer = null;

  function init() {
    const YEARS = Ch0.years();
    const slider = $("year-slider");
    const ticks = $("year-ticks");
    const playBtn = $("play-btn");

    slider.min = YEARS[0];
    slider.max = YEARS[YEARS.length - 1];
    slider.step = 1;
    slider.value = state.year;
    slider.addEventListener("input", () => Ch0.setYear(slider.value));

    YEARS.forEach((y) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = y;
      b.dataset.year = y;
      b.addEventListener("click", () => Ch0.setYear(y));
      ticks.appendChild(b);
    });

    function buildChips(containerId, options, set, labelFn) {
      const box = $(containerId);
      const make = (label, value) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = label;
        b.dataset.value = value === null ? "all" : value;
        b.addEventListener("click", () => {
          if (value === null) set.clear();
          else if (set.has(value)) set.delete(value);
          else set.add(value);
          if (set.size === options.length) set.clear(); // everything selected = "All"
          Ch0.emit("filter");
        });
        return b;
      };
      box.appendChild(make("All", null));
      options.forEach((o) => box.appendChild(make(labelFn(o), o)));
    }
    buildChips("level-chips", LEVELS, state.levels, (l) => `Year ${l}`);
    buildChips("domain-chips", DOMAINS, state.domains, (d) => d);

    function sync() {
      slider.value = state.year;
      [...ticks.children].forEach((b) => b.classList.toggle("active", +b.dataset.year === state.year));
      [["level-chips", state.levels, LEVELS], ["domain-chips", state.domains, DOMAINS]].forEach(([id, set, opts]) => {
        [...$(id).children].forEach((b) => {
          const isAll = b.dataset.value === "all";
          const val = isAll ? null : opts.find((o) => String(o) === b.dataset.value);
          const active = isAll ? set.size === 0 : set.has(val);
          b.classList.toggle("active", active);
          b.setAttribute("aria-pressed", active);
        });
      });
    }
    Ch0.onChange(sync);
    sync();

    /* Play through the years */
    const last = YEARS[YEARS.length - 1];
    function stop() { clearInterval(timer); timer = null; playBtn.textContent = "▶ Play"; }
    playBtn.addEventListener("click", () => {
      if (timer) return stop();
      if (state.year === last) Ch0.setYear(YEARS[0]);
      playBtn.textContent = "❚❚ Pause";
      timer = setInterval(() => {
        const next = state.year + 1;
        if (next > last) return stop();
        Ch0.setYear(next);
        if (next === last) stop();
      }, 1400);
    });
  }

  Ch0.controls = { init };
})(window.Ch0);
