/*
 * The one list of Schengen countries. Everything else reads from here:
 * the trip country menu, the map, the color schemes, and exports.
 *
 *   code:   ISO 3166-1 alpha-2 code. Saved trips store this, so it must never change.
 *   code3:  ISO 3166-1 alpha-3 code (searchable)
 *   aliases: other searchable names: other official languages, common
 *            English names, and Latin spellings of Greek and Cyrillic names
 *   name:   English name (shown in menus and exports)
 *   native: name in the country's own official language(s), split by " / "
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
    { code: "AT", code3: "AUT", name: "Austria", native: "Österreich", flag: "🇦🇹",
      colors: { primary: "#C8102E", map: "#C8102E", stripe: ["#C8102E", "#FFFFFF", "#C8102E"] } },
    { code: "BE", code3: "BEL", name: "Belgium", native: "België / Belgique / Belgien", flag: "🇧🇪",
      colors: { primary: "#B3122A", map: "#FDDA24", stripe: ["#1A1A1A", "#FDDA24", "#EF3340"] } },
    { code: "BG", code3: "BGR", aliases: ["Balgariya"], name: "Bulgaria", native: "България", flag: "🇧🇬",
      colors: { primary: "#00805E", map: "#D62612", stripe: ["#FFFFFF", "#00966E", "#D62612"] } },
    { code: "HR", code3: "HRV", name: "Croatia", native: "Hrvatska", flag: "🇭🇷",
      colors: { primary: "#171796", map: "#D10000", stripe: ["#FF0000", "#FFFFFF", "#171796"] } },
    { code: "CZ", code3: "CZE", aliases: ["Czech Republic", "Česká republika"], name: "Czechia", native: "Česko", flag: "🇨🇿",
      colors: { primary: "#11457E", map: "#D7141A", stripe: ["#FFFFFF", "#D7141A", "#11457E"] } },
    { code: "DK", code3: "DNK", name: "Denmark", native: "Danmark", flag: "🇩🇰",
      colors: { primary: "#C8102E", map: "#C8102E", stripe: ["#C8102E", "#FFFFFF", "#C8102E"] } },
    { code: "EE", code3: "EST", name: "Estonia", native: "Eesti", flag: "🇪🇪",
      colors: { primary: "#0063B3", map: "#0072CE", stripe: ["#0072CE", "#1A1A1A", "#FFFFFF"] } },
    { code: "FI", code3: "FIN", aliases: ["Finland"], name: "Finland", native: "Suomi", flag: "🇫🇮",
      colors: { primary: "#002F6C", map: "#002F6C", stripe: ["#FFFFFF", "#002F6C", "#FFFFFF"] } },
    { code: "FR", code3: "FRA", name: "France", native: "France", flag: "🇫🇷",
      colors: { primary: "#002395", map: "#ED2939", stripe: ["#002395", "#FFFFFF", "#ED2939"] } },
    { code: "DE", code3: "DEU", name: "Germany", native: "Deutschland", flag: "🇩🇪",
      colors: { primary: "#1A1A1A", map: "#DD0000", stripe: ["#1A1A1A", "#DD0000", "#FFCE00"] } },
    { code: "GR", code3: "GRC", aliases: ["Ellada", "Hellas"], name: "Greece", native: "Ελλάδα", flag: "🇬🇷",
      colors: { primary: "#0D5EAF", map: "#0D5EAF", stripe: ["#0D5EAF", "#FFFFFF", "#0D5EAF"] } },
    { code: "HU", code3: "HUN", name: "Hungary", native: "Magyarország", flag: "🇭🇺",
      colors: { primary: "#436F4D", map: "#CD2A3E", stripe: ["#CD2A3E", "#FFFFFF", "#436F4D"] } },
    { code: "IS", code3: "ISL", name: "Iceland", native: "Ísland", flag: "🇮🇸",
      colors: { primary: "#02529C", map: "#DC1E35", stripe: ["#02529C", "#FFFFFF", "#DC1E35"] } },
    { code: "IT", code3: "ITA", name: "Italy", native: "Italia", flag: "🇮🇹",
      colors: { primary: "#007A3D", map: "#CD212A", stripe: ["#008C45", "#FFFFFF", "#CD212A"] } },
    { code: "LV", code3: "LVA", name: "Latvia", native: "Latvija", flag: "🇱🇻",
      colors: { primary: "#9E3039", map: "#9E3039", stripe: ["#9E3039", "#FFFFFF", "#9E3039"] } },
    { code: "LI", code3: "LIE", name: "Liechtenstein", native: "Liechtenstein", flag: "🇱🇮",
      colors: { primary: "#002B7F", map: "#CE1126", stripe: ["#002B7F", "#FFD83D", "#CE1126"] } },
    { code: "LT", code3: "LTU", name: "Lithuania", native: "Lietuva", flag: "🇱🇹",
      colors: { primary: "#006A44", map: "#FDB913", stripe: ["#FDB913", "#006A44", "#C1272D"] } },
    { code: "LU", code3: "LUX", aliases: ["Luxembourg", "Luxemburg"], name: "Luxembourg", native: "Lëtzebuerg", flag: "🇱🇺",
      colors: { primary: "#0076A8", map: "#EF3340", stripe: ["#EF3340", "#FFFFFF", "#00A3E0"] } },
    { code: "MT", code3: "MLT", name: "Malta", native: "Malta", flag: "🇲🇹",
      colors: { primary: "#CF142B", map: "#CF142B", stripe: ["#FFFFFF", "#CF142B", "#CF142B"] } },
    { code: "NL", code3: "NLD", aliases: ["Holland"], name: "Netherlands", native: "Nederland", flag: "🇳🇱",
      colors: { primary: "#21468B", map: "#FF7900", stripe: ["#AE1C28", "#FFFFFF", "#21468B"] } },
    { code: "NO", code3: "NOR", aliases: ["Noreg", "Norga"], name: "Norway", native: "Norge", flag: "🇳🇴",
      colors: { primary: "#BA0C2F", map: "#00205B", stripe: ["#BA0C2F", "#FFFFFF", "#00205B"] } },
    { code: "PL", code3: "POL", name: "Poland", native: "Polska", flag: "🇵🇱",
      colors: { primary: "#C8102E", map: "#DC143C", stripe: ["#FFFFFF", "#DC143C", "#DC143C"] } },
    { code: "PT", code3: "PRT", name: "Portugal", native: "Portugal", flag: "🇵🇹",
      colors: { primary: "#006600", map: "#DA291C", stripe: ["#006600", "#DA291C", "#DA291C"] } },
    { code: "RO", code3: "ROU", name: "Romania", native: "România", flag: "🇷🇴",
      colors: { primary: "#002B7F", map: "#FCD116", stripe: ["#002B7F", "#FCD116", "#CE1126"] } },
    { code: "SK", code3: "SVK", name: "Slovakia", native: "Slovensko", flag: "🇸🇰",
      colors: { primary: "#0B4EA2", map: "#EE1C25", stripe: ["#FFFFFF", "#0B4EA2", "#EE1C25"] } },
    { code: "SI", code3: "SVN", name: "Slovenia", native: "Slovenija", flag: "🇸🇮",
      colors: { primary: "#005DA4", map: "#ED1C24", stripe: ["#FFFFFF", "#005DA4", "#ED1C24"] } },
    { code: "ES", code3: "ESP", name: "Spain", native: "España", flag: "🇪🇸",
      colors: { primary: "#AA151B", map: "#F1BF00", stripe: ["#AA151B", "#F1BF00", "#AA151B"] } },
    { code: "SE", code3: "SWE", name: "Sweden", native: "Sverige", flag: "🇸🇪",
      colors: { primary: "#006AA7", map: "#FECC02", stripe: ["#006AA7", "#FECC02", "#006AA7"] } },
    { code: "CH", code3: "CHE", aliases: ["Svizra"], name: "Switzerland", native: "Schweiz / Suisse / Svizzera", flag: "🇨🇭",
      colors: { primary: "#DA291C", map: "#DA291C", stripe: ["#DA291C", "#FFFFFF", "#DA291C"] } }
  ];

  // The default color scheme, based on the EU flag.
  var EUROPE = { code: "europe", name: "Europe", flag: "🇪🇺", colors: { primary: null, map: null, stripe: ["#003399", "#FFCC00", "#003399"] } };

  var byCode = {};
  var byName = {};
  COUNTRIES.forEach(function (c) { byCode[c.code] = c; byName[c.name.toLowerCase()] = c; });

  /** Lowercase and strip accents, so "osterreich" finds "Österreich". */
  function fold(text) {
    return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  // Every searchable name for each country, folded once.
  var searchNames = {};
  COUNTRIES.forEach(function (c) {
    var names = [c.name].concat(c.native.split(" / "), c.aliases || []);
    searchNames[c.code] = names.map(fold);
  });

  /**
   * Countries matching a typed query, best matches first.
   * Matches English names, official-language names, aliases, and
   * two- or three-letter codes. An empty query returns every country.
   */
  function search(query) {
    var q = fold(query);
    if (!q) return COUNTRIES.slice();
    var results = [];
    COUNTRIES.forEach(function (c, i) {
      var names = searchNames[c.code];
      var code2 = c.code.toLowerCase(), code3 = c.code3.toLowerCase();
      var rank = -1;
      if (q === code2 || q === code3) rank = 0;
      else if (names[0].indexOf(q) === 0) rank = 1;
      else if (names.some(function (n) { return n.indexOf(q) === 0; })) rank = 2;
      else if (names.some(function (n) { return n.split(/[\s-]+/).some(function (w) { return w.indexOf(q) === 0; }); })) rank = 3;
      else if (names.some(function (n) { return n.indexOf(q) !== -1; })) rank = 4;
      else if (code3.indexOf(q) === 0) rank = 5;
      if (rank !== -1) results.push({ country: c, rank: rank, order: i });
    });
    results.sort(function (a, b) { return a.rank - b.rank || a.order - b.order; });
    return results.map(function (r) { return r.country; });
  }

  var api = {
    /** Search countries by name, official-language name, or code. */
    search: search,
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
