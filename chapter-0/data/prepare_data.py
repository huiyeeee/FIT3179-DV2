"""Prepare the Chapter 0 (participation) datasets from ACARA's detailed NAPLAN participation file.

Input  (../../data/raw/NAPLAN_participation_detail_raw.csv)
  Every enrolled student ends up in exactly one of five outcomes (checked below):
    assessed      sat the test and has a result
    exempt        excused (significant disability, or newly arrived with limited English)
    non-attempt   was there but did not attempt enough to be scored
    absent        not at school for the test
    withdrawn     withdrawn from the tests by a parent or carer
  ACARA counts assessed + exempt + non-attempt as "participating".

We merge exempt + non-attempt into one group, "took part, no result" (together about 2%), and keep
absent and withdrawn apart because they tell different stories.

Outputs (this folder)
  outcomes_trend.csv   year x state: % of enrolled students in each outcome (all four year levels and five test domains),
                       plus c_* columns: the same outcomes as whole numbers out of 100 that add to exactly 100
                       (largest-remainder rounding), so the waffle and the tile map always agree
  outcomes_groups.csv  2026, Australia: the same split by year level and by student background
Run from this folder:  python3 prepare_data.py
"""
from pathlib import Path
import numpy as np
import pandas as pd

here = Path(__file__).parent
raw = here.parent.parent / "data" / "raw" / "NAPLAN_participation_detail_raw.csv"
df = pd.read_csv(raw, thousands=",")
df.columns = ["year", "level", "domain", "state", "attr", "sub", "enrolled", "assessed_p", "exempt_p", "nonatt_p", "part_p",
              "absent_p", "withdrawn_p", "assessed", "exempt", "nonatt", "part", "absent", "withdrawn", "age"]

# only the five test domains carry the outcome split ("Any domain" rows have participation only)
d = df[(df.domain != "Any domain") & df.absent.notna()].copy()
d["nonatt"] = d["nonatt"].fillna(0)
assert ((d.assessed + d.exempt + d.nonatt + d.absent + d.withdrawn) == d.enrolled).all(), "outcomes must add up to enrolment"


def split(g):
    e = g.enrolled.sum()
    s = {"enrolled": e / 5,                                   # students (each is counted once per test domain)
         "assessed": g.assessed.sum() / e * 100,
         "nores": (g.exempt.sum() + g.nonatt.sum()) / e * 100,
         "absent": g.absent.sum() / e * 100,
         "withdrawn": g.withdrawn.sum() / e * 100}
    s["missing"] = 100 - s["assessed"]
    return pd.Series(s)


def whole_numbers(vals):
    """Largest-remainder rounding: whole numbers that add to exactly 100."""
    base = [int(np.floor(v + 1e-9)) for v in vals]
    order = sorted(range(len(vals)), key=lambda i: vals[i] - base[i], reverse=True)
    for i in order[: 100 - sum(base)]:
        base[i] += 1
    return base


# ------------------------------------------------------------------ trend by state (2008-2026; no test in 2020)
t = d[d.attr == "All"].groupby(["year", "state"]).apply(split).reset_index()
C = ["c_assessed", "c_nores", "c_absent", "c_withdrawn"]
t[C] = [whole_numbers([r.assessed, r.nores, r.absent, r.withdrawn]) for r in t.itertuples()]
assert (t[C].sum(axis=1) == 100).all()
tiles = {  # equal-sized tiles placed roughly where each state sits on the map: (code, col, row)
    "Northern Territory": ("NT", 1, 0), "Queensland": ("QLD", 2, 0), "Western Australia": ("WA", 0, 1),
    "South Australia": ("SA", 1, 1), "New South Wales": ("NSW", 2, 1), "Australian Capital Territory": ("ACT", 3, 1),
    "Victoria": ("VIC", 2, 2), "Tasmania": ("TAS", 2, 3), "Australia": ("AUS", -1, -1)}
t["code"] = t.state.map(lambda s: tiles[s][0]); t["col"] = t.state.map(lambda s: tiles[s][1]); t["row"] = t.state.map(lambda s: tiles[s][2])
t.round(3).to_csv(here / "outcomes_trend.csv", index=False)

# ------------------------------------------------------------------ 2026 groups (Australia)
latest = d[(d.year == d.year.max()) & (d.state == "Australia")]
GROUPS = [  # chip label, attribute key, [(raw subgroup, label)]
    ("Where students live", "ABS remoteness", [("Major cities", "Major cities"), ("Inner regional", "Inner regional"), ("Outer regional", "Outer regional"),
                                                 ("Remote", "Remote"), ("Very remote", "Very remote")]),
    ("Indigenous status", "Indigeneity", [("Indigenous", "Indigenous"), ("Non-Indigenous", "Non-Indigenous")]),
    ("Parents’ education", "Parental education", [("Parental education: bachelor", "Bachelor degree or above"), ("Parental education: diploma", "Diploma"),
                                                    ("Parental education: certificate", "Certificate I–IV"), ("Parental education: Year 12", "Year 12"),
                                                    ("Parental education: Year 11", "Year 11 or below")]),
    ("Parents’ work", "Parental occupation", [("Senior managers and professionals", "Senior managers & professionals"),
                                                ("Other managers and associate professionals", "Other managers & associates"),
                                                ("Skilled trades, clerical and sales", "Skilled trades, clerical & sales"),
                                                ("Unskilled manual, office & sales", "Unskilled manual, office & sales"),
                                                ("Not in paid work for 12 months", "Not in paid work")]),
]
nat = split(latest[latest.attr == "All"])
rows = []
for label, key, subs in GROUPS:
    for i, (rawsub, name) in enumerate(subs):
        g = latest[(latest.attr == key) & (latest["sub"] == rawsub)]
        rows.append({"attribute": label, "group": name, "order": i, **split(g).to_dict()})
for lv in (3, 5, 7, 9):
    g = latest[(latest.attr == "All") & (latest.level == lv)]
    rows.append({"attribute": "Year level", "group": f"Year {lv}", "order": lv, **split(g).to_dict()})
out = pd.DataFrame(rows)
out["national_missing"] = nat["missing"]
out.round(3).to_csv(here / "outcomes_groups.csv", index=False)

print("outcomes_trend:", len(t), "rows | outcomes_groups:", len(out), "rows | latest year:", int(d.year.max()))
print(t[(t.state == "Australia")].set_index("year")[["assessed", "nores", "absent", "withdrawn", "missing"]].round(1).iloc[[0, 8, 14, 15, -2, -1]])
