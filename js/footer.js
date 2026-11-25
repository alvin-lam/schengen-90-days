/*
 * Footer helpers for pages that do not load the full calculator (privacy.html).
 * Keeps the copyright year current. Lives in a file because the
 * Content-Security-Policy does not allow inline scripts.
 */
(function () {
  "use strict";
  var year = document.getElementById("copyright-year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
