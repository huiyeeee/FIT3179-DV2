export const waffleChartSpec = {
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "NAPLAN Participation Waffle Chart filtered by Year Level and Domain with 'All' option aggregation.",
  
  // 1. PRIMARY DRIVER: Generate the core 100 cells for the visual matrix grid
  "data": {
    "sequence": {
      "start": 1,
      "stop": 101,
      "as": "cell_id"
    }
  },

  // 2. DASHBOARD FILTER CONTROLS (SLIDER + DROPDOWNS WITH 'ALL')
  "params": [
    {
      "name": "selected_year",
      "value": 2026,
      "bind": {
        "input": "range",
        "min": 2024,
        "max": 2026,
        "step": 1,
        "name": "Calendar Year: "
      }
    },
    {
      "name": "selected_year_level",
      "value": "All",
      "bind": {
        "input": "select",
        "options": ["All", "3", "5", "7", "9"],
        "name": "Year Level: "
      }
    },
    {
      "name": "selected_domain",
      "value": "All",
      "bind": {
        "input": "select",
        "options": ["All", "Reading", "Writing", "Spelling", "Numeracy", "Grammar and Punctuation"],
        "name": "Domain Subject: "
      }
    }
  ],

  "transform": [
    // Step A: Mathematically construct the 10x10 matrix layout grid positions
    {"calculate": "ceil(datum.cell_id / 10)", "as": "row"},
    {"calculate": "((datum.cell_id - 1) % 10) + 1", "as": "col"},

    // Step B: Stream the entire dataset from your local data folder path
    {
      "lookup": "cell_id", // Linked over dummy key index
      "from": {
        "data": {
          "url": "chapter-0/data/NAPLAN_participation_overall.csv",
          "format": {"type": "csv"}
        },
        // Links records safely using the raw dataset columns
        "key": "Calendar year", 
        "fields": ["Calendar year", "Year level", "Domain", "State/territory", "Student attribute", "Participation (%)"]
      }
    },

    // Step C: Narrow row data down strictly over your target parameters
    {"filter": "datum['Calendar year'] == selected_year"},
    // To calculate the broad national average, keep the baseline matching the National total
    {"filter": "datum['State/territory'] == 'Australia'"}, 
    {"filter": "datum['Student attribute'] == 'All'"},

    // Step D: THE 'ALL' CRITERIA SWITCH LOGIC
    // If user picks 'All', pass true to retain everything, otherwise match exactly
    {"filter": "selected_year_level == 'All' || datum['Year level'] == selected_year_level"},
    {"filter": "selected_domain == 'All' || datum['Domain'] == selected_domain"},

    // Step E: CALCULATE SMOOTH DYNAMIC AGGREGATION MEAN
    // This is the most crucial fix: averages out records when multiple rows are selected via 'All'
    {
      "joinaggregate": [
        {"op": "mean", "field": "Participation (%)", "as": "Calculated_Rate"}
      ]
    },

    // Step F: Map square states using the dynamically generated rate calculation
    {
      "calculate": "datum.cell_id <= datum.Calculated_Rate ? 'Participated' : 'Did Not Participate'",
      "as": "Status"
    }
  ],

  // 3. MAIN SPEC RENDERING DETAILS
  "width": 240,
  "height": 240,
  "mark": {
    "type": "rect",
    "cornerRadius": 4,
    "stroke": "#ffffff",
    "strokeWidth": 2.5,
    "tooltip": true
  },
  "encoding": {
    "x": {
      "field": "col",
      "type": "ordinal",
      "axis": null
    },
    "y": {
      "field": "row",
      "type": "ordinal",
      "axis": null,
      "sort": "descending"
    },
    "color": {
      "field": "Status",
      "type": "nominal",
      "scale": {
        "domain": ["Participated", "Did Not Participate"],
        "range": ["#008080", "#eaeaea"] // Premium Teal and Flat Grey tiles
      },
      "legend": {
        "orient": "bottom",
        "title": null,
        "labelFontSize": 12,
        "padding": 15
      }
    },
    "tooltip": [
      {"field": "Calendar year", "type": "quantitative", "title": "Selected Year"},
      {"field": "Calculated_Rate", "type": "quantitative", "title": "Participation Rate (%)", "format": ".1f"}
    ]
  },
  "config": {
    "view": {"stroke": null}
  }
};
