"""Turn the raw NAPLAN participation export into a tidy file for the waffle chart.

Keeps only the 'All' students rows (no demographic breakdown) for every
state/territory + Australia, and converts '97,455' style strings into numbers.
Run from this folder:  python3 prepare_data.py
"""
from pathlib import Path
import pandas as pd

here = Path(__file__).parent
raw = pd.read_csv(here.parent.parent / "data" / "raw" / "NAPLAN_participation_raw.csv", thousands=",")

tidy = (
    raw[raw["Student attribute"] == "All"]
    .rename(columns={
        "Calendar year": "year",
        "Year level": "year_level",
        "Domain": "domain",
        "State/territory": "state",
        "Enrolled students": "enrolled",
        "Participation (Num)": "participated",
        "Participation (%)": "participation_pct",
    })[["year", "year_level", "domain", "state", "enrolled", "participated", "participation_pct"]]
    .sort_values(["year", "year_level", "domain", "state"])
)
tidy.to_csv(here / "participation_all.csv", index=False)
print(f"wrote {len(tidy)} rows")

# ---------------------------------------------------------------------------
# Student-background rows (everything that is not "All"), for the background chart.
# Rows with 0 enrolled students (a group that doesn't exist in that state, e.g.
# "Very remote" in Victoria) carry no information and are dropped.
# ---------------------------------------------------------------------------
groups = (
    raw[(raw["Student attribute"] != "All") & (raw["Enrolled students"] > 0)]
    .rename(columns={
        "Calendar year": "year",
        "Year level": "year_level",
        "Domain": "domain",
        "State/territory": "state",
        "Student attribute": "attribute",
        "Subgroup": "subgroup",
        "Enrolled students": "enrolled",
        "Participation (Num)": "participated",
    })[["year", "year_level", "domain", "state", "attribute", "subgroup", "enrolled", "participated"]]
    .sort_values(["year", "state", "attribute", "subgroup", "year_level", "domain"])
)
groups["participated"] = groups["participated"].astype(int)
groups.to_csv(here / "participation_by_group.csv", index=False)
print(f"wrote {len(groups)} background rows")
