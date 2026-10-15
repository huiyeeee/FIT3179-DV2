/* Chapter 1 · shared state, data and helpers (namespace: window.Ch1)
 * National ("Australia") NAPLAN results for the 'All students' group.
 * Charts subscribe with Ch1.onChange(); the year slider, metric toggle and
 * selected domain drive every chart in the chapter.
 */
window.Ch1 = (function () {
  const DATA_URL = "chapter-1/data/performance_all.csv";
  const AUS = "Australia";
  const LEVELS = [3, 5, 7, 9];
  const DOMAINS = ["Reading", "Writing", "Spelling", "Grammar and Punctuation", "Numeracy"];
  const dlabel = (d) => (d === "Grammar and Punctuation" ? "Grammar & punctuation" : d);

  const METRICS = {
    so:     { label: "Strong or above",          good: 1 },  // higher is better
    nas:    { label: "Needs additional support", good: -1 }, // lower is better
    exceed: { label: "Exceeding",                good: 1 },
  };

  const C = {
    ink: "#14213d", muted: "#4a5568", teal: "#1f6f8b", coral: "#f0745a", grey: "#9aa3b2",
    // proficiency levels, from "needs support" (outer left) to "exceeding" (outer right)
    nas: "#c2410c", dev: "#f4a58f", strong: "#7ab3c6", exceed: "#0e4a62",
  };

  const state = { year: null, metric: "so", domain: "Writing", level: null };
  let rows = [], YEARS = [];
  const listeners = [];
  const onChange = (fn) => listeners.push(fn);
  const emit = (type) => listeners.forEach((fn) => fn(type));
  const setYear = (y) => { state.year = +y; emit("year"); };
  const setMetric = (m) => { state.metric = m; emit("metric"); };
  const setDomain = (d, level = null) => { state.domain = d; state.level = level; emit("domain"); };

  async function load() {
    const text = await vega.loader().load(DATA_URL);
    rows = vega.read(text, { type: "csv", parse: "auto" })
      .filter((d) => d.state === AUS)
      .map((d) => ({
        year: d.year, level: d.year_level, domain: d.domain, n: d.participants,
        mean: d.mean_score, sd: d.sd, exempt: d.exempt_pct,
        nas: d.needs_support_pct, dev: d.developing_pct, strong: d.strong_pct, exceed: d.exceeding_pct,
        so: d.strong_or_above_pct,
      }));
    YEARS = [...new Set(rows.map((d) => d.year))].sort((a, b) => a - b);
    state.year = YEARS[YEARS.length - 1];
  }
  const years = () => YEARS;

  // Participant-weighted proficiency profile for a year, optionally narrowed to a domain and/or year level.
  // mean / sd are only meaningful for a single domain + level (NAPLAN scales differ by domain).
  function agg(year, domain = null, level = null) {
    const sel = rows.filter((d) => d.year === year && (!domain || d.domain === domain) && (!level || d.level === level));
    if (!sel.length) return null;
    const w = sel.reduce((s, d) => s + d.n, 0);
    const avg = (k) => sel.reduce((s, d) => s + d[k] * d.n, 0) / w;
    const out = { year, n: w, nas: avg("nas"), dev: avg("dev"), strong: avg("strong"), exceed: avg("exceed"), exempt: avg("exempt"), so: avg("so") };
    if (sel.length === 1) { out.mean = sel[0].mean; out.sd = sel[0].sd; }
    return out;
  }

  const f1 = (n) => n.toFixed(1);
  const signed = (d, unit = " pp") => `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)}${unit}`;
  const join = (arr) => (arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1]);

  return {
    AUS, LEVELS, DOMAINS, dlabel, METRICS, C, state, onChange, emit, setYear, setMetric, setDomain,
    load, years, agg, f1, signed, join,
    $: (id) => document.getElementById(id),
    font: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  };
})();
