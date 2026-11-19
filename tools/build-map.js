/*
 * Builds the inline Europe map (europe-map.svg) from Natural Earth data.
 *
 *   cd tools && npm install && node build-map.js
 *
 * Then paste the output between the MAP START / MAP END markers in
 * index.html. The page itself needs no map library at runtime.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const d3 = require("d3-geo");
const topojson = require("topojson-client");
const simplify = require("topojson-simplify");
const { SCHENGEN_COUNTRIES } = require("../calc.js");

const WIDTH = 800;
const DETAIL = 0.15; // topojson quantile: lower keeps fewer points (smaller file, rougher coasts)
const MIN_AREA = 6; // drop islands smaller than this many square pixels // share of points kept after simplification // share of points kept after simplification

const topo = require("world-atlas/countries-50m.json");
const pre = simplify.presimplify(topo);
const simplified = simplify.simplify(pre, simplify.quantile(pre, DETAIL));
const countries = topojson.feature(simplified, simplified.objects.countries).features;

// Map data names that differ from the page's country list.
const ALIAS = { "Åland": "Finland" };
const schengen = new Set(SCHENGEN_COUNTRIES);

// Frame the Schengen Area: Iceland to Finland, Portugal to Crete.
const frame = { type: "MultiPoint", coordinates: [[-24.5, 66.5], [-9.6, 36.8], [26, 34.6], [31.5, 70.2], [25, 71.2], [30, 45]] };
const projection = d3.geoAzimuthalEqualArea().rotate([-10, -52]).fitWidth(WIDTH - 24, frame);
const [[x0, y0], [x1, y1]] = d3.geoPath(projection).bounds(frame);
projection.translate([projection.translate()[0] - x0 + 12, projection.translate()[1] - y0 + 12]);
const HEIGHT = Math.round(y1 - y0 + 24);
projection.clipExtent([[0, 0], [WIDTH, HEIGHT]]);
const pathGen = d3.geoPath(projection).digits(0);

// Keep each country's main shape, and other islands only if they are big enough to see.
function trim(feature) {
  const g = feature.geometry;
  if (!g || g.type !== "MultiPolygon") return feature;
  const parts = g.coordinates.map((c) => ({ c, a: pathGen.area({ type: "Polygon", coordinates: c }) }));
  const biggest = Math.max(...parts.map((p) => p.a));
  // Arctic islands (Svalbard, Jan Mayen) would show as stray specks along the top edge.
  const arctic = (c) => {
    const [lon, lat] = d3.geoCentroid({ type: "Polygon", coordinates: c });
    return lat > 74 || (lat > 70.5 && lon < 0);
  };
  const kept = parts.filter((p) => !arctic(p.c) && (p.a >= MIN_AREA || p.a === biggest)).map((p) => p.c);
  return { ...feature, geometry: { type: "MultiPolygon", coordinates: kept } };
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const context = [];
const members = [];
for (const f of countries) {
  const name = ALIAS[f.properties.name] || f.properties.name;
  const d = pathGen(trim(f));
  if (!d) continue;
  if (schengen.has(name)) {
    members.push(`<path class="map-country" data-country="${esc(name)}" d="${d}"><title>${esc(name)}</title></path>`);
  } else {
    context.push(`<path d="${d}"/>`);
  }
}

// Countries too small to see at this scale get a dot as well.
const DOTS = { Liechtenstein: [9.55, 47.15], Luxembourg: [6.13, 49.78], Malta: [14.4, 35.92] };
const dots = Object.entries(DOTS).map(([name, lonlat]) => {
  const [x, y] = projection(lonlat).map((v) => v.toFixed(1));
  return `<circle class="map-country map-dot" data-country="${name}" cx="${x}" cy="${y}" r="4"><title>${name}</title></circle>`;
});

const svg = [
  `<svg id="europe-map" class="europe-map" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="map-title map-desc">`,
  `<title id="map-title">Map of the Schengen Area</title>`,
  `<desc id="map-desc">Schengen countries you add to a trip are shaded in Europe blue.</desc>`,
  `<g class="map-context">${context.join("")}</g>`,
  `<g class="map-members">${members.join("")}${dots.join("")}</g>`,
  `</svg>`
].join("\n");

fs.writeFileSync(path.join(__dirname, "europe-map.svg"), svg + "\n");
console.log(`europe-map.svg: ${WIDTH}x${HEIGHT}, ${members.length} member shapes, ${context.length} context shapes, ${(svg.length / 1024).toFixed(1)} KB`);
