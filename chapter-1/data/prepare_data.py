"""Tidy ACARA NAPLAN results for Chapter 1 (overall performance).

Input : ../../data/raw/NAPLAN_results_raw.csv   (ACARA, 2023 to 2026; the four proficiency levels exist only from 2023)
Output: outcomes.csv  national results ("All" students) for every year x subject x year level, plus two kinds of summary rows:
          domain "All subjects"  = the five subjects combined
          level  "All years"     = Years 3, 5, 7 and 9 combined
        Summaries are averages weighted by the number of students who sat each test.
        Columns: year, domain, level, needs, developing, strong, exceeding (% of students at each level),
                 exempt (% excused, not in any level), so (Strong + Exceeding = "meeting expectations"),
                 mean (average score, single subject + year level only), d39 (Year 9 minus Year 3, points of "so", per subject and year).
        cohort.csv   the same students two years apart: for each end year, subject and year level, the share meeting expectations
                     then (so_start, from_level two years earlier, one year level down) and now (so_end). Year 3 has no earlier test.
Run from this folder:  python3 prepare_data.py
"""
from pathlib import Path
import numpy as np
import pandas as pd

here = Path(__file__).parent
raw = pd.read_csv(here.parent.parent / "data" / "raw" / "NAPLAN_results_raw.csv", thousands=",")
raw.columns = ["year", "level", "domain", "state", "attribute", "subgroup", "flag", "enrolled", "participation_pct", "participants",
               "mean", "mean_ci", "sd", "exempt", "needs", "developing", "strong", "exceeding", "exceeding_ci", "so", "so_ci", "dev_or_above", "dev_ci"]
d = raw[(raw.attribute == "All") & (raw.state == "Australia") & raw["mean"].notna()].copy()
d["level"] = "Year " + d.level.astype(str)
d["domain"] = d.domain.replace({"Grammar and Punctuation": "Grammar & punctuation"})
COLS = ["needs", "developing", "strong", "exceeding", "exempt", "so"]


def wavg(g):
    out = {c: np.average(g[c], weights=g.participants) for c in COLS}
    out["participants"] = g.participants.sum()
    out["mean"] = g["mean"].iloc[0] if len(g) == 1 else np.nan
    return pd.Series(out)


base = d.groupby(["year", "domain", "level"]).apply(wavg).reset_index()
by_domain = d.groupby(["year", "domain"]).apply(wavg).reset_index().assign(level="All years")
by_level = d.groupby(["year", "level"]).apply(wavg).reset_index().assign(domain="All subjects")
everything = d.groupby("year").apply(wavg).reset_index().assign(domain="All subjects", level="All years")
t = pd.concat([base, by_domain, by_level, everything], ignore_index=True)

# change in "meeting expectations" from Year 3 to Year 9, repeated on each row of that subject + year
so = t.pivot_table(index=["year", "domain"], columns="level", values="so")
t["d39"] = [so.loc[(r.year, r.domain), "Year 9"] - so.loc[(r.year, r.domain), "Year 3"] for r in t.itertuples()]
t = t[["year", "domain", "level", "needs", "developing", "strong", "exceeding", "exempt", "so", "mean", "d39", "participants"]]
t.round(2).sort_values(["year", "domain", "level"]).to_csv(here / "outcomes.csv", index=False)
print(len(t), "rows; years", sorted(t.year.unique()))
print(t[(t.year == 2026) & (t.level == "All years")][["domain", "so", "d39"]].round(1).to_string(index=False))


# ------------------------------------------------------------------ same students, two years apart
# NAPLAN tests Years 3, 5, 7 and 9, so the Year 5 students of 2026 are the Year 3 students of 2024, and so on.
FROM = {"Year 3": None, "Year 5": "Year 3", "Year 7": "Year 5", "Year 9": "Year 7"}
lookup = t.set_index(["year", "domain", "level"]).so
rows = []
for r in t[(t.level.isin(FROM)) & (t.year - 2 >= t.year.min())].itertuples():
    f = FROM[r.level]
    start = lookup.get((r.year - 2, r.domain, f)) if f else None
    rows.append({"year": r.year, "domain": r.domain, "level": r.level, "from_level": f or "", "so_start": start, "so_end": r.so})
pd.DataFrame(rows).round(2).sort_values(["year", "domain", "level"]).to_csv(here / "cohort.csv", index=False)
print("cohort.csv:", len(rows), "rows")
