"""Generate the Vega-Lite specifications for Chapter 0 as human-readable JSON files in ./specs/.
The page (js/main.js) loads them with vegaEmbed and only sets their named params (sel, attr, counts, ...).
Run from this folder:  python3 build_specs.py
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "specs"
OUT.mkdir(exist_ok=True)

VL = "https://vega.github.io/schema/vega-lite/v5.json"
FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif'
INK, MUTED, GRID = "#14213d", "#4a5568", "#eee8dc"

# the four things that can happen to an enrolled student (same colours in every chart of this chapter)
OUTCOMES = ["Result counted", "No result (excused or didn’t attempt)", "Absent", "Withdrawn"]
OUTCOME_COLORS = ["#1f6f8b", "#a9c7d6", "#f0745a", "#7b5ea7"]
REASONS = {"absent": "Absent", "withdrawn": "Withdrawn", "nores": "No result (excused or didn’t attempt)"}
REASON_COLORS = {"Absent": "#f0745a", "Withdrawn": "#7b5ea7", "No result (excused or didn’t attempt)": "#a9c7d6"}

CONFIG = {
    "view": {"stroke": None}, "font": FONT,
    "axis": {"labelFont": FONT, "titleFont": FONT, "labelColor": MUTED, "titleColor": MUTED, "titleFontWeight": 500,
             "titleFontSize": 11, "domain": False, "ticks": False, "gridColor": GRID},
    "legend": {"labelFont": FONT, "titleFont": FONT, "labelColor": MUTED, "titleColor": MUTED, "titleFontSize": 11,
               "titleFontWeight": 600, "labelFontSize": 11},
}


def dump(name, spec):
    (OUT / f"{name}.json").write_text(json.dumps({"$schema": VL, **spec}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def csv(name, numeric=()):
    fmt = {"type": "csv"}
    if numeric:  # Vega-Lite only auto-parses quantitative fields, so columns used as ordinal keys must be declared
        fmt["parse"] = {c: "number" for c in numeric}
    return {"url": f"chapter-0/data/{name}.csv", "format": fmt}


# =====================================================================================================
# 1. Waffle: of every 100 enrolled students, how many had a result counted, and what happened to the rest?
#    mark: rect; channels: position (10 x 10 grid, filled from the bottom), colour = outcome.
#    No data file: the 100 squares come from a generated sequence and the page sets the counts.
# =====================================================================================================
BAND = {"domain": list(range(10)), "paddingInner": 0.1, "paddingOuter": 0}
dump("waffle_outcomes", {
    "description": "Waffle chart of 100 enrolled students. Squares are filled from the bottom in the order: result counted, "
                   "no result (excused or didn’t attempt), absent, withdrawn. The page sets the params 'counts' (whole numbers adding to 100) "
                   "and 'pcts' (exact percentages) for the chosen state.",
    "width": "container", "height": "container",
    "autosize": {"type": "fit", "contains": "padding"},
    "padding": {"left": 2, "right": 2, "top": 2, "bottom": 2},
    "background": None, "config": CONFIG,
    "params": [
        {"name": "counts", "value": [91, 2, 4, 3]},
        {"name": "pcts", "value": [90.8, 2.1, 4.4, 2.8]},
        {"name": "hl", "select": {"type": "point", "fields": ["outcome"], "on": "pointerover", "clear": "pointerout"}},
    ],
    "data": {"sequence": {"start": 0, "stop": 100, "as": "i"}},
    "transform": [
        {"calculate": "datum.i < counts[0] ? 0 : datum.i < counts[0] + counts[1] ? 1 : datum.i < counts[0] + counts[1] + counts[2] ? 2 : 3", "as": "cat"},
        {"calculate": json.dumps(OUTCOMES) + "[datum.cat]", "as": "outcome"},
        {"calculate": "datum.i % 10", "as": "col"},
        {"calculate": "9 - floor(datum.i / 10)", "as": "row"},
        {"calculate": "counts[datum.cat] + ' of every 100 students'", "as": "t_count"},
        {"calculate": "format(pcts[datum.cat], '.1f') + '% of enrolled students'", "as": "t_pct"},
    ],
    "mark": {"type": "rect", "cornerRadius": 4, "tooltip": True},
    "encoding": {
        "x": {"field": "col", "type": "ordinal", "axis": None, "scale": BAND},
        "y": {"field": "row", "type": "ordinal", "axis": None, "scale": BAND},
        "color": {"field": "outcome", "type": "nominal", "legend": None, "scale": {"domain": OUTCOMES, "range": OUTCOME_COLORS}},
        "opacity": {"condition": {"param": "hl", "value": 1}, "value": 0.3},
        "tooltip": [{"field": "outcome", "title": "What happened"}, {"field": "t_count", "title": "Out of 100"}, {"field": "t_pct", "title": "Exact share"}],
    },
})

# =====================================================================================================
# 2. Tile-grid map (equalised cartogram): pick a state. Colour = share of enrolled students without a result.
#    Every state gets a tile of the same size, so small ones (ACT, Tasmania) are as easy to pick as big ones.
# =====================================================================================================
TBANDS = ["92 or more", "88–91", "80–87", "65–79", "Under 65"]
TCOLORS = ["#f6e7e1", "#f2c8ba", "#ea9d86", "#d96648", "#9c3a1f"]   # darker = fewer students with a result counted
TILE = [{"filter": "datum.year == year && datum.state != 'Australia'"},
        {"calculate": "datum.c_assessed >= 92 ? '" + TBANDS[0] + "' : datum.c_assessed >= 88 ? '" + TBANDS[1] + "' : datum.c_assessed >= 80 ? '" + TBANDS[2] +
                      "' : datum.c_assessed >= 65 ? '" + TBANDS[3] + "' : '" + TBANDS[4] + "'", "as": "band"},
        {"calculate": "indexof(['65–79', 'Under 65'], datum.band) >= 0 ? '#ffffff' : '" + INK + "'", "as": "ink"},
        {"calculate": "datum.c_assessed", "as": "counted_text"},
        {"calculate": "datum.c_assessed + ' of 100'", "as": "assessed_text"},
        {"calculate": "datum.c_nores + ' of 100'", "as": "nores_text"},
        {"calculate": "datum.c_absent + ' of 100'", "as": "absent_text"},
        {"calculate": "datum.c_withdrawn + ' of 100'", "as": "withdrawn_text"}]
TXY = {"x": {"field": "col", "type": "ordinal", "axis": None, "scale": {"domain": [0, 1, 2, 3], "paddingInner": 0.08, "paddingOuter": 0}},
       "y": {"field": "row", "type": "ordinal", "axis": None, "scale": {"domain": [0, 1, 2, 3], "paddingInner": 0.08, "paddingOuter": 0}}}
INKC = {"field": "ink", "type": "nominal", "scale": None, "legend": None}
dump("tile_map_selector", {
    "description": "Equal-sized tile map of the states and territories, placed roughly where they sit on the map. Colour and number show how "
                   "many of every 100 enrolled students had a result counted in the latest year (darker = fewer). Clicking a tile selects it (param 'sel').",
    "width": "container", "height": "container",
    "autosize": {"type": "fit", "contains": "padding"},
    "padding": {"left": 2, "right": 2, "top": 2, "bottom": 2},
    "background": None, "config": CONFIG,
    "params": [{"name": "year", "value": 2026}, {"name": "sel", "value": "Australia"}],
    "encoding": TXY,
    "layer": [
        {"data": csv("outcomes_trend", ("col", "row")), "transform": TILE,
         "mark": {"type": "rect", "cornerRadius": 10, "cursor": "pointer", "tooltip": True},
         "encoding": {
             "fill": {"field": "band", "type": "nominal", "scale": {"domain": TBANDS, "range": TCOLORS},
                      "legend": {"title": "Result counted, of 100", "orient": "bottom", "direction": "horizontal", "columns": 3,
                                 "symbolType": "square", "symbolSize": 160, "columnPadding": 10}},
             "stroke": {"condition": {"test": "datum.state == sel", "value": INK}, "value": "#ffffff"},
             "strokeWidth": {"condition": {"test": "datum.state == sel", "value": 4}, "value": 0},
             "tooltip": [{"field": "state", "title": "State / territory"}, {"field": "assessed_text", "title": "Result counted"},
                         {"field": "nores_text", "title": "No result (excused or didn’t attempt)"},
                         {"field": "absent_text", "title": "Absent"}, {"field": "withdrawn_text", "title": "Withdrawn"}]}},
        {"data": {"values": [{"col": 1, "row": 3}]},       # annotation: context the data cannot show
         "mark": {"type": "text", "text": ["Teachers’ union", "boycott of the", "tests in 2026 →"], "align": "right", "baseline": "middle",
                  "dx": {"expr": "width / 4 * 0.46"}, "fontSize": 11, "fontWeight": 700, "lineHeight": 14, "color": "#9c3a1f",
                  "opacity": {"expr": "year == 2026 && width >= 300 ? 1 : 0"}}},
        {"data": csv("outcomes_trend", ("col", "row")), "transform": TILE,
         "mark": {"type": "text", "dy": -9, "fontSize": 13, "fontWeight": 700},
         "encoding": {"text": {"field": "code"}, "color": INKC}},
        {"data": csv("outcomes_trend", ("col", "row")), "transform": TILE,
         "mark": {"type": "text", "dy": 10, "fontSize": 17, "fontWeight": 800},
         "encoding": {"text": {"field": "counted_text"}, "color": INKC}},
    ],
})

# =====================================================================================================
# 3. Stacked area over time: why are students going missing?  (selected state, default Australia)
#    marks: area (stacked); channels: x = year, y = % of enrolled students, colour = reason. Event markers explain the bumps.
# =====================================================================================================
XT = {"field": "year", "type": "quantitative", "scale": {"domain": [2007.5, 2026.5], "nice": False},
      "axis": {"title": None, "format": "d", "values": [2008, 2010, 2012, 2014, 2016, 2018, 2021, 2023, 2026], "grid": False, "labelFontSize": 11}}
YT = {"type": "quantitative", "scale": {"domain": [0, 14], "nice": False, "domainMax": {"expr": "ymax"}},
      "axis": {"title": "% of enrolled students without a result", "grid": True, "tickCount": 5, "format": ".0f", "labelExpr": "datum.label + '%'"}}
TR = [{"filter": "datum.state == sel"},
      {"fold": ["absent", "withdrawn", "nores"], "as": ["reason", "pct"]},
      {"calculate": "datum.reason == 'absent' ? 'Absent' : datum.reason == 'withdrawn' ? 'Withdrawn' : 'No result (excused or didn’t attempt)'", "as": "reason_label"},
      {"calculate": "datum.reason == 'absent' ? 0 : datum.reason == 'nores' ? 1 : 2", "as": "ord"},
      {"calculate": "datum.year < 2020 ? 'before 2020' : 'after 2020'", "as": "period"}]
LBL = {"type": "text", "fontSize": 11, "fontWeight": 700, "color": INK, "opacity": {"expr": "width < 460 ? 0 : 1"}}
XE = {"field": "y", "type": "quantitative", "scale": XT["scale"], "axis": XT["axis"]}   # event markers: same x axis as the area
dump("trend_missing", {
    "description": "Stacked area chart of the share of enrolled students without a result, split by reason, 2008 to 2026 (no tests in 2020). "
                   "Shown for the state in param 'sel'; a dashed line shows Australia for comparison. The y-axis maximum is the param 'ymax'.",
    "width": "container", "height": 340,
    "padding": {"left": 4, "right": 12, "top": 6, "bottom": 4},
    "background": None, "config": CONFIG,
    "params": [{"name": "sel", "value": "Australia"}, {"name": "ymax", "value": 14}],
    "layer": [
        {"data": {"values": [{"a": 2019, "b": 2021}]},
         "mark": {"type": "rect", "color": "#e9e3d6", "opacity": 0.9},
         "encoding": {"x": {"field": "a", "type": "quantitative", "scale": XT["scale"], "axis": XT["axis"]}, "x2": {"field": "b"}}},
        *[{"data": csv("outcomes_trend"), "transform": [{"filter": flt}] + TR,
           "mark": {"type": "area", "opacity": 0.95, "tooltip": True},
           "encoding": {
               "x": XT, "y": {"field": "pct", **YT, "stack": "zero"},
               "color": {"field": "reason_label", "type": "nominal",
                         "scale": {"domain": ["Absent", "No result (excused or didn’t attempt)", "Withdrawn"],
                                   "range": [REASON_COLORS["Absent"], REASON_COLORS["No result (excused or didn’t attempt)"], REASON_COLORS["Withdrawn"]]},
                         "legend": None},
               "order": {"field": "ord", "type": "quantitative"},
               "tooltip": [{"field": "year", "title": "Year", "format": "d"}, {"field": "reason_label", "title": "Reason"},
                           {"field": "pct", "title": "% of enrolled students", "format": ".1f"}]}}
          for flt in ("datum.year <= 2019", "datum.year >= 2021")],
        {"data": csv("outcomes_trend"),
         "transform": [{"filter": "datum.state == 'Australia' && sel != 'Australia'"}, {"calculate": "datum.year < 2020 ? 'before 2020' : 'after 2020'", "as": "period"}],
         "mark": {"type": "line", "color": INK, "strokeDash": [5, 4], "strokeWidth": 2},
         "encoding": {"x": XT, "y": {"field": "missing", **YT}, "detail": {"field": "period"}}},
        # event markers: dotted line + short label (details are in the key beside the chart)
        {"data": {"values": [{"y": 2008}, {"y": 2022}, {"y": 2023}]},
         "mark": {"type": "rule", "color": INK, "opacity": 0.35, "strokeDash": [2, 3]},
         "encoding": {"x": XE}},
        {"data": {"values": [{"y": 2026}]},
         "mark": {"type": "rule", "color": INK, "strokeDash": [2, 3], "opacity": {"expr": "sel == 'Tasmania' || sel == 'Australia' ? 0.35 : 0"}},
         "encoding": {"x": XE}},
        {"data": {"values": [{"y": 2008, "t": "2008 First NAPLAN"}]}, "mark": {**LBL, "align": "left", "dx": 4},
         "encoding": {"x": XE, "y": {"value": 10}, "text": {"field": "t"}}},
        {"data": {"values": [{"y": 2020, "t": "2020 No tests (COVID-19)"}]}, "mark": {**LBL, "align": "center", "color": MUTED},
         "encoding": {"x": XE, "y": {"value": 10}, "text": {"field": "t"}}},
        {"data": {"values": [{"y": 2022, "t": "2022 Illness and floods"}]}, "mark": {**LBL, "align": "right", "dx": -5},
         "encoding": {"x": XE, "y": {"value": 30}, "text": {"field": "t"}}},
        {"data": {"values": [{"y": 2023, "t": "2023 March, all online"}]}, "mark": {**LBL, "align": "right", "dx": -5},
         "encoding": {"x": XE, "y": {"value": 50}, "text": {"field": "t"}}},
        {"data": {"values": [{"y": 2026, "t": "2026 Tasmania boycott"}]},
         "mark": {**LBL, "align": "right", "dx": -5, "opacity": {"expr": "(sel == 'Tasmania' || sel == 'Australia') && width >= 460 ? 1 : 0"}},
         "encoding": {"x": XE, "y": {"value": 70}, "text": {"field": "t"}}},
    ],
})

# =====================================================================================================
# 4. Who is missing? Bars of the share of enrolled students without a result, split by reason, for the chosen type of group.
# =====================================================================================================
XG = {"type": "quantitative", "scale": {"domain": [0, 40], "nice": False, "domainMax": {"expr": "xmax"}}}
GF = [{"filter": "datum.attribute == attr"},
      {"fold": ["absent", "withdrawn", "nores"], "as": ["reason", "pct"]},
      {"calculate": "datum.reason == 'absent' ? 'Absent' : datum.reason == 'withdrawn' ? 'Withdrawn' : 'No result (excused or didn’t attempt)'", "as": "reason_label"},
      {"calculate": "datum.reason == 'absent' ? 0 : datum.reason == 'withdrawn' ? 1 : 2", "as": "ord"}]
YG = {"field": "group", "type": "nominal", "sort": {"field": "order", "op": "min"}, "scale": {"padding": 0.3},
      "axis": {"title": None, "labelFontSize": 12, "labelFontWeight": 600, "labelColor": INK, "labelLimit": 210, "labelPadding": 10}}
dump("who_is_missing", {
    "description": "Bars of the share of enrolled students without a result in 2026, split into absent, withdrawn and no result (excused or didn’t attempt), "
                   "for each group of the type in param 'attr'. The dashed line is the Australian figure.",
    "width": "container", "height": {"step": 42},
    "padding": {"left": 4, "right": 60, "top": 26, "bottom": 4},
    "background": None, "config": CONFIG,
    "params": [{"name": "attr", "value": "Where students live"}, {"name": "xmax", "value": 40}],
    "layer": [
        {"data": csv("outcomes_groups", ("order",)), "transform": GF,
         "mark": {"type": "bar", "tooltip": True, "stroke": "#ffffff", "strokeWidth": 1},
         "encoding": {
             "y": YG, "x": {"field": "pct", **XG, "stack": "zero", "axis": {"title": "% of enrolled students without a result", "grid": True, "format": ".0f", "labelExpr": "datum.label + '%'", "tickCount": 5}},
             "color": {"field": "reason_label", "type": "nominal",
                       "scale": {"domain": ["Absent", "Withdrawn", "No result (excused or didn’t attempt)"], "range": [REASON_COLORS["Absent"], REASON_COLORS["Withdrawn"], REASON_COLORS["No result (excused or didn’t attempt)"]]},
                       "legend": {"title": None, "orient": "top", "direction": "horizontal", "symbolType": "square", "offset": 8}},
             "order": {"field": "ord", "type": "quantitative"},
             "tooltip": [{"field": "group", "title": "Group"}, {"field": "reason_label", "title": "Reason"},
                         {"field": "pct", "title": "% of enrolled students", "format": ".1f"},
                         {"field": "assessed", "title": "Result counted (%)", "format": ".1f"}]}},
        {"data": csv("outcomes_groups"), "transform": [{"filter": "datum.attribute == attr"}, {"aggregate": [{"op": "max", "field": "national_missing", "as": "nat"}]}],
         "mark": {"type": "rule", "color": INK, "strokeDash": [4, 3], "strokeWidth": 1.5, "opacity": 0.55},
         "encoding": {"x": {"field": "nat", **XG, "axis": None}}},
        {"data": csv("outcomes_groups", ("order",)), "transform": [{"filter": "datum.attribute == attr"}, {"calculate": "format(datum.missing, '.0f') + '%'", "as": "t"}],
         "mark": {"type": "text", "align": "left", "baseline": "middle", "dx": 8, "fontSize": 12, "fontWeight": 800, "color": INK},
         "encoding": {"y": YG, "x": {"field": "missing", **XG, "axis": None}, "text": {"field": "t"}}},
        {"data": csv("outcomes_groups"), "transform": [{"filter": "datum.attribute == attr"}, {"aggregate": [{"op": "max", "field": "national_missing", "as": "nat"}]},
                                                       {"calculate": "'Australia ' + format(datum.nat, '.0f') + '%'", "as": "t"}],
         "mark": {"type": "text", "align": "left", "baseline": "bottom", "dx": 4, "fontSize": 10, "fontWeight": 700, "color": INK},
         "encoding": {"x": {"field": "nat", **XG, "axis": None}, "y": {"value": 8}, "text": {"field": "t"}}},
    ],
})
print("wrote:", ", ".join(sorted(p.name for p in OUT.glob("*.json"))))
