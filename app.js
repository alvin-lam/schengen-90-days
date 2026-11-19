(function () {
  "use strict";

  var C = window.SchengenCalc;
  var STORAGE_KEY = "schengen-90-180-trips";

  var tripList = document.getElementById("trip-list");
  var template = document.getElementById("trip-template");
  var emptyState = document.getElementById("empty-state");
  var referenceInput = document.getElementById("reference-date");

  var trips = loadTrips();
  referenceInput.value = C.todayIso();

  function loadTrips() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveTrips() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    } catch (e) {
      /* Storage may be unavailable; the app still works for this visit. */
    }
  }

  function buildCountryOptions(select, selected) {
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a country";
    select.appendChild(placeholder);
    C.COUNTRIES.forEach(function (country) {
      var opt = document.createElement("option");
      opt.value = country.name;
      opt.textContent = C.countryLabel(country);
      select.appendChild(opt);
    });
    select.value = selected || "";
  }

  function renderTrips() {
    tripList.innerHTML = "";
    trips.forEach(function (trip, index) {
      var node = template.content.firstElementChild.cloneNode(true);
      var country = node.querySelector(".trip-country");
      var entry = node.querySelector(".trip-entry");
      var exit = node.querySelector(".trip-exit");

      buildCountryOptions(country, trip.country);
      entry.value = trip.entry || "";
      exit.value = trip.exit || "";
      exit.min = trip.entry || "";

      country.addEventListener("change", function () {
        trips[index].country = country.value;
        saveTrips();
        update();
      });
      entry.addEventListener("change", function () {
        trips[index].entry = entry.value;
        exit.min = entry.value;
        if (!exit.value && entry.value) {
          exit.value = entry.value;
          trips[index].exit = entry.value;
        }
        saveTrips();
        update();
      });
      exit.addEventListener("change", function () {
        trips[index].exit = exit.value;
        saveTrips();
        update();
      });
      node.querySelector(".btn-remove").addEventListener("click", function () {
        trips.splice(index, 1);
        saveTrips();
        renderTrips();
      });

      tripList.appendChild(node);
    });
    emptyState.hidden = trips.length > 0;
    update();
  }

  function update() {
    var reference = referenceInput.value || C.todayIso();
    var result = C.daysInWindow(trips, reference);
    var status = C.statusFor(result.total);

    // Per-trip counts and validation.
    Array.prototype.forEach.call(tripList.children, function (node, i) {
      var trip = trips[i];
      var invalid = trip.entry && trip.exit && C.toDayNumber(trip.exit) < C.toDayNumber(trip.entry);
      node.classList.toggle("invalid", !!invalid);
      node.querySelector(".trip-error").hidden = !invalid;
      var value = node.querySelector(".trip-days-value");
      var length = C.tripLength(trip);
      var counted = result.perTrip[i];
      value.textContent = counted;
      value.title = length && counted !== length
        ? counted + " of " + length + " trip days fall inside the 180 day window"
        : "";
    });

    // Summary.
    var summary = document.getElementById("summary");
    summary.className = "summary status-" + status;
    document.getElementById("total-days").textContent = result.total;
    document.getElementById("window-range").textContent =
      formatDate(result.windowStart) + " to " + formatDate(result.windowEnd);

    document.getElementById("status-text").textContent = C.STATUS_LABELS[status];
    document.getElementById("status-emoji").textContent = {
      green: "\u2705",              // ✅
      yellow: "\u26A0\uFE0F",       // ⚠️
      red: "\u203C\uFE0F",          // ‼️
      black: "\u26D4\uFE0F"         // ⛔️
    }[status];

    var remaining = 90 - result.total;
    document.getElementById("remaining-text").textContent = remaining >= 0
      ? remaining + (remaining === 1 ? " day" : " days") + " remaining in this window."
      : "Exceeded by " + (-remaining) + (remaining === -1 ? " day." : " days.");

    var meter = document.getElementById("meter");
    meter.setAttribute("aria-valuenow", String(Math.min(result.total, 90)));
    document.getElementById("meter-fill").style.width = Math.min(result.total / 90, 1) * 100 + "%";

    updateMap();

    var hasTrips = trips.length > 0;
    document.getElementById("export-download").disabled = !hasTrips;

    document.getElementById("lawyer-warning").hidden = status !== "black";
  }

  // Shade every country that appears in a trip, in the same order as the country list.
  function updateMap() {
    var chosen = {};
    trips.forEach(function (t) { if (t.country) chosen[t.country] = true; });
    Array.prototype.forEach.call(document.querySelectorAll("#europe-map .map-country"), function (el) {
      el.classList.toggle("visited", !!chosen[el.getAttribute("data-country")]);
    });
    var names = C.SCHENGEN_COUNTRIES.filter(function (n) { return chosen[n]; });
    var summary = document.getElementById("map-summary");
    summary.textContent = names.length ? "In your trips (" + names.length + "): " + names.join(", ") : "";
    summary.hidden = !names.length;
  }

  function formatDate(iso) {
    var d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  }

  document.getElementById("add-trip").addEventListener("click", function () {
    trips.push({ country: "", entry: "", exit: "" });
    saveTrips();
    renderTrips();
    var last = tripList.lastElementChild;
    if (last) last.querySelector(".trip-country").focus();
  });

  // Two-step clear: the first click asks, the second click within 4 seconds confirms.
  var clearBtn = document.getElementById("clear-all");
  var clearTimer = null;
  function resetClear() {
    clearTimeout(clearTimer);
    clearBtn.classList.remove("confirming");
    clearBtn.textContent = "Clear all trips";
  }
  clearBtn.addEventListener("click", function () {
    if (!trips.length) return;
    if (clearBtn.classList.contains("confirming")) {
      resetClear();
      trips = [];
      saveTrips();
      renderTrips();
      return;
    }
    clearBtn.classList.add("confirming");
    clearBtn.textContent = "Select again to remove all trips";
    clearTimer = setTimeout(resetClear, 4000);
  });

  referenceInput.addEventListener("change", update);

  // Export the record as CSV, JSON, or plain text.
  var X = window.SchengenExport;
  var exportFormat = document.getElementById("export-format");
  var exportStatus = document.getElementById("export-status");
  var exportStatusTimer = null;

  function currentExport() {
    var format = exportFormat.value;
    var reference = referenceInput.value || C.todayIso();
    var record = X.buildRecord(trips, reference);
    return {
      text: X.FORMATS[format].serialize(record),
      mime: X.FORMATS[format].mime,
      name: X.fileName(format, reference),
      format: format
    };
  }

  function showExportStatus(message) {
    clearTimeout(exportStatusTimer);
    exportStatus.textContent = message;
    exportStatus.hidden = false;
    exportStatusTimer = setTimeout(function () { exportStatus.hidden = true; }, 5000);
  }

  document.getElementById("export-download").addEventListener("click", function () {
    if (!trips.length) return;
    var out = currentExport();
    // A byte order mark helps Excel read accented and non-Latin country names in CSV files.
    var body = out.format === "csv" ? "\uFEFF" + out.text : out.text;
    downloadBlob(new Blob([body], { type: out.mime }), out.name);
    showExportStatus("Downloaded " + out.name + ".");
  });

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // Download the map as SVG, PNG, or JPG, in the colors currently on screen.
  var mapFormat = document.getElementById("map-format");
  var mapStatus = document.getElementById("map-status");
  var mapStatusTimer = null;
  var MAP_SCALE = 2; // PNG and JPG are drawn at twice the map size (1600 px wide) for sharp prints

  function showMapStatus(message) {
    clearTimeout(mapStatusTimer);
    mapStatus.textContent = message;
    mapStatus.hidden = false;
    mapStatusTimer = setTimeout(function () { mapStatus.hidden = true; }, 5000);
  }

  // A standalone copy of the map: colors are written onto each shape, because
  // the page's stylesheet does not travel with the file. Colors come from the
  // theme tokens, not the shapes on screen, so a fade in progress is never captured.
  function standaloneMapSvg() {
    var source = document.getElementById("europe-map");
    var box = source.viewBox.baseVal;
    var tokens = getComputedStyle(document.documentElement);
    function token(name) { return tokens.getPropertyValue(name).trim(); }
    var colors = { visited: token("--map-visited"), member: token("--map-member"), other: token("--map-other"), sea: token("--map-sea") };
    var copy = source.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll("path, circle"), function (el) {
      var cls = el.getAttribute("class") || "";
      var isMember = cls.indexOf("map-country") !== -1;
      el.setAttribute("fill", !isMember ? colors.other : cls.indexOf("visited") !== -1 ? colors.visited : colors.member);
      el.setAttribute("stroke", colors.sea);
      el.setAttribute("stroke-width", cls.indexOf("map-dot") !== -1 ? "1.5" : "0.8");
      el.setAttribute("stroke-linejoin", "round");
      el.removeAttribute("class");
    });
    Array.prototype.forEach.call(copy.querySelectorAll("g"), function (g) { g.removeAttribute("class"); });
    copy.removeAttribute("id");
    copy.removeAttribute("class");
    copy.removeAttribute("role");
    copy.removeAttribute("aria-labelledby");
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", String(box.width));
    copy.setAttribute("height", String(box.height));
    var sea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    sea.setAttribute("width", String(box.width));
    sea.setAttribute("height", String(box.height));
    sea.setAttribute("fill", colors.sea);
    copy.insertBefore(sea, copy.querySelector("g"));
    return { text: new XMLSerializer().serializeToString(copy), width: box.width, height: box.height };
  }

  document.getElementById("map-download").addEventListener("click", function () {
    var format = mapFormat.value;
    var svg = standaloneMapSvg();
    var name = "schengen-map-" + (referenceInput.value || C.todayIso()) + "." + format;
    var svgBlob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + svg.text], { type: "image/svg+xml" });
    if (format === "svg") {
      downloadBlob(svgBlob, name);
      showMapStatus("Downloaded " + name + ".");
      return;
    }
    var url = URL.createObjectURL(svgBlob);
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      canvas.width = svg.width * MAP_SCALE;
      canvas.height = svg.height * MAP_SCALE;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      var type = format === "jpg" ? "image/jpeg" : "image/png";
      canvas.toBlob(function (blob) {
        if (!blob) { showMapStatus("This browser could not create the image. Try SVG instead."); return; }
        downloadBlob(blob, name);
        showMapStatus("Downloaded " + name + ".");
      }, type, 0.92);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      showMapStatus("This browser could not create the image. Try SVG instead.");
    };
    img.src = url;
  });

  // Back to top: appears after scrolling down, returns to the top of the page.
  var topButton = document.getElementById("back-to-top");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function toggleTopButton() {
    topButton.hidden = window.scrollY < 400;
  }
  window.addEventListener("scroll", toggleTopButton, { passive: true });
  toggleTopButton();
  topButton.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    // Move keyboard focus to the title so the next Tab starts from the top.
    document.getElementById("page-title").focus({ preventScroll: true });
  });

  // Keep the copyright year current.
  document.getElementById("copyright-year").textContent = String(new Date().getFullYear());

  renderTrips();
})();
