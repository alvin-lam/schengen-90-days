/*
 * The one list of Schengen countries. Everything else reads from here:
 * the trip country menu, the map, the color schemes, and exports.
 *
 *   code:   ISO 3166-1 alpha-2 code. Saved trips store this, so it must never change.
 *   name:   English name (shown in menus and exports)
 *   native: name in the country's own official language(s)
 *   flag:   flag emoji
 *   colors: the flag color scheme
 *     primary: buttons and links (dark enough for white text)
 *     map:     shading for countries in the visitor's trips
 *     stripe:  the flag's three colors, shown as a swatch in the scheme list
 */
(function (root) {
  "use strict";

  // Schengen Area members (29 countries as of 2025).
  var COUNTRIES = [
    { code: "AT", name: "Austria", native: "Österreich", flag: "🇦🇹",
      colors: { primary: "#C8102E", map: "#C8102E", stripe: ["#C8102E", "#FFFFFF", "#C8102E"] } },
    { code: "BE", name: "Belgium", native: "België / Belgique / Belgien", flag: "🇧🇪",
      colors: { primary: "#B3122A", map: "#FDDA24", stripe: ["#1A1A1A", "#FDDA24", "#EF3340"] } },
    { code: "BG", name: "Bulgaria", native: "България", flag: "🇧🇬",
      colors: { primary: "#00805E", map: "#D62612", stripe: ["#FFFFFF", "#00966E", "#D62612"] } },
    { code: "HR", name: "Croatia", native: "Hrvatska", flag: "🇭🇷",
      colors: { primary: "#171796", map: "#D10000", stripe: ["#FF0000", "#FFFFFF", "#171796"] } },
    { code: "CZ", name: "Czechia", native: "Česko", flag: "🇨🇿",
      colors: { primary: "#11457E", map: "#D7141A", stripe: ["#FFFFFF", "#D7141A", "#11457E"] } },
    { code: "DK", name: "Denmark", native: "Danmark", flag: "🇩🇰",
      colors: { primary: "#C8102E", map: "#C8102E", stripe: ["#C8102E", "#FFFFFF", "#C8102E"] } },
    { code: "EE", name: "Estonia", native: "Eesti", flag: "🇪🇪",
      colors: { primary: "#0063B3", map: "#0072CE", stripe: ["#0072CE", "#1A1A1A", "#FFFFFF"] } },
    { code: "FI", name: "Finland", native: "Suomi", flag: "🇫🇮",
      colors: { primary: "#002F6C", map: "#002F6C", stripe: ["#FFFFFF", "#002F6C", "#FFFFFF"] } },
    { code: "FR", name: "France", native: "France", flag: "🇫🇷",
      colors: { primary: "#002395", map: "#ED2939", stripe: ["#002395", "#FFFFFF", "#ED2939"] } },
    { code: "DE", name: "Germany", native: "Deutschland", flag: "🇩🇪",
      colors: { primary: "#1A1A1A", map: "#DD0000", stripe: ["#1A1A1A", "#DD0000", "#FFCE00"] } },
    { code: "GR", name: "Greece", native: "Ελλάδα", flag: "🇬🇷",
      colors: { primary: "#0D5EAF", map: "#0D5EAF", stripe: ["#0D5EAF", "#FFFFFF", "#0D5EAF"] } },
    { code: "HU", name: "Hungary", native: "Magyarország", flag: "🇭🇺",
      colors: { primary: "#436F4D", map: "#CD2A3E", stripe: ["#CD2A3E", "#FFFFFF", "#436F4D"] } },
    { code: "IS", name: "Iceland", native: "Ísland", flag: "🇮🇸",
      colors: { primary: "#02529C", map: "#DC1E35", stripe: ["#02529C", "#FFFFFF", "#DC1E35"] } },
    { code: "IT", name: "Italy", native: "Italia", flag: "🇮🇹",
      colors: { primary: "#007A3D", map: "#CD212A", stripe: ["#008C45", "#FFFFFF", "#CD212A"] } },
    { code: "LV", name: "Latvia", native: "Latvija", flag: "🇱🇻",
      colors: { primary: "#9E3039", map: "#9E3039", stripe: ["#9E3039", "#FFFFFF", "#9E3039"] } },
    { code: "LI", name: "Liechtenstein", native: "Liechtenstein", flag: "🇱🇮",
      colors: { primary: "#002B7F", map: "#CE1126", stripe: ["#002B7F", "#FFD83D", "#CE1126"] } },
    { code: "LT", name: "Lithuania", native: "Lietuva", flag: "🇱🇹",
      colors: { primary: "#006A44", map: "#FDB913", stripe: ["#FDB913", "#006A44", "#C1272D"] } },
    { code: "LU", name: "Luxembourg", native: "Lëtzebuerg", flag: "🇱🇺",
      colors: { primary: "#0076A8", map: "#EF3340", stripe: ["#EF3340", "#FFFFFF", "#00A3E0"] } },
    { code: "MT", name: "Malta", native: "Malta", flag: "🇲🇹",
      colors: { primary: "#CF142B", map: "#CF142B", stripe: ["#FFFFFF", "#CF142B", "#CF142B"] } },
    { code: "NL", name: "Netherlands", native: "Nederland", flag: "🇳🇱",
      colors: { primary: "#21468B", map: "#FF7900", stripe: ["#AE1C28", "#FFFFFF", "#21468B"] } },
    { code: "NO", name: "Norway", native: "Norge", flag: "🇳🇴",
      colors: { primary: "#BA0C2F", map: "#00205B", stripe: ["#BA0C2F", "#FFFFFF", "#00205B"] } },
    { code: "PL", name: "Poland", native: "Polska", flag: "🇵🇱",
      colors: { primary: "#C8102E", map: "#DC143C", stripe: ["#FFFFFF", "#DC143C", "#DC143C"] } },
    { code: "PT", name: "Portugal", native: "Portugal", flag: "🇵🇹",
      colors: { primary: "#006600", map: "#DA291C", stripe: ["#006600", "#DA291C", "#DA291C"] } },
    { code: "RO", name: "Romania", native: "România", flag: "🇷🇴",
      colors: { primary: "#002B7F", map: "#FCD116", stripe: ["#002B7F", "#FCD116", "#CE1126"] } },
    { code: "SK", name: "Slovakia", native: "Slovensko", flag: "🇸🇰",
      colors: { primary: "#0B4EA2", map: "#EE1C25", stripe: ["#FFFFFF", "#0B4EA2", "#EE1C25"] } },
    { code: "SI", name: "Slovenia", native: "Slovenija", flag: "🇸🇮",
      colors: { primary: "#005DA4", map: "#ED1C24", stripe: ["#FFFFFF", "#005DA4", "#ED1C24"] } },
    { code: "ES", name: "Spain", native: "España", flag: "🇪🇸",
      colors: { primary: "#AA151B", map: "#F1BF00", stripe: ["#AA151B", "#F1BF00", "#AA151B"] } },
    { code: "SE", name: "Sweden", native: "Sverige", flag: "🇸🇪",
      colors: { primary: "#006AA7", map: "#FECC02", stripe: ["#006AA7", "#FECC02", "#006AA7"] } },
    { code: "CH", name: "Switzerland", native: "Schweiz / Suisse / Svizzera", flag: "🇨🇭",
      colors: { primary: "#DA291C", map: "#DA291C", stripe: ["#DA291C", "#FFFFFF", "#DA291C"] } }
  ];

  // The default color scheme, based on the EU flag.
  var EUROPE = { code: "europe", name: "Europe", flag: "🇪🇺", colors: { primary: null, map: null, stripe: ["#003399", "#FFCC00", "#003399"] } };

  var byCode = {};
  var byName = {};
  COUNTRIES.forEach(function (c) { byCode[c.code] = c; byName[c.name.toLowerCase()] = c; });

  var api = {
    COUNTRIES: COUNTRIES,
    EUROPE: EUROPE,
    /** Country by ISO code, or null. */
    byCode: function (code) { return byCode[code] || null; },
    /** Country by English name (any letter case), or null. Used to upgrade old saved data. */
    byName: function (name) { return byName[String(name || "").toLowerCase()] || null; }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SchengenCountries = api;
  }
})(this);
