/*
 * Light, dark, or automatic mode.
 * Loaded in <head> so a saved choice applies before the page paints,
 * which avoids a flash of the wrong theme. "auto" (the default) follows
 * the device setting and keeps following it if the device switches.
 */
(function (root) {
  "use strict";

  var KEY = "schengen-theme";
  var html = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  // The choice for this visit, used when storage is blocked.
  var memory = null;

  function get() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : "auto";
    } catch (e) {
      return memory || "auto";
    }
  }

  function apply(mode) {
    if (mode === "light" || mode === "dark") html.setAttribute("data-theme", mode);
    else html.removeAttribute("data-theme");
  }

  function set(mode) {
    apply(mode);
    memory = mode;
    try {
      if (mode === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, mode);
    } catch (e) { /* lasts for this visit only */ }
  }

  // The mode the page is showing right now, after resolving "auto".
  function effective() {
    return html.getAttribute("data-theme") || (media && media.matches ? "dark" : "light");
  }

  apply(get());

  root.SchengenTheme = { get: get, set: set, effective: effective, media: media };
})(this);
