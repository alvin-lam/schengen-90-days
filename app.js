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

    var hasTrips = trips.length > 0;
    document.getElementById("export-download").disabled = !hasTrips;
    document.getElementById("export-copy").disabled = !hasTrips;

    document.getElementById("lawyer-warning").hidden = status !== "black";
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
    var url = URL.createObjectURL(new Blob([body], { type: out.mime }));
    var link = document.createElement("a");
    link.href = url;
    link.download = out.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showExportStatus("Downloaded " + out.name + ".");
  });

  document.getElementById("export-copy").addEventListener("click", function () {
    if (!trips.length) return;
    var out = currentExport();
    var label = out.format.toUpperCase();
    function fallbackCopy() {
      var area = document.createElement("textarea");
      area.value = out.text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      area.remove();
      showExportStatus(ok ? "Copied " + label + " to the clipboard."
        : "Copying is blocked in this browser. Use Download instead.");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(out.text).then(function () {
        showExportStatus("Copied " + label + " to the clipboard.");
      }, fallbackCopy);
    } else {
      fallbackCopy();
    }
  });

  // Keep the copyright year current.
  document.getElementById("copyright-year").textContent = String(new Date().getFullYear());

  renderTrips();
})();
