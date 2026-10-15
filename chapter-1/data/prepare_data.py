"""Tidy ACARA NAPLAN results for Chapter 1 (overall performance).

Keeps the 'All' students rows (no demographic breakdown) for every
state/territory + Australia, drops rows with no published score (e.g.
Tasmania 2026), and renames columns. Run from this folder:  python3 prepare_data.py
"""
from pathlib import Path
import pandas as pd

here = Path(__file__).parent
raw = pd.read_csv(here.parent.parent / "data" / "raw" / "NAPLAN_results_raw.csv", thousands=",")
raw.columns = ["year", "year_level", "domain", "state", "attribute", "subgroup", "flag", "enrolled",
               "participation_pct", "participants", "mean_score", "mean_ci", "sd", "exempt_pct",
               "needs_support_pct", "developing_pct", "strong_pct", "exceeding_pct", "exceeding_ci",
               "strong_or_above_pct", "strong_or_above_ci", "developing_or_above_pct", "developing_or_above_ci"]

tidy = raw[(raw["attribute"] == "All") & raw["mean_score"].notna()].copy()
keep = ["year", "year_level", "domain", "state", "participants", "mean_score", "sd", "exempt_pct",
        "needs_support_pct", "developing_pct", "strong_pct", "exceeding_pct",
        "strong_or_above_pct", "developing_or_above_pct"]
tidy = tidy[keep].sort_values(["year", "state", "domain", "year_level"]).round(3)
tidy.to_csv(here / "performance_all.csv", index=False)
print(f"wrote {len(tidy)} rows;", tidy.state.nunique(), "jurisdictions;", sorted(tidy.year.unique()))
