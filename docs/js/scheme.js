/*
 * Color schemes based on each Schengen country's flag. The colors live in
 * js/countries.js. Loaded in <head> so a saved scheme applies before the
 * page paints. "europe" is the default and keeps the page's original colors.
 */
(function (root) {
  "use strict";

  var KEY = "schengen-scheme";
  var DEFAULT_THEME_COLOR = "#0a2ea8"; // matches the theme-color meta tag in index.html
  var K = root.SchengenCountries;
  var SCHEMES = [K.EUROPE].concat(K.COUNTRIES).map(function (c) {
    return { id: c.code, name: c.name, flag: c.flag, primary: c.colors.primary, map: c.colors.map, stripe: c.colors.stripe };
  });

  // Blend a hex color toward white; used for lighter dark mode versions.
  function tint(hex, amount) {
    var n = parseInt(hex.slice(1), 16);
    var r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function mix(c) { return Math.round(c + (255 - c) * amount); }
    return "#" + [mix(r), mix(g), mix(b)].map(function (c) { return c.toString(16).padStart(2, "0"); }).join("");
  }

  // WCAG contrast of a hex color against white.
  function contrastWithWhite(hex) {
    var n = parseInt(hex.slice(1), 16);
    var l = [n >> 16, (n >> 8) & 255, n & 255].map(function (c) {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 1.05 / (0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] + 0.05);
  }
  // Dark mode buttons: lighten the color for the dark page, but only as far
  // as white button text keeps a 4.5:1 contrast.
  function darkButton(hex) {
    for (var amount = 0.25; amount > 0; amount -= 0.01) {
      var c = tint(hex, amount);
      if (contrastWithWhite(c) >= 4.5) return c;
    }
    return hex;
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
      style.setProperty("--scheme-primary-dark", darkButton(s.primary));
      style.setProperty("--scheme-link", s.primary);
      style.setProperty("--scheme-link-dark", tint(s.primary, 0.5));
      style.setProperty("--scheme-map", s.map);
      style.setProperty("--scheme-map-dark", tint(s.map, 0.15));
    }
    document.documentElement.setAttribute("data-scheme", s.id);
    // Browser toolbar and installed app title bar follow the scheme too.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", s.primary || DEFAULT_THEME_COLOR);
    return s;
  }

  // The choice for this visit, used when storage is blocked.
  var memory = null;

  function saved() {
    var v;
    try { v = localStorage.getItem(KEY) || "europe"; } catch (e) { return memory || "europe"; }
    // Older saves used lowercase English names ("germany"); upgrade them to codes.
    if (v !== "europe" && !K.byCode(v)) {
      var c = K.byName(v);
      v = c ? c.code : "europe";
      try { localStorage.setItem(KEY, v); } catch (e) { /* ignore */ }
    }
    return v;
  }

  function choose(id) {
    var s = apply(id);
    memory = s.id;
    try { localStorage.setItem(KEY, s.id); } catch (e) { /* lasts for this visit only */ }
    return s;
  }

  apply(saved());

  root.SchengenScheme = { SCHEMES: SCHEMES, current: function () { return find(saved()).id; }, choose: choose, tint: tint };
})(this);
