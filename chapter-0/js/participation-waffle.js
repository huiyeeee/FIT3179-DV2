// ============================================================
// Chapter 0 — NAPLAN Participation Waffle
// ============================================================


// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------

const DATA_PATH = "chapter-0/data/NAPLAN_participation_overall.csv";

const WAFFLE_SIZE = 10;
const TOTAL_SQUARES = WAFFLE_SIZE * WAFFLE_SIZE;


// ------------------------------------------------------------
// Load CSV
// ------------------------------------------------------------

d3.csv(DATA_PATH).then(data => {

    console.log("CSV loaded:", data);
    console.log("Number of rows:", data.length);

    // Convert numeric fields
    data.forEach(d => {
        d["Calendar year"] = +d["Calendar year"];
        d["Year level"] = +d["Year level"];
        d["Participation (%)"] = +d["Participation (%)"];

        // Remove commas before converting to numbers
        d["Enrolled students"] =
            +String(d["Enrolled students"]).replace(/,/g, "");

        d["Participation (Num)"] =
            +String(d["Participation (Num)"]).replace(/,/g, "");
    });


    // --------------------------------------------------------
    // Initial filter values
    // --------------------------------------------------------

    let selectedYear = 2026;
    let selectedYearLevel = "All";
    let selectedDomain = "All";


    // --------------------------------------------------------
    // Calculate participation
    // --------------------------------------------------------

    function calculateParticipation() {

        let filteredData = data.filter(d =>
            d["Calendar year"] === selectedYear &&
            d["State/territory"] === "Australia" &&
            d["Student attribute"] === "All" &&
            d["Subgroup"] === "All"
        );


        // Filter year level if required
        if (selectedYearLevel !== "All") {
            filteredData = filteredData.filter(d =>
                String(d["Year level"]) === selectedYearLevel
            );
        }


        // Filter domain if required
        if (selectedDomain !== "All") {
            filteredData = filteredData.filter(d =>
                d["Domain"] === selectedDomain
            );
        }


        console.log("Filtered data:", filteredData);


        // Sum the underlying counts
        const totalEnrolled = d3.sum(
            filteredData,
            d => d["Enrolled students"]
        );

        const totalParticipated = d3.sum(
            filteredData,
            d => d["Participation (Num)"]
        );


        // Calculate participation rate
        const participationRate =
            totalParticipated / totalEnrolled * 100;


        return {
            enrolled: totalEnrolled,
            participated: totalParticipated,
            rate: participationRate
        };
    }


    // --------------------------------------------------------
    // Create waffle data
    // --------------------------------------------------------

    function createWaffleData(participationRate) {

        // Number of filled squares
        const filledSquares =
            Math.round(participationRate);


        return d3.range(TOTAL_SQUARES).map(i => {

            const row = Math.floor(i / WAFFLE_SIZE);

            const column = i % WAFFLE_SIZE;

            return {
                square: i,
                row: row,
                column: column,
                participated: i < filledSquares
            };

        });
    }


    // --------------------------------------------------------
    // Create Vega-Lite chart
    // --------------------------------------------------------

    function renderWaffle() {

        const result = calculateParticipation();

        const waffleData =
            createWaffleData(result.rate);


        // Display the percentage above the waffle
        const formattedRate =
            result.rate.toFixed(1);


        const spec = {

            "$schema":
                "https://vega.github.io/schema/vega-lite/v5.json",

            "width": 400,
            "height": 400,

            "data": {
                "values": waffleData
            },

            "title": {
                "text": `${formattedRate}%`,
                "subtitle":
                    `${selectedYear} NAPLAN participation`
            },

            "mark": {
                "type": "square",
                "size": 32
            },

            "encoding": {

                "x": {
                    "field": "column",
                    "type": "ordinal",
                    "axis": null
                },

                "y": {
                    "field": "row",
                    "type": "ordinal",
                    "sort": "descending",
                    "axis": null
                },

                "color": {
                    "field": "participated",
                    "type": "nominal",
                    "scale": {
                        "domain": [true, false],
                        "range": ["#2C7FB8", "#E5E5E5"]
                    },
                    "legend": null
                }

            },

            "config": {
                "view": {
                    "stroke": null
                }
            }

        };


        // Render chart
        vegaEmbed(
            "#participation-waffle",
            spec,
            {
                "actions": false
            }
        );
    }

    // --------------------------------------------------------
    // Controls
    // --------------------------------------------------------

    const yearSlider =
        document.getElementById("year-slider");

    const yearValue =
        document.getElementById("year-value");

    const yearLevelSelect =
        document.getElementById("year-level-select");

    const domainSelect =
        document.getElementById("domain-select");


    // --------------------------------------------------------
    // Year slider
    // --------------------------------------------------------

    yearSlider.addEventListener("input", function () {

        selectedYear = +this.value;

        yearValue.textContent = selectedYear;

        renderWaffle();

    });


    // --------------------------------------------------------
    // Year level dropdown
    // --------------------------------------------------------

    yearLevelSelect.addEventListener("change", function () {

        selectedYearLevel = this.value;

        renderWaffle();

    });


    // --------------------------------------------------------
    // Domain dropdown
    // --------------------------------------------------------

    domainSelect.addEventListener("change", function () {

        selectedDomain = this.value;

        renderWaffle();

    });


    // --------------------------------------------------------
    // Initial render
    // --------------------------------------------------------

    renderWaffle();

});