/* Frame of the story: the headline numbers in the introduction and the conclusion.
 * Every number is read from the same CSV files the charts use, so the text cannot drift from the data. */
(async function () {
  const $ = (id) => document.getElementById(id);
  const read = async (p) => vega.read(await vega.loader().load(p), { type: "csv", parse: "auto" });
  const [trend, res, fac, map] = await Promise.all([
    read("chapter-0/data/outcomes_trend.csv"), read("chapter-1/data/outcomes.csv"),
    read("chapter-3/data/factors.csv"), read("chapter-2/data/map_latest.csv")]);
  const r0 = (x) => Math.round(x);
  const AUS = "Australia";
  const YEAR = Math.max(...trend.map((d) => d.year)), FIRST = Math.min(...trend.map((d) => d.year));
  const counted = (y) => trend.find((d) => d.year === y && d.state === AUS).c_assessed;
  const meet = res.find((d) => d.year === YEAR && d.domain === "All subjects" && d.level === "All years").so;
  const f = (k) => fac.find((d) => d.factor === k);
  const nt = map.find((d) => d.state === "Northern Territory");

  $("st1-n").textContent = `${counted(YEAR)} in 100`;
  $("st1-t").textContent = `enrolled students had a result counted in ${YEAR}.`;
  $("st2-n").textContent = `${r0(meet)} in 100`;
  $("st2-t").textContent = "students meet the expected level. Almost unchanged since 2023.";
  $("st3-n").textContent = `${r0(f("area").so_low)}%`;
  $("st3-t").textContent = `of very remote students meet it, against ${r0(f("area").so_high)}% in major cities.`;

  $("cl-1").textContent = `${counted(YEAR)} in 100 enrolled students had a result counted in ${YEAR}, down from ${counted(FIRST)} in ${FIRST}. ` +
    "Students who live in remote areas, are Indigenous, or have parents with less schooling miss the tests more often.";
  $("cl-2").textContent = `About ${r0(meet)} in 100 students meet expectations, almost unchanged since 2023. ` +
    `In the Northern Territory it is ${r0(nt.so)} in 100. Tasmania’s ${YEAR} results were not published.`;
  $("cl-3").textContent = `Very remote students meet expectations at ${r0(f("area").so_low)}%, major-city students at ${r0(f("area").so_high)}%. ` +
    `With parents at Year 11 or below it is ${r0(f("edu").so_low)}%, with a degree ${r0(f("edu").so_high)}%. ` +
    `Indigenous students: ${r0(f("ind").so_low)}%, others: ${r0(f("ind").so_high)}%. Gender and language matter far less.`;
})();
