"""Generate the Vega-Lite specifications for Chapter 1 as human-readable JSON files in ./specs/.
The page (js/main.js) loads them with vegaEmbed and only sets their named params (year, sel).
Run from this folder:  python3 build_specs.py
"""
import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
OUT = HERE / "specs"
OUT.mkdir(exist_ok=True)

VL = "https://vega.github.io/schema/vega-lite/v5.json"
FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif'
INK, MUTED, GRID = "#14213d", "#4a5568", "#eee8dc"

# the four proficiency levels, from the lowest (left, orange) to the highest (right, blue)
LEVELS = ["Needs additional support", "Developing", "Strong", "Exceeding"]
LCOLORS = ["#c2410c", "#f4a58f", "#7ab3c6", "#0e4a62"]
XDOM = {"expr": "width < 400 ? [-60, 100] : [-100, 100]"}   # full 0 to 100% on each side (a little tighter on phones); same scale in both bar charts

CONFIG = {
    "view": {"stroke": None}, "font": FONT,
    "axis": {"labelFont": FONT, "titleFont": FONT, "labelColor": MUTED, "titleColor": MUTED, "titleFontWeight": 500,
             "titleFontSize": 11, "domain": False, "ticks": False, "gridColor": GRID},
    "legend": {"labelFont": FONT, "titleFont": FONT, "labelColor": MUTED, "titleColor": MUTED, "titleFontSize": 11,
               "titleFontWeight": 600, "labelFontSize": 11},
}


_t = pd.read_csv(HERE / "data" / "outcomes.csv")
NAT = round(float(_t[(_t.year == _t.year.max()) & (_t.domain == "All subjects") & (_t.level == "All years")].so.iloc[0]), 1)   # all students, latest year (65.1)


def dump(name, spec):
    (OUT / f"{name}.json").write_text(json.dumps({"$schema": VL, **spec}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


NUM = ("year", "needs", "developing", "strong", "exceeding", "exempt", "so", "mean", "d39")   # declare numbers: Vega-Lite only auto-parses fields used in encodings


def csv(name, numeric=()):
    fmt = {"type": "csv"}
    if numeric:
        fmt["parse"] = {c: "number" for c in numeric}
    return {"url": f"chapter-1/data/{name}.csv", "format": fmt}


# ---------------------------------------------------------------------------------------------------
# Diverging stacked bar (used twice): the four levels are drawn from an "expectation line" at 0.
# To the right: Strong, then Exceeding (students meeting expectations). To the left: Developing, then Needs additional support.
# ---------------------------------------------------------------------------------------------------
def diverging(ycol, ytitle_axis, extra_transform, extra_layers, data_filter, y_sort, label_expr, height_step=54, top_pad=34, left_pad=4):
    fold = [
        {"calculate": "datum.strong", "as": "s"}, {"calculate": "datum.exceeding", "as": "e"},
        {"calculate": "datum.developing", "as": "d"}, {"calculate": "datum.needs", "as": "n"},
        {"fold": ["needs", "developing", "strong", "exceeding"], "as": ["key", "pct"]},
        {"calculate": "datum.key == 'needs' ? 0 : datum.key == 'developing' ? 1 : datum.key == 'strong' ? 2 : 3", "as": "ord"},
        {"calculate": json.dumps(LEVELS) + "[datum.ord]", "as": "level_name"},
        {"calculate": "datum.key == 'strong' ? 0 : datum.key == 'exceeding' ? datum.s : datum.key == 'developing' ? -datum.d : -(datum.d + datum.n)", "as": "lo"},
        {"calculate": "datum.key == 'strong' ? datum.s : datum.key == 'exceeding' ? datum.s + datum.e : datum.key == 'developing' ? 0 : -datum.d", "as": "hi"},
        {"calculate": "(datum.lo + datum.hi) / 2", "as": "mid"},
        {"calculate": "datum.ord >= 2 ? 'meeting' : 'below'", "as": "side"},
        {"calculate": "datum.ord == 1 || datum.ord == 2 ? '" + INK + "' : '#ffffff'", "as": "ink"},
        {"calculate": "format(datum.pct, '.0f')", "as": "pct_text"},
        {"calculate": "format(datum.pct, '.1f') + '% of students'", "as": "pct_tip"},
    ]
    y = {"field": ycol, "type": "ordinal", "sort": y_sort, "scale": {"padding": 0.28},
         "axis": {"title": ytitle_axis, "titleFontSize": 11, "titleColor": MUTED, "domain": True, "domainColor": "#9aa3b2", "ticks": True, "tickColor": "#9aa3b2", "tickSize": 5,
                  "labelFontSize": 12, "labelFontWeight": 700, "labelColor": INK, "labelPadding": 6, "labelExpr": label_expr, "labelLimit": 120}}
    x = {"type": "quantitative", "scale": {"domain": XDOM, "nice": False},
         "axis": {"title": "% of students", "grid": True, "values": list(range(-100, 101, 25)), "labelExpr": "abs(datum.value) + '%'"}}
    return {
        "width": "container", "height": {"step": height_step},
        "padding": {"left": left_pad, "right": 8, "top": top_pad, "bottom": 4},
        "background": None, "config": CONFIG,
        "data": csv("outcomes", NUM),
        "transform": data_filter + extra_transform + fold,
        "layer": [
            {"mark": {"type": "bar", "stroke": "#ffffff", "strokeWidth": 1.5, "tooltip": True},
             "encoding": {
                 "y": y, "x": {"field": "lo", **x}, "x2": {"field": "hi"},
                 "color": {"field": "level_name", "type": "nominal",
                           "scale": {"domain": LEVELS, "range": LCOLORS},
                           "legend": None},
                 "tooltip": [{"field": ycol, "title": ytitle_axis}, {"field": "level_name", "title": "Level"}, {"field": "pct_tip", "title": "Share"}]}},
            # numbers inside the segments (hidden when the segment is too narrow)
            {"transform": [{"filter": "datum.pct >= (width < 400 ? 11 : 5)"}],
             "mark": {"type": "text", "fontSize": 11, "fontWeight": 600},
             "encoding": {"y": y, "x": {"field": "mid", "type": "quantitative", "scale": {"domain": XDOM, "nice": False}},
                          "text": {"field": "pct_text"}, "color": {"field": "ink", "type": "nominal", "scale": None, "legend": None}}},
            # end labels: share meeting expectations (right) and share below (left)
            {"transform": [{"filter": "datum.key == 'exceeding'"}, {"calculate": "format(datum.s + datum.e, '.0f') + '%'", "as": "t"}],
             "mark": {"type": "text", "align": "left", "dx": 7, "fontSize": 13, "fontWeight": 800, "color": "#0e4a62"},
             "encoding": {"y": y, "x": {"field": "hi", "type": "quantitative", "scale": {"domain": XDOM, "nice": False}}, "text": {"field": "t"}}},
            {"transform": [{"filter": "datum.key == 'needs'"}, {"calculate": "format(datum.d + datum.n, '.0f') + '%'", "as": "t"}],
             "mark": {"type": "text", "align": "right", "dx": -7, "fontSize": 12, "fontWeight": 700, "color": "#c2410c", "opacity": {"expr": "width < 400 ? 0 : 1"}},
             "encoding": {"y": y, "x": {"field": "lo", "type": "quantitative", "scale": {"domain": XDOM, "nice": False}}, "text": {"field": "t"}}},
            # the expectation line and the two side headings
            {"data": {"values": [{"x": 0}]}, "mark": {"type": "rule", "color": INK, "strokeWidth": 2.5},
             "encoding": {"x": {"field": "x", "type": "quantitative", "scale": {"domain": XDOM, "nice": False}}}},
            {"data": {"values": [{"x": 0}]}, "transform": [{"calculate": "width < 400 ? '◀ Below' : '◀ Below the expected level'", "as": "t"}],
             "mark": {"type": "text", "align": "right", "baseline": "bottom", "dx": -6, "dy": -4, "fontSize": 11, "fontWeight": 700, "color": "#c2410c"},
             "encoding": {"x": {"field": "x", "type": "quantitative", "scale": {"domain": XDOM, "nice": False}}, "y": {"value": 0}, "text": {"field": "t"}}},
            {"data": {"values": [{"x": 0}]}, "transform": [{"calculate": "width < 400 ? 'Meeting ▶' : 'Meeting expectations ▶'", "as": "t"}],
             "mark": {"type": "text", "align": "left", "baseline": "bottom", "dx": 6, "dy": -4, "fontSize": 11, "fontWeight": 700, "color": "#0e4a62"},
             "encoding": {"x": {"field": "x", "type": "quantitative", "scale": {"domain": XDOM, "nice": False}}, "y": {"value": 0}, "text": {"field": "t"}}},
            *extra_layers,
        ],
    }


# =====================================================================================================
# 1. Headline: all subjects and year levels combined, 2023 to 2026.   idiom: diverging stacked bar
# =====================================================================================================
hero = diverging(
    "yr", "Year", [], [],
    left_pad=44,
    data_filter=[{"filter": "datum.domain == 'All subjects' && datum.level == 'All years'"}, {"calculate": "toString(datum.year)", "as": "yr"}],
    y_sort="ascending",
    label_expr="datum.value == '2023' ? ['2023', 'new scale'] : datum.value",
)
hero["description"] = ("Diverging stacked bar of the four NAPLAN proficiency levels for all students, subjects and year levels combined, 2023 to 2026. "
                       "The bars are drawn from the expectation line: Strong and Exceeding to the right, Developing and Needs additional support to the left.")
dump("hero_levels_by_year", hero)

# =====================================================================================================
# 2. Heatmap: share meeting expectations for every subject x year level (latest year), with an overall row/column and the change from Year 3 to 9.
#    idiom: heatmap with marginals; colour = diverging around the national share; click a cell to pick the subject for the zoom chart.
# =====================================================================================================
COLS_ = ["Year 3", "Year 5", "Year 7", "Year 9", "All years", "Change"]
ROWS_ = ["All subjects", "Spelling", "Numeracy", "Reading", "Writing", "Grammar & punctuation"]
XH = {"field": "level", "type": "ordinal", "scale": {"domain": COLS_, "paddingInner": 0.07, "paddingOuter": 0},
      "axis": {"orient": "top", "title": None, "labelAngle": 0, "labelFontSize": 11, "labelFontWeight": 700, "labelColor": INK, "labelPadding": 6,
               "labelExpr": "datum.value == 'Change' ? (width < 250 ? '3→9' : 'Year 3 → 9') : datum.value == 'All years' ? 'All' : (width < 250 ? replace(datum.value, 'Year ', 'Y') : datum.value)"}}
YH = {"field": "domain", "type": "ordinal", "scale": {"domain": ROWS_, "paddingInner": 0.07, "paddingOuter": 0},
      "axis": {"title": None, "labelFontSize": {"expr": "width < 250 ? 10 : 12"}, "labelFontWeight": 700, "labelColor": INK, "labelLimit": 150, "labelPadding": 6,
              "labelExpr": "datum.value == 'Grammar & punctuation' && width < 250 ? ['Grammar &', 'punctuation'] : datum.value"}}
HF = [{"filter": "datum.year == year"}]
dump("heatmap_subject_year_level", {
    "description": "Heatmap of the share of students meeting expectations (Strong or Exceeding) for each subject and year level in the latest year. "
                   "The last two columns show all year levels combined and the change from Year 3 to Year 9. The param 'sel' outlines the chosen subject.",
    "width": "container", "height": {"step": 36},
    "padding": {"left": 2, "right": 4, "top": 4, "bottom": 2},
    "background": None, "config": CONFIG,
    "params": [{"name": "year", "value": 2026}, {"name": "sel", "value": "All subjects"}],
    "data": csv("outcomes", NUM),
    "layer": [
        {"transform": HF + [{"filter": "datum.level != 'Change'"},
                            {"calculate": "format(datum.so, '.0f') + '% meet expectations: ' + (abs(datum.so - " + str(NAT) + ") < 0.5 ? 'the same as all students' : format(abs(datum.so - " + str(NAT) + "), '.0f') + ' points ' + (datum.so > " + str(NAT) + " ? 'above' : 'below') + ' all students (65%)')", "as": "tip"}],
         "mark": {"type": "rect", "cornerRadius": 4, "cursor": "pointer", "tooltip": True},
         "encoding": {
             "x": XH, "y": YH,
             "fill": {"field": "so", "type": "quantitative",
                       "scale": {"domain": [NAT - 15, NAT, NAT + 15], "range": ["#d96648", "#f4efe6", "#1f6f8b"], "clamp": True},
                       "legend": {"title": {"expr": "width < 250 ? \"Vs all students\" : \"Compared with all students\""}, "orient": "bottom", "direction": "horizontal", "gradientLength": {"expr": "min(240, width + 20)"},
                                  "gradientThickness": 10, "values": [50, 65, 80], "offset": 10, "titleLimit": 300,
                                  "labelExpr": "datum.value == 50 ? (width < 250 ? '≤50%' : '50% or less') : datum.value == 65 ? (width < 250 ? '65%' : 'All students: 65%') : (width < 250 ? '≥80%' : '80% or more')"}},
             "stroke": {"condition": {"test": "datum.domain == sel", "value": INK}, "value": "#ffffff"},
             "strokeWidth": {"condition": {"test": "datum.domain == sel", "value": 3}, "value": 0},
             "tooltip": [{"field": "domain", "title": "Subject"}, {"field": "level", "title": "Year level"}, {"field": "tip", "title": "Result"}]}},
        {"transform": HF + [{"filter": "datum.level != 'Change'"}, {"calculate": "format(datum.so, '.0f') + (width < 250 ? '' : '%')", "as": "t"},
                            {"calculate": "abs(datum.so - " + str(NAT) + ") > 8 ? '#ffffff' : '" + INK + "'", "as": "ink"}],
         "mark": {"type": "text", "fontSize": {"expr": "width < 250 ? 10 : 13"}, "fontWeight": 700},
         "encoding": {"x": XH, "y": YH, "text": {"field": "t"}, "color": {"field": "ink", "type": "nominal", "scale": None, "legend": None}}},
        # last column: how much the share changes between Year 3 and Year 9
        {"transform": HF + [{"filter": "datum.level == 'All years'"},
                            {"calculate": "abs(datum.d39) < 1.5 ? '→ 0' : datum.d39 > 0 ? '↑ ' + format(datum.d39, '.0f') : '↓ ' + format(-datum.d39, '.0f')", "as": "t"},
                            {"calculate": "abs(datum.d39) < 1.5 ? '" + MUTED + "' : datum.d39 > 0 ? '#1f6f8b' : '#c2410c'", "as": "ink"},
                            {"calculate": "'Year 3 to Year 9: ' + (datum.d39 > 0 ? '+' : '') + format(datum.d39, '.0f') + ' percentage points'", "as": "tip"},
                            {"calculate": "'Change'", "as": "level"}],
         "mark": {"type": "text", "fontSize": {"expr": "width < 250 ? 11 : 14"}, "fontWeight": 800, "tooltip": True},
         "encoding": {"x": XH, "y": YH,
                      "text": {"field": "t"}, "color": {"field": "ink", "type": "nominal", "scale": None, "legend": None},
                      "tooltip": [{"field": "domain", "title": "Subject"}, {"field": "tip", "title": "Change"}]}},
    ],
})

# =====================================================================================================
# 3. Zoom: one subject, Year 3 to Year 9.   idiom: diverging stacked bar (same as the headline), plus a line for all subjects combined
# =====================================================================================================
zoom = diverging(
    "level", "Year level", [],
    [{"data": csv("outcomes", NUM),
      "transform": [{"filter": "datum.year == year && datum.domain == 'All subjects' && datum.level == 'All years'"}],
      "mark": {"type": "rule", "color": INK, "strokeDash": [4, 3], "strokeWidth": 1.5, "opacity": 0.7},
      "encoding": {"x": {"field": "so", "type": "quantitative", "scale": {"domain": XDOM, "nice": False}}}},
     {"data": csv("outcomes", NUM),
      "transform": [{"filter": "datum.year == year && datum.domain == 'All subjects' && datum.level == 'All years'"},
                    {"calculate": "(width < 400 ? 'All ' : 'All subjects: ') + format(datum.so, '.0f') + '%'", "as": "t"}],
      "mark": {"type": "text", "align": "center", "baseline": "top", "dx": 0, "dy": 2, "fontSize": 10, "fontWeight": 700, "color": INK},
      "encoding": {"x": {"field": "so", "type": "quantitative", "scale": {"domain": XDOM, "nice": False}}, "y": {"value": 0}, "text": {"field": "t"}}}],
    data_filter=[{"filter": "datum.year == year && datum.domain == sel && datum.level != 'All years'"}],
    y_sort=["Year 3", "Year 5", "Year 7", "Year 9"],
    label_expr="datum.value",
    height_step=58,
)
zoom["params"] = [{"name": "year", "value": 2026}, {"name": "sel", "value": "Writing"}]
zoom["description"] = ("Diverging stacked bar of the four proficiency levels for one subject (param 'sel') at Years 3, 5, 7 and 9 in the latest year. "
                       "The dashed line marks the share meeting expectations across all subjects.")
dump("zoom_subject_by_year_level", zoom)

# =====================================================================================================
# 3b. Same students, two years apart.   idiom: dumbbell (hollow dot = two years earlier, filled dot = latest year)
# Rows match the zoom chart above (same row height, same padding) so each year level lines up across the two panels.
# =====================================================================================================
CX = {"type": "quantitative", "scale": {"domain": {"expr": "[0, 100]"}, "nice": False}}
CY = {"field": "level", "type": "ordinal", "sort": ["Year 3", "Year 5", "Year 7", "Year 9"], "scale": {"padding": 0.28},
      "axis": {"title": "Year level now", "titleFontSize": 11, "titleColor": MUTED, "domain": True, "domainColor": "#9aa3b2", "ticks": True,
               "tickColor": "#9aa3b2", "tickSize": 5, "labelFontSize": 12, "labelFontWeight": 700, "labelColor": INK, "labelPadding": 6,
               "labelExpr": "datum.value == 'Year 3' ? ['Year 3', 'first test'] : [datum.value, 'from Year ' + (toNumber(slice(datum.value, 5)) - 2)]",
               "labelLimit": 120}}
DIR = {"field": "dir", "type": "nominal", "scale": {"domain": ["Share rose", "Share fell", "First test"], "range": ["#1f6f8b", "#c2410c", "#4a5568"]}, "legend": None}
cohort = {
    "width": "container", "height": {"step": 58},
    "padding": {"left": 4, "right": 8, "top": 34, "bottom": 4},
    "background": None, "config": CONFIG,
    "params": [{"name": "year", "value": 2026}, {"name": "sel", "value": "Writing"}],
    "data": csv("cohort", ("year", "so_start", "so_end")),
    "transform": [
        {"filter": "datum.year == year && datum.domain == sel"},
        {"calculate": "isValid(datum.so_start) ? (datum.so_end >= datum.so_start ? 'Share rose' : 'Share fell') : 'First test'", "as": "dir"},
        {"calculate": "isValid(datum.so_start) ? min(datum.so_start, datum.so_end) : datum.so_end", "as": "lo"},
        {"calculate": "isValid(datum.so_start) ? max(datum.so_start, datum.so_end) : datum.so_end", "as": "hi"},
        {"calculate": "format(datum.lo, '.0f') + '%'", "as": "lo_t"}, {"calculate": "format(datum.hi, '.0f') + '%'", "as": "hi_t"},
        {"calculate": "datum.level + ' students, ' + year + ': ' + format(datum.so_end, '.1f') + '% meet expectations'", "as": "tip_now"},
        {"calculate": "isValid(datum.so_start) ? 'Same students in ' + (year - 2) + ' (' + datum.from_level + '): ' + format(datum.so_start, '.1f') + '%' : 'No earlier test for this group'", "as": "tip_before"},
    ],
    "layer": [
        {"data": csv("outcomes", NUM),
         "transform": [{"filter": "datum.year == year && datum.domain == 'All subjects' && datum.level == 'All years'"}],
         "mark": {"type": "rule", "color": INK, "strokeDash": [4, 3], "strokeWidth": 1.5, "opacity": 0.7},
         "encoding": {"x": {"field": "so", **CX}}},
        {"data": csv("outcomes", NUM),
         "transform": [{"filter": "datum.year == year && datum.domain == 'All subjects' && datum.level == 'All years'"},
                       {"calculate": "(width < 400 ? 'All ' : 'All subjects: ') + format(datum.so, '.0f') + '%'", "as": "t"}],
         "mark": {"type": "text", "align": "center", "baseline": "bottom", "dy": -4, "fontSize": 10, "fontWeight": 700, "color": INK},
         "encoding": {"x": {"field": "so", **CX}, "y": {"value": 0}, "text": {"field": "t"}}},
        {"transform": [{"filter": "isValid(datum.so_start)"}],
         "mark": {"type": "rule", "strokeWidth": 5, "strokeCap": "round", "opacity": 0.45},
         "encoding": {"y": CY, "x": {"field": "lo", **CX}, "x2": {"field": "hi"}, "color": DIR}},
        {"transform": [{"filter": "isValid(datum.so_start)"}],
         "mark": {"type": "point", "filled": True, "fill": "#ffffff", "size": 120, "strokeWidth": 2.5, "opacity": 1, "tooltip": True},
         "encoding": {"y": CY, "x": {"field": "so_start", **CX}, "stroke": DIR,
                      "tooltip": [{"field": "tip_before", "title": "Two years earlier"}, {"field": "tip_now", "title": "Now"}]}},
        {"mark": {"type": "point", "filled": True, "size": 130, "strokeWidth": 0, "opacity": 1, "tooltip": True},
         "encoding": {"y": CY, "x": {"field": "so_end", **CX}, "color": DIR,
                      "tooltip": [{"field": "tip_before", "title": "Two years earlier"}, {"field": "tip_now", "title": "Now"}]}},
        {"transform": [{"filter": "isValid(datum.so_start)"}],
         "mark": {"type": "text", "align": "right", "dx": -11, "fontSize": 12, "fontWeight": 700},
         "encoding": {"y": CY, "x": {"field": "lo", **CX}, "text": {"field": "lo_t"}, "color": DIR}},
        {"mark": {"type": "text", "align": "left", "dx": 11, "fontSize": 12, "fontWeight": 700},
         "encoding": {"y": CY, "x": {"field": "hi", **CX}, "text": {"field": "hi_t"}, "color": DIR}},
    ],
    "description": ("Dumbbell chart. For each year level in the latest year, a hollow dot shows the share meeting expectations among the same students "
                    "two years earlier and a filled dot shows the latest share. Teal means the share rose, orange that it fell."),
}
cohort["config"] = {**CONFIG, "axis": {**CONFIG["axis"]}}
cohort["layer"][2]["encoding"]["x"]["axis"] = {"title": "% of students meeting expectations", "grid": True, "values": [0, 25, 50, 75, 100], "labelExpr": "datum.value + '%'"}
dump("cohort_same_students", cohort)
SUBJ = ["Writing", "Spelling", "Reading", "Numeracy", "Grammar & punctuation"]
SCOL = ["#c2410c", "#1f6f8b", "#7b5ea7", "#b8860b", "#4b5563"]
ax = {"field": "level", "type": "ordinal", "scale": {"domain": ["Year 3", "Year 5", "Year 7", "Year 9"], "padding": 0.35},
      "axis": {"title": "Year level", "labelAngle": 0, "labelFontWeight": 700, "labelColor": INK, "labelFontSize": 12, "domain": True, "domainColor": "#9aa3b2", "ticks": True, "tickColor": "#9aa3b2"}}
ay = {"field": "mean", "type": "quantitative", "scale": {"domain": [0, 600], "nice": False},     # starts at 0: no truncated axis
      "axis": {"title": "Average NAPLAN score", "grid": True, "values": list(range(0, 601, 100)), "domain": True, "domainColor": "#9aa3b2", "ticks": True, "tickColor": "#9aa3b2"}}
acol = {"field": "domain", "type": "nominal", "scale": {"domain": SUBJ, "range": SCOL}, "legend": None}
ALL = "focus == 'All subjects'"
dump("scores_by_year_level", {
    "description": "Line chart of the average NAPLAN score at Years 3, 5, 7 and 9 in the latest year, one line per subject. "
                   "The param 'focus' is either 'All subjects' (five lines) or one subject (one line, with labels). The y-axis starts at 0.",
    "width": "container", "height": 190,
    "padding": {"left": 4, "right": 12, "top": 16, "bottom": 4},
    "background": None, "config": CONFIG,
    "params": [{"name": "year", "value": 2026}, {"name": "focus", "value": "All subjects"}],
    "data": csv("outcomes", NUM),
    "transform": [{"filter": "datum.year == year && datum.domain != 'All subjects' && datum.level != 'All years'"},
                  {"filter": ALL + " || datum.domain == focus"},
                  {"window": [{"op": "lag", "field": "mean", "as": "prev"}], "groupby": ["domain"], "sort": [{"field": "level"}]},
                  {"calculate": "isValid(datum.prev) ? '+' + format(datum.mean - datum.prev, '.0f') : ''", "as": "gain"},
                  {"calculate": "format(datum.mean, '.0f')", "as": "score"}],
    "layer": [
        {"mark": {"type": "line", "strokeWidth": {"expr": ALL + " ? 2.5 : 3.5"}, "opacity": 0.95},
         "encoding": {"x": ax, "y": ay, "color": acol, "detail": {"field": "domain"}}},
        {"mark": {"type": "point", "filled": True, "size": {"expr": ALL + " ? 40 : 90"}, "tooltip": True, "opacity": 1},
         "encoding": {"x": ax, "y": ay, "color": acol,
                      "tooltip": [{"field": "domain", "title": "Subject"}, {"field": "level", "title": "Year level"}, {"field": "score", "title": "Average score"}]}},
        {"mark": {"type": "text", "dy": -14, "fontSize": 13, "fontWeight": 800, "color": INK, "opacity": {"expr": ALL + " ? 0 : 1"}},
         "encoding": {"x": ax, "y": ay, "text": {"field": "score"}}},
        {"mark": {"type": "text", "dy": 20, "fontSize": 12, "fontWeight": 700, "color": "#c2410c", "opacity": {"expr": ALL + " ? 0 : 1"}},
         "encoding": {"x": ax, "y": ay, "text": {"field": "gain"}}},
    ],
})
print("wrote:", ", ".join(sorted(p.name for p in OUT.glob("*.json"))))
