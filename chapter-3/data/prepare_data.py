"""Prepare the Chapter 3 datasets (student background).

Inputs (../../data/raw/):
  NAPLAN_results_raw.csv              ACARA NAPLAN results by student background (students tested, average scores, % at each level)

Outputs (this folder):
  factors.csv        one row per background factor: the lower and higher group, their % meeting expectations, the gap, the share of
                     students in each group, and the same gap in 2023
  groups_all.csv     every group of every factor (for the "groups in between" view)
  subject_gaps.csv      % meeting expectations and gap by subject for each background
  state_gaps.csv        the five gaps (education, job, Indigenous status, language, gender) in each state and territory
  support_groups.csv    every group: share of all students, % needing additional support, and share of all students needing support
  support_combo.csv     % needing support: Indigenous and non-Indigenous students by type of area

"Meeting expectations" = Strong or Exceeding. Averages over subjects and year levels are weighted by students tested.
Run from this folder:  python3 prepare_data.py
"""
from pathlib import Path
import numpy as np
import pandas as pd

here = Path(__file__).parent
raw = here.parent.parent / "data" / "raw"
YEAR, BASE_YEAR = 2026, 2023

r = pd.read_csv(raw / "NAPLAN_results_raw.csv", thousands=",")
r.columns = ["year", "level", "domain", "state", "attr", "sub", "flag", "enrolled", "part_pct", "n", "avg", "avg_ci", "sd", "exempt", "nas",
             "dev", "strong", "exceed", "exceed_ci", "so", "so_ci", "do", "do_ci"]
rall = r.copy()
r = r[r.state == "Australia"]
res = r[r.so.notna() & (r.n > 0)]

# factor -> (label, lower group, higher group, [(raw name, short label) all groups, high to low])
FACTORS = {
    "edu": ("Parents’ education", "Parental education: Year 11", "Parental education: bachelor", [
        ("Parental education: bachelor", "Bachelor degree"), ("Parental education: diploma", "Diploma"), ("Parental education: certificate", "Certificate"),
        ("Parental education: Year 12", "Year 12"), ("Parental education: Year 11", "Year 11 or below")]),
    "job": ("Parents’ job", "Not in paid work for 12 months", "Senior managers and professionals", [
        ("Senior managers and professionals", "Managers, professionals"), ("Other managers and associate professionals", "Other managers"),
        ("Skilled trades, clerical and sales", "Trades, clerical, sales"), ("Unskilled manual, office & sales", "Unskilled work"),
        ("Not in paid work for 12 months", "Not in paid work")]),
    "area": ("Where they live", "Very remote", "Major cities", [
        ("Major cities", "Major cities"), ("Inner regional", "Inner regional"), ("Outer regional", "Outer regional"), ("Remote", "Remote"),
        ("Very remote", "Very remote")]),
    "ind": ("Indigenous status", "Indigenous", "Non-Indigenous", [("Non-Indigenous", "Non-Indigenous"), ("Indigenous", "Indigenous")]),
    "lang": ("Language at home", "Non-LBOTE", "LBOTE", [("LBOTE", "Other than English"), ("Non-LBOTE", "English only")]),
    "sex": ("Gender", "Male", "Female", [("Female", "Girls"), ("Male", "Boys")]),
}
LOW_LABEL = {"edu": "Year 11 or below", "job": "Not in paid work", "area": "Very remote", "ind": "Indigenous", "lang": "English only", "sex": "Boys"}
HIGH_LABEL = {"edu": "Bachelor degree", "job": "Managers, professionals", "area": "Major cities", "ind": "Non-Indigenous", "lang": "Other than English", "sex": "Girls"}


def wmean(df, col="so"):
    df = df[df[col].notna() & df["n"].notna() & (df["n"] > 0)]
    return float(np.average(df[col], weights=df["n"])) if len(df) else float("nan")


def so(sub, year):
    return wmean(res[(res["sub"] == sub) & (res.year == year)])


def students(sub, year):   # students tested, counted once (mean over the five subjects of the sum over year levels)
    g = r[(r["sub"] == sub) & (r.year == year) & r.n.notna()]
    return float(g.groupby("domain").n.sum().mean())


tot = {y: students("All", y) for y in (YEAR, BASE_YEAR)}
DOMS = ["Reading", "Writing", "Spelling", "Grammar and Punctuation", "Numeracy"]


def so_d(sub, year, dom=None):
    g = res[(res["sub"] == sub) & (res.year == year)]
    if dom:
        g = g[g.domain == dom]
    return wmean(g)


rows, grows = [], []
for k, (label, lo, hi, groups) in FACTORS.items():
    for dom in [None] + DOMS:
        d = dict(factor=k, label=label, domain=dom or "All subjects")
        a_, b_ = so_d(lo, YEAR, dom), so_d(hi, YEAR, dom)
        lo_name, hi_name, lo_so, hi_so = LOW_LABEL[k], HIGH_LABEL[k], a_, b_
        if a_ > b_:   # the groups swap roles when the "usually lower" group is ahead (boys in numeracy)
            lo_name, hi_name, lo_so, hi_so = hi_name, lo_name, b_, a_
        d.update(low=lo_name, high=hi_name, so_low=lo_so, so_high=hi_so, gap=hi_so - lo_so,
                 share_low=students(lo, YEAR) / tot[YEAR] * 100, share_high=students(hi, YEAR) / tot[YEAR] * 100)
        if dom is None:
            d["so_low_2023"], d["so_high_2023"] = so_d(lo, BASE_YEAR), so_d(hi, BASE_YEAR)
            d["gap_2023"] = d["so_high_2023"] - d["so_low_2023"]
        rows.append(d)
    for i, (raw_name, lab) in enumerate(groups):
        for dom in [None] + DOMS:
            grows.append(dict(factor=k, label=label, domain=dom or "All subjects", group=lab, order=i, so=so_d(raw_name, YEAR, dom), share=students(raw_name, YEAR) / tot[YEAR] * 100))
fac = pd.DataFrame(rows)
order = fac[fac.domain == "All subjects"].sort_values("gap", ascending=False).factor.tolist()
fac["rank"] = fac.factor.map({f: i for i, f in enumerate(order)})
fac = fac[fac.domain == "All subjects"].drop(columns="domain").sort_values("gap", ascending=False)
fac.round(2).to_csv(here / "factors.csv", index=False)
pd.DataFrame(grows).query("domain == 'All subjects'").drop(columns="domain").round(2).to_csv(here / "groups_all.csv", index=False)

# ------------------------------------------------------------------ the same gaps in each state
STATES = ["Australian Capital Territory", "New South Wales", "Victoria", "Western Australia", "South Australia", "Queensland", "Northern Territory"]
srows = []
for k in ("edu", "job", "ind", "sex", "lang"):
    _, lo, hi, _g = FACTORS[k]
    for s in STATES:
        sd_ = rall[(rall.state == s) & (rall.year == YEAR) & rall.so.notna() & (rall.n > 0)]
        gl, gh = sd_[sd_["sub"] == lo], sd_[sd_["sub"] == hi]
        n_lo = gl.groupby("domain").n.sum().mean()
        srows.append(dict(factor=k, state=s, so_low=wmean(gl), so_high=wmean(gh), gap=wmean(gh) - wmean(gl), n_low=n_lo))
pd.DataFrame(srows).round(2).to_csv(here / "state_gaps.csv", index=False)

# ------------------------------------------------------------------ who needs additional support
a = r[(r.year == YEAR) & r.nas.notna() & (r.n > 0)]


def nas_rate(sub, df=None):
    g = (a if df is None else df)
    g = g[g["sub"] == sub]
    return float(np.average(g.nas, weights=g.n))


all_n, all_rate = students("All", YEAR), nas_rate("All")
GROUPS = [("area", "Where they live", [("Major cities", "Major cities"), ("Inner regional", "Inner regional"), ("Outer regional", "Outer regional"), ("Remote", "Remote"), ("Very remote", "Very remote")]),
          ("ind", "Indigenous status", [("Non-Indigenous", "Non-Indigenous"), ("Indigenous", "Indigenous")]),
          ("edu", "Parents’ education", [("Parental education: bachelor", "Bachelor degree"), ("Parental education: diploma", "Diploma"), ("Parental education: certificate", "Certificate"),
                                          ("Parental education: Year 12", "Year 12"), ("Parental education: Year 11", "Year 11 or below")]),
          ("job", "Parents’ job", [("Senior managers and professionals", "Managers, professionals"), ("Other managers and associate professionals", "Other managers"),
                                   ("Skilled trades, clerical and sales", "Trades, clerical, sales"), ("Unskilled manual, office & sales", "Unskilled work"),
                                   ("Not in paid work for 12 months", "Not in paid work")]),
          ("sex", "Gender", [("Female", "Girls"), ("Male", "Boys")]),
          ("lang", "Language at home", [("Non-LBOTE", "English only"), ("LBOTE", "Other than English")])]
grows = [dict(factor="all", label="All students", group="All students", order=0, share=100.0, rate=all_rate, students=all_n, support=all_n * all_rate / 100, share_support=100.0)]
for k, label, gs in GROUPS:
    for i, (raw_name, lab) in enumerate(gs):
        n, rt = students(raw_name, YEAR), nas_rate(raw_name)
        grows.append(dict(factor=k, label=label, group=lab, order=i, share=n / all_n * 100, rate=rt, students=n, support=n * rt / 100, share_support=n * rt / (all_n * all_rate) * 100))
sgrp = pd.DataFrame(grows)
sgrp.round(2).to_csv(here / "support_groups.csv", index=False)

# Indigenous status and place together (Indigenous students by type of area)
combo = []
for area in ("Major cities", "Inner regional", "Outer regional", "Remote", "Very remote"):
    pg = r[(r.year == YEAR) & (r["sub"] == "Indigenous " + area.lower()) & r.part_pct.notna() & (r.enrolled > 0)]
    combo.append(dict(area=area, ind=nas_rate("Indigenous " + area.lower()), non=nas_rate("Non-Indigenous " + area.lower()),
                      part_ind=float(np.average(pg.part_pct, weights=pg.enrolled))))
pd.DataFrame(combo).round(2).to_csv(here / "support_combo.csv", index=False)

# the other four backgrounds by subject (they favour the same group in every subject), and Year 9 shares for girls/boys and language
rows = []
for k in ("edu", "job", "area", "ind", "sex", "lang"):
    _, lo, hi, _g = FACTORS[k]
    for dom in DOMS:
        rows.append(dict(factor=k, domain=dom, so_low=so_d(lo, YEAR, dom), so_high=so_d(hi, YEAR, dom), gap=so_d(hi, YEAR, dom) - so_d(lo, YEAR, dom)))
pd.DataFrame(rows).round(2).to_csv(here / "subject_gaps.csv", index=False)
print(fac[["factor", "so_low", "so_high", "gap", "gap_2023", "share_low", "share_high"]].round(1).to_string())
