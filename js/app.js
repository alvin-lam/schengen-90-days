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
  var exportStatus = document.getElementById("export-status");
  var exportStatusTimer = null;

  function currentExport(format) {
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

  S.SCHEMES.forEach(function (s) {
    var option = document.createElement("label");
    option.className = "scheme-option";
    var swatch = s.stripe.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("");
    option.innerHTML = '<input type="radio" name="scheme" value="' + s.id + '">' +
      '<span class="scheme-flag" aria-hidden="true">' + s.flag + '</span>' +
      '<span class="scheme-name">' + s.name + (s.id === "europe" ? " (default)" : "") + '</span>' +
      '<span class="scheme-swatch" aria-hidden="true">' + swatch + '</span>' +
      '<span class="scheme-check" aria-hidden="true">\u2713</span>';
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
  function framedSvg(map) {
    var c = frameColors();
    var w = map.width, h = map.height + FRAME.header + FRAME.footer;
    var inner = map.text.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">' +
      '<style>@import url("https://fonts.googleapis.com/css2?family=Instrument+Serif&amp;display=swap");</style>' +
      '<rect width="' + w + '" height="' + h + '" fill="' + c.bg + '"/>' +
      '<text x="' + w / 2 + '" y="58" text-anchor="middle" font-family="' + escapeXml(SERIF) + '" font-size="46" fill="' + c.brand + '">All Trips Considered</text>' +
      '<text x="' + w / 2 + '" y="96" text-anchor="middle" font-family="' + escapeXml(c.sans) + '" font-size="24" font-weight="700" fill="' + c.text + '">Schengen 90/180 Calculator</text>' +
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
    ctx.fillText("Schengen 90/180 Calculator", w / 2, 96);
    ctx.fillStyle = c.muted;
    ctx.font = "18px " + c.sans;
    ctx.fillText(SITE_URL, w / 2, h - 22);
    return canvas;
  }

  setupFormatMenu("map-download", "map-menu", function (format) {
    var map = standaloneMapSvg();
    var name = "schengen-map-" + (referenceInput.value || C.todayIso()) + "." + format;
    if (format === "svg") {
      downloadBlob(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + framedSvg(map)], { type: "image/svg+xml" }), name);
      showMapStatus("Downloaded " + name + ".");
      return;
    }
    function fail() { showMapStatus("This browser could not create the image. Try SVG instead."); }
    var url = URL.createObjectURL(new Blob([map.text], { type: "image/svg+xml" }));
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      // Make sure the title font is ready before writing text onto the image.
      var fontsReady = document.fonts && document.fonts.load ? document.fonts.load('46px "Instrument Serif"').catch(function () {}) : Promise.resolve();
      fontsReady.then(function () {
        drawFramed(map, img).toBlob(function (blob) {
          if (!blob) { fail(); return; }
          downloadBlob(blob, name);
          showMapStatus("Downloaded " + name + ".");
        }, format === "jpg" ? "image/jpeg" : "image/png", 0.92);
      });
    };
    img.onerror = function () { URL.revokeObjectURL(url); fail(); };
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
