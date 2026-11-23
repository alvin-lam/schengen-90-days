/*
 * Color schemes based on each Schengen country's flag.
 * Loaded in <head> so a saved scheme applies before the page paints.
 *   primary: buttons and links (dark enough for white text)
 *   map:     shading for countries in the visitor's trips
 *   stripe:  flag colors for the thin stripe across the top of the page
 * "europe" is the default and keeps the page's original colors.
 */
(function (root) {
  "use strict";

  var KEY = "schengen-scheme";
  var SCHEMES = [
    { id: "europe", name: "Europe", flag: "🇪🇺", primary: null, map: null, stripe: ["#003399", "#FFCC00", "#003399"] },
    { id: "austria", name: "Austria", flag: "🇦🇹", primary: "#C8102E", map: "#C8102E", stripe: ["#C8102E", "#FFFFFF", "#C8102E"] },
    { id: "belgium", name: "Belgium", flag: "🇧🇪", primary: "#B3122A", map: "#FDDA24", stripe: ["#1A1A1A", "#FDDA24", "#EF3340"] },
    { id: "bulgaria", name: "Bulgaria", flag: "🇧🇬", primary: "#00805E", map: "#D62612", stripe: ["#FFFFFF", "#00966E", "#D62612"] },
    { id: "croatia", name: "Croatia", flag: "🇭🇷", primary: "#171796", map: "#D10000", stripe: ["#FF0000", "#FFFFFF", "#171796"] },
    { id: "czechia", name: "Czechia", flag: "🇨🇿", primary: "#11457E", map: "#D7141A", stripe: ["#FFFFFF", "#D7141A", "#11457E"] },
    { id: "denmark", name: "Denmark", flag: "🇩🇰", primary: "#C8102E", map: "#C8102E", stripe: ["#C8102E", "#FFFFFF", "#C8102E"] },
    { id: "estonia", name: "Estonia", flag: "🇪🇪", primary: "#0063B3", map: "#0072CE", stripe: ["#0072CE", "#1A1A1A", "#FFFFFF"] },
    { id: "finland", name: "Finland", flag: "🇫🇮", primary: "#002F6C", map: "#002F6C", stripe: ["#FFFFFF", "#002F6C", "#FFFFFF"] },
    { id: "france", name: "France", flag: "🇫🇷", primary: "#002395", map: "#ED2939", stripe: ["#002395", "#FFFFFF", "#ED2939"] },
    { id: "germany", name: "Germany", flag: "🇩🇪", primary: "#1A1A1A", map: "#DD0000", stripe: ["#1A1A1A", "#DD0000", "#FFCE00"] },
    { id: "greece", name: "Greece", flag: "🇬🇷", primary: "#0D5EAF", map: "#0D5EAF", stripe: ["#0D5EAF", "#FFFFFF", "#0D5EAF"] },
    { id: "hungary", name: "Hungary", flag: "🇭🇺", primary: "#436F4D", map: "#CD2A3E", stripe: ["#CD2A3E", "#FFFFFF", "#436F4D"] },
    { id: "iceland", name: "Iceland", flag: "🇮🇸", primary: "#02529C", map: "#DC1E35", stripe: ["#02529C", "#FFFFFF", "#DC1E35"] },
    { id: "italy", name: "Italy", flag: "🇮🇹", primary: "#007A3D", map: "#CD212A", stripe: ["#008C45", "#FFFFFF", "#CD212A"] },
    { id: "latvia", name: "Latvia", flag: "🇱🇻", primary: "#9E3039", map: "#9E3039", stripe: ["#9E3039", "#FFFFFF", "#9E3039"] },
    { id: "liechtenstein", name: "Liechtenstein", flag: "🇱🇮", primary: "#002B7F", map: "#CE1126", stripe: ["#002B7F", "#FFD83D", "#CE1126"] },
    { id: "lithuania", name: "Lithuania", flag: "🇱🇹", primary: "#006A44", map: "#FDB913", stripe: ["#FDB913", "#006A44", "#C1272D"] },
    { id: "luxembourg", name: "Luxembourg", flag: "🇱🇺", primary: "#0076A8", map: "#EF3340", stripe: ["#EF3340", "#FFFFFF", "#00A3E0"] },
    { id: "malta", name: "Malta", flag: "🇲🇹", primary: "#CF142B", map: "#CF142B", stripe: ["#FFFFFF", "#CF142B", "#CF142B"] },
    { id: "netherlands", name: "Netherlands", flag: "🇳🇱", primary: "#21468B", map: "#FF7900", stripe: ["#AE1C28", "#FFFFFF", "#21468B"] },
    { id: "norway", name: "Norway", flag: "🇳🇴", primary: "#BA0C2F", map: "#00205B", stripe: ["#BA0C2F", "#FFFFFF", "#00205B"] },
    { id: "poland", name: "Poland", flag: "🇵🇱", primary: "#C8102E", map: "#DC143C", stripe: ["#FFFFFF", "#DC143C", "#DC143C"] },
    { id: "portugal", name: "Portugal", flag: "🇵🇹", primary: "#006600", map: "#DA291C", stripe: ["#006600", "#DA291C", "#DA291C"] },
    { id: "romania", name: "Romania", flag: "🇷🇴", primary: "#002B7F", map: "#FCD116", stripe: ["#002B7F", "#FCD116", "#CE1126"] },
    { id: "slovakia", name: "Slovakia", flag: "🇸🇰", primary: "#0B4EA2", map: "#EE1C25", stripe: ["#FFFFFF", "#0B4EA2", "#EE1C25"] },
    { id: "slovenia", name: "Slovenia", flag: "🇸🇮", primary: "#005DA4", map: "#ED1C24", stripe: ["#FFFFFF", "#005DA4", "#ED1C24"] },
    { id: "spain", name: "Spain", flag: "🇪🇸", primary: "#AA151B", map: "#F1BF00", stripe: ["#AA151B", "#F1BF00", "#AA151B"] },
    { id: "sweden", name: "Sweden", flag: "🇸🇪", primary: "#006AA7", map: "#FECC02", stripe: ["#006AA7", "#FECC02", "#006AA7"] },
    { id: "switzerland", name: "Switzerland", flag: "🇨🇭", primary: "#DA291C", map: "#DA291C", stripe: ["#DA291C", "#FFFFFF", "#DA291C"] }
  ];

  // Blend a hex color toward white; used for lighter dark mode versions.
  function tint(hex, amount) {
    var n = parseInt(hex.slice(1), 16);
    var r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function mix(c) { return Math.round(c + (255 - c) * amount); }
    return "#" + [mix(r), mix(g), mix(b)].map(function (c) { return c.toString(16).padStart(2, "0"); }).join("");
  }

  function find(id) {
    for (var i = 0; i < SCHEMES.length; i++) if (SCHEMES[i].id === id) return SCHEMES[i];
    return SCHEMES[0];
  }

  function apply(id) {
    var s = find(id);
    var style = document.documentElement.style;
    var names = ["--scheme-primary", "--scheme-primary-dark", "--scheme-link", "--scheme-link-dark", "--scheme-map", "--scheme-map-dark"];
    if (!s.primary) {
      names.forEach(function (n) { style.removeProperty(n); });
    } else {
      style.setProperty("--scheme-primary", s.primary);
      style.setProperty("--scheme-primary-dark", tint(s.primary, 0.25));
      style.setProperty("--scheme-link", s.primary);
      style.setProperty("--scheme-link-dark", tint(s.primary, 0.5));
      style.setProperty("--scheme-map", s.map);
      style.setProperty("--scheme-map-dark", tint(s.map, 0.15));
    }
    var c = s.stripe;
    style.setProperty("--flag-stripe", "linear-gradient(90deg, " + c[0] + " 0 33.4%, " + c[1] + " 33.4% 66.7%, " + c[2] + " 66.7% 100%)");
    document.documentElement.setAttribute("data-scheme", s.id);
    return s;
  }

  function saved() {
    try { return localStorage.getItem(KEY) || "europe"; } catch (e) { return "europe"; }
  }

  function choose(id) {
    var s = apply(id);
    try { localStorage.setItem(KEY, s.id); } catch (e) { /* lasts for this visit only */ }
    return s;
  }

  apply(saved());

  root.SchengenScheme = { SCHEMES: SCHEMES, current: function () { return find(saved()).id; }, choose: choose, tint: tint };
})(this);
