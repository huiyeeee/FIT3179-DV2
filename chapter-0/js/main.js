import { waffleChartSpec } from './components.js';

document.addEventListener('DOMContentLoaded', () => {
  // Select your div placeholder container ID
    vegaEmbed('#participation-waffle', waffleChartSpec, {actions: false})
        .then(result => {
            console.log("NAPLAN Participation Waffle Chart Rendered Successfully.");
        })
        .catch(console.error);
});
