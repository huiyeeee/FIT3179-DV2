"""Turn the raw NAPLAN participation export into a tidy file for the waffle chart.

Keeps only the 'All' students rows (no demographic breakdown) for every
state/territory + Australia, and converts '97,455' style strings into numbers.
Run from this folder:  python3 prepare_data.py
"""
from pathlib import Path
import pandas as pd

here = Path(__file__).parent
raw = pd.read_csv(here / "NAPLAN_participation_overall.csv", thousands=",")

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
