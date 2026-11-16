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
    C.SCHENGEN_COUNTRIES.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
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

    var statusText = {
      green: "Well within the limit",
      yellow: "More than half of the 90 days used",
      red: "Close to the 90 day limit",
      black: "Over the 90 day limit"
    }[status];
    document.getElementById("status-text").textContent = statusText;

    var remaining = 90 - result.total;
    document.getElementById("remaining-text").textContent = remaining >= 0
      ? remaining + (remaining === 1 ? " day" : " days") + " remaining in this window."
      : "Exceeded by " + (-remaining) + (remaining === -1 ? " day." : " days.");

    var meter = document.getElementById("meter");
    meter.setAttribute("aria-valuenow", String(Math.min(result.total, 90)));
    document.getElementById("meter-fill").style.width = Math.min(result.total / 90, 1) * 100 + "%";

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

  /*
   * Two-step button: the first click asks, a second click within 4 seconds
   * confirms. Embedded viewers block window.confirm, so this replaces it.
   */
  function twoStepButton(button, confirmLabel, canRun, action) {
    var label = button.textContent;
    var timer = null;
    function reset() {
      clearTimeout(timer);
      button.classList.remove("confirming");
      button.textContent = label;
    }
    button.addEventListener("click", function () {
      if (!canRun()) return;
      if (button.classList.contains("confirming")) {
        reset();
        action();
        return;
      }
      button.classList.add("confirming");
      button.textContent = confirmLabel;
      timer = setTimeout(reset, 4000);
    });
  }

  twoStepButton(
    document.getElementById("clear-all"),
    "Select again to remove all trips",
    function () { return trips.length > 0; },
    function () {
      trips = [];
      saveTrips();
      renderTrips();
    }
  );

  // Wipe everything this page stored in the browser and reset the page.
  var cacheStatus = document.getElementById("cache-status");
  twoStepButton(
    document.getElementById("clear-cache"),
    "Select again to erase all saved data",
    function () { return true; },
    function () {
      try { localStorage.clear(); } catch (e) { /* storage unavailable */ }
      try { sessionStorage.clear(); } catch (e) { /* storage unavailable */ }
      trips = [];
      referenceInput.value = C.todayIso();
      renderTrips();
      cacheStatus.textContent = "Local cache cleared. All saved trips were removed from this browser.";
      cacheStatus.hidden = false;
      setTimeout(function () { cacheStatus.hidden = true; }, 6000);
    }
  );

  referenceInput.addEventListener("change", update);

  renderTrips();
})();
