/*
 * Schengen 90/180 calculation helpers.
 * Dates are handled as UTC day numbers so time zones and daylight saving
 * changes never shift a day.
 */
(function (root) {
  "use strict";

  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var WINDOW_DAYS = 180;

  // Schengen Area members (29 countries as of 2025), with the name used
  // in each country's own official language(s) and its flag emoji.
  var COUNTRIES = [
    { name: "Austria", native: "Österreich", flag: "🇦🇹" },
    { name: "Belgium", native: "België / Belgique / Belgien", flag: "🇧🇪" },
    { name: "Bulgaria", native: "България", flag: "🇧🇬" },
    { name: "Croatia", native: "Hrvatska", flag: "🇭🇷" },
    { name: "Czechia", native: "Česko", flag: "🇨🇿" },
    { name: "Denmark", native: "Danmark", flag: "🇩🇰" },
    { name: "Estonia", native: "Eesti", flag: "🇪🇪" },
    { name: "Finland", native: "Suomi", flag: "🇫🇮" },
    { name: "France", native: "France", flag: "🇫🇷" },
    { name: "Germany", native: "Deutschland", flag: "🇩🇪" },
    { name: "Greece", native: "Ελλάδα", flag: "🇬🇷" },
    { name: "Hungary", native: "Magyarország", flag: "🇭🇺" },
    { name: "Iceland", native: "Ísland", flag: "🇮🇸" },
    { name: "Italy", native: "Italia", flag: "🇮🇹" },
    { name: "Latvia", native: "Latvija", flag: "🇱🇻" },
    { name: "Liechtenstein", native: "Liechtenstein", flag: "🇱🇮" },
    { name: "Lithuania", native: "Lietuva", flag: "🇱🇹" },
    { name: "Luxembourg", native: "Lëtzebuerg", flag: "🇱🇺" },
    { name: "Malta", native: "Malta", flag: "🇲🇹" },
    { name: "Netherlands", native: "Nederland", flag: "🇳🇱" },
    { name: "Norway", native: "Norge", flag: "🇳🇴" },
    { name: "Poland", native: "Polska", flag: "🇵🇱" },
    { name: "Portugal", native: "Portugal", flag: "🇵🇹" },
    { name: "Romania", native: "România", flag: "🇷🇴" },
    { name: "Slovakia", native: "Slovensko", flag: "🇸🇰" },
    { name: "Slovenia", native: "Slovenija", flag: "🇸🇮" },
    { name: "Spain", native: "España", flag: "🇪🇸" },
    { name: "Sweden", native: "Sverige", flag: "🇸🇪" },
    { name: "Switzerland", native: "Schweiz / Suisse / Svizzera", flag: "🇨🇭" }
  ];
  var SCHENGEN_COUNTRIES = COUNTRIES.map(function (c) { return c.name; });

  /** Dropdown label, e.g. "Germany | Deutschland | 🇩🇪". */
  function countryLabel(country) {
    return country.name + " | " + country.native + " | " + country.flag;
  }

  /** Convert "YYYY-MM-DD" into an integer day number (days since epoch, UTC). */
  function toDayNumber(isoDate) {
    var parts = String(isoDate).split("-");
    if (parts.length !== 3) return NaN;
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

  /** Length of a single trip in days (entry and exit inclusive). */
  function tripLength(trip) {
    var entry = toDayNumber(trip.entry);
    var exit = toDayNumber(trip.exit);
    if (isNaN(entry) || isNaN(exit) || exit < entry) return 0;
    return exit - entry + 1;
  }

  var api = {
    COUNTRIES: COUNTRIES,
    SCHENGEN_COUNTRIES: SCHENGEN_COUNTRIES,
    countryLabel: countryLabel,
    WINDOW_DAYS: WINDOW_DAYS,
    toDayNumber: toDayNumber,
    toIsoDate: toIsoDate,
    todayIso: todayIso,
    daysInWindow: daysInWindow,
    statusFor: statusFor,
    tripLength: tripLength
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SchengenCalc = api;
  }
})(this);
