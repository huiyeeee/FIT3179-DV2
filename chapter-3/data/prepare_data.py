"""Builds the small, tidy CSVs used by Chapter 3 from the ACARA NAPLAN results file.
Run:  python prepare_data.py <path-to-ACARA-csv>
Only selects, renames and pivots columns; values are not altered (rounded to 1 d.p.)."""
import sys, pandas as pd

src = sys.argv[1] if len(sys.argv) > 1 else "FIT3179_DV2_Dataset__ACARA__-_NAPLAN_Results__1_.csv"
d = pd.read_csv(src)
d.columns = ["year","level","domain","state","attribute","subgroup","flag","enrolled","part","partn","score","ci","sd",
             "exempt","needs","developing","strong","exceeding","excci","strongPlus","spci","devPlus","dpci"]
d["enrolled"] = pd.to_numeric(d["enrolled"].astype(str).str.replace(",", ""), errors="coerce")
d["strongPlus"] = pd.to_numeric(d["strongPlus"], errors="coerce")
d["domain"] = d["domain"].replace({"Grammar and Punctuation": "Grammar and punctuation"})

LABEL = {
 "Parental education: bachelor": "Bachelor degree or above", "Parental education: diploma": "Diploma",
 "Parental education: certificate": "Certificate (trade / TAFE)", "Parental education: Year 12": "Year 12",
 "Parental education: Year 11": "Year 11 or below",
 "Senior managers and professionals": "Senior managers & professionals",
 "Other managers and associate professionals": "Other managers & associate professionals",
 "Skilled trades, clerical and sales": "Skilled trades, clerical & sales",
 "Unskilled manual, office & sales": "Unskilled manual, office & sales",
 "Not in paid work for 12 months": "Not in paid work (12 months)",
 "Non-LBOTE": "English at home", "LBOTE": "Language other than English at home",
}
ATTR = {"Indigeneity": "Indigenous status", "ABS remoteness": "Remoteness", "Language background": "Language background",
        "Gender": "Gender", "Parental education": "Parental education", "Parental occupation": "Parental occupation", "All": "All"}
d["group"] = d["subgroup"].replace(LABEL)
d["attr"] = d["attribute"].map(ATTR)

# 1. National results by student background (Australia rows only; 'not stated' groups dropped)
n = d[(d.state == "Australia") & d.attribute.isin(ATTR) & ~d.subgroup.str.contains("not stated")].copy()
avg = n[n.attribute == "All"].set_index(["year","level","domain"])["strongPlus"].rename("avg")
n = n.join(avg, on=["year","level","domain"])
n["diff"] = n.strongPlus - n.avg
n = n[["year","level","domain","attr","group","enrolled","score","needs","developing","strong","exceeding","strongPlus","avg","diff"]]
n.round(1).to_csv("equity_national.csv", index=False)
print("diff range (all years):", n[n.attr != "All"]["diff"].agg(["min","max"]).round(1).tolist())

# 2. Indigenous status x remoteness (national)
r = d[(d.state == "Australia") & (d.attribute == "Indigeneity by ABS remoteness")].copy()
r["status"] = r.subgroup.str.extract(r"^(Non-Indigenous|Indigenous)")[0]
r["remoteness"] = r.subgroup.str.replace(r"^(Non-Indigenous|Indigenous) ", "", regex=True).str.capitalize()
r[["year","level","domain","remoteness","status","enrolled","strongPlus"]].round(1).to_csv("equity_remoteness.csv", index=False)

# 3. Gaps (percentage points at 'Strong or above') for four advantage/disadvantage pairs, national
pairs = {"Indigenous status": ("Non-Indigenous", "Indigenous"),
         "Parental education": ("Parental education: bachelor", "Parental education: Year 11"),
         "Parental occupation": ("Senior managers and professionals", "Not in paid work for 12 months"),
         "Remoteness": ("Major cities", "Very remote")}
a = d[d.state == "Australia"]
rows = []
for m, (hi, lo) in pairs.items():
    p = a[a.subgroup.isin([hi, lo])].pivot_table(index=["year","level","domain"], columns="subgroup", values="strongPlus").dropna().reset_index()
    p["measure"] = m; p["advantaged"] = p[hi]; p["disadvantaged"] = p[lo]; p["gap"] = p[hi] - p[lo]
    rows.append(p[["measure","year","level","domain","advantaged","disadvantaged","gap"]])
g = pd.concat(rows)
ok = g.groupby(["measure","level","domain"]).year.transform("nunique") == 4   # comparable across all 4 years
print("dropped incomplete rows:", (~ok).sum())
g[ok].round(1).to_csv("equity_gaps.csv", index=False)

# 4. State results for Indigenous vs non-Indigenous students (tile-grid map)
TILE = {"Western Australia":("WA",0,1),"Northern Territory":("NT",1,0),"South Australia":("SA",1,1),"Queensland":("QLD",2,0),
        "New South Wales":("NSW",2,1),"Australian Capital Territory":("ACT",3,1),"Victoria":("VIC",2,2),"Tasmania":("TAS",2,3)}
s = d[(d.attribute == "Indigeneity") & d.state.isin(TILE)]
p = s.pivot_table(index=["year","level","domain","state"], columns="subgroup", values=["strongPlus","enrolled"], dropna=False)
p.columns = [f"{a}_{b}" for a, b in p.columns]; p = p.reset_index()
p["abbr"] = p.state.map(lambda x: TILE[x][0]); p["col"] = p.state.map(lambda x: TILE[x][1]); p["row"] = p.state.map(lambda x: TILE[x][2])
p = p.rename(columns={"strongPlus_Indigenous":"indig","strongPlus_Non-Indigenous":"non","enrolled_Indigenous":"indigN"})
p["gap"] = p.non - p.indig
p[["year","level","domain","state","abbr","col","row","indig","non","gap","indigN"]].round(1).to_csv("equity_states.csv", index=False)
