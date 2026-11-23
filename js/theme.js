/*
 * Light and dark mode button.
 * Loaded in <head> so a saved choice applies before the page paints,
 * which avoids a flash of the wrong theme. With no saved choice the page
 * follows the device setting, as before.
 */
(function () {
  "use strict";

  var KEY = "schengen-theme";
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function saved() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : null;
    } catch (e) {
      return null;
    }
  }

  function effective() {
    return root.getAttribute("data-theme") || (media && media.matches ? "dark" : "light");
  }

  var initial = saved();
  if (initial) root.setAttribute("data-theme", initial);

  function syncButton(button) {
    var dark = effective() === "dark";
    var label = dark ? "Switch to light mode" : "Switch to dark mode";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.setAttribute("aria-pressed", String(dark));
  }

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.getElementById("theme-toggle");
    if (!button) return;
    syncButton(button);

    button.addEventListener("click", function () {
      var next = effective() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* choice lasts for this visit only */ }
      syncButton(button);
    });

    // Keep the label right if the device switches theme and no choice is saved.
    if (media && media.addEventListener) {
      media.addEventListener("change", function () { syncButton(button); });
    }
  });
})();
