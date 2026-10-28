"""Generate the Vega-Lite specifications for Chapter 3 (student background) as JSON files in ./specs/.

The page (js/main.js) loads these files as they are with vegaEmbed and only sets their named params
(sel, groups, factor) from the page controls, so the JSON is the complete description of each chart.
Run from this folder:  python3 build_specs.py   (after data/prepare_data.py)
"""
import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
OUT = HERE / "specs"
OUT.mkdir(exist_ok=True)
DATA = "chapter-3/data/"

VL = "https://vega.github.io/schema/vega-lite/v5.json"
FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif'
INK, MUTED, GRID = "#14213d", "#4a5568", "#eee8dc"
TEAL, CORAL, LINE = "#1f6f8b", "#f0745a", "#d5dbe5"
DEEP_CORAL = "#c2410c"
LEVEL_GREYS = ["#cbd5e1", "#94a3b8", "#556987", "#1e2f4d"]   # Year 3, 5, 7, 9 (same as Chapter 2)
CONFIG = {
    "view": {"stroke": None}, "font": FONT,
    "axis": {"labelFont": FONT, "titleFont": FONT, "labelColor": MUTED, "titleColor": MUTED, "titleFontWeight": 500, "titleFontSize": 11,
             "domain": False, "ticks": False, "gridColor": GRID},
}


def dump(name, spec):
    (OUT / f"{name}.json").write_text(json.dumps({"$schema": VL, **spec}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def csvn(name, numeric):
    return {"url": f"{DATA}{name}.csv", "format": {"type": "csv", "parse": {c: "number" for c in numeric}}}


PCT = {"labelExpr": "datum.value + '%'"}


def yidx(rows, step_domain=None, labels_phone=None):
    """Quantitative row index (0..n-1, top to bottom) whose tick labels are the row names."""
    n = len(rows)
    axis = {"title": None, "values": list(range(n)), "grid": False, "labelFontSize": 12, "labelFontWeight": 600, "labelColor": INK,
            "labelPadding": 8, "labelLimit": 130, "labelExpr": json.dumps(rows, ensure_ascii=False) + "[datum.value]"}
    if labels_phone:
        axis["labelExpr"] = "width < 600 ? " + json.dumps(labels_phone, ensure_ascii=False) + "[datum.value] : " + axis["labelExpr"]
    return {"scale": {"domain": [-0.5, n - 0.5], "reverse": True, "nice": False}, "type": "quantitative", "axis": axis}


# =====================================================================================================
# 1. Who is behind?  Dumbbell: the higher- and lower-scoring group of each background factor
#    marks: rule + circles + text; channels: x = % meeting expectations, y = factor (sorted by gap), colour = group
# =====================================================================================================
fac = pd.read_csv(HERE / "data" / "factors.csv").sort_values("gap", ascending=False).reset_index(drop=True)
FACTOR_ORDER = fac.factor.tolist()
LABELS = fac.label.tolist()
NF = len(fac)
XP = {"type": "quantitative", "scale": {"domain": [0, 100], "nice": False}}
FNUM = ("so_low", "so_high", "gap", "gap_2023", "share_low", "share_high", "rank")
RANK = {"calculate": "indexof(" + json.dumps(FACTOR_ORDER) + ", datum.factor)", "as": "row"}
Y1 = {"field": "row", **yidx(LABELS)}
FMT_SHARE = "datum.share_low < 1 ? format(datum.share_low, '.1f') + '%' : format(datum.share_low, '.0f') + '%'"

dump("gap_overview", {
    "description": "Dumbbell chart. For each background factor, the share of students meeting expectations in the lower-scoring group (coral) "
                   "and the higher-scoring group (teal), 2026, sorted by the size of the gap. Optional grey dots show the groups in between.",
    "width": "container", "height": 6 * 62, "padding": {"left": 4, "right": 8, "top": 34, "bottom": 4}, "background": None, "config": CONFIG,
    "params": [{"name": "groups", "value": False}],
    "layer": [
        {   # the bar between the two groups
            "data": csvn("factors", FNUM), "transform": [RANK],
            "mark": {"type": "rule", "strokeWidth": 7, "strokeCap": "round", "color": LINE},
            "encoding": {"x": {"field": "so_low", **XP, "axis": {"title": "Students meeting expectations (%)", "grid": True, "values": [0, 25, 50, 75, 100], **PCT}},
                         "x2": {"field": "so_high"}, "y": Y1}},
        {   # groups in between (optional)
            "data": csvn("groups_all", ("so", "share", "order")),
            "transform": [{"joinaggregate": [{"op": "max", "field": "order", "as": "omax"}], "groupby": ["factor"]},
                          {"filter": "groups && datum.order > 0 && datum.order < datum.omax"}, RANK],
            "mark": {"type": "circle", "size": 70, "color": "#8a96b0", "opacity": 0.9, "stroke": "#fff", "strokeWidth": 1},
            "encoding": {"x": {"field": "so", **XP}, "y": Y1,
                         "tooltip": [{"field": "label", "title": "Factor"}, {"field": "group", "title": "Group"},
                                     {"field": "so", "title": "% meeting expectations", "format": ".1f"},
                                     {"field": "share", "title": "% of all students", "format": ".1f"}]}},
        {   # lower-scoring group
            "data": csvn("factors", FNUM), "transform": [RANK],
            "mark": {"type": "circle", "size": 190, "color": CORAL, "stroke": "#fff", "strokeWidth": 1.5, "cursor": "pointer", "tooltip": True},
            "encoding": {"x": {"field": "so_low", **XP}, "y": Y1,
                         "tooltip": [{"field": "label", "title": "Factor"}, {"field": "low", "title": "Lower group"},
                                     {"field": "so_low", "title": "% meeting expectations", "format": ".1f"},
                                     {"field": "gap", "title": "Gap (points)", "format": ".1f"},
                                     {"field": "share_low", "title": "% of all students in this group", "format": ".1f"}]}},
        {   # higher-scoring group
            "data": csvn("factors", FNUM), "transform": [RANK],
            "mark": {"type": "circle", "size": 190, "color": TEAL, "stroke": "#fff", "strokeWidth": 1.5, "cursor": "pointer", "tooltip": True},
            "encoding": {"x": {"field": "so_high", **XP}, "y": Y1,
                         "tooltip": [{"field": "label", "title": "Factor"}, {"field": "high", "title": "Higher group"},
                                     {"field": "so_high", "title": "% meeting expectations", "format": ".1f"},
                                     {"field": "gap", "title": "Gap (points)", "format": ".1f"},
                                     {"field": "share_high", "title": "% of all students in this group", "format": ".1f"}]}},
        # values above the dots
        {"data": csvn("factors", FNUM), "transform": [RANK],
         "mark": {"type": "text", "dy": -16, "fontSize": 11.5, "fontWeight": 700, "color": DEEP_CORAL},
         "encoding": {"x": {"field": "so_low", **XP}, "y": Y1, "text": {"field": "so_low", "type": "quantitative", "format": ".0f"}}},
        {"data": csvn("factors", FNUM), "transform": [RANK],
         "mark": {"type": "text", "dy": -16, "fontSize": 11.5, "fontWeight": 700, "color": TEAL},
         "encoding": {"x": {"field": "so_high", **XP}, "y": Y1, "text": {"field": "so_high", "type": "quantitative", "format": ".0f"}}},
        # group names below the dots (written outwards so close dots do not collide)
        {"data": csvn("factors", FNUM), "transform": [RANK],
         "mark": {"type": "text", "align": "right", "dx": 7, "dy": 17, "fontSize": 11, "color": MUTED},
         "encoding": {"x": {"field": "so_low", **XP}, "y": Y1, "text": {"field": "low"}}},
        {"data": csvn("factors", FNUM), "transform": [RANK],
         "mark": {"type": "text", "align": "left", "dx": -7, "dy": 17, "fontSize": 11, "color": MUTED},
         "encoding": {"x": {"field": "so_high", **XP}, "y": Y1, "text": {"field": "high"}}},
        # right-hand columns
        {"data": {"values": [{"t": "Gap"}]}, "mark": {"type": "text", "align": "left", "baseline": "bottom", "dx": 14, "dy": -5, "fontSize": 10.5, "fontWeight": 700, "color": MUTED},
         "encoding": {"x": {"datum": 100, **XP}, "y": {"value": 0}, "text": {"field": "t"}}},
        {"data": {"values": [{"t": "Students in lower group"}]}, "mark": {"type": "text", "align": "left", "baseline": "bottom", "dx": 64, "dy": -5, "fontSize": 10.5, "fontWeight": 700, "color": MUTED},
         "encoding": {"x": {"datum": 100, **XP}, "y": {"value": 0}, "text": {"field": "t"}}},
        {"data": csvn("factors", FNUM), "transform": [RANK, {"calculate": "round(datum.gap) + ' pts'", "as": "g"}],
         "mark": {"type": "text", "align": "left", "baseline": "middle", "dx": 14, "fontSize": 12.5, "fontWeight": 700, "color": INK},
         "encoding": {"x": {"datum": 100, **XP}, "y": Y1, "text": {"field": "g"}}},
        {"data": csvn("factors", FNUM), "transform": [RANK, {"calculate": FMT_SHARE, "as": "s"}],
         "mark": {"type": "text", "align": "left", "baseline": "middle", "dx": 64, "fontSize": 12.5, "fontWeight": 600, "color": INK},
         "encoding": {"x": {"datum": 100, **XP}, "y": Y1, "text": {"field": "s"}}},
        # in-diagram notes where the rows are short of context
        {"data": {"values": [{"factor": "lang", "t": "LBOTE: a language other than\nEnglish is spoken at home."},
                             {"factor": "sex", "t": "Girls lead in reading and writing,\nboys in numeracy (see below)."}]},
         "transform": [RANK],
         "mark": {"type": "text", "align": "left", "baseline": "middle", "dx": 6, "fontSize": 11, "fontStyle": "italic", "lineBreak": "\n", "lineHeight": 13, "color": MUTED},
         "encoding": {"x": {"datum": 0, **XP}, "y": Y1, "text": {"field": "t"}}},
    ],
})

# =====================================================================================================
# 3. Who is ahead?  Strip plot of girls-boys and LBOTE-non-LBOTE differences by subject and year level
#    marks: circle (filled / hollow) + rect zones + text; channels: x = difference, y = subject (+ year-level offset), colour = year level
# =====================================================================================================
DOMAINS = ["Reading", "Writing", "Spelling", "Grammar and Punctuation", "Numeracy"]
XD = {"type": "quantitative", "scale": {"domain": [-10, 20], "nice": False}}
GCALC = [{"calculate": "indexof(" + json.dumps(DOMAINS) + ", datum.domain) + (indexof([3, 5, 7, 9], datum.level) - 1.5) * 0.2", "as": "y"}]
YD = {"type": "quantitative", "scale": {"domain": [-0.5, 4.5], "reverse": True, "nice": False}}
YD_AXIS = {"title": None, "values": [0, 1, 2, 3, 4], "grid": False, "labelFontSize": 12, "labelFontWeight": 600, "labelColor": INK, "labelPadding": 8,
           "labelExpr": "width < 600 ? ['Reading','Writing','Spelling','Grammar','Numeracy'][datum.value] : ['Reading','Writing','Spelling','Grammar and punctuation','Numeracy'][datum.value]"}
GF = {"filter": "datum.factor == factor"}
gd = lambda: csvn("gap_domain_level", ("level", "diff", "ci", "sig"))
LV = {"field": "level", "type": "ordinal", "scale": {"domain": [3, 5, 7, 9], "range": LEVEL_GREYS}, "legend": None}
TIP = [{"field": "domain", "title": "Subject"}, {"field": "level", "title": "Year level"}, {"field": "diff", "title": "Difference (points)", "format": "+.1f"}]
dump("gender_language", {
    "description": "Strip plot. Each dot is one subject at one year level, placed by how many percentage points more (right) or fewer (left) students in the "
                   "named group meet expectations than in the comparison group. Darker dots are older year levels; hollow dots are too close to call.",
    "width": "container", "height": 5 * 56, "padding": {"left": 4, "right": 8, "top": 26, "bottom": 4}, "background": None, "config": CONFIG,
    "params": [{"name": "factor", "value": "sex"}],
    "layer": [
        {"data": {"values": [{"a": -10, "b": 0, "z": "l"}, {"a": 0, "b": 20, "z": "r"}]}, "mark": {"type": "rect", "opacity": 0.07},
         "encoding": {"x": {"field": "a", **XD, "axis": {"title": "Difference in the share meeting expectations (percentage points)", "grid": True, "values": [-10, 0, 10, 20],
                                                       "labelExpr": "(datum.value > 0 ? '+' : datum.value < 0 ? '−' : '') + abs(datum.value)"}},
                      "x2": {"field": "b"}, "fill": {"field": "z", "type": "nominal", "legend": None, "scale": {"domain": ["l", "r"], "range": [CORAL, TEAL]}}}},
        {"data": {"values": [{"x": 0}]}, "mark": {"type": "rule", "color": INK, "strokeWidth": 1.5}, "encoding": {"x": {"field": "x", **XD}}},
        {"data": gd(), "transform": [GF] + GCALC + [{"filter": "datum.sig != 0"}],
         "mark": {"type": "circle", "size": 100, "opacity": 0.95, "stroke": "#fff", "strokeWidth": 0.8, "tooltip": True},
         "encoding": {"x": {"field": "diff", **XD}, "y": {"field": "y", **YD, "axis": YD_AXIS}, "color": LV, "tooltip": TIP}},
        {"data": gd(), "transform": [GF] + GCALC + [{"filter": "datum.sig == 0"}],
         "mark": {"type": "point", "size": 100, "filled": False, "strokeWidth": 2, "fill": "#fff", "tooltip": True},
         "encoding": {"x": {"field": "diff", **XD}, "y": {"field": "y", **YD, "axis": YD_AXIS}, "color": LV, "tooltip": TIP}},
        # captions for the two sides
        {"data": {"values": [{"factor": "sex", "s": "l", "t": "Boys ahead"}, {"factor": "sex", "s": "r", "t": "Girls ahead"},
                             {"factor": "lang", "s": "l", "t": "English-only ahead"}, {"factor": "lang", "s": "r", "t": "LBOTE ahead"}]},
         "transform": [GF, {"filter": "datum.s == 'l'"}],
         "mark": {"type": "text", "align": "left", "baseline": "bottom", "dx": 4, "dy": -6, "fontSize": 10.5, "fontWeight": 700, "color": DEEP_CORAL},
         "encoding": {"x": {"datum": -10, **XD}, "y": {"value": 0}, "text": {"field": "t"}}},
        {"data": {"values": [{"factor": "sex", "s": "r", "t": "Girls ahead"}, {"factor": "lang", "s": "r", "t": "LBOTE ahead"}]},
         "transform": [GF],
         "mark": {"type": "text", "align": "right", "baseline": "bottom", "dx": -4, "dy": -6, "fontSize": 10.5, "fontWeight": 700, "color": TEAL},
         "encoding": {"x": {"datum": 20, **XD}, "y": {"value": 0}, "text": {"field": "t"}}},
        # in-diagram notes
        {"data": {"values": [{"factor": "sex", "row": 2, "t": "In every reading and writing subject, girls’ lead\ngrows between Year 3 and Year 9."},
                             {"factor": "lang", "row": 1, "t": "LBOTE: a student, or a parent, speaks a\nlanguage other than English at home."}]},
         "transform": [GF],
         "mark": {"type": "text", "align": "left", "baseline": "middle", "dx": 6, "fontSize": 11, "fontStyle": "italic", "lineBreak": "\n", "lineHeight": 13, "color": MUTED},
         "encoding": {"x": {"datum": -10, **XD}, "y": {"field": "row", **YD}, "text": {"field": "t"}}},
    ],
})


# =====================================================================================================
# 3. Does where you live change the gap?  Dot strip: the gap of each background in each state, with Australia as a tick
#    marks: circle + tick + rule + text; channels: x = gap (points), y = background, colour = selected state
# =====================================================================================================
SG = pd.read_csv(HERE / "data" / "state_gaps.csv")
SROWS = ["edu", "job", "ind", "lang", "sex"]
SLAB = ["Parents’ education", "Parents’ job", "Indigenous status", "Language at home", "Gender"]
XS = {"type": "quantitative", "scale": {"domain": [-25, 60], "nice": False}}
SNUM = ("so_low", "so_high", "gap", "n_low")
SR = {"calculate": "indexof(" + json.dumps(SROWS) + ", datum.factor)", "as": "row"}
YS = {"field": "row", **yidx(SLAB)}
SD = lambda: csvn("state_gaps", SNUM)
STSTATE = {"calculate": "datum.state == st ? 'sel' : (st == '' ? 'all' : 'other')", "as": "k"}
SCOL = {"field": "k", "type": "nominal", "legend": None, "scale": {"domain": ["sel", "all", "other"], "range": [CORAL, TEAL, "#bcc5d6"]}}
SX = lambda: {"field": "gap", **XS}
JOIN = {"joinaggregate": [{"op": "min", "field": "gap", "as": "gmin"}, {"op": "max", "field": "gap", "as": "gmax"}], "groupby": ["factor"]}
STIP = [{"field": "state", "title": "State"}, {"field": "gap", "title": "Gap (points)", "format": ".1f"},
        {"field": "so_high", "title": "Higher group: % meeting expectations", "format": ".0f"},
        {"field": "so_low", "title": "Lower group: % meeting expectations", "format": ".0f"},
        {"field": "n_low", "title": "Students in the lower group", "format": ",.0f"}]
dump("state_gaps", {
    "description": "Dot strip. For each background, the gap in the share of students meeting expectations in each state or territory, 2026 "
                   "(higher group minus lower group; for gender, girls minus boys; for language, other-than-English minus English only). "
                   "A dark tick marks Australia. Tasmania is left out because its results by background are not published.",
    "width": "container", "height": 5 * 56, "padding": {"left": 4, "right": 8, "top": 34, "bottom": 4}, "background": None, "config": CONFIG,
    "params": [{"name": "st", "value": ""}],
    "layer": [
        {"data": {"values": [{"x": 0}]}, "mark": {"type": "rule", "color": INK, "strokeWidth": 1.5},
         "encoding": {"x": {"field": "x", **XS, "axis": {"title": "Gap in the share meeting expectations (percentage points)", "grid": True, "values": [-20, 0, 20, 40, 60],
                                                      "labelExpr": "(datum.value > 0 ? '+' : datum.value < 0 ? '−' : '') + abs(datum.value)"}}}},
        {"data": SD(), "transform": [SR], "mark": {"type": "rule", "color": LINE, "strokeWidth": 1},
         "encoding": {"x": {"datum": -25, **XS}, "x2": {"datum": 60}, "y": YS}},
        {"data": SD(), "transform": [SR, STSTATE, {"filter": "datum.k != 'sel'"}],
         "mark": {"type": "circle", "size": 130, "opacity": 0.9, "stroke": "#fff", "strokeWidth": 1, "tooltip": True},
         "encoding": {"x": SX(), "y": YS, "color": SCOL, "tooltip": STIP}},
        {"data": csvn("factors", ("gap",)), "transform": [{"filter": "indexof(" + json.dumps(SROWS) + ", datum.factor) >= 0"}, SR],
         "mark": {"type": "tick", "color": INK, "thickness": 3, "size": 30},
         "encoding": {"x": {"field": "gap", **XS}, "y": YS, "tooltip": [{"field": "label", "title": "Australia"}, {"field": "gap", "title": "Gap (points)", "format": ".1f"}]}},
        {"data": SD(), "transform": [SR, STSTATE, {"filter": "datum.k == 'sel'"}],
         "mark": {"type": "circle", "size": 260, "stroke": "#fff", "strokeWidth": 1.5, "tooltip": True},
         "encoding": {"x": SX(), "y": YS, "color": SCOL, "tooltip": STIP}},
        # the largest and smallest gap of each background (when no state is picked), or the picked state
        {"data": SD(), "transform": [JOIN, SR, {"calculate": "datum.state == 'Australian Capital Territory' ? 'ACT' : datum.state == 'New South Wales' ? 'NSW' : datum.state == 'Northern Territory' ? 'NT' : "
                                                              "datum.state == 'Queensland' ? 'Qld' : datum.state == 'South Australia' ? 'SA' : datum.state == 'Victoria' ? 'Vic' : 'WA'", "as": "ab"},
                                    {"filter": "datum.state == st || (st == '' && datum.gmax - datum.gmin > 3 && (datum.gap == datum.gmax || datum.gap == datum.gmin))"}],
         "mark": {"type": "text", "dy": -15, "fontSize": 11, "fontWeight": 700, "color": MUTED},
         "encoding": {"x": SX(), "y": YS, "text": {"field": "ab"}}},
        # right-hand column: the spread across states
        {"data": {"values": [{"t": "Spread across states"}]}, "mark": {"type": "text", "align": "left", "baseline": "bottom", "dx": 14, "dy": -5, "fontSize": 10.5, "fontWeight": 700, "color": MUTED},
         "encoding": {"x": {"datum": 60, **XS}, "y": {"value": 0}, "text": {"field": "t"}}},
        {"data": SD(), "transform": [JOIN, SR, {"aggregate": [{"op": "max", "field": "gmin", "as": "gmin"}, {"op": "max", "field": "gmax", "as": "gmax"}], "groupby": ["factor", "row"]},
                                     {"calculate": "(datum.gmin < 0 ? '−' : '') + format(abs(datum.gmin), '.0f') + ' to ' + (datum.gmax < 0 ? '−' : '') + format(abs(datum.gmax), '.0f') + ' pts'", "as": "rg"}],
         "mark": {"type": "text", "align": "left", "baseline": "middle", "dx": 14, "fontSize": 12.5, "fontWeight": 700, "color": INK},
         "encoding": {"x": {"datum": 60, **XS}, "y": YS, "text": {"field": "rg"}}},
        # in-diagram note: why the language gap points the other way in the Northern Territory
        {"data": {"values": [{"row": 3, "t": "Many Territory students speak an\nIndigenous language at home."}]},
         "mark": {"type": "text", "align": "left", "baseline": "middle", "dx": 4, "fontSize": 11, "fontStyle": "italic", "lineBreak": "\n", "lineHeight": 13, "color": MUTED},
         "encoding": {"x": {"datum": -18.5, **XS}, "y": {"field": "row", **yidx(SLAB)}, "text": {"field": "t"}}},
    ],
})

# =====================================================================================================
# 4. Who needs support?  Two bar panels on the same rows: how likely each group is to need support, and how much of all the need it holds
#    marks: bar + rule + text; channels: x = % (0-100), y = group (sorted by rate)
# =====================================================================================================
SEL = ["Very remote", "Indigenous", "Year 11 or below", "Not in paid work"]
SHORT = {"Very remote": "Very remote areas", "Indigenous": "Indigenous students", "Year 11 or below": "Parents finished\nYear 11 or below", "Not in paid work": "Parents not in\npaid work"}
ORDER = [SHORT[k] for k in SEL]
GNUM = ("order", "share", "rate", "students", "support", "share_support")
GD = lambda: csvn("support_groups", GNUM)
GSEL = {"filter": "indexof(" + json.dumps(SEL) + ", datum.group) >= 0"}
GSHORT = {"calculate": json.dumps(SHORT, ensure_ascii=False) + "[datum.group]", "as": "g"}
XB = {"type": "quantitative", "scale": {"domain": [0, 100], "nice": False}}
YB = lambda labels: {"field": "g", "type": "nominal", "sort": ORDER, "title": None,
                     "axis": ({"grid": False, "labelFontSize": 12, "labelFontWeight": 600, "labelColor": INK, "labelPadding": 8, "labelLimit": 170, "labelLineHeight": 14}
                              if labels else {"labels": False, "grid": False})}
XAX = lambda t: {"title": t, "grid": True, "values": [0, 25, 50, 75, 100], **PCT}
TITLE = lambda t: {"text": t, "anchor": "start", "fontSize": 13, "fontWeight": 700, "color": INK, "offset": 12, "font": FONT}
GTIP2 = [{"field": "g", "title": "Group"}, {"field": "rate", "title": "% of the group needing support", "format": ".1f"},
         {"field": "share_support", "title": "% of all students needing support", "format": ".1f"}, {"field": "share", "title": "% of all students", "format": ".1f"}]
LAB = lambda f, color: {"mark": {"type": "text", "align": "left", "dx": 5, "fontSize": 12, "fontWeight": 700, "color": color},
                        "encoding": {"x": {"field": f, **XB}, "y": YB(False),
                                     "text": {"field": f, "type": "quantitative", "format": ".0f"}}}
dump("support_groups", {
    "description": "Two bar charts on the same rows, 2026. Left: the share of each group that needs additional support. Right: the share of all students needing "
                   "additional support who belong to that group. The dashed line is the rate for all students.",
    "background": None, "config": CONFIG, "padding": {"left": 4, "right": 8, "top": 4, "bottom": 4},
    "resolve": {"scale": {"y": "shared"}},
    "hconcat": [
        {"title": TITLE("Share of the group needing support"), "width": 330, "height": {"step": 52},
         "layer": [
             {"data": GD(), "transform": [GSEL, GSHORT], "mark": {"type": "bar", "color": CORAL, "cornerRadiusEnd": 3, "height": {"band": 0.62}, "tooltip": True},
              "encoding": {"x": {"field": "rate", **XB, "axis": XAX("Students needing additional support (%)")}, "y": YB(True), "tooltip": GTIP2}},
             {"data": GD(), "transform": [GSEL, GSHORT], **LAB("rate", DEEP_CORAL)},
             {"data": GD(), "transform": [{"filter": "datum.factor == 'all'"}], "mark": {"type": "rule", "strokeDash": [4, 3], "color": INK, "strokeWidth": 1.3},
              "encoding": {"x": {"field": "rate", **XB}}},
             {"data": GD(), "transform": [{"filter": "datum.factor == 'all'"}, {"calculate": "'All students: ' + format(datum.rate, '.0f') + '%'", "as": "t"}],
              "mark": {"type": "text", "align": "left", "baseline": "bottom", "dx": 5, "dy": -2, "fontSize": 10.5, "fontWeight": 700, "color": INK},
              "encoding": {"x": {"field": "rate", **XB}, "y": {"value": 0}, "text": {"field": "t"}}},
             {"data": {"values": [{"g": SHORT["Very remote"], "t": "Fewer students sit the tests here,\nso the real need may be higher."}]},
              "mark": {"type": "text", "align": "left", "baseline": "middle", "dx": 34, "fontSize": 11, "fontStyle": "italic", "lineBreak": "\n", "lineHeight": 12, "color": MUTED},
              "encoding": {"x": {"value": 214}, "y": YB(True), "text": {"field": "t"}}}]},
        {"title": TITLE("Share of all students needing support"), "width": 330, "height": {"step": 52},
         "layer": [
             {"data": GD(), "transform": [GSEL, GSHORT], "mark": {"type": "bar", "color": "#7f8fb0", "cornerRadiusEnd": 3, "height": {"band": 0.62}, "tooltip": True},
              "encoding": {"x": {"field": "share_support", **XB, "axis": XAX("Students needing additional support who are in the group (%)")}, "y": YB(False), "tooltip": GTIP2}},
             {"data": GD(), "transform": [GSEL, GSHORT], **LAB("share_support", INK)},
             {"data": {"values": [{"g": SHORT["Indigenous"], "t": "Most students needing support are in big groups:\n59% live in major cities, 77% are non-Indigenous."}]},
              "mark": {"type": "text", "align": "left", "baseline": "middle", "dx": 0, "fontSize": 11, "fontStyle": "italic", "lineBreak": "\n", "lineHeight": 12, "color": MUTED},
              "encoding": {"x": {"value": 120}, "y": YB(False), "text": {"field": "t"}}}]}
    ],
})

print("wrote:", ", ".join(sorted(p.name for p in OUT.glob("*.json"))))
