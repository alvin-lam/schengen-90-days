(function () {
  "use strict";

  var C = window.SchengenCalc;
  var STORAGE_KEY = "schengen-90-180-trips";

  var tripList = document.getElementById("trip-list");
  var template = document.getElementById("trip-template");
  var emptyState = document.getElementById("empty-state");
  var referenceInput = document.getElementById("reference-date");
  var checkError = document.getElementById("check-date-error");

  var trips = loadTrips();
  // The check date follows today until the visitor picks another date.
  var followToday = true;
  referenceInput.value = C.todayIso();

  // Saved data: { version: 3, trips: [{ id, country: "DE", entry, exit, ongoing }] }.
  // Older saves are upgraded once on load (see upgradeSaved in calc.js).
  function readSaved() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return C.upgradeSaved(raw ? JSON.parse(raw) : []);
    } catch (e) {
      return null;
    }
  }

  function loadTrips() {
    var data = readSaved();
    if (!data) return [];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
    return data.trips;
  }

  function saveTrips() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: C.DATA_VERSION, trips: trips }));
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
      opt.value = country.code;
      opt.textContent = C.countryLabel(country);
      select.appendChild(opt);
    });
    select.value = selected || "";
  }

  /** The trip with this id, or null. Rows find their trip by id, so the list can change under them. */
  function tripById(id) {
    for (var i = 0; i < trips.length; i++) if (trips[i].id === id) return trips[i];
    return null;
  }

  /**
   * Show a trip's saved values in its row. The field that has focus is left
   * alone, so a date being typed is never changed under the visitor.
   */
  function fillRow(node, trip) {
    var active = document.activeElement;
    function set(el, value) { if (el !== active && el.value !== value) el.value = value; }
    var country = node.querySelector(".trip-country");
    var entry = node.querySelector(".trip-entry");
    var exit = node.querySelector(".trip-exit");
    var still = node.querySelector(".trip-still");
    set(country, trip.country || "");
    set(entry, trip.entry || "");
    // A current stay keeps its departure date in storage but shows none.
    set(exit, trip.ongoing ? "" : (trip.exit || ""));
    exit.min = trip.entry || "";
    if (still !== active) still.checked = !!trip.ongoing;
    exit.disabled = !!trip.ongoing;
  }

  /** A new row for one trip, with its event handlers. */
  function buildRow(trip) {
    var id = trip.id;
    var node = template.content.firstElementChild.cloneNode(true);
    node.setAttribute("data-id", id);
    var country = node.querySelector(".trip-country");
    var entry = node.querySelector(".trip-entry");
    var exit = node.querySelector(".trip-exit");
    var still = node.querySelector(".trip-still");
    var error = node.querySelector(".trip-error");
    error.id = "trip-error-" + id;
    [entry, exit].forEach(function (input) { input.setAttribute("aria-describedby", error.id); });
    buildCountryOptions(country, trip.country);
    fillRow(node, trip);

    // Each handler looks the trip up again, so it never writes to the wrong trip.
    function edit(change) {
      var current = tripById(id);
      if (!current) return;
      change(current);
      saveTrips();
      update();
    }
    country.addEventListener("change", function () {
      edit(function (t) { t.country = country.value; });
    });
    entry.addEventListener("change", function () {
      edit(function (t) {
        t.entry = entry.value;
        exit.min = entry.value;
        // Fill an empty departure only from a finished, usable date, never from
        // a year still being typed.
        if (!t.ongoing && !exit.value && C.isUsableDate(entry.value)) {
          exit.value = entry.value;
          t.exit = entry.value;
        }
      });
    });
    exit.addEventListener("change", function () {
      edit(function (t) { t.exit = exit.value; });
    });
    // Still in the Schengen Area: the trip counts through the check date,
    // which follows today by default. The departure date is kept, so
    // unticking the box brings it back.
    still.addEventListener("change", function () {
      edit(function (t) {
        t.ongoing = still.checked;
        exit.value = t.ongoing ? "" : (t.exit || "");
        exit.disabled = t.ongoing;
      });
    });
    node.querySelector(".btn-remove").addEventListener("click", function () {
      var pos = Array.prototype.indexOf.call(tripList.children, node);
      trips = trips.filter(function (t) { return t.id !== id; });
      saveTrips();
      renderTrips();
      // Keep keyboard and screen reader users in place: the trip that moved
      // up into this spot, the one before it, or Add trip when none are left.
      var buttons = tripList.querySelectorAll(".btn-remove");
      (buttons[Math.min(pos, buttons.length - 1)] || document.getElementById("add-trip")).focus();
    });
    return node;
  }

  /** Redraw every row from scratch. */
  function renderTrips() {
    tripList.replaceChildren();
    trips.forEach(function (trip) { tripList.appendChild(buildRow(trip)); });
    emptyState.hidden = trips.length > 0;
    update();
  }

  /**
   * Bring the rows in line with the trips without redrawing them: keep each
   * existing row (and whatever has focus in it), add new ones, drop removed
   * ones, and move rows only when the order changed.
   */
  function syncRows() {
    var rows = {};
    Array.prototype.forEach.call(tripList.children, function (node) { rows[node.getAttribute("data-id")] = node; });
    trips.forEach(function (trip, i) {
      var node = rows[trip.id];
      if (node) { fillRow(node, trip); delete rows[trip.id]; }
      else node = buildRow(trip);
      if (tripList.children[i] !== node) tripList.insertBefore(node, tripList.children[i] || null);
    });
    Object.keys(rows).forEach(function (id) { rows[id].remove(); });
    emptyState.hidden = trips.length > 0;
    update();
  }

  /** The check date to count with: the picked date, or today while the field is empty, half typed, or unusable. */
  function checkDate() {
    var value = referenceInput.value;
    return C.isUsableDate(value) ? value : C.todayIso();
  }

  var TRIP_ERRORS = {
    badEntry: "This entry date can't be used. Check the year.",
    badExit: "This departure date can't be used. Check the year.",
    backwards: "Departure date must be on or after the entry date.",
    noExit: "Add a departure date. This trip counts no days until it has one.",
    noEntry: "Add an entry date. This trip counts no days until it has one.",
    startsLater: "This trip starts after the check date, so it counts no days yet."
  };

  function tripProblem(trip, reference) {
    if (trip.entry && !C.isUsableDate(trip.entry)) return "badEntry";
    if (trip.ongoing) {
      if (!trip.entry) return "noEntry";
      return C.toDayNumber(trip.entry) > C.toDayNumber(reference) ? "startsLater" : "";
    }
    if (trip.exit && !C.isUsableDate(trip.exit)) return "badExit";
    if (trip.entry && trip.exit) return C.toDayNumber(trip.exit) < C.toDayNumber(trip.entry) ? "backwards" : "";
    return trip.entry ? "noExit" : trip.exit ? "noEntry" : "";
  }

  function update() {
    var reference = checkDate();
    var result = C.daysInWindow(trips, reference);
    var status = C.statusFor(result.total);
    var position = {};
    trips.forEach(function (t, i) { position[t.id] = i; });

    // A check date that can't be used: say so, and count to today meanwhile.
    var badCheck = !!referenceInput.value && !C.isUsableDate(referenceInput.value);
    checkError.textContent = badCheck ? "This date can't be used, so the totals count to today. Check the year." : "";
    checkError.hidden = !badCheck;

    // Per-trip counts and validation.
    Array.prototype.forEach.call(tripList.children, function (node, i) {
      var trip = tripById(node.getAttribute("data-id"));
      if (!trip) return; // removed in another tab; the list redraws when editing ends
      var problem = tripProblem(trip, reference);
      node.classList.toggle("invalid", !!problem);
      var error = node.querySelector(".trip-error");
      if (error.textContent !== (problem ? TRIP_ERRORS[problem] : "")) error.textContent = problem ? TRIP_ERRORS[problem] : "";
      error.hidden = !problem;
      // Name each Remove button after its trip, so screen readers can tell them apart.
      // Name each Remove button and checkbox after its trip, so screen readers can tell them apart.
      var country = C.countryByCode(trip.country);
      var which = "trip " + (i + 1) + (country ? ", " + country.name : "");
      node.querySelector(".btn-remove").setAttribute("aria-label", "Remove " + which);
      node.querySelector(".trip-still").setAttribute("aria-label",
        "Still in the Schengen Area, " + which + ". Counts through the check date.");
      var value = node.querySelector(".trip-days-value");
      var length = C.tripLength(trip, reference);
      var counted = result.perTrip[position[trip.id]];
      value.textContent = formatNumber(counted);
      value.title = length && counted !== length
        ? counted + " of " + length + " trip days fall inside the 180 day window"
        : "";
    });

    // At the trip limit, explain why Add trip is off.
    var full = trips.length >= C.MAX_TRIPS;
    document.getElementById("add-trip").disabled = full;
    document.getElementById("trip-limit").hidden = !full;

    // Summary.
    var summary = document.getElementById("summary");
    summary.className = "summary status-" + status;
    document.getElementById("total-days").textContent = formatNumber(result.total);
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
      ? formatNumber(remaining) + (remaining === 1 ? " day" : " days") + " remaining in this window."
      : "Exceeded by " + formatNumber(-remaining) + (remaining === -1 ? " day." : " days.");

    var meter = document.getElementById("meter");
    meter.setAttribute("aria-valuenow", String(Math.min(result.total, 90)));
    document.getElementById("meter-fill").style.width = Math.min(result.total / 90, 1) * 100 + "%";

    updateMap();
    if (typeof updateShareLinks === "function") { updateShareLinks(); prepareShareFile(); }

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
    var names = C.COUNTRIES.filter(function (c) { return chosen[c.code]; }).map(function (c) { return c.name; });
    var summary = document.getElementById("map-summary");
    summary.textContent = names.length ? "In your trips (" + formatNumber(names.length) + "): " + names.join(", ") : "";
    summary.hidden = !names.length;
  }

  /*
   * Dates, times, and numbers use the device's own settings (language and
   * region), so visitors see the formats they are used to. Saved data, CSV,
   * JSON, and file names keep YYYY-MM-DD so other programs can read them.
   */
  function formatDate(iso) {
    // Date-only values are stored as UTC midnight; format them in UTC so the day never shifts.
    var d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  }
  function formatDateTime(isoTimestamp) {
    // A real moment in time: shown in the device's own time zone and 12 or 24 hour clock.
    return new Date(isoTimestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
  var numberFormat = new Intl.NumberFormat();
  function formatNumber(n) { return numberFormat.format(n); }
  var DEVICE_FORMAT = { date: formatDate, dateTime: formatDateTime, number: formatNumber };

  document.getElementById("add-trip").addEventListener("click", function () {
    if (trips.length >= C.MAX_TRIPS) return;
    trips.push({ id: C.newTripId(), country: "", entry: "", exit: "", ongoing: false });
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

  referenceInput.addEventListener("change", function () {
    var value = referenceInput.value;
    // Picking today goes back to following today. An empty value while the
    // field has focus is a date being typed, so leave the choice alone.
    if (value) followToday = value === C.todayIso();
    else if (document.activeElement !== referenceInput) followToday = true;
    update();
  });
  referenceInput.addEventListener("blur", function () {
    // Left empty: follow today again.
    if (!referenceInput.value) { followToday = true; refreshToday(); }
  });

  // Move the check date to the new day at midnight, and when the page comes
  // back after the device slept, unless the visitor picked a date.
  function refreshToday() {
    // Never overwrite a date the visitor is typing.
    if (!followToday || document.activeElement === referenceInput) return;
    var today = C.todayIso();
    if (referenceInput.value !== today) {
      referenceInput.value = today;
      update();
    }
  }
  function scheduleMidnight() {
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    setTimeout(function () { refreshToday(); scheduleMidnight(); }, next - now);
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshToday(); });
  window.addEventListener("focus", refreshToday);
  window.addEventListener("pageshow", refreshToday);
  scheduleMidnight();

  // Another tab changed the trips: show its list here too, so this tab's
  // next save does not overwrite them. Rows are updated in place, so a date
  // being typed here keeps its focus and its unfinished parts.
  window.addEventListener("storage", function (e) {
    if (e.key !== STORAGE_KEY && e.key !== null) return;
    var data = readSaved();
    if (!data) return;
    resetClear();
    // The trip being edited here keeps this tab's values.
    var active = document.activeElement;
    var row = active && tripList.contains(active) ? active.closest("li") : null;
    var mine = row ? tripById(row.getAttribute("data-id")) : null;
    trips = data.trips.map(function (t) { return mine && t.id === mine.id ? mine : t; });
    syncRows();
  });

  // Export the record as CSV, JSON, or plain text.
  var X = window.SchengenExport;
  var exportStatus = document.getElementById("export-status");
  var exportStatusTimer = null;

  function currentExport(format) {
    var reference = checkDate();
    var record = X.buildRecord(trips, reference);
    return {
      text: X.FORMATS[format].serialize(record, DEVICE_FORMAT),
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

  /*
   * A button that opens a short list of file formats. Picking one runs
   * onChoose(format) and closes the list. Works with mouse, touch, and keyboard
   * (arrow keys move between formats, Escape closes).
   */
  var openMenu = null;
  function setupFormatMenu(buttonId, menuId, onChoose) {
    var button = document.getElementById(buttonId);
    var list = document.getElementById(menuId);
    var items = Array.prototype.slice.call(list.querySelectorAll('[role^="menuitem"]'));
    var wrap = button.parentNode;

    function close(returnFocus) {
      list.hidden = true;
      wrap.classList.remove("open-up");
      button.setAttribute("aria-expanded", "false");
      if (openMenu && openMenu.list === list) openMenu = null;
      if (returnFocus) button.focus();
    }
    function open(focusIndex) {
      if (openMenu) openMenu.close(false);
      list.hidden = false;
      button.setAttribute("aria-expanded", "true");
      // Open upward when there is not enough room below the button.
      var rect = list.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 8 && button.getBoundingClientRect().top > rect.height + 8) {
        wrap.classList.add("open-up");
      }
      // If the list still runs past the screen edge, scroll it into view.
      var placed = list.getBoundingClientRect();
      if (placed.bottom > window.innerHeight || placed.top < 0) list.scrollIntoView({ block: "nearest" });
      openMenu = { list: list, close: close, wrap: wrap };
      // Start on the checked item when the list has one (the color schemes).
      var checked = items.filter(function (it) { return it.getAttribute("aria-checked") === "true"; })[0];
      (focusIndex === undefined && checked ? checked : items[focusIndex || 0]).focus();
    }

    button.addEventListener("click", function () {
      if (button.disabled) return;
      if (list.hidden) open(); else close(true);
    });
    button.addEventListener("keydown", function (e) {
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !button.disabled) {
        e.preventDefault();
        open(e.key === "ArrowUp" ? items.length - 1 : 0);
      }
    });
    items.forEach(function (item, i) {
      item.addEventListener("click", function () {
        close(true);
        onChoose(item.getAttribute("data-format"));
      });
      item.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowDown") next = (i + 1) % items.length;
        else if (e.key === "ArrowUp") next = (i - 1 + items.length) % items.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = items.length - 1;
        else if (e.key === "Escape") { e.preventDefault(); close(true); return; }
        else if (e.key === "Tab") { close(false); return; }
        if (next !== null) { e.preventDefault(); items[next].focus(); }
      });
    });
  }
  // Close an open menu when the visitor clicks or taps anywhere else.
  document.addEventListener("click", function (e) {
    if (openMenu && !openMenu.wrap.contains(e.target)) openMenu.close(false);
  });

  // Appearance panel: Auto / Light / Dark mode and the color schemes.
  var S = window.SchengenScheme;
  var T = window.SchengenTheme;
  var appearanceButton = document.getElementById("appearance-button");
  var appearancePanel = document.getElementById("appearance-panel");
  var schemeList = document.getElementById("scheme-list");
  var modeHint = document.getElementById("mode-hint");

  // Built with createElement and textContent (no HTML strings), so the page
  // works under the strict Trusted Types policy.
  function el(tag, className, text, hidden) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    if (hidden) node.setAttribute("aria-hidden", "true");
    return node;
  }
  S.SCHEMES.forEach(function (s) {
    var option = el("label", "scheme-option");
    var input = document.createElement("input");
    input.type = "radio";
    input.name = "scheme";
    input.value = s.id;
    var swatch = el("span", "scheme-swatch", "", true);
    s.stripe.forEach(function (c) {
      var bar = document.createElement("i");
      bar.style.background = c; // set through the style object, which the policy allows
      swatch.appendChild(bar);
    });
    option.append(
      input,
      el("span", "scheme-flag", s.flag, true),
      el("span", "scheme-name", s.name + (s.id === "europe" ? " (default)" : "")),
      swatch,
      el("span", "scheme-check", "\u2713", true)
    );
    schemeList.appendChild(option);
  });

  function syncAppearance() {
    var mode = T.get();
    Array.prototype.forEach.call(appearancePanel.querySelectorAll('input[name="mode"]'), function (r) { r.checked = r.value === mode; });
    var scheme = S.current();
    Array.prototype.forEach.call(schemeList.querySelectorAll('input[name="scheme"]'), function (r) { r.checked = r.value === scheme; });
    modeHint.textContent = mode === "auto"
      ? "Follows your device, which is set to " + T.effective() + " right now."
      : "Always " + mode + ", whatever your device is set to.";
  }

  appearancePanel.addEventListener("change", function (e) {
    if (e.target.name === "mode") T.set(e.target.value);
    if (e.target.name === "scheme") S.choose(e.target.value);
    syncAppearance();
  });
  if (T.media && T.media.addEventListener) T.media.addEventListener("change", syncAppearance);

  function openAppearance() {
    syncAppearance();
    appearancePanel.hidden = false;
    appearanceButton.setAttribute("aria-expanded", "true");
    appearancePanel.querySelector('input[name="mode"]:checked').focus();
  }
  function closeAppearance(returnFocus) {
    if (appearancePanel.hidden) return;
    appearancePanel.hidden = true;
    appearanceButton.setAttribute("aria-expanded", "false");
    if (returnFocus) appearanceButton.focus();
  }
  appearanceButton.addEventListener("click", function () {
    if (appearancePanel.hidden) openAppearance(); else closeAppearance(true);
  });
  appearancePanel.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); closeAppearance(true); }
  });
  document.addEventListener("click", function (e) {
    if (!appearancePanel.hidden && !appearancePanel.parentNode.contains(e.target)) closeAppearance(false);
  });
  // Close when keyboard focus leaves the panel.
  appearancePanel.addEventListener("focusout", function (e) {
    if (e.relatedTarget && !appearancePanel.parentNode.contains(e.relatedTarget)) closeAppearance(false);
  });

  setupFormatMenu("export-download", "export-menu", function (format) {
    if (!trips.length) return;
    var out = currentExport(format);
    // A byte order mark helps Excel read accented and non-Latin country names in CSV files.
    var body = out.format === "csv" ? "\uFEFF" + out.text : out.text;
    if (downloadBlob(new Blob([body], { type: out.mime }), out.name)) {
      showExportStatus("Downloaded " + out.name + ".");
    }
  });

  /*
   * Save a file. Returns false (and explains what to do) when this browser
   * cannot save files, so callers never report a download that did not happen.
   */
  var D = window.SchengenDevice;
  var DOWNLOAD_HELP = D.inAppBrowser
    ? "This in-app browser can't save files. Open this page in Safari or Chrome to download, then add it to your Home Screen for one-tap access."
    : "This browser can't save files. Add this page to your Home Screen, then download from there.";

  function remindHomeScreen() {
    if (window.SchengenInstall) window.SchengenInstall.remind();
  }

  // Point out the limit next to each Download button before anyone taps it.
  if (!D.canDownload) {
    Array.prototype.forEach.call(document.querySelectorAll(".download-note"), function (note) {
      note.querySelector(".download-note-text").textContent = DOWNLOAD_HELP;
      note.querySelector(".download-note-button").addEventListener("click", remindHomeScreen);
      note.hidden = false;
    });
  }

  function downloadBlob(blob, name) {
    if (!D.canDownload) {
      // The note beside the button already explains why; show the steps.
      remindHomeScreen();
      return false;
    }
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return true;
  }

  // Download the map as SVG, PNG, or JPG, in the colors currently on screen.
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

  // Downloaded maps get a title band on top and the site address below.
  var FRAME = { header: 118, footer: 58 };
  var SITE_URL = "90days.alltripsconsidered.com";
  var SERIF = '"Instrument Serif", Georgia, "Times New Roman", serif';

  function frameColors() {
    var t = getComputedStyle(document.documentElement);
    function v(n) { return t.getPropertyValue(n).trim(); }
    return { bg: v("--surface"), brand: v("--brand-link"), text: v("--text"), muted: v("--muted"), line: v("--border"),
      sans: getComputedStyle(document.body).fontFamily };
  }

  function escapeXml(str) { return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  // SVG file: the map plus title and address as real text.
  function framedSvg(map, fontDataUrl) {
    var c = frameColors();
    var w = map.width, h = map.height + FRAME.header + FRAME.footer;
    var inner = map.text.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">' +
      (fontDataUrl ? '<style>@font-face { font-family: "Instrument Serif"; src: url("' + fontDataUrl + '") format("woff2"); }</style>' : "") +
      '<rect width="' + w + '" height="' + h + '" fill="' + c.bg + '"/>' +
      '<text x="' + w / 2 + '" y="58" text-anchor="middle" font-family="' + escapeXml(SERIF) + '" font-size="46" fill="' + c.brand + '">All Trips Considered</text>' +
      '<text x="' + w / 2 + '" y="96" text-anchor="middle" font-family="' + escapeXml(c.sans) + '" font-size="24" font-weight="700" fill="' + c.text + '">Schengen 90/180 Calculator \uD83C\uDDEA\uD83C\uDDFA</text>' +
      '<g transform="translate(0 ' + FRAME.header + ')">' + inner + '</g>' +
      '<text x="' + w / 2 + '" y="' + (h - 22) + '" text-anchor="middle" font-family="' + escapeXml(c.sans) + '" font-size="18" fill="' + c.muted + '">' + SITE_URL + '</text>' +
      '</svg>';
  }

  // PNG and JPG: draw the map, then write the text with the page's own fonts.
  function drawFramed(map, mapImg) {
    var c = frameColors();
    var w = map.width, h = map.height + FRAME.header + FRAME.footer;
    var canvas = document.createElement("canvas");
    canvas.width = w * MAP_SCALE;
    canvas.height = h * MAP_SCALE;
    var ctx = canvas.getContext("2d");
    ctx.scale(MAP_SCALE, MAP_SCALE);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(mapImg, 0, FRAME.header, map.width, map.height);
    ctx.textAlign = "center";
    ctx.fillStyle = c.brand;
    ctx.font = "46px " + SERIF;
    ctx.fillText("All Trips Considered", w / 2, 58);
    ctx.fillStyle = c.text;
    ctx.font = "700 24px " + c.sans;
    ctx.fillText("Schengen 90/180 Calculator \uD83C\uDDEA\uD83C\uDDFA", w / 2, 96);
    ctx.fillStyle = c.muted;
    ctx.font = "18px " + c.sans;
    ctx.fillText(SITE_URL, w / 2, h - 22);
    return canvas;
  }

  // Build the framed map image as a Blob (PNG or JPG).
  function mapImageBlob(format) {
    return new Promise(function (resolve, reject) {
      var map = standaloneMapSvg();
      var url = URL.createObjectURL(new Blob([map.text], { type: "image/svg+xml" }));
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        // Make sure the title font is ready before writing text onto the image.
        var fontsReady = document.fonts && document.fonts.load ? document.fonts.load('46px "Instrument Serif"').catch(function () {}) : Promise.resolve();
        fontsReady.then(function () {
          drawFramed(map, img).toBlob(function (blob) {
            if (blob) resolve(blob); else reject(new Error("no image"));
          }, format === "jpg" ? "image/jpeg" : "image/png", 0.92);
        });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("no image")); };
      img.src = url;
    });
  }

  var fontPromise = null;
  function embeddedFont() {
    if (!fontPromise) {
      fontPromise = fetch("fonts/instrument-serif-v5-latin.woff2")
        .then(function (r) { if (!r.ok) throw new Error("font"); return r.blob(); })
        .then(function (blob) {
          return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        });
      fontPromise.catch(function () { fontPromise = null; });
    }
    return fontPromise;
  }

  function mapFileName(format) {
    return "schengen-map-" + checkDate() + "." + format;
  }

  setupFormatMenu("map-download", "map-menu", function (format) {
    var name = mapFileName(format);
    if (format === "svg") {
      // Embed the self-hosted font so the file is complete on its own and makes no outside requests.
      var save = function (fontDataUrl) {
        var svgText = '<?xml version="1.0" encoding="UTF-8"?>\n' + framedSvg(standaloneMapSvg(), fontDataUrl);
        if (downloadBlob(new Blob([svgText], { type: "image/svg+xml" }), name)) showMapStatus("Downloaded " + name + ".");
      };
      embeddedFont().then(save, function () { save(null); });
      return;
    }
    mapImageBlob(format).then(function (blob) {
      if (downloadBlob(blob, name)) showMapStatus("Downloaded " + name + ".");
    }, function () { showMapStatus("This browser could not create the image. Try SVG instead."); });
  });

  /*
   * Share map.
   * Phones (and browsers that can share files) open the device share sheet
   * with the map image attached. Other browsers get a menu of social links
   * that share the site address with a short message.
   */
  var SHARE_URL = "https://" + SITE_URL + "/";
  var shareButton = document.getElementById("share-map");
  var shareMenu = document.getElementById("share-menu");

  function shareText() {
    var reference = checkDate();
    var total = C.daysInWindow(trips, reference).total;
    var countries = {};
    trips.forEach(function (t) { if (t.country) countries[t.country] = true; });
    var n = Object.keys(countries).length;
    if (!trips.length || !n) return "Check your Schengen 90/180 days with this free calculator.";
    var places = n + (n === 1 ? " country" : " countries");
    var today = C.todayIso();
    // Today: days used. A future check date is a plan. A past one is a look back.
    if (reference === today) return "My Schengen map: " + places + ", " + total + " of 90 days used in the last 180 days. Check yours:";
    if (reference > today) return "My Schengen plan: " + places + ", " + total + " of 90 days by " + formatDate(reference) + ". Check yours:";
    return "My Schengen map: " + places + ", " + total + " of 90 days used in the 180 days ending " + formatDate(reference) + ". Check yours:";
  }

  function canShareFiles() {
    try {
      return !!(navigator.share && navigator.canShare &&
        navigator.canShare({ files: [new File([""], "map.png", { type: "image/png" })] }));
    } catch (e) { return false; }
  }

  // Keep the social links current with the visitor's numbers.
  function updateShareLinks() {
    var text = shareText();
    var links = {
      x: "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(SHARE_URL),
      bluesky: "https://bsky.app/intent/compose?text=" + encodeURIComponent(text + " " + SHARE_URL),
      facebook: "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(SHARE_URL),
      linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(SHARE_URL),
      whatsapp: "https://wa.me/?text=" + encodeURIComponent(text + " " + SHARE_URL),
      pinterest: "https://pinterest.com/pin/create/button/?url=" + encodeURIComponent(SHARE_URL) +
        "&media=" + encodeURIComponent(SHARE_URL + "icons/icon-512.png") + "&description=" + encodeURIComponent(text),
      reddit: "https://www.reddit.com/submit?url=" + encodeURIComponent(SHARE_URL) + "&title=" + encodeURIComponent(text),
      threads: "https://www.threads.net/intent/post?text=" + encodeURIComponent(text + " " + SHARE_URL)
    };
    Object.keys(links).forEach(function (k) {
      shareMenu.querySelector('[data-format="' + k + '"]').setAttribute("href", links[k]);
    });
  }

  // Prepare the image ahead of time so the share sheet opens right away
  // (some phones only allow sharing straight after a tap).
  var shareFile = null;
  var shareTimer = null;
  function prepareShareFile() {
    if (!canShareFiles()) return;
    clearTimeout(shareTimer);
    shareFile = null;
    shareTimer = setTimeout(function () {
      mapImageBlob("png").then(function (blob) {
        shareFile = new File([blob], mapFileName("png"), { type: "image/png" });
      }, function () {});
    }, 500);
  }

  function nativeShare() {
    var go = function (file) {
      return navigator.share({ files: [file], title: "My Schengen map", text: shareText() + " " + SHARE_URL });
    };
    var pending = shareFile ? go(shareFile) : mapImageBlob("png").then(function (blob) {
      shareFile = new File([blob], mapFileName("png"), { type: "image/png" });
      return go(shareFile);
    });
    pending.catch(function (err) {
      if (err && err.name === "AbortError") return; // the visitor closed the share sheet
      showMapStatus("Sharing did not open. Tap Share again, or use Download.");
    });
  }

  if (canShareFiles()) {
    // Use the device share sheet: no menu needed.
    shareButton.removeAttribute("aria-haspopup");
    shareButton.removeAttribute("aria-controls");
    shareButton.removeAttribute("aria-expanded");
    shareButton.querySelector(".menu-chevron").remove();
    shareMenu.remove();
    shareButton.addEventListener("click", nativeShare);
  } else {
    setupFormatMenu("share-map", "share-menu", function (choice) {
      if (choice === "instagram") {
        // Instagram only accepts posts from its app, so save the image and copy the caption.
        mapImageBlob("png").then(function (blob) {
          if (!downloadBlob(blob, mapFileName("png"))) return;
          var caption = shareText() + " " + SHARE_URL;
          var msg = "Map image saved. Post it from the Instagram app";
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(caption).then(function () {
              showMapStatus(msg + ". The caption is copied, so you can paste it.");
            }, function () { showMapStatus(msg + "."); });
          } else { showMapStatus(msg + "."); }
        }, function () { showMapStatus("This browser could not create the image. Use Download instead."); });
        return;
      }
      if (choice !== "copy") return; // social links open in a new tab on their own
      function done(ok) { showMapStatus(ok ? "Link copied: " + SHARE_URL : "Copy this link: " + SHARE_URL); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(SHARE_URL).then(function () { done(true); }, function () { done(false); });
      } else { done(false); }
    });
  }

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
