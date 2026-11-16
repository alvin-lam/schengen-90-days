/*
 * Export helpers: turn the visitor's trips into CSV, JSON, or plain text.
 * Pure functions, so they run the same in the browser and in Node tests.
 */
(function (root) {
  "use strict";

  var C = (typeof module !== "undefined" && module.exports)
    ? require("./calc.js")
    : root.SchengenCalc;

  var LIMIT = 90;

  function countryInfo(name) {
    for (var i = 0; i < C.COUNTRIES.length; i++) {
      if (C.COUNTRIES[i].name === name) return C.COUNTRIES[i];
    }
    return null;
  }

  /** Gather everything an export needs into one plain object. */
  function buildRecord(trips, referenceDate, now) {
    var result = C.daysInWindow(trips, referenceDate);
    var status = C.statusFor(result.total);
    return {
      app: "Schengen 90/180 Calculator",
      source: "https://90days.alltripsconsidered.com",
      exportedAt: (now || new Date()).toISOString(),
      checkDate: referenceDate,
      window: { start: result.windowStart, end: result.windowEnd, days: C.WINDOW_DAYS },
      limitDays: LIMIT,
      totalDays: result.total,
      daysRemaining: Math.max(LIMIT - result.total, 0),
      daysOver: Math.max(result.total - LIMIT, 0),
      status: status,
      statusLabel: C.STATUS_LABELS[status],
      trips: trips.map(function (trip, i) {
        var info = countryInfo(trip.country);
        return {
          country: trip.country || "",
          nativeName: info ? info.native : "",
          entryDate: trip.entry || "",
          departureDate: trip.exit || "",
          tripDays: C.tripLength(trip),
          daysInWindow: result.perTrip[i]
        };
      })
    };
  }

  /** Quote a CSV field when it contains a comma, quote, or line break. */
  function csvField(value) {
    var s = String(value);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** One row per trip, ready for Excel, Numbers, or Google Sheets. */
  function toCSV(record) {
    var rows = [["Country", "Native name", "Entry date", "Departure date", "Trip days", "Days in 180-day window"]];
    record.trips.forEach(function (t) {
      rows.push([t.country, t.nativeName, t.entryDate, t.departureDate, t.tripDays, t.daysInWindow]);
    });
    return rows.map(function (r) { return r.map(csvField).join(","); }).join("\r\n") + "\r\n";
  }

  function toJSON(record) {
    return JSON.stringify(record, null, 2) + "\n";
  }

  /** A readable summary for notes, email, or printing. */
  function toTXT(record) {
    var lines = [
      record.app,
      "Exported: " + record.exportedAt.slice(0, 10),
      "",
      "Check date: " + record.checkDate,
      "180-day window: " + record.window.start + " to " + record.window.end,
      "Days in the Schengen Area: " + record.totalDays + " / " + record.limitDays,
      "Status: " + record.statusLabel,
      record.daysOver > 0
        ? "Exceeded by: " + record.daysOver + (record.daysOver === 1 ? " day" : " days")
        : "Days remaining: " + record.daysRemaining,
      "",
      "Trips (" + record.trips.length + ")"
    ];
    record.trips.forEach(function (t, i) {
      var name = t.country ? t.country + (t.nativeName ? " (" + t.nativeName + ")" : "") : "Country not selected";
      var dates = (t.entryDate || "?") + " to " + (t.departureDate || "?");
      lines.push((i + 1) + ". " + name + ": " + dates + ", " + t.tripDays +
        (t.tripDays === 1 ? " day" : " days") + " (" + t.daysInWindow + " in window)");
    });
    lines.push("", "Entry and departure days both count. This record is for general information only and is not legal advice.");
    return lines.join("\n") + "\n";
  }

  var FORMATS = {
    csv: { serialize: toCSV, mime: "text/csv;charset=utf-8", ext: "csv" },
    json: { serialize: toJSON, mime: "application/json;charset=utf-8", ext: "json" },
    txt: { serialize: toTXT, mime: "text/plain;charset=utf-8", ext: "txt" }
  };

  function fileName(format, referenceDate) {
    return "schengen-trips-" + referenceDate + "." + FORMATS[format].ext;
  }

  var api = {
    FORMATS: FORMATS,
    buildRecord: buildRecord,
    toCSV: toCSV,
    toJSON: toJSON,
    toTXT: toTXT,
    fileName: fileName
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SchengenExport = api;
  }
})(this);
