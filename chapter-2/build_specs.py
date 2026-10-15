"""Generate the Vega-Lite specifications for Chapter 2 as human-readable JSON files in ./specs/.

The page (js/main.js) loads these files directly with vegaEmbed. Interactivity is driven by named params
(year, metric, sel) that the page sets from its controls, so the JSON is the complete description of each chart.
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
TEAL, CORAL = "#1f6f8b", "#f0745a"
OCHRE, SLATE = "#b7791f", "#8a96b0"

# colour classes for "better / worse than Australia" (same meaning as the Chapter 0 map and the Chapter 1 heatmap)
BANDS = ["10+ pp worse", "3-10 pp worse", "1-3 pp worse", "within 1 pp", "1-3 pp better", "3+ pp better"]
BAND_COLORS = ["#c2410c", "#f0745a", "#f8cbbd", "#ece8df", "#9fc9d8", "#0e5a78"]

STATE_ORDER = ["Victoria", "Australian Capital Territory", "New South Wales", "Western Australia",
               "South Australia", "Queensland", "Tasmania", "Northern Territory"]
REMOTENESS = ["Major cities", "Inner regional", "Outer regional", "Remote", "Very remote"]

CONFIG = {
    "view": {"stroke": None},
    "font": FONT,
    "axis": {"labelFont": FONT, "titleFont": FONT, "labelColor": MUTED, "titleColor": MUTED,
             "titleFontWeight": 500, "titleFontSize": 11, "domain": False, "ticks": False, "gridColor": GRID},
    "legend": {"labelFont": FONT, "titleFont": FONT, "labelColor": MUTED, "titleColor": MUTED,
               "titleFontSize": 11, "titleFontWeight": 600, "labelFontSize": 11},
}


def dump(name, spec):
    spec = {"$schema": VL, **spec}
    (OUT / f"{name}.json").write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def csv(name):
    return {"url": f"chapter-2/data/{name}.csv", "format": {"type": "csv"}}


# =====================================================================================================
# 1. Proportional symbol map: where do students live, and how are they doing?
#    marks: circle (area = students tested), channel: fill = better/worse than Australia, position = capital-region location
# =====================================================================================================
NUM = "datum.year == year && datum.state != 'Australia'"
CALC = [
    {"calculate": "metric == 'so' ? datum.band_so : datum.band_nas", "as": "band"},
    {"calculate": "metric == 'so' ? datum.gap_so : datum.gap_nas", "as": "gap"},
    {"calculate": "metric == 'so' ? datum.so : datum.nas", "as": "value"},
    {"calculate": "metric == 'so' ? datum.nat_so : datum.nat_nas", "as": "nat_value"},
    {"calculate": "(datum.gap > 0 ? '+' : datum.gap < 0 ? '−' : '') + format(abs(datum.gap), '.1f') + ' pp'", "as": "gap_label"},
    {"calculate": "format(datum.value, '.1f') + '%'", "as": "value_label"},
    {"calculate": "format(datum.nat_value, '.1f') + '%'", "as": "nat_label"},
    {"calculate": "indexof(['10+ pp worse', '3+ pp better'], datum.band) >= 0 ? '#ffffff' : '" + INK + "'", "as": "ink"},
    {"calculate": "format(datum.n, ',') + ' students tested'", "as": "n_label"},
]
POS = {"longitude": {"field": "lon", "type": "quantitative"}, "latitude": {"field": "lat", "type": "quantitative"}}
SIZE_SCALE = {"type": "linear", "domain": [0, 2000000], "range": [40, 3600]}
INK_COLOR = {"field": "ink", "type": "nominal", "scale": None, "legend": None}

dump("map_states", {
    "description": "Proportional symbol map of Australian states and territories. Circle area = students tested; "
                   "colour = how far the state is from the Australian figure (diverging classes).",
    "width": "container", "height": "container",
    "autosize": {"type": "fit", "contains": "padding"},
    "padding": {"left": 4, "right": 4, "top": 4, "bottom": 4},
    "background": None,
    "config": CONFIG,
    "params": [{"name": "year", "value": 2026}, {"name": "metric", "value": "so"},
               {"name": "sel", "value": "Northern Territory"}],
    "projection": {"type": "conicEqualArea", "rotate": [-134, 0, 0], "parallels": [-18, -36]},
    "layer": [
        {   # base map: state and territory outlines (Natural Earth, public domain)
            "data": {"url": "chapter-2/data/states.geojson", "format": {"type": "json", "property": "features"}},
            "mark": {"type": "geoshape", "fill": "#ece8df", "stroke": "#ffffff", "strokeWidth": 1.2},
        },
        {   # leader line from the offshore ACT symbol back to Canberra
            "data": csv("state_results"),
            "transform": [{"filter": NUM + " && datum.leader == 1"}],
            "mark": {"type": "rule", "stroke": "#9aa3b2", "strokeWidth": 1},
            "encoding": {"longitude": {"field": "lon", "type": "quantitative"}, "latitude": {"field": "lat", "type": "quantitative"},
                         "longitude2": {"field": "anchor_lon"}, "latitude2": {"field": "anchor_lat"}},
        },
        {   # one circle per state, drawn largest first so small ones stay visible on top
            "data": csv("state_results"),
            "transform": [{"filter": NUM + " && datum.reported == 1"}] + CALC,
            "mark": {"type": "circle", "opacity": 0.95, "cursor": "pointer", "tooltip": True},
            "encoding": {
                **POS,
                "size": {"field": "n", "type": "quantitative", "scale": SIZE_SCALE,
                         "legend": {"title": "Students tested (area)", "orient": "bottom", "direction": "horizontal", "columns": 2, "columnPadding": 16, "padding": 2,
                                    "values": [100000, 500000, 1000000, 2000000], "format": "~s",
                                    "symbolFillColor": "#c8c3b8", "symbolStrokeColor": "#9aa3b2", "symbolOpacity": 1}},
                "fill": {"field": "band", "type": "nominal",
                         "scale": {"domain": BANDS, "range": BAND_COLORS},
                         "legend": {"title": "Compared with Australia", "orient": "bottom", "direction": "horizontal", "columns": 2, "columnPadding": 16, "padding": 2,
                                    "symbolType": "circle", "symbolSize": 160,
                                    "labelExpr": "replace(datum.label, '-', '–')"}},
                "stroke": {"condition": {"test": "datum.state == sel", "value": INK}, "value": "#ffffff"},
                "strokeWidth": {"condition": {"test": "datum.state == sel", "value": 3}, "value": 1.5},
                "order": {"field": "n", "type": "quantitative", "sort": "descending"},
                "tooltip": [
                    {"field": "state", "title": "State / territory"},
                    {"field": "value_label", "title": "Result"},
                    {"field": "nat_label", "title": "Australia"},
                    {"field": "gap_label", "title": "Difference"},
                    {"field": "n_label", "title": "Students"},
                ],
            },
        },
        {   # unpublished results (Tasmania 2026): hollow dashed circle
            "data": csv("state_results"),
            "transform": [{"filter": NUM + " && datum.reported == 0"}, {"calculate": "format(datum.n, ',') + ' students sat the tests, but ACARA did not publish Tasmania’s 2026 results'", "as": "note"}],
            "mark": {"type": "circle", "fill": "#ffffff", "fillOpacity": 0.7, "stroke": "#9aa3b2", "strokeDash": [4, 3],
                     "strokeWidth": 1.5, "tooltip": True},
            "encoding": {**POS, "size": {"field": "n", "type": "quantitative", "scale": SIZE_SCALE, "legend": None},
                         "tooltip": [{"field": "state", "title": "State / territory"}, {"field": "note", "title": "Not published"}]},
        },
        {   # code + value inside the big circles
            "data": csv("state_results"),
            "transform": [{"filter": NUM + " && datum.reported == 1 && datum.n >= 300000"}] + CALC,
            "mark": {"type": "text", "dy": -7, "fontSize": 11, "fontWeight": 700, "opacity": 0.9},
            "encoding": {**POS, "text": {"field": "code"}, "color": INK_COLOR},
        },
        {
            "data": csv("state_results"),
            "transform": [{"filter": NUM + " && datum.reported == 1 && datum.n >= 300000"}] + CALC,
            "mark": {"type": "text", "dy": 8, "fontSize": 13, "fontWeight": 700},
            "encoding": {**POS, "text": {"field": "value_label"}, "color": INK_COLOR},
        },
        {   # small circles: label underneath
            "data": csv("state_results"),
            "transform": [{"filter": NUM + " && datum.reported == 1 && datum.n < 300000"}] + CALC +
                         [{"calculate": "datum.code + ' ' + datum.value_label", "as": "small_label"}],
            "mark": {"type": "text", "dy": 17, "fontSize": 11, "fontWeight": 700, "color": INK},
            "encoding": {**POS, "text": {"field": "small_label"}},
        },
        {
            "data": csv("state_results"),
            "transform": [{"filter": NUM + " && datum.reported == 0"}, {"calculate": "datum.code + ' not published'", "as": "small_label"}],
            "mark": {"type": "text", "dy": 30, "fontSize": 11, "fontWeight": 600, "color": "#6b7280"},
            "encoding": {**POS, "text": {"field": "small_label"}},
        },
        {   # leader line for the callout
            "data": {"name": "annot"},
            "mark": {"type": "rule", "stroke": "#c2410c", "strokeWidth": 1.2, "strokeDash": [3, 2]},
            "encoding": {"longitude": {"field": "lon2", "type": "quantitative"}, "latitude": {"field": "lat2", "type": "quantitative"},
                         "longitude2": {"field": "lon3"}, "latitude2": {"field": "lat3"}},
        },
        {   # annotation supplied by the page (callout for the largest gap), see js/main.js
            "data": {"name": "annot"},
            "mark": {"type": "text", "align": "left", "baseline": "top", "fontSize": 12, "fontWeight": 600, "lineBreak": "\n",
                     "lineHeight": 15, "color": "#c2410c"},
            "encoding": {"longitude": {"field": "lon", "type": "quantitative"}, "latitude": {"field": "lat", "type": "quantitative"},
                         "text": {"field": "text"}},
        },
    ],
})

# =====================================================================================================
# 2. Dot strip plot: how consistent is each state across all 20 domain x year-level results?
#    marks: circle; channels: x = gap vs Australia, y = state (+ a small fixed lane per domain), colour = above/below
# =====================================================================================================
DOMAINS = ["Reading", "Writing", "Spelling", "Grammar and Punctuation", "Numeracy"]
SHORT = [("ACT" if s == "Australian Capital Territory" else s) for s in STATE_ORDER]
XS = {"domain": [-34, 12], "nice": False}
YEAR = {"filter": "datum.year == year"}
STATE_IDX = {"calculate": "indexof(" + json.dumps(STATE_ORDER) + ", datum.state)", "as": "state_idx"}


def strip_y(field):
    return {"field": field, "type": "quantitative", "scale": {"domain": [-0.5, len(STATE_ORDER) - 0.5], "reverse": True, "nice": False},
            "axis": {"title": None, "values": list(range(len(STATE_ORDER))), "grid": False, "labelFontSize": 12, "labelFontWeight": 600,
                     "labelColor": INK, "labelPadding": 8, "labelExpr": json.dumps(SHORT) + "[datum.value]"}}


dump("strip_consistency", {
    "description": "Dot strip plot. Each dot is one result (a domain at a year level) for one state, positioned by how many "
                   "percentage points it is above or below the Australian result for the same test. The five dots stacked in "
                   "each row are the five domains.",
    "width": "container", "height": 416,
    "padding": {"left": 4, "right": 150, "top": 10, "bottom": 4},
    "background": None,
    "config": CONFIG,
    "params": [{"name": "year", "value": 2026}],
    "layer": [
        {   # shaded zones: below / above Australia
            "data": {"values": [{"a": -34, "b": 0, "z": "below"}, {"a": 0, "b": 12, "z": "above"}]},
            "mark": {"type": "rect", "opacity": 0.07},
            "encoding": {"x": {"field": "a", "type": "quantitative", "scale": XS,
                               "axis": {"title": "Percentage points above or below the Australian result for the same test", "grid": True,
                                        "values": [-30, -20, -10, 0, 10], "labelExpr": "(datum.value > 0 ? '+' : datum.value < 0 ? '−' : '') + abs(datum.value)"}},
                         "x2": {"field": "b"},
                         "color": {"field": "z", "type": "nominal", "legend": None, "scale": {"domain": ["below", "above"], "range": [CORAL, TEAL]}}},
        },
        {   # the Australian result = zero line
            "data": {"values": [{"x": 0}]},
            "mark": {"type": "rule", "color": INK, "strokeWidth": 1.5},
            "encoding": {"x": {"field": "x", "type": "quantitative", "scale": XS, "axis": None}},
        },
        {   # one dot per result
            "data": csv("state_cells"),
            "transform": [YEAR, STATE_IDX,
                          {"calculate": "indexof(" + json.dumps(DOMAINS) + ", datum.domain)", "as": "dom_idx"},
                          {"calculate": "datum.state_idx + (datum.dom_idx - 2) * 0.15", "as": "y"}],
            "mark": {"type": "circle", "size": 55, "opacity": 0.88, "stroke": "#ffffff", "strokeWidth": 0.8, "tooltip": True},
            "encoding": {
                "x": {"field": "gap", "type": "quantitative", "scale": XS, "axis": None},
                "y": strip_y("y"),
                "color": {"condition": {"test": "datum.gap >= 0", "value": TEAL}, "value": CORAL},
                "tooltip": [
                    {"field": "state", "title": "State / territory"},
                    {"field": "domain", "title": "Domain"},
                    {"field": "level", "title": "Year level"},
                    {"field": "so", "title": "% meeting expectations", "format": ".1f"},
                    {"field": "nat_so", "title": "Australia, same test (%)", "format": ".1f"},
                    {"field": "gap", "title": "Difference (points)", "format": "+.1f"},
                ],
            },
        },
        {   # summary on the right: how many of the 20 results are below Australia
            "data": csv("state_cells"),
            "transform": [YEAR,
                {"calculate": "datum.gap < 0 ? 1 : 0", "as": "is_below"},
                {"aggregate": [{"op": "sum", "field": "is_below", "as": "n_below"}, {"op": "count", "as": "n_total"}], "groupby": ["state"]},
                {"calculate": "datum.n_below == 0 ? 'all ' + datum.n_total + ' above' : datum.n_below == datum.n_total ? 'all ' + datum.n_total + ' below' : datum.n_below + ' of ' + datum.n_total + ' below'", "as": "summary"},
                {"calculate": "datum.n_below == 0 ? '" + TEAL + "' : datum.n_below == datum.n_total ? '#c2410c' : '#4a5568'", "as": "summary_color"},
                STATE_IDX],
            "mark": {"type": "text", "align": "left", "baseline": "middle", "fontSize": 12, "fontWeight": 700, "dx": 10},
            "encoding": {"x": {"datum": 12, "type": "quantitative", "scale": XS, "axis": None},
                         "y": strip_y("state_idx"),
                         "text": {"field": "summary"}, "color": {"field": "summary_color", "type": "nominal", "scale": None, "legend": None}},
        },
        {   # Tasmania has no 2026 results
            "data": csv("state_results"),
            "transform": [{"filter": "datum.year == year && datum.reported == 0"}, STATE_IDX],
            "mark": {"type": "text", "align": "center", "baseline": "middle", "fontSize": 12, "fontStyle": "italic", "color": "#6b7280"},
            "encoding": {"x": {"datum": -14, "type": "quantitative", "scale": XS, "axis": None},
                         "y": strip_y("state_idx"),
                         "text": {"value": "results not published for 2026"}},
        },
    ],
})

# =====================================================================================================
# 3. Remoteness ladder: results for each type of area, Australia vs the selected state
#    marks: line + circle; channels: x = area type (ordered), y = % meeting expectations, size = students tested
# =====================================================================================================
SIZE_R = {"type": "linear", "domain": [0, 5000000], "range": [50, 2400]}
XR = {"field": "remoteness", "type": "ordinal", "scale": {"domain": REMOTENESS, "padding": 0.5},
      "axis": {"title": None, "labelAngle": 0, "labelFontSize": 12, "labelColor": INK, "labelFontWeight": 600, "labelPadding": 8,
               "labelExpr": "replace(datum.label, ' ', '\\n')"}}
YR = {"field": "so", "type": "quantitative", "scale": {"domain": [0, 80], "nice": False},
      "axis": {"title": "% meeting expectations", "grid": True, "values": [0, 20, 40, 60, 80]}}
dump("remoteness_ladder", {
    "description": "How results change with remoteness. Grey = Australia, coral = the selected state. "
                   "Circle area = students tested in that type of area.",
    "width": "container", "height": 300,
    "padding": {"left": 4, "right": 12, "top": 14, "bottom": 4},
    "background": None,
    "config": CONFIG,
    "params": [{"name": "year", "value": 2026}, {"name": "sel", "value": "Northern Territory"}],
    "layer": [
        {"data": csv("remoteness"), "transform": [{"filter": "datum.year == year && datum.state == 'Australia'"}],
         "mark": {"type": "line", "color": "#9aa3b2", "strokeWidth": 3}, "encoding": {"x": XR, "y": YR}},
        {"data": csv("remoteness"), "transform": [{"filter": "datum.year == year && datum.state == 'Australia'"}],
         "mark": {"type": "circle", "color": "#9aa3b2", "opacity": 0.55, "stroke": "#ffffff", "strokeWidth": 1.5, "tooltip": True},
         "encoding": {"x": XR, "y": YR, "size": {"field": "n", "type": "quantitative", "scale": SIZE_R, "legend": None},
                      "tooltip": [{"field": "remoteness", "title": "Type of area"}, {"field": "so", "title": "Australia: % meeting expectations", "format": ".1f"},
                                  {"field": "n", "title": "Students tested in Australia", "format": ","}]}},
        {"data": csv("remoteness"), "transform": [{"filter": "datum.year == year && datum.state == sel"}],
         "mark": {"type": "line", "color": CORAL, "strokeWidth": 3}, "encoding": {"x": XR, "y": YR}},
        {"data": csv("remoteness"), "transform": [{"filter": "datum.year == year && datum.state == sel"}],
         "mark": {"type": "circle", "color": CORAL, "opacity": 0.9, "stroke": "#ffffff", "strokeWidth": 1.5, "tooltip": True},
         "encoding": {"x": XR, "y": YR, "size": {"field": "n", "type": "quantitative", "scale": SIZE_R, "legend": None},
                      "tooltip": [{"field": "state", "title": "State / territory"}, {"field": "remoteness", "title": "Type of area"},
                                  {"field": "so", "title": "% meeting expectations", "format": ".1f"},
                                  {"field": "n", "title": "Students tested", "format": ","}]}},
        {"data": csv("remoteness"), "transform": [{"filter": "datum.year == year && datum.state == 'Australia'"}],
         "mark": {"type": "text", "dy": -16, "fontSize": 11, "fontWeight": 700, "color": "#6b7280"},
         "encoding": {"x": XR, "y": YR, "text": {"field": "so", "type": "quantitative", "format": ".0f"}}},
        {"data": csv("remoteness"), "transform": [{"filter": "datum.year == year && datum.state == sel"}],
         "mark": {"type": "text", "dy": 17, "fontSize": 11, "fontWeight": 700, "color": "#c2410c"},
         "encoding": {"x": XR, "y": YR, "text": {"field": "so", "type": "quantitative", "format": ".0f"}}},
    ],
})

# =====================================================================================================
# 4. Gap breakdown: how much of each state's gap is about where its students live?
#    idiom: diverging stacked bar of the two parts of each state's difference from Australia
# =====================================================================================================
PARTS = {"location": "Where students live", "other": "Everything else"}
dump("gap_breakdown", {
    "description": "Diverging stacked bars. Each bar splits a state's difference from the Australian result into the part "
                   "explained by where its students live (type of area) and everything else. The black tick is the total difference.",
    "width": "container", "height": {"step": 34},
    "padding": {"left": 4, "right": 70, "top": 24, "bottom": 4},
    "background": None,
    "config": CONFIG,
    "params": [{"name": "year", "value": 2026}, {"name": "sel", "value": "Northern Territory"}],
    "data": csv("gap_breakdown"),
    "transform": [{"filter": "datum.year == year"}],
    "encoding": {"y": {"field": "state", "type": "nominal",
                       "sort": {"field": "gap", "op": "max", "order": "descending"},
                       "scale": {"padding": 0.3},
                       "axis": {"title": None, "labelFontSize": 12, "labelFontWeight": 600, "labelColor": INK, "labelLimit": 150,
                                "labelPadding": 8, "labelExpr": "replace(datum.label, 'Australian Capital Territory', 'ACT')"}}},
    "layer": [
        {
            "transform": [{"fold": ["location", "other"], "as": ["part", "pp"]},
                          {"calculate": "datum.part == 'location' ? '" + PARTS["location"] + "' : '" + PARTS["other"] + "'", "as": "part_label"}],
            "mark": {"type": "bar", "cursor": "pointer", "tooltip": True, "stroke": "#ffffff", "strokeWidth": 1},
            "encoding": {
                "x": {"field": "pp", "type": "quantitative", "scale": {"domain": [-30, 8], "nice": False},
                      "axis": {"title": "Difference from Australia (percentage points)", "grid": True, "values": [-30, -20, -10, 0],
                               "labelExpr": "(datum.value > 0 ? '+' : datum.value < 0 ? '−' : '') + abs(datum.value)"}},
                "color": {"field": "part_label", "type": "nominal",
                          "scale": {"domain": list(PARTS.values()), "range": [OCHRE, SLATE]},
                          "legend": {"title": None, "orient": "top", "direction": "horizontal", "symbolType": "square"}},
                "opacity": {"condition": {"test": "datum.state == sel", "value": 1}, "value": 0.62},
                "tooltip": [{"field": "state", "title": "State / territory"}, {"field": "part_label", "title": "Part of the gap"},
                            {"field": "pp", "title": "Points", "format": "+.1f"}, {"field": "gap", "title": "Total difference", "format": "+.1f"}],
            },
        },
        {"mark": {"type": "tick", "color": INK, "thickness": 3, "size": 24},
         "encoding": {"x": {"field": "gap", "type": "quantitative", "scale": {"domain": [-30, 8], "nice": False}, "axis": None}}},
        {"mark": {"type": "text", "align": "left", "dx": 14, "fontSize": 12, "fontWeight": 700, "color": INK},
         "transform": [{"calculate": "(datum.gap > 0 ? '+' : '−') + format(abs(datum.gap), '.1f')", "as": "gap_text"}],
         "encoding": {"x": {"datum": 8, "type": "quantitative", "scale": {"domain": [-30, 8], "nice": False}, "axis": None},
                      "text": {"field": "gap_text"}}},
    ],
})

# =====================================================================================================
# 5. Waterfall drill-down: from the Australian result to the selected state's result
# =====================================================================================================
WX = {"field": "step_label", "type": "ordinal", "sort": {"field": "step", "op": "min"}, "scale": {"padding": 0.25},
      "axis": {"title": None, "labelAngle": 0, "labelFontSize": 12, "labelFontWeight": 600, "labelColor": INK, "labelLimit": 150, "labelPadding": 8,
               "labelExpr": "replace(replace(replace(datum.label, 'Where students live', 'Where its students\\nlive'), 'Everything else', 'Everything\\nelse'), 'Australian Capital Territory', 'ACT')"}}
WY = {"type": "quantitative", "scale": {"domain": [0, 80], "nice": False}}
dump("waterfall", {
    "description": "Waterfall chart for the selected state: start at the Australian result, add the effect of where the "
                   "state's students live, then everything else, to reach the state's own result.",
    "width": "container", "height": 330,
    "padding": {"left": 4, "right": 12, "top": 20, "bottom": 4},
    "background": None,
    "config": CONFIG,
    "params": [{"name": "year", "value": 2026}, {"name": "sel", "value": "Northern Territory"}],
    "data": csv("waterfall"),
    "transform": [
        {"filter": "datum.year == year && datum.state == sel"},
        {"calculate": "datum.step == 4 ? datum.state : datum.label", "as": "step_label"},
        {"calculate": "max(datum.start, datum.end)", "as": "top"},
        {"calculate": "datum.step == 1 ? '#9aa3b2' : datum.step == 2 ? '" + OCHRE + "' : datum.step == 3 ? '" + SLATE + "' : '" + INK + "'", "as": "bar_color"},
        {"calculate": "datum.kind == 'total' ? format(datum.value, '.1f') + '%' : (datum.value > 0 ? '+' : '−') + format(abs(datum.value), '.1f') + ' pp'", "as": "bar_text"},
    ],
    "layer": [
        {   # dashed line at the Australian result
            "transform": [{"aggregate": [{"op": "max", "field": "start", "as": "nat"}]}],
            "mark": {"type": "rule", "color": "#9aa3b2", "strokeDash": [4, 3]},
            "encoding": {"y": {"field": "nat", **WY, "axis": None}},
        },
        {"mark": {"type": "bar", "cornerRadius": 3, "tooltip": True},
         "encoding": {
             "x": WX,
             "y": {"field": "start", **WY, "axis": {"title": "% meeting expectations", "grid": True, "values": [0, 20, 40, 60, 80]}},
             "y2": {"field": "end"},
             "color": {"field": "bar_color", "type": "nominal", "scale": None, "legend": None},
             "tooltip": [{"field": "step_label", "title": "Step"}, {"field": "bar_text", "title": "Value"}],
         }},
        {"mark": {"type": "text", "dy": -9, "fontSize": 13, "fontWeight": 700, "color": INK},
         "encoding": {"x": WX, "y": {"field": "top", **WY, "axis": None}, "text": {"field": "bar_text"}}},
    ],
})
print("wrote:", ", ".join(sorted(p.name for p in OUT.glob("*.json"))))
