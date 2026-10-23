"""Builds the small CSVs used by Chapter 4 (progress over time, 2023-2026) from the ACARA NAPLAN file.
Run:  python prepare_data.py <path-to-ACARA-csv>
Selects, renames, pivots and averages columns; no values are altered."""
import sys, pandas as pd

src = sys.argv[1] if len(sys.argv) > 1 else "FIT3179_DV2_Dataset__ACARA__-_NAPLAN_Results__1_.csv"
d = pd.read_csv(src)
d.columns = ["year","level","domain","state","attribute","subgroup","flag","enrolled","part","partn","score","ci","sd",
             "exempt","needs","developing","strong","exceeding","excci","strongPlus","spci","devPlus","dpci"]
for c in ["score","needs","developing","strong","exceeding","strongPlus"]:
    d[c] = pd.to_numeric(d[c], errors="coerce")
d["domain"] = d["domain"].replace({"Grammar and Punctuation": "Grammar and punctuation"})
DOMS = ["Reading","Writing","Spelling","Grammar and punctuation","Numeracy"]

# 1. Australia, all students: every domain x year level x year
nat = d[(d.state == "Australia") & (d.attribute == "All")]
nat[["year","level","domain","score","needs","developing","strong","exceeding","strongPlus"]].round(1).to_csv("progress_national.csv", index=False)

# 2. Waterfall: how much each domain pushed the national 'Strong or above' average between 2023 and 2026
p = nat.pivot_table(index=["domain","level"], columns="year", values="strongPlus")
chg = (p[2026] - p[2023]).groupby("domain").mean() / len(DOMS)       # each domain's contribution to the 20-cell average
rows, run = [], 0.0
for i, dom in enumerate(DOMS, 1):
    rows.append({"step": dom, "start": run, "end": run + chg[dom], "kind": "up" if chg[dom] >= 0 else "down", "order": i}); run += chg[dom]
rows.append({"step": "Net change", "start": 0, "end": run, "kind": "total", "order": 6})
pd.DataFrame(rows).round(2).to_csv("progress_waterfall.csv", index=False)

# 3. Change in average score since 2023 for the advantaged vs disadvantaged group of each comparison
pairs = {"Parental education": ("Parental education: bachelor", "Parental education: Year 11"),
         "Parental occupation": ("Senior managers and professionals", "Not in paid work for 12 months"),
         "Remoteness": ("Major cities", "Very remote"),
         "Indigenous status": ("Non-Indigenous", "Indigenous")}
a = d[d.state == "Australia"]; out = []
for m, (hi, lo) in pairs.items():
    q = a[a.subgroup.isin([hi, lo])].pivot_table(index=["year","level","domain"], columns="subgroup", values="score").dropna().reset_index()
    q = q[q.groupby(["level","domain"]).year.transform("nunique") == 4]
    base = q[q.year == 2023].set_index(["level","domain"])
    q["adv"] = q[hi] - q.apply(lambda r: base.loc[(r.level, r.domain), hi], axis=1)
    q["dis"] = q[lo] - q.apply(lambda r: base.loc[(r.level, r.domain), lo], axis=1)
    g = q.groupby("year")[["adv","dis"]].mean().reset_index(); g["measure"] = m; out.append(g)
pd.concat(out)[["measure","year","adv","dis"]].round(2).to_csv("progress_score_change.csv", index=False)

# 4. State results (all students) for the tile-grid map
TILE = {"Western Australia":("WA",0,1),"Northern Territory":("NT",1,0),"South Australia":("SA",1,1),"Queensland":("QLD",2,0),
        "New South Wales":("NSW",2,1),"Australian Capital Territory":("ACT",3,1),"Victoria":("VIC",2,2),"Tasmania":("TAS",2,3)}
s = d[(d.attribute == "All") & d.state.isin(TILE)].copy()
full = pd.MultiIndex.from_product([[2023,2024,2025,2026],[3,5,7,9],DOMS,list(TILE)], names=["year","level","domain","state"])
s = s.set_index(["year","level","domain","state"]).reindex(full).reset_index()   # missing (unpublished) rows stay empty
s["abbr"] = s.state.map(lambda x: TILE[x][0]); s["col"] = s.state.map(lambda x: TILE[x][1]); s["row"] = s.state.map(lambda x: TILE[x][2])
s[["year","level","domain","state","abbr","col","row","strongPlus","needs"]].round(1).to_csv("progress_states.csv", index=False)
