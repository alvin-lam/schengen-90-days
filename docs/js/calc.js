/*
 * Schengen 90/180 calculation helpers.
 * Dates are handled as UTC day numbers so time zones and daylight saving
 * changes never shift a day.
 */
(function (root) {
  "use strict";

  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var WINDOW_DAYS = 180;

  var K = (typeof module !== "undefined" && module.exports)
    ? require("./countries.js")
    : root.SchengenCountries;
  var COUNTRIES = K.COUNTRIES;
  var SCHENGEN_COUNTRIES = COUNTRIES.map(function (c) { return c.name; });

  /** Dropdown label, e.g. "Germany | Deutschland | 🇩🇪". */
  function countryLabel(country) {
    return country.name + " | " + country.native + " | " + country.flag;
  }

  /** Convert "YYYY-MM-DD" into an integer day number (days since epoch, UTC). */
  function toDayNumber(isoDate) {
    // Only the exact form a date input produces, so "2026-5-1" or "1e3-01-01" never counts.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate))) return NaN;
    var parts = String(isoDate).split("-");
    var y = Number(parts[0]), m = Number(parts[1]), d = Number(parts[2]);
    var ms = Date.UTC(y, m - 1, d);
    var check = new Date(ms);
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
      return NaN;
    }
    return Math.round(ms / MS_PER_DAY);
  }

  /** Convert a day number back to "YYYY-MM-DD". */
  function toIsoDate(dayNumber) {
    return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
  }

  /** Today's date in the user's local calendar, as "YYYY-MM-DD". */
  function todayIso() {
    var now = new Date();
    var mm = String(now.getMonth() + 1).padStart(2, "0");
    var dd = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + mm + "-" + dd;
  }

  /**
   * Count the days spent in the Schengen Area inside the 180-day window
   * that ends on (and includes) referenceDate. Entry and exit days both
   * count as full days. Overlapping trips are never double counted.
   */
  function daysInWindow(trips, referenceDate) {
    var end = toDayNumber(referenceDate);
    if (isNaN(end)) {
      // No valid check date: nothing to count, and never throw.
      return { total: 0, perTrip: trips.map(function () { return 0; }), windowStart: "", windowEnd: "" };
    }
    var start = end - (WINDOW_DAYS - 1);
    var counted = new Set();
    var perTrip = [];

    trips.forEach(function (trip) {
      var entry = toDayNumber(trip.entry);
      var exit = toDayNumber(trip.exit);
      var inWindow = 0;
      if (!isNaN(entry) && !isNaN(exit) && exit >= entry) {
        var from = Math.max(entry, start);
        var to = Math.min(exit, end);
        for (var day = from; day <= to; day++) {
          inWindow++;
          counted.add(day);
        }
      }
      perTrip.push(inWindow);
    });

    return {
      total: counted.size,
      perTrip: perTrip,
      windowStart: toIsoDate(start),
      windowEnd: toIsoDate(end)
    };
  }

  /** Map a day total to a status level. */
  function statusFor(total) {
    if (total <= 45) return "green";
    if (total <= 60) return "yellow";
    if (total <= 90) return "red";
    return "black";
  }

  var STATUS_LABELS = {
    green: "Well within the limit",
    yellow: "More than half of the 90 days used",
    red: "Close to the 90 day limit",
    black: "Over the 90 day limit"
  };

  /** Length of a single trip in days (entry and exit inclusive). */
  function tripLength(trip) {
    var entry = toDayNumber(trip.entry);
    var exit = toDayNumber(trip.exit);
    if (isNaN(entry) || isNaN(exit) || exit < entry) return 0;
    return exit - entry + 1;
  }

  /* ---------- Saved data ---------- */

  var DATA_VERSION = 2;

  function newTripId() {
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /** A saved date the page can show, or "" so the visitor can pick again. */
  function cleanDate(value) {
    return typeof value === "string" && !isNaN(toDayNumber(value)) ? value : "";
  }

  /**
   * Bring saved data to the current format.
   *   Version 1 (before this change): a plain array of trips that stored the
   *   country's English name, e.g. [{ country: "Germany", entry, exit }].
   *   Version 2: { version: 2, trips: [{ id, country: "DE", entry, exit }] }.
   * Unknown countries and dates a date field cannot show become "", so the
   * trip is kept and the visitor can pick again.
   */
  function upgradeSaved(raw) {
    var list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.trips) ? raw.trips : []);
    var trips = list.filter(function (t) { return t && typeof t === "object"; }).map(function (t) {
      var code = "";
      if (typeof t.country === "string" && t.country) {
        var c = K.byCode(t.country) || K.byName(t.country);
        code = c ? c.code : "";
      }
      return {
        id: typeof t.id === "string" && t.id ? t.id : newTripId(),
        country: code,
        entry: cleanDate(t.entry),
        exit: cleanDate(t.exit)
      };
    });
    return { version: DATA_VERSION, trips: trips };
  }

  var api = {
    countryByCode: K.byCode,
    DATA_VERSION: DATA_VERSION,
    newTripId: newTripId,
    upgradeSaved: upgradeSaved,
    COUNTRIES: COUNTRIES,
    SCHENGEN_COUNTRIES: SCHENGEN_COUNTRIES,
    countryLabel: countryLabel,
    WINDOW_DAYS: WINDOW_DAYS,
    toDayNumber: toDayNumber,
    toIsoDate: toIsoDate,
    todayIso: todayIso,
    daysInWindow: daysInWindow,
    statusFor: statusFor,
    STATUS_LABELS: STATUS_LABELS,
    tripLength: tripLength
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SchengenCalc = api;
  }
})(this);
