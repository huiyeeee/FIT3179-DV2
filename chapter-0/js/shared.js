/* Chapter 0 · shared state, data and helpers (namespace: window.Ch0)
 * Every chart in this chapter reads the same state, so the year slider and the
 * filters drive the waffle AND the map. Charts subscribe with Ch0.onChange().
 */
window.Ch0 = (function () {
  const DATA_URL = "chapter-0/data/participation_all.csv";
  const LEVELS = [3, 5, 7, 9];
  const DOMAINS = ["Reading", "Writing", "Spelling", "Grammar and Punctuation", "Numeracy"];
  const AUS = "Australia";

  const state = {
    year: null,
    levels: new Set(),  // empty = all year levels
    domains: new Set(), // empty = all domains
    region: AUS,        // "Australia" or a state/territory name
  };

  let rows = [];
  let YEARS = [];
  const listeners = [];

  /* ---- events ---- */
  const onChange = (fn) => listeners.push(fn);
  const emit = (type) => listeners.forEach((fn) => fn(type)); // type: year | filter | region
  const setYear = (y) => { state.year = +y; emit("year"); };
  const setRegion = (r) => { state.region = r; emit("region"); };

  /* ---- data ---- */
  async function load() {
    const text = await vega.loader().load(DATA_URL);
    rows = vega.read(text, { type: "csv", parse: "auto" });
    YEARS = [...new Set(rows.map((d) => d.year))].sort((a, b) => a - b);
    state.year = YEARS[YEARS.length - 1]; // default: latest year
  }
  const years = () => YEARS;

  // Participation for a year + region under the current filters, weighted by
  // enrolment: sum(participated) / sum(enrolled).
  function aggregate(year, region = state.region) {
    const sel = rows.filter(
      (d) =>
        d.year === year &&
        d.state === region &&
        (!state.levels.size || state.levels.has(d.year_level)) &&
        (!state.domains.size || state.domains.has(d.domain))
    );
    if (!sel.length) return null;
    const enrolled = sel.reduce((s, d) => s + d.enrolled, 0);
    const participated = sel.reduce((s, d) => s + d.participated, 0);
    return { year, region, enrolled, participated, pct: (participated / enrolled) * 100 };
  }

  /* ---- text helpers ---- */
  const fmtInt = (n) => Math.round(n).toLocaleString("en-AU");
  const fmtPct = (n) => n.toFixed(1);
  const join = (arr) =>
    arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
  const levelsArr = () => LEVELS.filter((l) => state.levels.has(l));
  const domainsArr = () => DOMAINS.filter((d) => state.domains.has(d));
  const levelPhrase = () => (state.levels.size ? "Year " + join(levelsArr()) : "all year levels");
  const domainPhrase = () => (state.domains.size ? join(domainsArr()) : "all domains");
  const contextLabel = (region = state.region) =>
    `${region} · ${state.levels.size ? "Year " + levelsArr().join(", ") : "All year levels"} · ${
      state.domains.size ? domainsArr().join(", ") : "All domains"
    }`;

  return {
    LEVELS, DOMAINS, AUS, state, onChange, emit, setYear, setRegion, load, years, aggregate,
    fmtInt, fmtPct, join, levelsArr, domainsArr, levelPhrase, domainPhrase, contextLabel,
    $: (id) => document.getElementById(id),
    font: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  };
})();
