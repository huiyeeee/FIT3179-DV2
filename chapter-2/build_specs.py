"""Generate the Vega-Lite specifications for Chapter 2 as human-readable JSON files in ./specs/.

The page (js/main.js) loads these files directly with vegaEmbed. Interactivity is driven by named params
(year, metric, sel) that the page sets from its controls, so the JSON is the complete description of each chart.
Run from this folder:  python3 build_specs.py
"""
import json

import pandas as pd
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "specs"
OUT.mkdir(exist_ok=True)

VL = "https://vega.github.io/schema/vega-lite/v5.json"
FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif'
INK, MUTED, GRID = "#14213d", "#4a5568", "#eee8dc"
CODEX = ("{'Australian Capital Territory': 'ACT', 'New South Wales': 'NSW', 'Victoria': 'VIC', 'Queensland': 'QLD', "
         "'South Australia': 'SA', 'Western Australia': 'WA', 'Northern Territory': 'NT'}")   # short names on phones
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
# 1. Choropleth map: how far is each state from the Australian result?
#    The colour is a percentage (share of students meeting expectations, compared with Australia's), so it is already
#    normalised for the number of students. Extra layers give context: neighbouring land, capital cities, an inset marker for the
#    tiny ACT, a hatched-grey Tasmania (not published) and annotations supplied by the page (see js/main.js).
# =====================================================================================================
def csvn(name, numeric):
    return {"url": f"chapter-2/data/{name}.csv", "format": {"type": "csv", "parse": {c: "number" for c in numeric}}}


MAPNUM = ("year", "n", "so", "nas", "gap_so", "gap_nas", "nat_so", "reported", "lon", "lat", "anchor_lon", "anchor_lat", "leader", "land_pct")
GEO = {"url": "chapter-2/data/states.geojson", "format": {"type": "json", "property": "features"}}
JOIN = [{"lookup": "properties.name", "from": {"data": csvn("map_latest", MAPNUM), "key": "state",
                                                "fields": ["state", "code", "so", "gap_so", "band_so", "n", "nat_so", "reported", "lon", "lat", "land_pct"]}},
        {"calculate": "datum.reported == 1 ? datum.band_so : 'Not published'", "as": "band"},
        {"calculate": "(datum.gap_so > 0 ? '+' : '−') + format(abs(datum.gap_so), '.1f') + ' points'", "as": "gap_label"},
        {"calculate": "datum.reported == 1 ? format(datum.so, '.1f') + '%' : 'not published'", "as": "value_label"},
        {"calculate": "format(datum.nat_so, '.1f') + '%'", "as": "nat_label"},
        {"calculate": "format(datum.n, ',') + ' students (' + format(datum.n / 6103856 * 100, '.1f') + '% of Australia)'", "as": "n_label"},
        {"calculate": "format(datum.land_pct, '.1f') + '% of Australia’s land'", "as": "land_label"},
        {"calculate": "indexof(['10+ pp worse', '3+ pp better'], datum.band) >= 0 ? '#ffffff' : '" + INK + "'", "as": "ink"}]
MAP_BANDS = BANDS + ["Not published"]
MAP_COLORS = BAND_COLORS + ["#e3e3e3"]
MPOS = {"longitude": {"field": "lon", "type": "quantitative"}, "latitude": {"field": "lat", "type": "quantitative"}}
dump("map_states", {
    "description": "Choropleth map of Australian states and territories. Colour = how many percentage points the share of students meeting "
                   "expectations is above or below Australia's. An inset marker shows the ACT; annotations are supplied by the page.",
    "width": "container", "height": "container",
    "padding": {"left": 0, "right": 0, "top": 0, "bottom": 0},
    "background": None, "config": CONFIG,
    "params": [{"name": "sel", "value": "Northern Territory"}],
    # a fixed, centred projection (not "fit") so that the notes drawn beside the map do not shrink or shift it
    "projection": {"type": "conicEqualArea", "rotate": [-134, 0, 0], "parallels": [-18, -36], "center": [0, -27],
                   "scale": {"expr": "width < 600 ? min(width * 1.05, height * 1.05) : min(width * 1.3, height * 1.3)"}, "translate": {"expr": "[width / 2, height / 2]"}},
    "layer": [
        {   # the states, filled by how far they are from Australia
            "data": GEO, "transform": JOIN,
            "mark": {"type": "geoshape", "stroke": "#ffffff", "strokeWidth": 1.4, "cursor": "pointer", "tooltip": True},
            "encoding": {"fill": {"field": "band", "type": "nominal", "scale": {"domain": MAP_BANDS, "range": MAP_COLORS}, "legend": None},
                         "tooltip": [{"field": "state", "title": "State / territory"}, {"field": "value_label", "title": "Meeting expectations"},
                                     {"field": "nat_label", "title": "Australia"}, {"field": "gap_label", "title": "Difference"},
                                     {"field": "n_label", "title": "Students tested"}, {"field": "land_label", "title": "Area"}]}},
        {   # the state picked on the page gets a dark outline
            "data": GEO, "transform": JOIN + [{"filter": "datum.state == sel"}],
            "mark": {"type": "geoshape", "fill": None, "stroke": INK, "strokeWidth": 2.5}},
        {   # inset marker for the ACT (far too small to see at this scale), with a leader line back to Canberra
            "data": csv("map_latest"), "transform": [{"filter": "datum.leader == 1"}],
            "mark": {"type": "rule", "stroke": "#9aa3b2", "strokeWidth": 1},
            "encoding": {"longitude": {"field": "lon", "type": "quantitative"}, "latitude": {"field": "lat", "type": "quantitative"},
                         "longitude2": {"field": "anchor_lon"}, "latitude2": {"field": "anchor_lat"}}},
        {"data": csvn("map_latest", MAPNUM), "transform": [{"filter": "datum.leader == 1"}] + [{"calculate": "datum.band_so", "as": "band"}],
         "mark": {"type": "circle", "size": 170, "stroke": "#ffffff", "strokeWidth": 1.5, "cursor": "pointer", "tooltip": True},
         "encoding": {**MPOS, "fill": {"field": "band", "type": "nominal", "scale": {"domain": MAP_BANDS, "range": MAP_COLORS}, "legend": None},
                      "tooltip": [{"field": "state", "title": "State / territory"}, {"field": "so", "title": "Meeting expectations (%)", "format": ".1f"},
                                  {"field": "gap_so", "title": "Difference (points)", "format": "+.1f"}]}},
        {   # state code and result, written on each state
            "data": csvn("map_latest", MAPNUM), "transform": [{"filter": "datum.leader == 0"}] + [
                {"calculate": "datum.reported == 1 ? datum.band_so : 'Not published'", "as": "band"},
                {"calculate": "indexof(['10+ pp worse', '3+ pp better'], datum.band) >= 0 ? '#ffffff' : '" + INK + "'", "as": "ink"},
                {"calculate": "datum.reported == 1 ? format(datum.so, '.1f') + '%' : 'not published'", "as": "value_label"}],
            "mark": {"type": "text", "dy": -7, "fontSize": 11, "fontWeight": 700},
            "encoding": {**MPOS, "text": {"field": "code"}, "color": {"field": "ink", "type": "nominal", "scale": None, "legend": None}}},
        {"data": csvn("map_latest", MAPNUM), "transform": [{"filter": "datum.leader == 0"}] + [
            {"calculate": "datum.reported == 1 ? datum.band_so : 'Not published'", "as": "band"},
            {"calculate": "indexof(['10+ pp worse', '3+ pp better'], datum.band) >= 0 ? '#ffffff' : '" + INK + "'", "as": "ink"},
            {"calculate": "datum.reported == 1 ? format(datum.so, '.1f') + '%' : 'not published'", "as": "value_label"}],
         "mark": {"type": "text", "dy": 7, "fontSize": 12, "fontWeight": 700},
         "encoding": {**MPOS, "text": {"field": "value_label"}, "color": {"field": "ink", "type": "nominal", "scale": None, "legend": None}}},
        {"data": csvn("map_latest", MAPNUM), "transform": [{"filter": "datum.leader == 1"}, {"calculate": "width < 420 ? datum.code : datum.code + ' ' + format(datum.so, '.1f') + '%'", "as": "t"}],
         "mark": {"type": "text", "align": "left", "dx": 11, "fontSize": 11, "fontWeight": 700, "color": INK},
         "encoding": {**MPOS, "text": {"field": "t"}}},
        {   # annotations supplied by the page: a leader line and a note for each row (see js/main.js)
            "data": {"name": "annot"}, "transform": [{"filter": "isValid(datum.lon2)"}],
            "mark": {"type": "rule", "strokeWidth": 1.2, "strokeDash": [3, 2]},
            "encoding": {"longitude": {"field": "lon2", "type": "quantitative"}, "latitude": {"field": "lat2", "type": "quantitative"},
                         "longitude2": {"field": "lon3"}, "latitude2": {"field": "lat3"},
                         "color": {"field": "color", "type": "nominal", "scale": None, "legend": None}}},
        {"data": {"name": "annot"}, "transform": [{"filter": "isValid(datum.text)"}],
         "mark": {"type": "text", "align": "left", "baseline": "top", "fontSize": 11.5, "fontWeight": 600, "lineBreak": "\n", "lineHeight": 14},
         "encoding": {"longitude": {"field": "lon", "type": "quantitative"}, "latitude": {"field": "lat", "type": "quantitative"},
                      "text": {"field": "text"}, "color": {"field": "color", "type": "nominal", "scale": None, "legend": None}}},
    ],
})


# =====================================================================================================
# 2. Dot strip plot: how consistent is each state across all 20 tests (5 subjects x 4 year levels)?
#    idiom: dot strip. Position = points above or below Australia on the same test. Filled dot = clear gap; hollow dot = too close to call
#    (ACARA's state comparisons). Param 'view' picks what the dots are coloured and laned by: all | level | subject.
# =====================================================================================================
DOMAINS = ["Reading", "Writing", "Spelling", "Grammar and Punctuation", "Numeracy"]
SHORT = [("ACT" if s == "Australian Capital Territory" else s) for s in STATE_ORDER]
XS = {"domain": [-34, 12], "nice": False}
YEAR = {"filter": "datum.year == year"}
STATE_IDX = {"calculate": "indexof(" + json.dumps(STATE_ORDER) + ", datum.state)", "as": "state_idx"}
CNUM = ("year", "level", "so", "n", "nat_so", "gap", "sig")
KEYS = ["Below Australia", "Above Australia", "Year 3", "Year 5", "Year 7", "Year 9"] + DOMAINS
KEYCOL = ["#f0745a", "#1f6f8b", "#cbd5e1", "#94a3b8", "#556987", "#1e2f4d", "#c2410c", "#1f6f8b", "#7b5ea7", "#b8860b", "#4b5563"]
STRIP_CALC = [
    YEAR, STATE_IDX,
    {"calculate": "indexof(" + json.dumps(DOMAINS) + ", datum.domain)", "as": "dom_idx"},
    {"calculate": "datum.state_idx + (mode == 'level' ? (indexof([3, 5, 7, 9], datum.level) - 1.5) * 0.2 : (datum.dom_idx - 2) * 0.17)", "as": "y"},
    {"calculate": "mode == 'all' ? (datum.gap >= 0 ? 'Above Australia' : 'Below Australia') : mode == 'level' ? 'Year ' + datum.level : datum.domain", "as": "key"},
    {"calculate": "'Year ' + datum.level + ' ' + datum.domain", "as": "test"},
    {"calculate": "datum.sig == 0 ? 'Too close to call' : datum.sig > 0 ? 'Clearly above Australia' : 'Clearly below Australia'", "as": "clear"},
]


def strip_y(field):
    return {"field": field, "type": "quantitative", "scale": {"domain": [-0.5, len(STATE_ORDER) - 0.5], "reverse": True, "nice": False},
            "axis": {"title": None, "values": list(range(len(STATE_ORDER))), "grid": False, "labelFontSize": 12, "labelFontWeight": 600,
                     "labelColor": INK, "labelPadding": 8,
                     "labelExpr": "width < 600 ? " + json.dumps(["VIC", "ACT", "NSW", "WA", "SA", "QLD", "TAS", "NT"]) + "[datum.value] : " + json.dumps(SHORT) + "[datum.value]"}}


STRIP_COLOR = {"field": "key", "type": "nominal", "scale": {"domain": KEYS, "range": KEYCOL}, "legend": None}
STRIP_TIP = [{"field": "state", "title": "State / territory"}, {"field": "test", "title": "Test"},
             {"field": "so", "title": "% meeting expectations", "format": ".1f"}, {"field": "nat_so", "title": "Australia, same test (%)", "format": ".1f"},
             {"field": "gap", "title": "Difference (points)", "format": "+.1f"}, {"field": "clear", "title": "Is the gap clear?"}]
dump("strip_consistency", {
    "description": "Dot strip plot. Each dot is one result (a subject at a year level) for one state, placed by how many percentage points it is above "
                   "or below the Australian result for the same test. Filled dots are clear gaps; hollow dots are too close to call.",
    "width": "container", "height": 416,
    "padding": {"left": 4, "right": 8, "top": 34, "bottom": 4},
    "background": None, "config": CONFIG,
    "params": [{"name": "year", "value": 2026}, {"name": "mode", "value": "all"}, {"name": "sel", "value": "Northern Territory"}],
    "layer": [
        {   # shaded zones: below / above Australia
            "data": {"values": [{"a": -34, "b": 0, "z": "below"}, {"a": 0, "b": 12, "z": "above"}]},
            "mark": {"type": "rect", "opacity": 0.07},
            "encoding": {"x": {"field": "a", "type": "quantitative", "scale": XS,
                               "axis": {"title": "Percentage points above or below the Australian result for the same test", "grid": True,
                                        "values": [-30, -20, -10, 0, 10], "labelExpr": "(datum.value > 0 ? '+' : datum.value < 0 ? '−' : '') + abs(datum.value)"}},
                         "x2": {"field": "b"},
                         "fill": {"field": "z", "type": "nominal", "legend": None, "scale": {"domain": ["below", "above"], "range": [CORAL, TEAL]}}}},
        {"data": {"values": [{"x": 0}]}, "mark": {"type": "rule", "color": INK, "strokeWidth": 1.5},
         "encoding": {"x": {"field": "x", "type": "quantitative", "scale": XS}}},
        {   # the picked state gets a soft band behind its dots
            "data": {"values": [{"i": i - 0.5, "i2": i + 0.5, "state": st} for i, st in enumerate(STATE_ORDER)]}, "transform": [{"filter": "datum.state == sel"}],
            "mark": {"type": "rect", "color": "#14213d", "opacity": 0.06},
            "encoding": {"x": {"datum": -34, "type": "quantitative", "scale": XS}, "x2": {"datum": 12},
                         "y": strip_y("i"),
                         "y2": {"field": "i2"}},
        },
        {   # clear gaps: filled dots
            "data": csvn("state_cells", CNUM), "transform": STRIP_CALC + [{"filter": "datum.sig != 0"}],
            "mark": {"type": "circle", "size": 60, "opacity": 0.92, "stroke": "#ffffff", "strokeWidth": 0.8, "cursor": "pointer", "tooltip": True},
            "encoding": {"x": {"field": "gap", "type": "quantitative", "scale": XS}, "y": strip_y("y"), "color": STRIP_COLOR, "tooltip": STRIP_TIP}},
        {   # gaps too close to call: hollow dots
            "data": csvn("state_cells", CNUM), "transform": STRIP_CALC + [{"filter": "datum.sig == 0"}],
            "mark": {"type": "point", "filled": False, "fill": "#ffffff", "size": 60, "strokeWidth": 1.8, "opacity": 1, "cursor": "pointer", "tooltip": True},
            "encoding": {"x": {"field": "gap", "type": "quantitative", "scale": XS}, "y": strip_y("y"), "color": STRIP_COLOR, "tooltip": STRIP_TIP}},
        {   # summary on the right: how many of the 20 results are below Australia
            "data": csvn("state_cells", CNUM),
            "transform": [YEAR, {"calculate": "datum.gap < 0 ? 1 : 0", "as": "is_below"},
                          {"aggregate": [{"op": "sum", "field": "is_below", "as": "n_below"}, {"op": "count", "as": "n_total"}], "groupby": ["state"]},
                          {"calculate": "datum.n_below == 0 ? 'all ' + datum.n_total + ' above' : datum.n_below == datum.n_total ? 'all ' + datum.n_total + ' below' : datum.n_below + ' of ' + datum.n_total + ' below'", "as": "summary"},
                          {"calculate": "datum.n_below == 0 ? '" + TEAL + "' : datum.n_below == datum.n_total ? '#c2410c' : '#4a5568'", "as": "summary_color"}, STATE_IDX],
            "mark": {"type": "text", "align": "left", "baseline": "middle", "fontSize": 12, "fontWeight": 700, "dx": 10},
            "encoding": {"x": {"datum": 12, "type": "quantitative", "scale": XS}, "y": strip_y("state_idx"),
                         "text": {"field": "summary"}, "color": {"field": "summary_color", "type": "nominal", "scale": None, "legend": None}}},
        {   # column headings
            "data": {"values": [{"t": "Results"}]},
            "mark": {"type": "text", "align": "left", "baseline": "bottom", "dy": -4, "dx": 10, "fontSize": 10.5, "fontWeight": 700, "color": MUTED},
            "encoding": {"x": {"datum": 12, "type": "quantitative", "scale": XS}, "y": {"datum": -0.5, "type": "quantitative", "scale": {"domain": [-0.5, len(STATE_ORDER) - 0.5], "reverse": True, "nice": False}, "axis": strip_y("y")["axis"]}, "text": {"field": "t"}}},
        {   # Tasmania has no 2026 results
            "data": csvn("state_results", ("year", "reported")),
            "transform": [{"filter": "datum.year == year && datum.reported == 0 && datum.state != 'Australia'"}, STATE_IDX],
            "mark": {"type": "text", "align": "center", "baseline": "middle", "fontSize": 12, "fontStyle": "italic", "color": "#6b7280"},
            "encoding": {"x": {"datum": -14, "type": "quantitative", "scale": XS}, "y": strip_y("state_idx"),
                         "text": {"value": "results not published for 2026"}}},
        {   # informative notes supplied by the page (see js/main.js)
            "data": {"name": "annot"},
            "mark": {"type": "text", "align": "left", "baseline": "middle", "fontSize": 11, "fontWeight": 600, "lineBreak": "\n", "lineHeight": 13, "color": INK},
            "encoding": {"x": {"field": "x", "type": "quantitative", "scale": XS}, "y": strip_y("yi"), "text": {"field": "text"}}},
    ],
})

# =====================================================================================================
# 2b. Parents with a degree: a small bar chart that sits beside the dot strip (same rows, same height), shown on request.
#     Its x scale is its own (0 to 100%), so it is a separate chart rather than a layer on the strip.
# =====================================================================================================
NATP = float(pd.read_csv(HERE / "data" / "state_context.csv").query("state == 'Australia'").parents_degree_pct.iloc[0])
BY = {"field": "state_idx", "type": "quantitative", "scale": {"domain": [-0.5, len(STATE_ORDER) - 0.5], "reverse": True, "nice": False}, "axis": None}
BX = {"type": "quantitative", "scale": {"domain": [0, 100], "nice": False}}
dump("parents_bars", {
    "description": "Bar chart: share of tested students whose parent has a bachelor degree, one bar per state, in the same row order as the dot strip. "
                   "The dashed line is the Australian figure.",
    "width": "container", "height": 416,
    "padding": {"left": 4, "right": 40, "top": 34, "bottom": 4},
    "background": None, "config": CONFIG,
    "params": [{"name": "sel", "value": "Northern Territory"}],
    "data": csvn("state_context", ("parents_degree_pct", "indigenous_pct", "participation_pct")),
    "transform": [{"filter": "datum.state != 'Australia'"}, STATE_IDX, {"calculate": "format(datum.parents_degree_pct, '.0f') + '%'", "as": "t"}],
    "layer": [
        {"transform": [{"filter": "datum.state == sel"}, {"calculate": "datum.state_idx - 0.5", "as": "i0"}, {"calculate": "datum.state_idx + 0.5", "as": "i1"}],
         "mark": {"type": "rect", "color": "#14213d", "opacity": 0.06},
         "encoding": {"x": {"datum": 0, **BX}, "x2": {"datum": 100}, "y": {"field": "i0", "type": "quantitative", "scale": BY["scale"], "axis": None}, "y2": {"field": "i1"}}},
        {"mark": {"type": "bar", "size": 16, "color": "#7b8fa8", "cornerRadiusEnd": 3, "tooltip": True},
         "encoding": {"x": {"field": "parents_degree_pct", **BX, "axis": {"title": "Parents with a degree", "grid": True, "values": [0, 50, 100], "labelExpr": "datum.value + '%'"}},
                      "x2": {"datum": 0}, "y": BY,
                      "tooltip": [{"field": "state", "title": "State / territory"}, {"field": "parents_degree_pct", "title": "Students with a parent who has a degree (%)", "format": ".1f"}]}},
        {"mark": {"type": "text", "align": "right", "baseline": "middle", "dx": 34, "fontSize": 12, "fontWeight": 700, "color": INK},
         "encoding": {"x": {"datum": 100, **BX}, "y": BY, "text": {"field": "t"}}},
        {   # the Australian figure
            "data": csvn("state_context", ("parents_degree_pct",)), "transform": [{"filter": "datum.state == 'Australia'"}, {"calculate": "'Australia: ' + format(datum.parents_degree_pct, '.0f') + '%'", "as": "t"}],
            "mark": {"type": "rule", "color": INK, "strokeDash": [4, 3], "strokeWidth": 1.4, "opacity": 0.7},
            "encoding": {"x": {"field": "parents_degree_pct", **BX}}},
        {   # callout on the dashed line
            "data": csvn("state_context", ("parents_degree_pct",)), "transform": [{"filter": "datum.state == 'Australia'"}, {"calculate": "'Australia ' + format(datum.parents_degree_pct, '.0f') + '%'", "as": "t"}],
            "mark": {"type": "text", "align": "center", "baseline": "bottom", "dy": -4, "fontSize": 10.5, "fontWeight": 700, "color": INK},
            "encoding": {"x": {"field": "parents_degree_pct", **BX}, "y": {"value": 0}, "text": {"field": "t"}}},
    ],
})

# =====================================================================================================
# 3. Remoteness ladder: results for each type of area, Australia vs the selected state
#    marks: line + circle; channels: x = area type (ordered), y = % meeting expectations, size = students tested
# =====================================================================================================
SIZE_R = {"type": "linear", "domain": [0, 5000000], "range": [50, 2400]}
XR = {"field": "remoteness", "type": "ordinal", "scale": {"domain": REMOTENESS, "padding": 0.5},
      "axis": {"title": None, "labelAngle": 0, "labelFontSize": 12, "labelColor": INK, "labelFontWeight": 600, "labelPadding": 8,
               "labelExpr": "split(datum.label, ' ')"}}
YR = {"field": "so", "type": "quantitative", "scale": {"domain": [0, 80], "nice": False},
      "axis": {"title": "% meeting expectations", "grid": True, "values": [0, 20, 40, 60, 80]}}
ABOVE = "datum.sel_so != null && isFinite(datum.sel_so) && datum.sel_so >= datum.nat_so"
PRE = [{"filter": "datum.year == year && (datum.state == sel || datum.state == 'Australia')"},
       {"calculate": "datum.state == sel ? datum.so : null", "as": "s1"}, {"calculate": "datum.state == 'Australia' ? datum.so : null", "as": "n1"},
       {"joinaggregate": [{"op": "max", "field": "s1", "as": "sel_so"}, {"op": "max", "field": "n1", "as": "nat_so"}], "groupby": ["remoteness"]}]
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
                                  {"field": "n", "title": "Students tested", "format": ","}]}}
    ] + [
        {"data": csvn("remoteness", ("year", "n", "so")), "transform": PRE + [{"filter": f"datum.state == {("sel" if who == "sel" else repr(who))} && ({ABOVE}) == {str(above).lower()}"}],
         "mark": {"type": "text", "dy": dy, "fontSize": 11, "fontWeight": 700, "color": col},
         "encoding": {"x": XR, "y": YR, "text": {"field": "so", "type": "quantitative", "format": ".0f"}}}
        for who, above, dy, col in [("sel", True, -16, "#c2410c"), ("sel", False, 17, "#c2410c"),
                                    ("Australia", True, 17, "#6b7280"), ("Australia", False, -16, "#6b7280")]
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
    "padding": {"left": 4, "right": 46, "top": 24, "bottom": 4},
    "background": None,
    "config": CONFIG,
    "params": [{"name": "year", "value": 2026}, {"name": "sel", "value": "Northern Territory"}],
    "data": csv("gap_breakdown"),
    "transform": [{"filter": "datum.year == year"}],
    "encoding": {"y": {"field": "state", "type": "nominal",
                       "sort": {"field": "gap", "op": "max", "order": "descending"},
                       "scale": {"padding": 0.3},
                       "axis": {"title": None, "labelFontSize": 12, "labelFontWeight": 600, "labelColor": INK, "labelLimit": 150,
                                "labelPadding": 8, "labelExpr": "width < 360 ? " + CODEX + "[datum.label] : replace(datum.label, 'Australian Capital Territory', 'ACT')"}}},
    "layer": [
        {
            "transform": [{"fold": ["location", "other"], "as": ["part", "pp"]},
                          {"calculate": "datum.part == 'location' ? '" + PARTS["location"] + "' : '" + PARTS["other"] + "'", "as": "part_label"}],
            "mark": {"type": "bar", "cursor": "pointer", "tooltip": True, "stroke": "#ffffff", "strokeWidth": 1},
            "encoding": {
                "x": {"field": "pp", "type": "quantitative", "scale": {"domain": [-30, 10], "nice": False},
                      "axis": {"title": "Difference from Australia (percentage points)", "grid": True, "values": [-30, -20, -10, 0, 10],
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
         "encoding": {"x": {"field": "gap", "type": "quantitative", "scale": {"domain": [-30, 10], "nice": False}}}},
        {"mark": {"type": "text", "align": "left", "dx": 14, "fontSize": 12, "fontWeight": 700, "color": INK},
         "transform": [{"calculate": "(datum.gap > 0 ? '+' : '−') + format(abs(datum.gap), '.1f')", "as": "gap_text"}],
         "encoding": {"x": {"datum": 10, "type": "quantitative", "scale": {"domain": [-30, 10], "nice": False}},
                      "text": {"field": "gap_text"}}},
    ],
})


# =====================================================================================================
# Numbers used in the notes drawn on the maps below (all from the CSV files, so the notes cannot drift from the data)
# =====================================================================================================
_res = pd.read_csv(HERE / "data" / "state_results.csv")
_ctx = pd.read_csv(HERE / "data" / "state_context.csv").set_index("state")
_m = pd.read_csv(HERE / "data" / "map_latest.csv")
_YEAR = int(_res.year.max())
_aus = _res[(_res.year == _YEAR) & (_res.state == "Australia")].iloc[0]
_ok = _res[(_res.state != "Australia") & (_res.reported == 1)]
_nt_lowest = all(g.sort_values("so").iloc[0].state == "Northern Territory" for _, g in _ok.groupby("year"))
_big3 = _m[_m.code.isin(["NSW", "VIC", "QLD"])].n.sum() / _aus.n * 100
_nt_share = _m[_m.code == "NT"].n.iloc[0] / _aus.n * 100
_pub = _m[_m.reported == 1].copy()
_pub["cnt_ex"] = _pub.n * _pub.exceed / 100
_two = _pub[_pub.code.isin(["NSW", "VIC"])].cnt_ex.sum() / _pub.cnt_ex.sum() * 100
_nt_ex = _pub[_pub.code == "NT"].iloc[0]
_nat_ex = float(_aus.exceed)

# =====================================================================================================
# 1a. Contiguous area cartogram (first tab): each state is redrawn so its AREA is proportional to its students tested, while
#     neighbours still touch (shapes from data/make_cartogram.py). Colour = how far the share meeting expectations is from Australia's.
#     Size answers "how many students", colour answers "how well are they doing", so the Territory is far below AND tiny.
# =====================================================================================================
CLAB = {"url": "chapter-2/data/cartogram_labels.csv", "format": {"type": "csv", "parse": {c: "number" for c in ("cx", "cy", "lx", "ly", "ext", "side", "area_share", "students_share")}}}
CARTO_FIELDS = ["state", "code", "so", "gap_so", "band_so", "n", "nat_so", "reported"]
CARTO_JOIN = [
    {"lookup": "properties.name", "from": {"data": CLAB, "key": "state", "fields": ["cx", "cy", "lx", "ly", "ext", "side", "students_share"]}},
    {"lookup": "properties.name", "from": {"data": csvn("map_latest", MAPNUM), "key": "state", "fields": CARTO_FIELDS}},
    {"calculate": "datum.reported == 1 ? datum.band_so : 'Not published'", "as": "band"},
    {"calculate": "(datum.gap_so > 0 ? '+' : '−') + format(abs(datum.gap_so), '.1f') + ' points'", "as": "gap_label"},
    {"calculate": "datum.reported == 1 ? format(datum.so, '.1f') + '%' : 'not published'", "as": "value_label"},
    {"calculate": "format(datum.nat_so, '.1f') + '%'", "as": "nat_label"},
    {"calculate": "format(datum.n, ',') + ' (' + format(datum.n / 6103856 * 100, '.1f') + '% of Australia)'", "as": "n_label"},
    {"calculate": "indexof(['10+ pp worse', '3+ pp better'], datum.band) >= 0 ? '#ffffff' : '" + INK + "'", "as": "ink"},
    {"calculate": "width < 420 ? datum.code : datum.reported == 1 ? datum.code + ' ' + format(datum.so, '.0f') + '%' : datum.code + ' not published'", "as": "label"},
]
CPOS = {"longitude": {"field": "cx", "type": "quantitative"}, "latitude": {"field": "cy", "type": "quantitative"}}
CLPOS = {"longitude": {"field": "lx", "type": "quantitative"}, "latitude": {"field": "ly", "type": "quantitative"}}
CGEO = {"url": "chapter-2/data/cartogram.geojson", "format": {"type": "json", "property": "features"}}
SHOW = {"expr": "width >= 560 ? 1 : 0"}          # the notes need width: phones keep the labels and drop the notes
NOTE_MARK = {"type": "text", "align": "left", "baseline": "top", "fontSize": 11.5, "fontWeight": 600, "lineBreak": "\n", "lineHeight": 14, "opacity": SHOW}
carto_notes = [
    {"x": 12, "y": 8, "color": "#c2410c",
     "text": "Northern Territory: lowest result\n" + (f"in every year since {int(_res.year.min())}.\n" if _nt_lowest else "") +
             f"{_ctx.loc['Northern Territory'].indigenous_pct:.0f}% of its students are Indigenous\n(Australia: {_ctx.loc['Australia'].indigenous_pct:.0f}%)."},
    {"x": 12, "y": 690, "color": "#4a5568",
     "text": f"{_big3:.0f}% of students live in NSW,\nVictoria and Queensland, so they\nsteer the national result.\nThe Territory has {_nt_share:.1f}%."},
    {"x": 12, "y": 850, "color": "#4a5568",
     "text": f"Tasmania: no {_YEAR} result. A union\nboycott of public-school testing\ncut participation to {_ctx.loc['Tasmania'].participation_pct:.0f}%, below\nthe reporting threshold."},
]
carto_calls = [        # callout lines: from the right edge of each note to the state it explains
    {"x": 470, "y": 78, "x2": 520, "y2": 150, "color": "#c2410c"},       # Territory note -> the Territory
    {"x": 485, "y": 895, "x2": 903, "y2": 958, "color": "#4a5568"},      # Tasmania note -> Tasmania
]
dump("map_cartogram", {
    "description": "Contiguous area cartogram of the states and territories. Each state is redrawn so its area is proportional to its students tested, "
                   "while neighbours still touch. Colour = how many percentage points the share meeting expectations is above or below Australia's. Tasmania is not published.",
    "width": "container", "height": "container", "autosize": {"type": "fit", "contains": "padding"},
    "padding": {"left": 4, "right": 4, "top": 4, "bottom": 4},
    "background": None, "config": CONFIG,
    "params": [{"name": "sel", "value": "Northern Territory"}],
    "projection": {"type": "identity"},
    "layer": [
        {"data": CGEO, "transform": CARTO_JOIN,
         "mark": {"type": "geoshape", "cursor": "pointer", "tooltip": True, "strokeJoin": "round"},
         "encoding": {"fill": {"field": "band", "type": "nominal", "scale": {"domain": MAP_BANDS, "range": MAP_COLORS}, "legend": None},
                      "stroke": {"condition": {"test": "datum.state == sel", "value": INK}, "value": "#ffffff"},
                      "strokeWidth": {"condition": {"test": "datum.state == sel", "value": 2}, "value": 1.2},
                      "tooltip": [{"field": "state", "title": "State / territory"}, {"field": "value_label", "title": "Meeting expectations"},
                                  {"field": "nat_label", "title": "Australia"}, {"field": "gap_label", "title": "Difference"},
                                  {"field": "n_label", "title": "Students tested"}]}},
        {"data": CLAB, "transform": [{"filter": "datum.ext == 1"}],      # leader lines from the small states to their labels
         "mark": {"type": "rule", "stroke": "#9aa3b2", "strokeWidth": 1},
         "encoding": {**CLPOS, "longitude2": {"field": "cx"}, "latitude2": {"field": "cy"}}},
        {"data": CGEO, "transform": CARTO_JOIN + [{"filter": "datum.ext == 0"}],      # labels inside the big states
         "mark": {"type": "text", "fontSize": 13, "fontWeight": 700},
         "encoding": {**CPOS, "text": {"field": "label"}, "color": {"field": "ink", "type": "nominal", "scale": None, "legend": None}}},
        {"data": CGEO, "transform": CARTO_JOIN + [{"filter": "datum.ext == 1 && datum.side == 1"}],      # labels to the right of the small states
         "mark": {"type": "text", "align": "left", "dx": 6, "fontSize": 12.5, "fontWeight": 700, "color": INK},
         "encoding": {**CLPOS, "text": {"field": "label"}}},
        {"data": CGEO, "transform": CARTO_JOIN + [{"filter": "datum.ext == 1 && datum.side == -1"}],     # labels to the left (the Territory)
         "mark": {"type": "text", "align": "right", "dx": -6, "fontSize": 12.5, "fontWeight": 700, "color": INK},
         "encoding": {**CLPOS, "text": {"field": "label"}}},
        {   # annotations supplied by the page (js/main.js measures the text so each leader line starts at its note)
            "data": {"name": "annot"}, "transform": [{"filter": "isValid(datum.lon2)"}],
            "mark": {"type": "rule", "strokeWidth": 1.2, "strokeDash": [3, 2]},
            "encoding": {"longitude": {"field": "lon2", "type": "quantitative"}, "latitude": {"field": "lat2", "type": "quantitative"},
                         "longitude2": {"field": "lon3"}, "latitude2": {"field": "lat3"},
                         "color": {"field": "color", "type": "nominal", "scale": None, "legend": None}}},
        {"data": {"name": "annot"}, "transform": [{"filter": "isValid(datum.text)"}],
         "mark": {"type": "text", "align": "left", "baseline": "top", "fontSize": 11.5, "fontWeight": 600, "lineBreak": "\n", "lineHeight": 14},
         "encoding": {"longitude": {"field": "lon", "type": "quantitative"}, "latitude": {"field": "lat", "type": "quantitative"},
                      "text": {"field": "text"}, "color": {"field": "color", "type": "nominal", "scale": None, "legend": None}}},
    ],
})

# =====================================================================================================
# 1b. Proportional symbol map (third tab, exceeding expectations): one circle per state.
#     Area = number of students exceeding expectations (a count); colour = above / below the Australian share exceeding.
#     Count and rate on one map: the Territory is far below Australia AND has almost no students at the top end.
# =====================================================================================================
EX_BANDS = ["5+ below", "2–5 below", "within 2", "2+ above"]
EX_COLORS = ["#c2410c", "#f0745a", "#b8b2a4", "#7fb3c7"]
SYMNUM = ("n", "so", "exceed", "lon", "lat", "anchor_lon", "anchor_lat", "reported", "leader")
SYM_AREA = "datum.cnt / 400000 * 6500"      # pixel area of a circle; 400,000 students = 6,500 square pixels
SYM_POS = {"longitude": {"field": "sx", "type": "quantitative"}, "latitude": {"field": "sy", "type": "quantitative"}}
_ex = "datum.exceed - %.4f" % _nat_ex
SYM_CALC = [
    {"filter": "datum.reported == 1"},
    {"calculate": "{'NSW': 148.6, 'VIC': 143.6, 'QLD': 144.5, 'ACT': 155.0}[datum.code] || datum.lon", "as": "sx"},
    {"calculate": "{'NSW': -32.2, 'VIC': -37.6, 'ACT': -36.6}[datum.code] || datum.lat", "as": "sy"},
    {"calculate": _ex, "as": "gap_ex"},
    {"calculate": "datum.gap_ex <= -5 ? '" + EX_BANDS[0] + "' : datum.gap_ex <= -2 ? '" + EX_BANDS[1] + "' : datum.gap_ex < 2 ? '" + EX_BANDS[2] + "' : '" + EX_BANDS[3] + "'", "as": "band"},
    {"calculate": "datum.n * datum.exceed / 100", "as": "cnt"},
    {"calculate": "'about ' + format(round(datum.cnt / 1000), ',') + ',000 students (' + format(datum.exceed, '.1f') + '%)'", "as": "cnt_label"},
    {"calculate": "format(" + "%.1f" % _nat_ex + ", '.1f') + '%'", "as": "nat_label"},
    {"calculate": "(datum.gap_ex > 0 ? '+' : '−') + format(abs(datum.gap_ex), '.1f') + ' points'", "as": "gap_label"},
    {"calculate": "width < 420 ? datum.code : datum.code + ' ' + format(datum.exceed, '.0f') + '%'", "as": "label"},
    {"calculate": "datum.sy + (sqrt(" + SYM_AREA.replace("6500", "(width < 600 ? 1700 : 6500)") + " / PI) + 5) * 180 / (PI * (width < 600 ? min(width * 1.05, height * 1.05) : min(width * 1.3, height * 1.3)))", "as": "ly"},
]
SYM_COLOR = {"field": "band", "type": "nominal", "scale": {"domain": EX_BANDS, "range": EX_COLORS}, "legend": None}
SYM_DATA = csvn("map_latest", SYMNUM + ("anchor_lon", "anchor_lat") + ("exceed",))
sym_notes = [
    {"lon": 110.5, "lat": -12.5, "color": "#c2410c",
     "text": f"Northern Territory: {_nt_ex.exceed:.0f}% exceed expectations,\nless than half Australia’s {_nat_ex:.0f}%."},
    {"lon": 110.5, "lat": -35.0, "color": "#4a5568",
     "text": f"NSW and Victoria hold {_two:.0f}% of all\nstudents exceeding expectations."},
    {"lon": 153.5, "lat": -40.0, "color": "#4a5568",
     "text": f"{_ctx.loc['Australian Capital Territory'].parents_degree_pct:.0f}% of ACT students’ parents have\na degree, the highest of any state\n(Australia: {_ctx.loc['Australia'].parents_degree_pct:.0f}%)."},
]
sym_calls = [          # callout lines from each note to the circle(s) it explains
    {"lon": 128.0, "lat": -15.3, "lon2": 132.7, "lat2": -18.7, "color": "#c2410c"},      # Territory note -> Territory
    {"lon": 124.6, "lat": -36.3, "lon2": 140.7, "lat2": -37.2, "color": "#4a5568"},      # NSW/VIC note -> Victoria
    {"lon": 124.6, "lat": -36.0, "lon2": 145.6, "lat2": -33.0, "color": "#4a5568"},      # NSW/VIC note -> NSW
    {"lon": 155.0, "lat": -39.9, "lon2": 155.0, "lat2": -37.6, "color": "#4a5568"},      # ACT note -> ACT
]
dump("map_symbols", {
    "description": "Proportional symbol map of Australian states. Circle area = number of students exceeding expectations; colour = how far the share "
                   "exceeding is above or below Australia's. Tasmania is not published.",
    "width": "container", "height": "container",
    "padding": {"left": 0, "right": 0, "top": 0, "bottom": 0},
    "background": None, "config": CONFIG,
    "params": [{"name": "sel", "value": "Northern Territory"}],
    "projection": {"type": "conicEqualArea", "rotate": [-134, 0, 0], "parallels": [-18, -36], "center": [0, -27],
                   "scale": {"expr": "width < 600 ? min(width * 1.05, height * 1.05) : min(width * 1.3, height * 1.3)"}, "translate": {"expr": "[width / 2, height / 2]"}},
    "layer": [
        {"data": GEO, "mark": {"type": "geoshape", "fill": "#f1efe9", "stroke": "#ffffff", "strokeWidth": 1.4}},
        {"data": SYM_DATA, "transform": [{"filter": "datum.leader == 1"}],
         "mark": {"type": "rule", "stroke": "#9aa3b2", "strokeWidth": 1},
         "encoding": {"longitude": {"field": "lon", "type": "quantitative"}, "latitude": {"field": "lat", "type": "quantitative"},
                      "longitude2": {"field": "anchor_lon"}, "latitude2": {"field": "anchor_lat"}}},
        {"data": SYM_DATA, "transform": SYM_CALC,
         "mark": {"type": "circle", "fillOpacity": 0.9, "cursor": "pointer", "tooltip": True},
         "encoding": {**SYM_POS, "color": SYM_COLOR,
                      "size": {"field": "cnt", "type": "quantitative", "scale": {"type": "linear", "domain": [0, 400000], "range": [0, 6500]}, "legend": None},
                      "stroke": {"condition": {"test": "datum.state == sel", "value": INK}, "value": "#ffffff"},
                      "strokeWidth": {"condition": {"test": "datum.state == sel", "value": 2.8}, "value": 1.5},
                      "tooltip": [{"field": "state", "title": "State / territory"}, {"field": "cnt_label", "title": "Exceeding expectations"},
                                  {"field": "nat_label", "title": "Australia"}, {"field": "gap_label", "title": "Difference"}]}},
        {"data": SYM_DATA, "transform": SYM_CALC,
         "mark": {"type": "text", "baseline": "middle", "fontSize": 11, "fontWeight": 700, "color": INK},
         "encoding": {"longitude": {"field": "sx", "type": "quantitative"}, "latitude": {"field": "ly", "type": "quantitative"}, "text": {"field": "label"}}},
        {"data": SYM_DATA, "transform": [{"filter": "datum.reported == 0"}],
         "mark": {"type": "text", "fontSize": 10.5, "color": "#6b7280", "fontStyle": "italic"},
         "encoding": {"longitude": {"field": "lon", "type": "quantitative"}, "latitude": {"field": "lat", "type": "quantitative"},
                      "text": {"value": "TAS: not published"}}},
        {   # annotations supplied by the page (colour is by condition: the circles above already use a colour scale)
            "data": {"name": "annot"}, "transform": [{"filter": "isValid(datum.lon2)"}],
            "mark": {"type": "rule", "strokeWidth": 1.2, "strokeDash": [3, 2]},
            "encoding": {"longitude": {"field": "lon2", "type": "quantitative"}, "latitude": {"field": "lat2", "type": "quantitative"},
                         "longitude2": {"field": "lon3"}, "latitude2": {"field": "lat3"},
                         "color": {"condition": {"test": "datum.color == '#c2410c'", "value": "#c2410c"}, "value": "#4a5568"}}},
        {"data": {"name": "annot"}, "transform": [{"filter": "isValid(datum.text)"}],
         "mark": {"type": "text", "align": "left", "baseline": "top", "fontSize": 11.5, "fontWeight": 600, "lineBreak": "\n", "lineHeight": 14},
         "encoding": {"longitude": {"field": "lon", "type": "quantitative"}, "latitude": {"field": "lat", "type": "quantitative"},
                      "text": {"field": "text"}, "color": {"condition": {"test": "datum.color == '#c2410c'", "value": "#c2410c"}, "value": "#4a5568"}}},
    ],
})

# ---- choropleth of students needing additional support: the original choropleth with the measure swapped (so -> nas) ----
import re as _re


def _swap(o):
    if isinstance(o, dict):
        return {k: _swap(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_swap(v) for v in o]
    if isinstance(o, str):
        o = _re.sub(r"\b(gap_|band_|nat_)so\b", r"\1nas", o)
        o = _re.sub(r"\bso\b", "nas", o)
        return o.replace("Meeting expectations", "Needing support")
    return o


_sup = _swap(json.loads((OUT / "map_states.json").read_text(encoding="utf-8")))
_sup["description"] = ("Choropleth map of Australian states and territories. Colour = how many percentage points the share of students needing "
                       "additional support is above or below Australia's. An inset marker shows the ACT; annotations are supplied by the page.")
for _l in _sup["layer"]:
    _d = _l.get("data", {})
    for _t in _l.get("transform", []):
        if "lookup" in _t:
            _t["from"]["fields"] = list(dict.fromkeys(_t["from"]["fields"] + ["nas", "gap_nas", "band_nas", "nat_nas"]))
            _t["from"]["data"]["format"]["parse"]["nat_nas"] = "number"
    if "format" in _d and "parse" in _d["format"]:
        _d["format"]["parse"]["nat_nas"] = "number"
(OUT / "map_support.json").write_text(json.dumps({"$schema": VL, **{k: v for k, v in _sup.items() if k != "$schema"}}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
(OUT / "map_states.json").unlink()      # the "meeting expectations" choropleth is replaced by the symbol map above

print("wrote:", ", ".join(sorted(p.name for p in OUT.glob("*.json"))))
