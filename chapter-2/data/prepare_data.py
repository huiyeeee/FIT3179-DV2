"""Prepare the Chapter 2 (geographic differences) datasets.

Inputs  (this folder):
  ../../data/raw/NAPLAN_results_raw.csv        ACARA NAPLAN results (national + state, by attribute)
  ../../data/raw/ne_50m_admin_1_states_provinces.geojson   Natural Earth admin-1 boundaries (public domain)

Outputs (this folder):
  states.geojson      Australian state/territory outlines (Jervis Bay merged away), coordinates rounded
  state_results.csv   one row per year x state: students tested, % at each level, gap vs Australia, symbol position
  state_context.csv  background facts per state (parents with a degree, Indigenous students, participation) for the annotations
  map_latest.csv     the latest year of state_results, one row per state (joined to the outlines for the choropleth)
  state_cells.csv     one row per year x state x domain x year level: % meeting expectations and gap vs Australia
  remoteness.csv      one row per year x state x remoteness area: students tested, % meeting expectations
  gap_breakdown.csv   per year x state: how much of the gap vs Australia is explained by where its students live
  waterfall.csv       the same breakdown laid out as waterfall steps

"Meeting expectations" = proficiency level Strong or Exceeding (ACARA's 'Strong or above').
All averages across domains / year levels are weighted by the number of students who sat each test.
Run from this folder:  python3 prepare_data.py
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd

here = Path(__file__).parent
AUS = "Australia"

# ---------------------------------------------------------------- results
r = pd.read_csv(here.parent.parent / "data" / "raw" / "NAPLAN_results_raw.csv", thousands=",")
r.columns = ["year", "level", "domain", "state", "attr", "sub", "flag", "enrolled", "part_pct", "n", "mean",
             "mean_ci", "sd", "exempt", "nas", "dev", "strong", "exceed", "exceed_ci", "so", "so_ci", "do", "do_ci"]
scored = r[r["so"].notna()].copy()


def wavg(g, col):
    return (g[col] * g["n"]).sum() / g["n"].sum()


# ---- state_results: overall profile per year x state (All students, all domains and year levels)
al = scored[scored.attr == "All"]
rows = []
for (yr, st), g in al.groupby(["year", "state"]):
    rows.append({"year": yr, "state": st, "n": g.n.sum(), "so": wavg(g, "so"), "nas": wavg(g, "nas"),
                 "dev": wavg(g, "dev"), "strong": wavg(g, "strong"), "exceed": wavg(g, "exceed")})
res = pd.DataFrame(rows)

# jurisdictions whose results were not published (Tasmania 2026): keep a row so the map can say so
published = set(zip(res.year, res.state))
part = r[(r.attr == "All")].groupby(["year", "state"]).n.sum().reset_index()
for yr, st in sorted(set(zip(part.year, part.state)) - published):
    n = part[(part.year == yr) & (part.state == st)].n.iloc[0]
    res = pd.concat([res, pd.DataFrame([{"year": yr, "state": st, "n": n}])], ignore_index=True)
res["reported"] = res["so"].notna().astype(int)

nat = res[res.state == AUS].set_index("year")
res["nat_so"] = res.year.map(nat["so"])
res["nat_nas"] = res.year.map(nat["nas"])
res["gap_so"] = res["so"] - res["nat_so"]
res["gap_nas"] = res["nas"] - res["nat_nas"]


def band(good):
    if pd.isna(good):
        return ""
    if good <= -10: return "10+ pp worse"
    if good <= -3:  return "3-10 pp worse"
    if good <= -1:  return "1-3 pp worse"
    if good < 1:    return "within 1 pp"
    if good < 3:    return "1-3 pp better"
    return "3+ pp better"


res["band_so"] = res["gap_so"].map(band)
res["band_nas"] = (-res["gap_nas"]).map(band)   # more students needing support = worse

# symbol positions (inland spots inside each state so every symbol sits on its own territory).
# ACT is drawn offshore with a leader line back to Canberra so it is not hidden behind NSW.
cap = {  # name: (code, symbol lon, symbol lat, anchor lon, anchor lat)
    "New South Wales":              ("NSW", 147.9, -32.6, 147.9, -32.6),
    "Victoria":                     ("VIC", 144.96, -37.0, 144.96, -37.0),
    "Queensland":                   ("QLD", 144.5, -22.0, 144.5, -22.0),
    "Western Australia":            ("WA", 122.0, -26.5, 122.0, -26.5),
    "South Australia":              ("SA", 135.5, -30.0, 135.5, -30.0),
    "Tasmania":                     ("TAS", 146.7, -42.0, 146.7, -42.0),
    "Northern Territory":           ("NT", 133.5, -19.5, 133.5, -19.5),
    "Australian Capital Territory": ("ACT", 155.0, -36.6, 149.13, -35.28),
    AUS:                            ("AUS", np.nan, np.nan, np.nan, np.nan),
}
for i, k in enumerate(["code", "lon", "lat", "anchor_lon", "anchor_lat"]):
    res[k] = res.state.map(lambda s: cap[s][i])
res["leader"] = res.state.eq("Australian Capital Territory").astype(int)
res = res.sort_values(["year", "state"]).round(3)
res.to_csv(here / "state_results.csv", index=False)
# state_context.csv: background facts for the annotations (latest year, Reading rows used so each student is counted once)
_ctx = r[(r.year == r.year.max()) & (r.domain == "Reading")].copy()
for _c in ("n", "enrolled"):
    _ctx[_c] = pd.to_numeric(_ctx[_c], errors="coerce")
_pe = _ctx[_ctx.attr == "Parental education"].groupby(["state", "sub"]).n.sum().unstack()
_ind = _ctx[_ctx.attr == "Indigeneity"].groupby(["state", "sub"]).n.sum().unstack()
_all = _ctx[_ctx.attr == "All"].groupby("state")[["n", "enrolled"]].sum()
_remote = pd.read_csv(here / "remoteness.csv")
context = pd.DataFrame({
    "parents_degree_pct": _pe["Parental education: bachelor"] / _pe.drop(columns=["Parental education: not stated"]).sum(axis=1) * 100,
    "indigenous_pct": _ind["Indigenous"] / _ind.sum(axis=1) * 100,
    "participation_pct": _all.n / _all.enrolled * 100,
}).round(1)
context.index.name = "state"
context.reset_index().to_csv(here / "state_context.csv", index=False)

# latest year only, one row per state: the choropleth joins its outlines to this file by state name
import math


def _ring_km2(ring):   # equal-area (Lambert azimuthal) projection centred on Australia, then the shoelace formula
    lam0, phi0, R = math.radians(134), math.radians(-25), 6371
    pts = []
    for lon, lat in ring:
        l, p = math.radians(lon), math.radians(lat)
        k = math.sqrt(2 / (1 + math.sin(phi0) * math.sin(p) + math.cos(phi0) * math.cos(p) * math.cos(l - lam0)))
        pts.append((R * k * math.cos(p) * math.sin(l - lam0), R * k * (math.cos(phi0) * math.sin(p) - math.sin(phi0) * math.cos(p) * math.cos(l - lam0))))
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))) / 2


_geo = json.load(open(here / "states.geojson"))
_area = {}
for _f in _geo["features"]:
    _polys = _f["geometry"]["coordinates"] if _f["geometry"]["type"] == "MultiPolygon" else [_f["geometry"]["coordinates"]]
    _area[_f["properties"]["name"]] = sum(_ring_km2(q[0]) - sum(_ring_km2(h) for h in q[1:]) for q in _polys)
_tot = sum(_area.values())
latest = res[(res.year == res.year.max()) & (res.state != AUS)].copy()
latest["land_pct"] = latest.state.map(lambda x: round(_area[x] / _tot * 100, 1))   # share of Australia's land area
latest.to_csv(here / "map_latest.csv", index=False)

# ---- state_cells: each domain x year level, gap vs the same cell nationally
cells = al[["year", "state", "domain", "level", "so", "n"]].copy()
natc = cells[cells.state == AUS].set_index(["year", "domain", "level"])["so"]
cells["nat_so"] = [natc[(a, b, c)] for a, b, c in zip(cells.year, cells.domain, cells.level)]
cells["gap"] = cells["so"] - cells["nat_so"]
cells = cells[cells.state != AUS].round(3)

# second ACARA file (state comparisons): is each gap clearly real, or small enough to be chance?
# sig = -1 clearly below Australia, 0 too close to call, +1 clearly above (ACARA's 'Significance of difference').
cmp_ = pd.read_csv(here.parent.parent / "data" / "raw" / "NAPLAN_state_comparisons_raw.csv")
cmp_ = cmp_[(cmp_["Base state/territory"] == AUS) & (cmp_.Measure == "Strong or above (%)")]
cmp_ = cmp_.rename(columns={"Calendar year": "year", "Year level": "level", "Domain": "domain", "State/territory": "state",
                            "Significance of difference": "sig"})[["year", "state", "domain", "level", "sig"]]
cells = cells.merge(cmp_, on=["year", "state", "domain", "level"], how="left")
cells.to_csv(here / "state_cells.csv", index=False)


# ---- remoteness: students tested + % meeting expectations per state x remoteness area
rm = scored[scored.attr == "ABS remoteness"]
out = []
for (yr, st, sub), g in rm.groupby(["year", "state", "sub"]):
    out.append({"year": yr, "state": st, "remoteness": sub, "n": g.n.sum(), "so": wavg(g, "so")})
rem = pd.DataFrame(out).round(3)
rem.to_csv(here / "remoteness.csv", index=False)

# ---- gap_breakdown: compare like with like.
# expected = what a state would score if its students did as well as students in the SAME type of area nationally.
ir = scored[scored.attr == "Indigeneity by ABS remoteness"]
ird = pd.DataFrame([{"year": yr, "state": st, "sub": sub, "n": g.n.sum(), "so": wavg(g, "so")}
                    for (yr, st, sub), g in ir.groupby(["year", "state", "sub"])])
remd = rem.rename(columns={"remoteness": "sub"})


def expected(tab, yr, st):
    nat_t = tab[(tab.year == yr) & (tab.state == AUS)].set_index("sub")
    s = tab[(tab.year == yr) & (tab.state == st)].set_index("sub")
    if s.empty:
        return np.nan
    share = s.n / s.n.sum()
    return float((share * nat_t.loc[share.index, "so"]).sum())


rows, wf = [], []
for yr in sorted(res.year.unique()):
    nat_pub = float(res[(res.year == yr) & (res.state == AUS)].so.iloc[0])
    nat_rebuilt = expected(remd, yr, AUS)
    for st in res.state.unique():
        if st == AUS:
            continue
        rr = res[(res.year == yr) & (res.state == st)].iloc[0]
        if rr.reported == 0:
            continue
        e1, e2 = expected(remd, yr, st), expected(ird, yr, st)
        location = e1 - nat_rebuilt                    # where its students live (type of area)
        indig = e2 - e1                                # extra effect of the Indigenous / non-Indigenous mix
        gap = rr.so - nat_pub
        other = gap - location                         # everything else (also absorbs a ~0.3 pp method difference)
        rows.append({"year": yr, "state": st, "national": nat_pub, "actual": rr.so, "gap": gap,
                     "location": location, "other": other, "indigenous_check": indig})
        steps = [("Australia", nat_pub, nat_pub, nat_pub, "total"),
                 ("Where students live", nat_pub, nat_pub + location, location, "delta"),
                 ("Everything else", nat_pub + location, rr.so, other, "delta"),
                 (st, 0, rr.so, rr.so, "total")]
        for i, (lab, a, b, v, kind) in enumerate(steps):
            wf.append({"year": yr, "state": st, "step": i + 1, "label": lab if i < 3 else "This state",
                       "start": a, "end": b, "value": v, "kind": kind})
gb = pd.DataFrame(rows).round(3)
gb.to_csv(here / "gap_breakdown.csv", index=False)
pd.DataFrame(wf).round(3).to_csv(here / "waterfall.csv", index=False)

# ---------------------------------------------------------------- boundaries
gj = json.load(open(here.parent.parent / "data" / "raw" / "ne_50m_admin_1_states_provinces.geojson"))


def rnd(c, k=3):
    return [rnd(x, k) for x in c] if isinstance(c[0], list) else [round(c[0], k), round(c[1], k)]


feats = []
for f in gj["features"]:
    p = f["properties"]
    if p.get("admin") != "Australia" or p["name"] == "Jervis Bay Territory":
        continue
    feats.append({"type": "Feature", "properties": {"name": p["name"], "code": p["iso_3166_2"].split("-")[1]},
                  "geometry": {"type": f["geometry"]["type"], "coordinates": rnd(f["geometry"]["coordinates"])}})
json.dump({"type": "FeatureCollection", "features": feats}, open(here / "states.geojson", "w"), separators=(",", ":"))
print("states.geojson:", len(feats), "features,", (here / "states.geojson").stat().st_size // 1024, "KB")
print("state_results:", len(res), "| state_cells:", len(cells), "| remoteness:", len(rem), "| gap_breakdown:", len(gb))
